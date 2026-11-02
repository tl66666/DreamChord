"""Reproducible synthetic Japanese cast references; never impersonates a performer.

Run with the installed Qwen venv, with GPT-SoVITS stopped to release the GPU.
Every WAV is retained with its exact direction, seed, model and source metadata.
"""
import argparse
import hashlib
import json
import pathlib
import time

import numpy as np
import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

ROOT = pathlib.Path(__file__).resolve().parent.parent
PACK = ROOT / 'assets/voice-packs/paint-prologue'
MODEL = 'D:/DreamChordRuntime/qwen-cast/model'
VOICES = [
    dict(id='cheng', role='程见', name='程见 · 温暖自嘲', speaker='Aiden', genderTone='男声', description='温暖、稍懒散的青年男声。自嘲像朋友间的闲话，认真时不摆出朗诵腔。'),
    dict(id='xia', role='夏禾', name='夏禾 · 明亮率真', speaker='Ono_Anna', genderTone='女声', description='清亮利落的青年女声，轻巧拌嘴，认真时语气收敛。'),
    dict(id='ye', role='许野', name='许野 · 轻快有戏', speaker='Ryan', genderTone='男声', description='轻快有表现力的青年男声，有舞台感，日常对话不夸张。'),
    dict(id='lu', role='陆青', name='陆青 · 安静理性', speaker='Serena', genderTone='女声', description='平静、清晰的成熟女声，语调克制，留给对方思考的空隙。'),
]
REFERENCE_LINES = [
    ('cheng-casual', 'cheng', 'casual', '絵のことは少しわかる。暮らしのことは、まあ、これから勉強するよ。', '若い男性の自然な会話。少し気だるく、温かい。後半は自分をからかうように軽く。朗読しない。'),
    ('cheng-serious', 'cheng', 'serious', 'ちゃんと覚えてるよ。あの日、君が言ってくれたこと。だから、もう少しここにいたい。', '若い男性。親しい相手に静かに本心を伝える。悲劇的にせず、温かく、言葉を大切に。'),
    ('xia-casual', 'xia', 'casual', 'ちょっと、そこに座らないで。まだ絵の具が乾いてないんだから。ほら、言ったでしょ。', '明るい若い女性。親しい友達を軽くたしなめる。会話の自然な抑揚、少し呆れた笑顔。大げさに怒鳴らない。'),
    ('xia-serious', 'xia', 'serious', 'きれいに直してほしいんじゃないの。あの人が見ていたものを、少しだけ知りたい。', '若い女性。静かに率直な願いを伝える。普段の明るさを抑え、言葉を選ぶ。泣かず、ささやきすぎない。'),
    ('ye-casual', 'ye', 'casual', 'お待たせしました。本日の主役は、こちらの古い椅子です。僕よりずっと、芝居がうまい。', '若い男性。友達の前で小さな冗談を演じる。軽快で親しみやすく、最後は自然に落とす。叫ばず、芝居がかりすぎない。'),
    ('ye-serious', 'ye', 'serious', '幕が下りても、明日は来る。僕は明日の君にも、会いに行くよ。約束する。', '若い男性。ふざけず、友達に穏やかに約束する。息のある自然な会話、押しつけず、誠実。'),
    ('lu-casual', 'lu', 'casual', '急がなくていいですよ。まず、お茶にしましょう。話は、それからでも間に合います。', '落ち着いた女性の会話。理性的で柔らかい。ゆっくりすぎず、放送のアナウンスのように読まない。'),
    ('lu-serious', 'lu', 'serious', '残すことと、変わらないことは、同じではありません。決めるのは、あなたです。', '落ち着いた女性。相手の判断を尊重して静かに語る。感情を煽らず、自然な抑揚で。'),
]
BASE_DIRECTION = ' 日本語で自然に話す。指定された台詞だけを読む。余計な笑い声、ため息、音楽を入れない。'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--only', nargs='*', default=[])
    parser.add_argument('--retake', action='store_true')
    args = parser.parse_args()
    PACK.mkdir(parents=True, exist_ok=True)
    manifest_path = PACK / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {'references': [], 'takes': []}
    manifest.update(schemaVersion=1, packId='paint-prologue', storyTitle='请让这幅画老去', syntheticSource=True,
                    referenceModel='Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice', referenceLicense='Apache-2.0',
                    referenceSource='https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice',
                    identityNotice='原创合成角色声线，不代表任何真人声优。未训练角色专属权重。',
                    voices=VOICES, humanListeningCompleted=False)
    work = []
    for index, (ref_id, role, emotion, text, direction) in enumerate(REFERENCE_LINES):
        if args.only and ref_id not in args.only:
            continue
        target = PACK / f'ref-{ref_id}-ja.wav'
        prior = next((r for r in manifest['references'] if r['id'] == ref_id and r['text'] == text and r.get('direction') == direction + BASE_DIRECTION), None)
        if not args.retake and prior and target.exists() and digest(target) == prior['sha256']:
            continue
        work.append((index, ref_id, role, emotion, text, direction, target))
    if not work:
        print('References current.', flush=True)
        return
    model = Qwen3TTSModel.from_pretrained(MODEL, device_map='cuda:0', dtype=torch.bfloat16, attn_implementation='sdpa')
    for index, ref_id, role, emotion, text, direction, target in work:
        voice = next(v for v in VOICES if v['id'] == role)
        started = time.monotonic()
        for attempt in range(3):
            seed = 831000 + index * 100 + attempt
            torch.manual_seed(seed)
            parameters = dict(max_new_tokens=320, temperature=.65, top_p=.85)
            wavs, rate = model.generate_custom_voice(text=text, language='Japanese', speaker=voice['speaker'], instruct=direction + BASE_DIRECTION, **parameters)
            samples = np.asarray(wavs[0], dtype=np.float32).squeeze()
            duration = len(samples) / rate
            rms = float(np.sqrt(np.mean(samples ** 2)))
            if 3.1 <= duration <= 11 and np.isfinite(samples).all() and rms > .002:
                break
        else:
            raise RuntimeError(f'Invalid reference {ref_id}: {duration:.2f}s rms={rms}')
        samples *= min(1, .94 / max(.001, float(np.max(np.abs(samples)))))
        sf.write(target, samples, rate, subtype='PCM_16')
        reference = dict(id=ref_id, role=role, language='ja', emotion=emotion, text=text, speaker=voice['speaker'],
                         direction=direction + BASE_DIRECTION, parameters=parameters, seed=seed, outputFile=target.name,
                         sha256=digest(target), durationSeconds=round(duration, 3), sampleRate=rate, rms=round(rms, 5),
                         generationSeconds=round(time.monotonic() - started, 2), syntheticSource=True,
                         sourceModel=manifest['referenceModel'], source=manifest['referenceSource'], license='Apache-2.0',
                         humanListeningCompleted=False)
        manifest['references'] = [r for r in manifest['references'] if r['id'] != ref_id] + [reference]
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'READY {ref_id} {duration:.2f}s gen {reference["generationSeconds"]}s', flush=True)


if __name__ == '__main__':
    main()
