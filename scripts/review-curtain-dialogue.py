"""CPU recognition catches omissions/repeats; it does not grade voice acting."""
import json, pathlib, re, time
from difflib import SequenceMatcher
from faster_whisper import WhisperModel
root = pathlib.Path(__file__).resolve().parent.parent
pack = root / 'assets/voice-packs/curtain-call'
output = pack / 'asr-review.json'
report = json.loads(output.read_text(encoding='utf-8')) if output.exists() else []
model = WhisperModel('base', device='cpu', compute_type='int8', cpu_threads=3, download_root='D:/DreamChordRuntime/asr-review')
def norm(t): return re.sub(r'[^\w\u3040-\u30ff\u4e00-\u9fff]', '', t)
deadline = time.monotonic() + 1200
while time.monotonic() < deadline:
    manifest = json.loads((pack / 'manifest.json').read_text(encoding='utf-8'))
    items = [dict(r, id='reference-'+r['id']) for r in manifest['references']] + manifest['takes']
    for take in items:
        if any(r['id'] == take['id'] and r['sha256'] == take['sha256'] for r in report): continue
        segments, _ = model.transcribe(str(pack / take['outputFile']), language=take['language'], beam_size=5, temperature=0, condition_on_previous_text=False)
        text = ''.join(s.text for s in segments)
        score = SequenceMatcher(None,norm(take['text']),norm(text)).ratio()
        item = dict(id=take['id'], sha256=take['sha256'], expected=take['text'], recognized=text, similarity=round(score,3), review='check' if score < .55 else 'supporting-pass')
        report = [r for r in report if r['id'] != take['id']] + [item]
        output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(json.dumps(item,ensure_ascii=False),flush=True)
    if len(manifest['takes']) == 62 and all(any(r['id'] == t['id'] and r['sha256'] == t['sha256'] for r in report) for t in items): break
    time.sleep(5)
