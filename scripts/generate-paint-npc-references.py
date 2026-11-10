"""Two original mature NPC voices. No actor recordings, no trained identity weights.

Use the managed Qwen environment with GPT-SoVITS stopped; resume per reference.
"""
import hashlib
import json
import pathlib
import time
import numpy as np
import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel

ROOT = pathlib.Path(__file__).resolve().parent.parent
PACK = ROOT / 'assets/voice-packs/paint-chapter-four'
BASE = ' 日本語の自然な会話。指定された台詞だけを読む。音楽、余計な笑い声やため息は入れない。'
LINES = [
    ('liu-casual', 'liu', 'casual', 'そこの椅子は、まだ触らないでな。直したばかりだ。お茶なら、向こうに置いてあるよ。', '五十八歳の職人の男性。低めで温かい、普通の会話。相手と近くで話す。老人らしさを大げさに作らない。'),
    ('liu-serious', 'liu', 'serious', '先に、本人に聞いてやりな。手伝ってほしいかどうかは、こっちで決めることじゃない。', '五十八歳の落ち着いた職人の男性。静かな注意。説教や朗読の調子にせず、短く率直に話す。'),
    ('shen-casual', 'shen', 'casual', 'お釣りはここに置くね。今日は少し早く閉めたいの。川辺を歩いてから、帰るつもり。', '四十九歳の女性。中低音で、明快かつ穏やかな会話。生活感のある自然な抑揚。少女っぽい高い声や甘えた語尾は使わない。'),
    ('shen-serious', 'shen', 'serious', 'その布は預かり物よ。使う前に、持ち主に聞いてね。急いでいても、そこは変わらない。', '四十九歳の女性。落ち着いて、親しい人に仕事の確認をする。厳しく責めず、はっきり普通に話す。'),
]

def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

def main():
    file = PACK / 'manifest.json'
    manifest = json.loads(file.read_text(encoding='utf-8'))
    work = [(i, *item) for i, item in enumerate(LINES) if not any(r['id'] == item[0] and r['text'] == item[3] and (PACK / r['outputFile']).exists() and sha(PACK / r['outputFile']) == r['sha256'] for r in manifest['references'])]
    if not work:
        print('NPC references current.', flush=True)
        return
    model = Qwen3TTSModel.from_pretrained('D:/DreamChordRuntime/qwen-cast/model', device_map='cuda:0', dtype=torch.bfloat16, attn_implementation='sdpa')
    for i, ref_id, role, emotion, text, direction in work:
        voice = next(v for v in manifest['voices'] if v['id'] == role)
        target, started = PACK / f'ref-{ref_id}-ja.wav', time.monotonic()
        parameters = dict(max_new_tokens=350, temperature=.65, top_p=.85)
        for attempt in range(3):
            seed = 911090 + i * 100 + attempt
            torch.manual_seed(seed)
            wavs, rate = model.generate_custom_voice(text=text, language='Japanese', speaker=voice['speaker'], instruct=direction + BASE, **parameters)
            samples = np.asarray(wavs[0], dtype=np.float32).squeeze()
            seconds, rms = len(samples) / rate, float(np.sqrt(np.mean(samples ** 2)))
            if 3.1 <= seconds <= 9.8 and np.isfinite(samples).all() and rms > .002:
                break
        else:
            raise RuntimeError(f'Invalid NPC reference {ref_id}: {seconds}s')
        samples *= min(1, .94 / max(.001, float(np.max(np.abs(samples)))))
        sf.write(target, samples, rate, subtype='PCM_16')
        reference = dict(id=ref_id, role=role, language='ja', emotion=emotion, text=text, speaker=voice['speaker'], direction=direction + BASE, parameters=parameters, seed=seed, outputFile=target.name, sha256=sha(target), durationSeconds=round(seconds, 3), sampleRate=rate, rms=round(rms, 5), generationSeconds=round(time.monotonic()-started, 2), syntheticSource=True, sourceModel=manifest['referenceModel'], source=manifest['referenceSource'], license='Apache-2.0', humanListeningCompleted=False)
        manifest['references'] = [r for r in manifest['references'] if r['id'] != ref_id] + [reference]
        temporary = file.with_suffix('.tmp')
        temporary.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
        temporary.replace(file)
        print(f'READY {ref_id} {seconds:.2f}s gen {reference["generationSeconds"]}s', flush=True)

if __name__ == '__main__':
    main()
