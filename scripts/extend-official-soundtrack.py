"""Normalize four additional CC0 source tracks into the existing verified manifest."""
import hashlib
import json
import pathlib
import re
import shutil
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parent.parent
pack = root / 'assets/music-packs/ternox-vn'
manifest_file = pack / 'manifest.json'
manifest = json.loads(manifest_file.read_text(encoding='utf-8'))
source = pathlib.Path(sys.argv[1])
archive = pathlib.Path(sys.argv[2])
sha = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
if sha(archive) != manifest['archiveSha256']:
    raise RuntimeError('Source archive does not match the licensed pack manifest')
tracks = [
    ('afternoon', '午后余白', 'vntrack01.mp3', '日常 / 温柔 / 放松', ['部室闲谈', '章节间歇'], 89, '较缓的日常备选，适合不需要强调冲突的闲谈和章节间歇。'),
    ('daily', '走廊里的脚步', 'vntrack04.mp3', '轻快 / 日常 / 活泼', ['校园日常', '轻松插曲'], 108, '中速的日常备选，适合校园小插曲，避免紧张配乐贯穿所有对话。'),
    ('name', '名字落在掌心', 'vntrack08.mp3', '温柔 / 回忆 / 治愈', ['1-6 自己选择的名字', '安静独白'], 78, '较慢、频谱较柔和的命名段落备选，让角色回答前留出空间。'),
    ('mischief', '课间小插曲', 'vntrack14.mp3', '轻快 / 日常 / 俏皮', ['轻松插曲', '番外日常'], 161, '较快的番外日常备选；不放进主线沉重的转折场景。'),
]
for role, name, filename, mood, scenes, tempo, description in tracks:
    original = source / filename
    analysis = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(original), '-af', 'loudnorm=I=-18:TP=-1:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True, check=True).stderr
    measured = json.loads(re.search(r'\{\s*"input_i"[\s\S]*?\}', analysis).group())
    audio_filter = 'loudnorm=I=-18:TP=-1:LRA=11:measured_I={input_i}:measured_LRA={input_lra}:measured_TP={input_tp}:measured_thresh={input_thresh}:offset={target_offset}:linear=true'.format(**measured)
    output = pack / 'runtime' / f'{role}.ogg'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(original), '-af', audio_filter, '-c:a', 'libvorbis', '-q:a', '5', str(output)], check=True)
    duration = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', str(output)], text=True))
    track = dict(id=f'ternox-{role}', name=name, description=description, originalFile=filename, originalSha256=sha(original), outputFile=f'runtime/{role}.ogg', role=role, mood=mood, scenes=scenes, tempoBpm=tempo, musicalKey='未标注', durationSeconds=round(duration, 2), loop=True, author=manifest['author'], sourceUrl=manifest['sourceUrl'], license=manifest['sourceLicense'], sha256=sha(output))
    manifest['tracks'] = [entry for entry in manifest['tracks'] if entry['role'] != role] + [track]
    shutil.copyfile(output, root / 'apps/web/public/assets/audio/demo' / output.name)
    print(f'{name}: {duration:.2f}s', flush=True)
manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
