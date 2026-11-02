"""Render the original bilingual script through the local GPT-SoVITS v2ProPlus API."""
import argparse, hashlib, io, json, pathlib, time, urllib.request
import numpy as np
import soundfile as sf

parser = argparse.ArgumentParser()
parser.add_argument('--limit', type=int, default=0)
parser.add_argument('--retake', nargs='*', default=[])
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parent.parent
pack = root / 'assets/voice-packs/curtain-call'
manifest_path = pack / 'manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
script = json.loads((root / '.runtime/curtain-script.json').read_text(encoding='utf-8'))
manifest.update(dialogueEngine='GPT-SoVITS', dialogueVersion='v2ProPlus', dialogueSource='https://github.com/RVC-Boss/GPT-SoVITS', dialogueLicense='MIT', trainedCharacterWeights=False)
count = 0
for index, node in enumerate(script):
    role = next(v['id'] for v in manifest['voices'] if v['role'] == node['role'])
    for language in ['zh', 'ja']:
        take_id = node['id'] + '-' + language
        if args.retake and take_id not in args.retake: continue
        text = node['text'] if language == 'zh' else node['ja']
        target = pack / f'{take_id}.wav'
        prior = next((t for t in manifest['takes'] if t['id'] == take_id and t['text'] == text and t.get('engine') == 'GPT-SoVITS-v2ProPlus'), None)
        if not args.retake and prior and target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == prior['sha256']: continue
        reference = next(r for r in manifest['references'] if r['role'] == role and r['language'] == language)
        started = time.monotonic()
        for attempt in range(3):
            seed = 112000 + index * 2 + (language == 'ja') + attempt * 1000 + (10000 if args.retake else 0)
            payload = dict(text=text, text_lang=language, ref_audio_path=str(pack / reference['outputFile']), prompt_text=reference['text'], prompt_lang=language, speed_factor=1.0, seed=seed, text_split_method='cut5', batch_size=1, top_k=15, top_p=.9, temperature=.75, repetition_penalty=1.35, media_type='wav', streaming_mode=False)
            req = urllib.request.Request('http://127.0.0.1:9880/tts', data=json.dumps(payload).encode(), headers={'content-type':'application/json'})
            with urllib.request.urlopen(req, timeout=240) as response: audio = response.read()
            samples, rate = sf.read(io.BytesIO(audio), dtype='float32')
            if samples.ndim != 1: samples = samples.mean(axis=1)
            duration, rms = len(samples) / rate, float(np.sqrt(np.mean(samples**2)))
            maximum = min(35, max(5, len(text) / (3 if language == 'zh' else 4) + 5))
            if .35 < duration < maximum and np.isfinite(samples).all() and rms > .002: break
            print(f'RETRY {take_id}: {duration:.1f}s', flush=True)
        else: raise RuntimeError(f'Invalid take {take_id}: {duration}s')
        sf.write(target, samples, rate, subtype='PCM_16')
        take = dict(id=take_id, nodeId=node['id'], role=role, language=language, text=text, outputFile=target.name, engine='GPT-SoVITS-v2ProPlus', referenceId=reference['id'], referenceSha256=reference['sha256'], seed=seed, sha256=hashlib.sha256(target.read_bytes()).hexdigest(), durationSeconds=round(duration,3), sampleRate=rate, rms=round(rms,5), generationSeconds=round(time.monotonic()-started,2))
        manifest['takes'] = [t for t in manifest['takes'] if t['id'] != take_id] + [take]
        manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(f'READY {take_id} {duration:.2f}s gen {take["generationSeconds"]}s', flush=True)
        count += 1
        if args.limit and count >= args.limit: raise SystemExit(0)
print('CURTAIN_CALL_AUDIO_READY',flush=True)
