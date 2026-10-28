"""Download an official translation model with bounded ranges and SHA-256 verification."""
import concurrent.futures
import hashlib
import pathlib
import shutil
import sys
import time
import requests

target = pathlib.Path(sys.argv[1])
target.mkdir(parents=True, exist_ok=True)
repository = sys.argv[2] if len(sys.argv) > 2 else 'Qwen/Qwen3-4B-GGUF'
weight_name = sys.argv[3] if len(sys.argv) > 3 else 'Qwen3-4B-Q4_K_M.gguf'
metadata = requests.get(f'https://huggingface.co/api/models/{repository}?blobs=true', timeout=30)
metadata.raise_for_status()
files = {entry['rfilename']: entry for entry in metadata.json()['siblings']}
names = ['config.json', 'generation_config.json', 'sentencepiece.bpe.model', 'vocab.json', 'tokenizer_config.json', 'special_tokens_map.json', 'LICENSE', 'README.md']
for name in names:
    if name not in files:
        continue
    destination = target / name
    if destination.exists():
        continue
    response = requests.get(f'https://huggingface.co/{repository}/resolve/main/{name}?download=true&t={time.time_ns()}', timeout=60)
    if response.status_code != 200:
        raise RuntimeError(f'Could not download model resource: {name}')
    destination.write_bytes(response.content)

weights = files[weight_name]['lfs']
size, expected = weights['size'], weights['sha256']
destination = target / weight_name
def digest(file):
    result = hashlib.sha256()
    with file.open('rb') as stream:
        for block in iter(lambda: stream.read(8 * 1024 * 1024), b''):
            result.update(block)
    return result.hexdigest()
if destination.exists() and destination.stat().st_size == size and digest(destination) == expected:
    print('Translation model already verified', flush=True)
    sys.exit(0)

parts = target / 'verified-download-parts'
parts.mkdir(exist_ok=True)
chunk_size = 32 * 1024 * 1024
count = (size + chunk_size - 1) // chunk_size
def fetch(index):
    start, end = index * chunk_size, min(size - 1, (index + 1) * chunk_size - 1)
    output = parts / f'{index:04}.part'
    if output.exists() and output.stat().st_size == end - start + 1:
        return index
    for attempt in range(3):
        try:
            url = f'https://huggingface.co/{repository}/resolve/main/{weight_name}?download=true&t={time.time_ns()}'
            with requests.get(url, headers={'Range': f'bytes={start}-{end}'}, stream=True, timeout=(30, 60)) as response:
                if response.status_code != 206 or not response.headers.get('Content-Range', '').startswith(f'bytes {start}-{end}/'):
                    raise RuntimeError('Unexpected download range')
                with output.open('wb') as stream:
                    for block in response.iter_content(1024 * 1024):
                        stream.write(block)
            if output.stat().st_size != end - start + 1:
                raise RuntimeError('Incomplete download range')
            return index
        except (requests.RequestException, RuntimeError):
            if attempt == 2:
                raise RuntimeError(f'Translation model part {index + 1} failed') from None
            time.sleep(1)

with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
    for completed, future in enumerate(concurrent.futures.as_completed(executor.submit(fetch, index) for index in range(count)), 1):
        future.result()
        print(f'Model download {completed}/{count} parts', flush=True)
temporary = target / f'{weight_name}.verified.tmp'
with temporary.open('wb') as stream:
    for index in range(count):
        with (parts / f'{index:04}.part').open('rb') as part:
            shutil.copyfileobj(part, stream)
if digest(temporary) != expected:
    raise RuntimeError('Translation model SHA-256 mismatch; model was not installed')
temporary.replace(destination)
print('Translation model verified and installed', flush=True)
