"""Create a traceable bilingual synthetic cast and exact-script auditions locally.

Run with the isolated qwen-cast Python. Model weights stay outside the repository.
"""
import argparse
import hashlib
import json
import pathlib
import time
from datetime import datetime, timezone

import numpy as np
import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

parser = argparse.ArgumentParser()
parser.add_argument('--model', default='D:/DreamChordRuntime/qwen-cast/model')
parser.add_argument('--opening', action='store_true')
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parent.parent
pack = root / 'assets/voice-packs/dreamchord-cast'
output_root = pack / 'generated'
output_root.mkdir(parents=True, exist_ok=True)
script = json.loads((root / '.runtime/official-demo-audio-script.json').read_text(encoding='utf-8'))
cast = [
    dict(id='yuki', name='雪 · 清亮而倔强', speaker='Vivian', genderTone='女声', ageTone='少女', nodeId='s1-d3', direction='年轻清亮的女声，像放学后对朋友说话。惊讶但不尖叫，避免朗诵腔，句末自然收住。'),
    dict(id='ren', name='影 · 克制的锋芒', speaker='Dylan', genderTone='男声', ageTone='青年', nodeId='s3-d3', direction='年轻男子，语气克制、清楚，带一点受伤后的质问。像面对熟悉的人，不要新闻播音或舞台腔。'),
    dict(id='miya', name='宫 · 温柔有分寸', speaker='Serena', genderTone='女声', ageTone='青年', nodeId='s4-d7', direction='温暖自然的年轻女性，平静但有明确的界限，认真对晚辈说话，不甜腻、不朗诵。'),
    dict(id='sora', name='空 · 轻盈的好奇', speaker='Ono_Anna', genderTone='女声', ageTone='少女', nodeId='ending-agency-response', direction='轻盈、清澈的年轻女声，第一次自己作决定，真诚、有一点小心的喜悦。不要机械停顿，不要夸张的幼儿声。'),
    dict(id='ghost', name='守门人 · 低声的记录', speaker='Uncle_Fu', genderTone='男声', ageTone='成熟', nodeId='s8-d2', direction='低沉柔和的叙述声，安静而有人情味。像在讲述自己经历的事情，避免电子音与新闻播报。'),
]
model = Qwen3TTSModel.from_pretrained(args.model, device_map='cuda:0', dtype=torch.bfloat16, attn_implementation='sdpa')
manifest_file = pack / 'manifest.json'
manifest = json.loads(manifest_file.read_text(encoding='utf-8')) if manifest_file.exists() else dict(schemaVersion=1, packId='dreamchord-bilingual-cast', sourceModel='Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice', sourceUrl='https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice', sourceLicense='Apache-2.0', syntheticSource=True, generatedAt=datetime.now(timezone.utc).isoformat(), voices=cast, takes=[])
tasks = [(voice, voice['nodeId'], locale, True) for voice in cast for locale in ['zh', 'ja']]
if args.opening:
    for node in script:
        if node['id'].startswith('s1-d') and node['id'] != 's1-d3':
            voice = next(item for item in cast if item['id'] == node['role'])
            tasks.extend((voice, node['id'], locale, False) for locale in ['zh', 'ja'])

for index, (voice, node_id, locale, reference) in enumerate(tasks):
    take_id = f'{node_id}-{locale}'
    existing = next((item for item in manifest['takes'] if item['id'] == take_id), None)
    if existing and (pack / existing['outputFile']).exists() and hashlib.sha256((pack / existing['outputFile']).read_bytes()).hexdigest() == existing['sha256']:
        print(f'SKIP {take_id}', flush=True)
        continue
    node = next(item for item in script if item['id'] == node_id)
    text = node['text'] if locale == 'zh' else node['localizations']['ja']['text']
    torch.manual_seed(241028 + index)
    started = time.monotonic()
    instruction = voice['direction'] + (' 用自然的普通话。' if locale == 'zh' else ' 日本語で、自然な会話として話してください。')
    wavs, rate = model.generate_custom_voice(text=text, language='Chinese' if locale == 'zh' else 'Japanese', speaker=voice['speaker'], instruct=instruction, max_new_tokens=700, temperature=0.7, top_p=0.8)
    samples = np.asarray(wavs[0], dtype=np.float32)
    duration = len(samples) / rate
    peak = float(np.max(np.abs(samples)))
    rms = float(np.sqrt(np.mean(samples ** 2)))
    if not (0.5 < duration < 45) or not np.isfinite(samples).all() or rms < 0.001:
        raise RuntimeError(f'Audio technical check failed: {take_id}, duration={duration}, RMS={rms}')
    # Only reduce peaks, preserving dynamics rather than overcompressing dialogue.
    if peak > 0.94:
        samples *= 0.94 / peak
    filename = output_root / f'{take_id}.wav'
    sf.write(filename, samples, rate, subtype='PCM_16')
    take = dict(id=take_id, role=voice['id'], speaker=voice['speaker'], nodeId=node_id, language=locale, text=text, isReference=reference, instruction=instruction, outputFile=f'generated/{filename.name}', sha256=hashlib.sha256(filename.read_bytes()).hexdigest(), durationSeconds=round(duration, 3), generationSeconds=round(time.monotonic()-started, 2), sampleRate=rate, rms=round(rms, 5), originalPeak=round(peak, 5), expressiveReview='pending')
    manifest['takes'] = [item for item in manifest['takes'] if item['id'] != take_id] + [take]
    manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'OK {take_id}: {duration:.2f}s, generation {take["generationSeconds"]:.1f}s', flush=True)
print('CAST_READY', flush=True)
