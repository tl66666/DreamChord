"""Optional CPU ASR check for omissions/repetitions; never grades acting quality."""
import argparse
import json
import pathlib
import re
from difflib import SequenceMatcher

import numpy as np
import soundfile as sf
from faster_whisper import WhisperModel

root = pathlib.Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--only', nargs='*', default=[])
parser.add_argument('--pack', default='paint-prologue')
args = parser.parse_args()
if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', args.pack):
    parser.error('--pack must be a safe lowercase directory id')
pack = root / 'assets/voice-packs' / args.pack
output = pack / 'asr-review.json'
report = json.loads(output.read_text(encoding='utf-8')) if output.exists() else []
manifest = json.loads((pack / 'manifest.json').read_text(encoding='utf-8'))
if manifest.get('packId') != args.pack:
    raise ValueError('Manifest packId does not match --pack')
model = WhisperModel('base', device='cpu', compute_type='int8', cpu_threads=3, download_root='D:/DreamChordRuntime/asr-review')


def norm(text):
    return re.sub(r'[^\w\u3040-\u30ff\u4e00-\u9fff]', '', text)


items = [dict(item, id='reference-' + item['id']) for item in manifest['references']] + manifest['takes']
items += [dict(item, id='direct-qwen-' + item['id']) for item in manifest.get('directQwenComparisons', [])]
for take in items:
    if args.only and take['id'] not in args.only:
        continue
    if any(item['id'] == take['id'] and item['sha256'] == take['sha256'] for item in report):
        continue
    samples, rate = sf.read(pack / take['outputFile'], dtype='float32')
    segments, _ = model.transcribe(str(pack / take['outputFile']), language='ja', beam_size=5, temperature=0, condition_on_previous_text=False)
    recognized = ''.join(segment.text for segment in segments)
    similarity = SequenceMatcher(None, norm(take['text']), norm(recognized)).ratio()
    item = dict(id=take['id'], sha256=take['sha256'], expected=take['text'], recognized=recognized,
                similarity=round(similarity, 3), review='check' if similarity < .55 else 'supporting-pass',
                durationSeconds=round(len(samples) / rate, 3), rms=round(float(np.sqrt(np.mean(samples ** 2))), 5),
                clippedSampleCount=int(np.sum(np.abs(samples) >= .999)), humanListeningCompleted=False,
                limitation='Small CPU ASR can misrecognize natural Japanese. This is not a pronunciation or acting verdict.')
    report = [prior for prior in report if prior['id'] != item['id']] + [item]
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(item, ensure_ascii=False), flush=True)
