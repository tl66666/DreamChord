"""CPU ASR review of completed takes. Recognition supports checks, not an acting-quality claim."""
import json
import pathlib
import time
import re
from difflib import SequenceMatcher
from faster_whisper import WhisperModel

root = pathlib.Path(__file__).resolve().parent.parent
pack = root / 'assets/voice-packs/seventh-row'
report_path = pack / 'asr-review.json'
report = json.loads(report_path.read_text(encoding='utf-8')) if report_path.exists() else []
model = WhisperModel('base', device='cpu', compute_type='int8', cpu_threads=3, download_root='D:/DreamChordRuntime/asr-review')
deadline = time.monotonic() + 1800
def normalize(text):
    return re.sub(r'[^\w\u3040-\u30ff\u4e00-\u9fff]', '', text)
while time.monotonic() < deadline:
    manifest = json.loads((pack / 'manifest.json').read_text(encoding='utf-8'))
    for take in manifest['takes']:
        if any(r['id'] == take['id'] and r.get('sha256') == take['sha256'] for r in report):
            continue
        segments, _ = model.transcribe(str(pack / take['outputFile']), language=take['language'], beam_size=5, temperature=0, condition_on_previous_text=False)
        text = ''.join(s.text for s in segments)
        score = SequenceMatcher(None, normalize(take['text']), normalize(text)).ratio()
        item = dict(id=take['id'], sha256=take['sha256'], expected=take['text'], recognized=text, similarity=round(score, 3), review='check' if score < .55 else 'supporting-pass')
        report = [r for r in report if r['id'] != take['id']] + [item]
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n',encoding='utf-8')
        print(json.dumps(item,ensure_ascii=False),flush=True)
    if len(manifest['takes']) == 70 and len(report) == 70:
        break
    time.sleep(10)
