"""Independent ASR spot-check. Recognition is supporting evidence, not a listening verdict."""
import json
import pathlib
from faster_whisper import WhisperModel

root = pathlib.Path(__file__).resolve().parent.parent
model = WhisperModel('base', device='cpu', compute_type='int8', download_root='D:/DreamChordRuntime/asr-review')
files = [
    ('qwen-reference-zh', 'zh', root / 'assets/voice-packs/dreamchord-cast/generated/s1-d3-zh.wav'),
    ('qwen-reference-ja', 'ja', root / 'assets/voice-packs/dreamchord-cast/generated/s1-d3-ja.wav'),
    ('cosy-new-zh', 'zh', root / '.runtime/voice-auditions/bilingual-new-line-zh.wav'),
    ('translated-japanese-new-line', 'ja', root / '.runtime/voice-auditions/bilingual-new-line-ja.wav'),
]
if (root / '.runtime/voice-auditions/bilingual-ja-zero.wav').exists():
    files.append(('cosy-ja-reference-mode', 'ja', root / '.runtime/voice-auditions/bilingual-ja-zero.wav'))
if (root / '.runtime/voice-auditions/bilingual-ja-gpt.wav').exists():
    files.append(('gpt-ja-reference-mode', 'ja', root / '.runtime/voice-auditions/bilingual-ja-gpt.wav'))
report = []
for name, language, file in files:
    segments, info = model.transcribe(str(file), language=language, beam_size=5, temperature=0, condition_on_previous_text=False)
    text = ''.join(segment.text for segment in segments)
    record = dict(name=name, language=language, transcript=text)
    print(json.dumps(record, ensure_ascii=False), flush=True)
    report.append(record)
(root / '.runtime/voice-auditions/bilingual-asr-review.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
