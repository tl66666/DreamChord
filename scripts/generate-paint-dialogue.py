"""Render/resume Japanese dialogue with the local GPT-SoVITS v2ProPlus API.

Input: .runtime/paint-script.json [{id,role,text,ja,emotion}].
WAV masters and exact provenance stay in assets/voice-packs/paint-prologue.
"""
import argparse
import hashlib
import http.client
import io
import json
import pathlib
import shutil
import socket
import time
import urllib.request
from urllib.parse import urlparse

import numpy as np
import soundfile as sf

ROOT = pathlib.Path(__file__).resolve().parent.parent
PACK = ROOT / 'assets/voice-packs/paint-prologue'
ENGINE = 'GPT-SoVITS-v2ProPlus'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--script', default=str(ROOT / '.runtime/paint-script.json'))
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--only', nargs='*', default=[])
    parser.add_argument('--retake', action='store_true')
    parser.add_argument('--reason', default='Requested alternate take')
    parser.add_argument('--seed-offset', type=int, default=0)
    parser.add_argument('--split-method', choices=['cut0', 'cut5'], default='cut5', help='Per-line pronunciation directions may override this for targeted retakes')
    parser.add_argument('--api', default='http://127.0.0.1:9880/tts')
    parser.add_argument('--wait-seconds', type=int, default=90)
    args = parser.parse_args()
    manifest_path = PACK / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    script = json.loads(pathlib.Path(args.script).read_text(encoding='utf-8-sig'))
    pronunciation_file = PACK / 'pronunciation-overrides.json'
    pronunciations = json.loads(pronunciation_file.read_text(encoding='utf-8')) if pronunciation_file.exists() else {}
    manifest.update(dialogueEngine='GPT-SoVITS', dialogueVersion='v2ProPlus',
                    dialogueSource='https://github.com/RVC-Boss/GPT-SoVITS', dialogueLicense='MIT',
                    trainedCharacterWeights=False, humanListeningCompleted=False)
    count = 0
    api_ready = False
    for index, node in enumerate(script):
        if not node.get('ja') or not node.get('role'):
            continue
        take_id = node['id'] + '-ja'
        if args.only and node['id'] not in args.only and take_id not in args.only:
            continue
        if not all(c in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in node['id']):
            raise ValueError('Node id must be a safe lowercase filename: ' + node['id'])
        voice = next((v for v in manifest['voices'] if node['role'] in (v['id'], v['role'])), None)
        if voice is None:
            raise ValueError(f'Unknown speaking role: {node["role"]}')
        emotion = node.get('emotion', 'casual')
        serious = any(word in emotion.lower() for word in ['serious', 'quiet', 'sad', 'gentle', 'tender', 'resolve', 'restrain', '认真', '低落', '平静', '克制', '坚定', '温柔'])
        reference_id = voice['id'] + ('-serious' if serious else '-casual')
        reference = next((r for r in manifest['references'] if r['id'] == reference_id), None)
        if reference is None:
            raise ValueError('Reference not generated: ' + reference_id)
        reference_path = PACK / reference['outputFile']
        if digest(reference_path) != reference['sha256']:
            raise ValueError('Reference checksum mismatch: ' + reference_id)
        text = node['ja'].strip()
        pronunciation = pronunciations.get(node['id'], {})
        synthesis_text = pronunciation.get('synthesisText', text)
        split_method = pronunciation.get('textSplitMethod', args.split_method)
        target = PACK / f'{take_id}.wav'
        prior = next((t for t in manifest['takes'] if t['id'] == take_id and t['text'] == text and t.get('synthesisText', t['text']) == synthesis_text and t.get('emotion') == emotion and t.get('referenceSha256') == reference['sha256'] and t.get('parameters', {}).get('text_split_method') == split_method and t.get('engine') == ENGINE), None)
        if not args.retake and prior and target.exists() and digest(target) == prior['sha256']:
            continue
        if not api_ready:
            address = urlparse(args.api)
            deadline = time.monotonic() + args.wait_seconds
            while True:
                try:
                    with socket.create_connection((address.hostname, address.port or 80), timeout=2):
                        pass
                    break
                except OSError:
                    if time.monotonic() >= deadline:
                        raise RuntimeError('Local voice API is not ready. Start the project GPT-SoVITS engine, then resume this command.')
                    time.sleep(.5)
            api_ready = True
        started = time.monotonic()
        for attempt in range(3):
            seed = 842000 + index * 10 + attempt + args.seed_offset + (100000 if args.retake else 0)
            payload = dict(text=synthesis_text, text_lang='ja', ref_audio_path=str(reference_path),
                           prompt_text=reference['text'], prompt_lang='ja', speed_factor=1.0,
                           seed=seed, text_split_method=split_method, batch_size=1,
                           top_k=15, top_p=.9, temperature=.72, repetition_penalty=1.35,
                           media_type='wav', streaming_mode=False)
            request = urllib.request.Request(args.api, data=json.dumps(payload).encode(), headers={'content-type': 'application/json'})
            for connection_attempt in range(4):
                try:
                    with urllib.request.urlopen(request, timeout=240) as response:
                        raw = response.read()
                    break
                except (OSError, http.client.HTTPException) as error:
                    if connection_attempt == 3:
                        raise RuntimeError(f'Voice API interrupted at {take_id}; saved takes are resumable.') from error
                    print(f'API_WAIT {take_id} {type(error).__name__}; retrying after engine startup', flush=True)
                    address = urlparse(args.api)
                    deadline = time.monotonic() + args.wait_seconds
                    time.sleep(2)
                    while time.monotonic() < deadline:
                        try:
                            with socket.create_connection((address.hostname, address.port or 80), timeout=2):
                                pass
                            break
                        except OSError:
                            time.sleep(1)
            samples, rate = sf.read(io.BytesIO(raw), dtype='float32')
            if samples.ndim != 1:
                samples = samples.mean(axis=1)
            duration, rms = len(samples) / rate, float(np.sqrt(np.mean(samples ** 2)))
            if .25 < duration < min(42, max(6, len(text) / 3.4 + 5)) and np.isfinite(samples).all() and rms > .002:
                break
            print(f'RETRY {take_id} duration={duration:.2f}s rms={rms:.5f}', flush=True)
        else:
            raise RuntimeError('Invalid take: ' + take_id)
        previous = next((item for item in manifest['takes'] if item['id'] == take_id), None)
        if previous and target.exists():
            archive = PACK / 'alternates' / f'{take_id}-{digest(target)[:12]}.wav'
            archive.parent.mkdir(exist_ok=True)
            shutil.copy2(target, archive)
            archived = dict(previous, outputFile=archive.relative_to(PACK).as_posix(), archiveReason=args.reason)
            if not any(item['id'] == take_id and item['sha256'] == archived['sha256'] for item in manifest.setdefault('alternates', [])):
                manifest['alternates'].append(archived)
        sf.write(target, samples, rate, subtype='PCM_16')
        parameters = {key: value for key, value in payload.items() if key not in ['text', 'ref_audio_path', 'prompt_text']}
        take = dict(id=take_id, nodeId=node['id'], role=voice['id'], roleName=voice['role'],
                    language='ja', displayLanguage='zh', displayText=node['text'], text=text,
                    synthesisText=synthesis_text, pronunciationNote=pronunciation.get('note'),
                    emotion=emotion, referenceEmotion=reference['emotion'], purpose=node.get('purpose', 'dialogue'), outputFile=target.name,
                    engine=ENGINE, referenceId=reference_id, referenceSha256=reference['sha256'],
                    parameters=parameters, seed=seed, sha256=digest(target), durationSeconds=round(duration, 3),
                    sampleRate=rate, rms=round(rms, 5), peak=round(float(np.max(np.abs(samples))), 5),
                    generationSeconds=round(time.monotonic() - started, 2), humanListeningCompleted=False)
        manifest['takes'] = [t for t in manifest['takes'] if t['id'] != take_id] + [take]
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'READY {take_id} {duration:.2f}s gen {take["generationSeconds"]}s', flush=True)
        count += 1
        if args.limit and count >= args.limit:
            break
    print(f'PAINT_AUDIO_RENDERED {count} new takes', flush=True)


if __name__ == '__main__':
    main()
