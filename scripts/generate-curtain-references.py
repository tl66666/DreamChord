"""Create clearly labelled synthetic reference voices, not impersonations of real actors."""
import hashlib, json, pathlib, time
import numpy as np
import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

root = pathlib.Path(__file__).resolve().parent.parent
pack = root / 'assets/voice-packs/curtain-call'
pack.mkdir(parents=True, exist_ok=True)
voices = [
    dict(id='zhi', role='许栀', name='许栀 · 温柔而坦率', speaker='Serena', genderTone='女声', description='温暖清晰的青年女声，语气克制。适合许栀、校园日常与认真谈心。', zh='明天就要出发了。到了那边，我会给你打电话，还有好多话想慢慢说。', ja='明日の朝には出発するね。向こうに着いたら、電話する。まだ、ゆっくり話したいことがあるから。'),
    dict(id='tang', role='唐棠', name='唐棠 · 明亮的朋友', speaker='Vivian', genderTone='女声', description='明亮、利落的青年女声，带轻微笑意。适合唐棠、亲近朋友与轻松拌嘴。', zh='好啦，先把东西收好。等晚会结束，我们一起去吃夜宵，谁也不许先跑。', ja='はい、まずは片づけよう。公演が終わったら、みんなでご飯に行こうね。先に帰っちゃだめだよ。'),
    dict(id='lin', role='林澈', name='林澈 · 内敛的青年', speaker='Dylan', genderTone='男声', description='偏低、自然的青年男声。适合林澈、第一人称主角与迟疑后的坦白。', zh='我不是不想说，只是一直没找到合适的时候。今天这些话，我想亲口告诉你。', ja='言いたくなかったわけじゃない。ただ、いつ言えばいいか、わからなかった。今日は、自分の言葉で伝えたい。'),
]
model = Qwen3TTSModel.from_pretrained('D:/DreamChordRuntime/qwen-cast/model', device_map='cuda:0', dtype=torch.bfloat16, attn_implementation='sdpa')
manifest = dict(schemaVersion=1, packId='curtain-call', syntheticSource=True, referenceModel='Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice', referenceLicense='Apache-2.0', referenceSource='https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice', voices=voices, references=[], takes=[])
for index, voice in enumerate(voices):
    for language in ['zh', 'ja']:
        target = pack / f'ref-{voice["id"]}-{language}.wav'
        for attempt in range(4):
            torch.manual_seed(103200 + index * 10 + (language == 'ja') + attempt * 100)
            wavs, rate = model.generate_custom_voice(text=voice[language], language='Japanese' if language == 'ja' else 'Chinese', speaker=voice['speaker'], instruct='自然な会話。親しい友達に話しかける。朗読せず、余計な笑い声やため息を入れない。' if language == 'ja' else '二十二岁年轻人的自然对话，亲近的朋友之间说话，语气真诚平稳。不要朗诵，不要播音腔，不添加额外笑声或叹息。', max_new_tokens=360, temperature=.65, top_p=.85)
            samples = np.asarray(wavs[0], dtype=np.float32)
            duration = len(samples) / rate
            if 3.1 <= duration <= 10 and np.isfinite(samples).all() and np.sqrt(np.mean(samples**2)) > .002: break
        else: raise RuntimeError(f'Invalid reference {target.name}: {duration}s')
        samples *= min(1, .94 / max(.001, float(np.max(np.abs(samples)))))
        sf.write(target, samples, rate, subtype='PCM_16')
        manifest['references'].append(dict(id=f'{voice["id"]}-{language}', role=voice['id'], language=language, text=voice[language], outputFile=target.name, sha256=hashlib.sha256(target.read_bytes()).hexdigest(), durationSeconds=round(duration,3)))
        (pack / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
        print(f'READY {target.name} {duration:.2f}s', flush=True)
