"""Generate the bilingual dialogue audition pack locally with Qwen3-TTS.

Run with the isolated qwen-cast Python. Lines are original sample dialogue
written for DreamChord; audio stays inside the pack directory.
"""
import argparse
import hashlib
import json
import os
import pathlib
import sys
import time
import types
from datetime import datetime, timezone

# Detached runs must not lose progress output; log straight to the runtime disk.
_LOG_DIR = 'D:/DreamChordRuntime/tmp/audio-src/dreamchord-audio-src'
if os.path.isdir(_LOG_DIR):
    sys.stdout = open(f'{_LOG_DIR}/dialogue-gen2.log', 'w', buffering=1, encoding='utf-8')
    sys.stderr = sys.stdout

import numpy as np

# pysox hangs on import under this Windows environment; the pack only uses
# sox.Transformer().norm() inside the tokenizer's XVectorExtractor, which is a
# plain peak normalization to the target dBFS. Provide an equivalent stub.
_soak_module = types.ModuleType('sox')
class _NormTransformer:
    def __init__(self):
        self._target = None
    def norm(self, db_level=None):
        self._target = 10 ** (db_level / 20.0) if db_level is not None else 1.0
        return self
    def build_array(self, input_array, sample_rate_in):
        arr = np.asarray(input_array, dtype=np.float64)
        peak = float(np.max(np.abs(arr))) if arr.size else 0.0
        if self._target is None or peak == 0.0:
            return arr
        return arr * (self._target / peak)
_soak_module.Transformer = _NormTransformer
sys.modules.setdefault('sox', _soak_module)

import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

parser = argparse.ArgumentParser()
parser.add_argument('--model', default='D:/DreamChordRuntime/qwen-cast/model')
args = parser.parse_args()
root = pathlib.Path(__file__).resolve().parent.parent
pack = root / 'assets/voice-packs/dreamchord-dialogue'
output_root = pack / 'generated'
output_root.mkdir(parents=True, exist_ok=True)

# Four original voices covering tones the starter cast does not provide.
# `speaker` values are Qwen3-TTS preset names verified by the demo cast pipeline.
VOICES = [
    dict(
        id='kaito', name='海斗 · 沉稳青年', speaker='Dylan', genderTone='男声', ageTone='青年',
        direction='沉稳可靠的年轻男声，像在保护身边的人。冷静但不冷淡，句尾自然下沉，不要播音腔。',
        lines={
            'zh': [
                ('冷静守护', '低声安抚', '别怕，跟紧我。这条路，我走过很多次。'),
                ('释然感慨', '感慨释怀', '原来……真相一直就在我们身边。'),
                ('自嘲温柔', '自嘲中带温柔', '抱歉，让你看到我不太可靠的一面了。'),
            ],
            'ja': [
                ('冷静守護', '落ち着いた励まし', '怖くないよ。僕についてきて。この道は、何度も通ったから。'),
                ('安堵感慨', '安堵と感慨', 'ずっと……真実は、僕らのそばにあったんだね。'),
                ('自嘲優しさ', '自嘲まじりの優しさ', 'ごめん。君に、情けないところを見せちゃったね。'),
            ],
        },
    ),
    dict(
        id='kanade', name='奏 · 温柔姐姐', speaker='Serena', genderTone='女声', ageTone='青年',
        direction='温暖从容的年轻女声，像照顾晚辈的姐姐。语速稍缓，语气笃定而柔和，不要甜腻。',
        lines={
            'zh': [
                ('日常迎接', '温和的日常感', '欢迎回来。今天想喝红茶，还是咖啡？'),
                ('温柔安慰', '笃定的温柔', '没关系的。慢慢来，我会一直陪着你。'),
                ('肯定鼓励', '可靠的肯定', '你已经很努力了。剩下的，交给我吧。'),
            ],
            'ja': [
                ('日常出迎え', '穏やかな日常', 'おかえりなさい。今日は紅茶にする？それともコーヒー？'),
                ('優しい寄り添い', '揺るがない優しさ', '大丈夫。ゆっくりでいいの。ずっと、そばにいるから。'),
                ('肯定の励まし', '頼れる肯定', 'よく頑張ったね。あとは、お姉さんに任せて。'),
            ],
        },
    ),
    dict(
        id='hina', name='阳奈 · 元气少女', speaker='Ono_Anna', genderTone='女声', ageTone='少女',
        direction='明亮轻快的少女声，充满好奇心。语速稍快、有跳跃感，认真时骤然收住，不要夸张的幼儿声。',
        lines={
            'zh': [
                ('雀跃催促', '兴奋雀跃', '快点快点！祭典的烟火，要开始啦！'),
                ('假装生气', '佯装的生气', '诶——你怎么不早说嘛！我都等了好久了！'),
                ('认真感谢', '认真而郑重', '嗯……谢谢你。真的，谢谢你。'),
            ],
            'ja': [
                ('弾む催促', '弾む興奮', '早く早く！お祭りの花火、始まっちゃうよ！'),
                ('ふくれっ面', 'あどけない怒り', 'ええっ、そんなこと早く言ってよ！ずっと待ってたのに！'),
                ('真顔の感謝', '真剣な感謝', 'ん……ありがとう。ほんとに、ありがとう。'),
            ],
        },
    ),
    dict(
        id='shin', name='深 · 低语叙述', speaker='Uncle_Fu', genderTone='男声', ageTone='成熟',
        direction='低沉安静的叙述声，像在深夜讲述亲身经历。有人情味，语速缓慢，避免电子音与新闻播报。',
        lines={
            'zh': [
                ('追忆开场', '平静的追忆', '那年的夏天，蝉鸣比记忆里，更吵一些。'),
                ('旁白感悟', '温和的洞察', '故事啊，总是在我们准备好之前，就开始了。'),
                ('场景描写', '低语的紧张', '门后传来轻轻的、像是叹息一样的声音。'),
            ],
            'ja': [
                ('回想の書き出し', '静かな追憶', 'あの年の夏は、蝉の声が記憶より、少しうるさかった。'),
                ('語り手の洞察', '柔らかな洞察', '物語はいつも、僕らの心の準備ができる前に、始まるんだ。'),
                ('情景の描写', 'ささやくような緊張', 'ドアの向こうから、ため息みたいな、小さな音が聞こえた。'),
            ],
        },
    ),
]

