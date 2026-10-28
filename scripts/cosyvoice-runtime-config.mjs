import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function cosyVoiceRuntimeConfig({ runtimeRoot = process.env.DREAMCHORD_RUNTIME_ROOT || 'D:\\DreamChordRuntime' } = {}) {
  const home = path.win32.join(runtimeRoot, 'cosyvoice')
  return {
    runtimeRoot,
    home,
    repository: path.win32.join(home, 'repository'),
    environment: path.win32.join(home, '.conda'),
    modelDirectory: path.win32.join(home, 'pretrained_models', 'Fun-CosyVoice3-0.5B'),
    bridge: path.win32.join(home, 'dreamchord_bridge.py'),
    modelId: 'FunAudioLLM/Fun-CosyVoice3-0.5B-2512',
    host: '127.0.0.1',
    port: 50_000,
  }
}

export function renderCosyVoiceBridge({ modelDirectory, port = 50_000 }) {
  const modelPath = String(modelDirectory).replaceAll('\\', '/').replaceAll("'", "\\'")
  return `"""DreamChord loopback-only CosyVoice bridge. Generated; do not edit."""
import argparse
import io
import sys
from pathlib import Path
import numpy as np
import torch
import torchaudio
import soundfile as sf
import uvicorn
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.responses import StreamingResponse

repository = Path(r'${modelPath}').parent.parent / 'repository'
sys.path.insert(0, str(repository))
sys.path.insert(0, str(repository / 'third_party' / 'Matcha-TTS'))
from cosyvoice.cli.cosyvoice import AutoModel
import cosyvoice.cli.frontend as frontend_module

def read_reference_wave(source, target_sr, min_sr=16000):
    if hasattr(source, 'seek'):
        source.seek(0)
    samples, sample_rate = sf.read(source, dtype='float32', always_2d=True)
    if sample_rate < min_sr:
        raise ValueError('Reference sample rate must be at least 16000Hz')
    speech = torch.from_numpy(samples.mean(axis=1).copy()).unsqueeze(0)
    if sample_rate != target_sr:
        speech = torchaudio.transforms.Resample(sample_rate, target_sr)(speech)
    return speech

# Torchaudio 2.9+ routes load() through TorchCodec even when soundfile is
# requested. Use the installed audio-only reader for this upstream boundary.
frontend_module.load_wav = read_reference_wave

# Construct the optional text frontend from explicit local files. The upstream
# default downloads every language on startup; a local app must start offline.
import wetext
OfficialNormalizer = wetext.Normalizer
class LocalNormalizer:
    def __init__(self, **kwargs):
        root = repository.parent / 'text-frontend'
        self.normalizers = {lang: OfficialNormalizer(tagger_path=str(root / lang / 'tn' / 'tagger.fst'), verbalizer_path=str(root / lang / 'tn' / 'verbalizer.fst'), lang=lang) for lang in ('zh', 'en')}
    def normalize(self, text):
        lang = 'zh' if any('\\u4e00' <= char <= '\\u9fff' for char in text) else 'en'
        return self.normalizers[lang].normalize(text)
wetext.Normalizer = LocalNormalizer

app = FastAPI(title='DreamChord CosyVoice Bridge')
model = AutoModel(model_dir=r'${modelPath}', fp16=torch.cuda.is_available())

def pcm_stream(results):
    for result in results:
        audio = result['tts_speech'].detach().cpu().numpy().reshape(-1)
        yield (np.clip(audio, -1, 1) * 32767).astype(np.int16).tobytes()

async def reference_audio(upload: UploadFile):
    payload = await upload.read()
    return io.BytesIO(payload)

def prompt_prefix(text):
    return text if '<|endofprompt|>' in text else 'You are a helpful assistant.<|endofprompt|>' + text

def instruction_prefix(text):
    return text if '<|endofprompt|>' in text else 'You are a helpful assistant. ' + text + '<|endofprompt|>'

def audio_response(results):
    return StreamingResponse(pcm_stream(results), media_type='application/octet-stream', headers={'X-Audio-Sample-Rate': str(model.sample_rate)})

@app.get('/health')
def health():
    return {'ok': True, 'provider': 'cosyvoice', 'sampleRate': model.sample_rate, 'cuda': torch.cuda.is_available(), 'torchVersion': torch.__version__, 'peakAllocatedMiB': round(torch.cuda.max_memory_allocated() / 1048576, 1) if torch.cuda.is_available() else 0}

@app.post('/inference_zero_shot')
async def inference_zero_shot(tts_text: str = Form(...), prompt_text: str = Form(...), prompt_wav: UploadFile = File(...), speed: float = Form(1.0)):
    prompt = await reference_audio(prompt_wav)
    return audio_response(model.inference_zero_shot(tts_text, prompt_prefix(prompt_text), prompt, stream=False, speed=max(0.5, min(1.5, speed))))

@app.post('/inference_instruct2')
async def inference_instruct2(tts_text: str = Form(...), instruct_text: str = Form(...), prompt_wav: UploadFile = File(...), speed: float = Form(1.0)):
    prompt = await reference_audio(prompt_wav)
    return audio_response(model.inference_instruct2(tts_text, instruction_prefix(instruct_text), prompt, stream=False, speed=max(0.5, min(1.5, speed))))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=${Number(port)})
    args = parser.parse_args()
    uvicorn.run(app, host='127.0.0.1', port=args.port)
`
}

async function main() {
  const [command, ...args] = process.argv.slice(2)
  if (command === 'config-json') {
    process.stdout.write(`${JSON.stringify(cosyVoiceRuntimeConfig({ ...(args[0] ? { runtimeRoot: args[0] } : {}) }))}\n`)
    return
  }
  if (command === 'write-bridge') {
    if (!args[0] || !args[1]) throw new Error('用法: write-bridge <输出路径> <模型目录> [端口]')
    const { writeFile } = await import('node:fs/promises')
    await writeFile(args[0], renderCosyVoiceBridge({ modelDirectory: args[1], ...(args[2] ? { port: Number(args[2]) } : {}) }), 'utf8')
    return
  }
  throw new Error('用法: cosyvoice-runtime-config.mjs config-json [运行时根目录] | write-bridge <输出路径> <模型目录> [端口]')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
