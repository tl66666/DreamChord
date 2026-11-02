"""Reproducible original cast takes; run using isolated qwen-cast Python."""
import hashlib
import json
import pathlib
import time
import argparse
import numpy as np
import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

root = pathlib.Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--limit', type=int, default=0)
parser.add_argument('--retake', nargs='*', default=[])
parser.add_argument('--seed-offset', type=int, default=5000)
args = parser.parse_args()
pack = root / 'assets/voice-packs/seventh-row'
pack.mkdir(parents=True, exist_ok=True)
script = json.loads((root / '.runtime/seventh-row-script.json').read_text(encoding='utf-8'))
voices = [
    dict(id='luyao', name='陆遥 · 雨灯', role='陆遥', speaker='Serena', genderTone='女声', direction='二十四岁的年轻女性，温暖低调，像对很熟悉的朋友说话，语速自然，句末收住。不要朗诵，不要播音腔。'),
    dict(id='chengxia', name='程夏 · 归潮', role='程夏', speaker='Ono_Anna', genderTone='女声', direction='二十四岁的独立女歌手，清晰真诚，自然聊天，有分寸，偶尔带轻微笑意。不要幼儿音，不要舞台朗诵。'),
    dict(id='chenyu', name='陈屿 · 旧磁带', role='陈屿', speaker='Dylan', genderTone='男声', direction='二十六岁的年轻男子，低调克制，自然对话，带一点难以开口的迟疑，避免新闻播音和朗诵腔。'),
]
manifest_path = pack / 'manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else dict(schemaVersion=1, packId='seventh-row', sourceModel='Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice', sourceUrl='https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice', sourceLicense='Apache-2.0', syntheticSource=True, voices=voices, takes=[])
model = Qwen3TTSModel.from_pretrained('D:/DreamChordRuntime/qwen-cast/model', device_map='cuda:0', dtype=torch.bfloat16, attn_implementation='sdpa')
count = 0
for index, node in enumerate(script):
    voice = next(v for v in voices if v['role'] == node['role'])
    for locale in ['ja', 'zh']:
        take_id = node['id'] + '-' + locale
        if args.retake and take_id not in args.retake:
            continue
        text = node['ja'] if locale == 'ja' else node['text']
        target = pack / (take_id + '.wav')
        prior = next((t for t in manifest['takes'] if t['id'] == take_id and t['text'] == text), None)
        if not args.retake and prior and target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == prior['sha256']:
            print('SKIP ' + take_id, flush=True)
            continue
        started = time.monotonic()
        instruction = voice['direction'] if locale == 'zh' else '自然な会話。親しい友達に静かに話しかける。余計なため息や笑い声を入れず、言葉をはっきり話す。'
        if args.retake and locale == 'zh':
            instruction = '认真、平静地对朋友说话。直接说出台词，不加笑声，不加叹息，不加额外语气词。'
        for attempt in range(4):
            torch.manual_seed(73100 + index * 2 + (locale == 'zh') + attempt * 1000 + (args.seed_offset if args.retake else 0))
            wavs, rate = model.generate_custom_voice(text=text, language='Japanese' if locale == 'ja' else 'Chinese', speaker=voice['speaker'], instruct=instruction, max_new_tokens=480, temperature=.65 if attempt == 0 else .8, top_p=.85)
            samples = np.asarray(wavs[0], dtype=np.float32)
            duration, rms, peak = len(samples) / rate, float(np.sqrt(np.mean(samples ** 2))), float(np.max(np.abs(samples)))
            maximum = min(33, max(6, len(text) / (3.5 if locale == 'zh' else 4.5) + 4))
            if np.isfinite(samples).all() and .4 < duration < maximum and rms > .002:
                break
            print(f'RETRY {take_id}: attempt {attempt+1} duration{duration:.1f}s RMS{rms:.4f}', flush=True)
        else:
            raise RuntimeError(f'Audio invalid {take_id}: {duration}s RMS{rms}')
        if peak > .94:
            samples *= .94 / peak
        sf.write(target, samples, rate, subtype='PCM_16')
        take = dict(id=take_id, nodeId=node['id'], role=voice['id'], speaker=voice['speaker'], language=locale, text=text, instruction=instruction, outputFile=target.name, sha256=hashlib.sha256(target.read_bytes()).hexdigest(), durationSeconds=round(duration, 3), sampleRate=rate, rms=round(rms, 5), generationSeconds=round(time.monotonic()-started, 2))
        manifest['takes'] = [t for t in manifest['takes'] if t['id'] != take_id] + [take]
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'OK {take_id} {duration:.1f}s gen{take["generationSeconds"]}s', flush=True)
        count += 1
        if args.limit and count >= args.limit:
            raise SystemExit(0)
print('SEVENTH_ROW_READY', flush=True)