model = Qwen3TTSModel.from_pretrained(args.model, device_map='cuda:0', dtype=torch.bfloat16, attn_implementation='sdpa')
device_map = getattr(model, 'hf_device_map', None)
_param_device = next((getattr(model, 'model', model)).parameters()).device
print(f'MODEL_DEVICE map={device_map} param={_param_device}', flush=True)
if 'cuda' not in str(_param_device):
    raise RuntimeError(f'Model was offloaded off the GPU ({_param_device}); free VRAM (close CosyVoice/GPU apps) and retry, CPU generation is unusably slow.')
manifest_file = pack / 'manifest.json'
manifest = json.loads(manifest_file.read_text(encoding='utf-8')) if manifest_file.exists() else dict(
    schemaVersion=1, packId='dreamchord-dialogue', displayName='台词配音声线集',
    description='Qwen3-TTS 本地生成的原创台词配音声线集，四条声线覆盖沉稳青年、温柔姐姐、元气少女与低语叙述，中文与日文各三条原创示例台词，供声音库试听与角色绑定。',
    generativeAiUsed=True, syntheticSource=True, sourceModel='Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice',
    sourceUrl='https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice', sourceLicense='Apache-2.0',
    generatedAt=datetime.now(timezone.utc).isoformat(),
    voices=[dict(id=v['id'], name=v['name'], speaker=v['speaker'], genderTone=v['genderTone'], ageTone=v['ageTone'], direction=v['direction']) for v in VOICES],
    takes=[])
manifest['generatedAt'] = datetime.now(timezone.utc).isoformat()

tasks = []
for voice in VOICES:
    for locale in ('zh', 'ja'):
        for index, (scene, emotion, text) in enumerate(voice['lines'][locale], start=1):
            tasks.append((voice, locale, scene, emotion, text, index))

for index, (voice, locale, scene, emotion, text, line_no) in enumerate(tasks):
    take_id = f"{voice['id']}-{locale}-{line_no:02d}"
    existing = next((item for item in manifest['takes'] if item['id'] == take_id), None)
    if existing and (pack / existing['outputFile']).exists() and hashlib.sha256((pack / existing['outputFile']).read_bytes()).hexdigest() == existing['sha256']:
        print(f'SKIP {take_id}', flush=True)
        continue
    torch.manual_seed(241029 + index)
    started = time.monotonic()
    instruction = voice['direction'] + (' 用自然的普通话。' if locale == 'zh' else ' 日本語で、自然な会話として話してください。')
    wavs, rate = model.generate_custom_voice(
        text=text, language='Chinese' if locale == 'zh' else 'Japanese', speaker=voice['speaker'],
        instruct=instruction, max_new_tokens=700, temperature=0.7, top_p=0.8)
    samples = np.asarray(wavs[0], dtype=np.float32)
    duration = len(samples) / rate
    peak = float(np.max(np.abs(samples)))
    rms = float(np.sqrt(np.mean(samples ** 2)))
    if not (0.5 < duration < 45) or not np.isfinite(samples).all() or rms < 0.001:
        raise RuntimeError(f'Audio technical check failed: {take_id}, duration={duration}, RMS={rms}')
    if peak > 0.94:
        samples *= 0.94 / peak
    filename = output_root / f'{take_id}.wav'
    sf.write(filename, samples, rate, subtype='PCM_16')
    take = dict(
        id=take_id, role=voice['id'], speaker=voice['speaker'], language=locale, text=text,
        scene=scene, emotion=emotion, isReference=True,
        instruction=instruction, outputFile=f'generated/{filename.name}',
        sha256=hashlib.sha256(filename.read_bytes()).hexdigest(), durationSeconds=round(duration, 3),
        generationSeconds=round(time.monotonic() - started, 2), sampleRate=int(rate))
    manifest['takes'] = [item for item in manifest['takes'] if item['id'] != take_id] + [take]
    manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'OK {take_id}: {duration:.2f}s, generation {take["generationSeconds"]:.1f}s', flush=True)

print('DIALOGUE_READY', flush=True)
