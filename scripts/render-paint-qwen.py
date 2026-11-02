"""Direct Qwen comparison/publish path: avoid a second voice conversion pass.

Stop GPT-SoVITS before running. Defaults to comparison masters, not production.
Use --publish only after comparing a voice; resumable per engine/text/emotion.
"""
import argparse
import hashlib
import json
import pathlib
import shutil
import time
import numpy as np
import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

ROOT = pathlib.Path(__file__).resolve().parent.parent
PACK = ROOT / 'assets/voice-packs/paint-prologue'
ENGINE = 'Qwen3-TTS-12Hz-1.7B-CustomVoice'
DIRECTIONS = {
    'cheng': '若い男性の自然な日本語の会話。温かく、少し気だるい。友達への軽い自嘲、朗読のように構えない。',
    'xia': '若い女性の自然な日本語の会話。明るく歯切れがよい。親しい友達に話しかける。軽い言い合いは軽快に、怒鳴らない。',
    'ye': '若い男性の自然な日本語の会話。軽快で親しみやすい。舞台の俳優だが、普段は大げさな演技をせず、友達と話す。',
    'lu': '落ち着いた女性の自然な日本語。理性的で静かな記録の声。無感情な機械音や放送のアナウンスのようにしない。',
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--only', nargs='*', default=[])
    parser.add_argument('--publish', action='store_true')
    args = parser.parse_args()
    manifest_path = PACK / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    script = json.loads((ROOT / '.runtime/paint-script.json').read_text(encoding='utf-8-sig'))
    work = []
    section = 'takes' if args.publish else 'directQwenComparisons'
    for index, node in enumerate(script):
        if args.only and node['id'] not in args.only:
            continue
        previous = next((take for take in manifest.setdefault(section, []) if take['nodeId'] == node['id'] and take['text'] == node['ja'] and take['engine'] == ENGINE and take['emotion'] == node['emotion']), None)
        if previous and (PACK / previous['outputFile']).exists() and sha(PACK / previous['outputFile']) == previous['sha256']:
            continue
        work.append((index, node))
    if not work:
        print('QWEN_DIRECT_CURRENT', flush=True)
        return
    model = Qwen3TTSModel.from_pretrained('D:/DreamChordRuntime/qwen-cast/model', device_map='cuda:0', dtype=torch.bfloat16, attn_implementation='sdpa')
    for index, node in work:
        voice = next(voice for voice in manifest['voices'] if node['role'] in (voice['id'], voice['role']))
        serious = node['emotion'] == 'serious'
        direction = DIRECTIONS[voice['id']] + (' 真剣な本音を、静かに率直に伝える。泣き声を入れず、言葉を選ぶ。' if serious else ' 相手との会話の流れを大切に。冗談は軽く、自然な抑揚で。') + ' 指定された台詞だけを読む。余計な笑い声、ため息、音楽を入れない。'
        start = time.monotonic()
        for attempt in range(3):
            seed = 853000 + index * 10 + attempt
            torch.manual_seed(seed)
            parameters = dict(max_new_tokens=520, temperature=.65, top_p=.85)
            wavs, rate = model.generate_custom_voice(text=node['ja'], language='Japanese', speaker=voice['speaker'], instruct=direction, **parameters)
            samples = np.asarray(wavs[0], dtype=np.float32).squeeze()
            duration, rms = len(samples) / rate, float(np.sqrt(np.mean(samples ** 2)))
            if .25 < duration < max(7, len(node['ja']) / 2.8 + 6) and np.isfinite(samples).all() and rms > .002:
                break
        else:
            raise RuntimeError('Invalid Qwen direct take: ' + node['id'])
        target = PACK / (node['id'] + '-ja.wav' if args.publish else 'direct-qwen-' + node['id'] + '-ja.wav')
        previous = next((take for take in manifest[section] if take['nodeId'] == node['id']), None)
        if args.publish and previous and target.exists():
            archive = PACK / 'alternates' / (target.stem + '-' + sha(target)[:12] + '.wav')
            archive.parent.mkdir(exist_ok=True)
            shutil.copy2(target, archive)
            if not any(item['id'] == previous['id'] and item['sha256'] == previous['sha256'] for item in manifest.setdefault('alternates', [])):
                manifest['alternates'].append(dict(previous, outputFile=archive.relative_to(PACK).as_posix(), archiveReason='Direct Qwen preserves voice without second conversion'))
        sf.write(target, samples, rate, subtype='PCM_16')
        take = dict(id=node['id'] + '-ja', nodeId=node['id'], role=voice['id'], roleName=voice['role'], language='ja', displayLanguage='zh', displayText=node['text'], text=node['ja'], synthesisText=node['ja'], emotion=node['emotion'], purpose='dialogue' if args.publish else 'comparison', outputFile=target.name, engine=ENGINE, speaker=voice['speaker'], direction=direction, parameters=parameters, seed=seed, sha256=sha(target), durationSeconds=round(duration, 3), sampleRate=rate, rms=round(rms, 5), peak=round(float(np.max(np.abs(samples))), 5), generationSeconds=round(time.monotonic() - start, 2), source=manifest['referenceSource'], license='Apache-2.0', syntheticSource=True, humanListeningCompleted=False)
        manifest[section] = [item for item in manifest[section] if item['nodeId'] != node['id']] + [take]
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'READY QWEN_DIRECT {node["id"]} {duration:.2f}s gen {take["generationSeconds"]}s', flush=True)


if __name__ == '__main__':
    main()
