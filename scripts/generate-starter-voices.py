"""Generate DreamChord's licensed synthetic starter reference voices.

The WAV files are intentionally local-only. Provenance, transcript, duration, and
hash remain in the checked-in manifest so the database seeder can verify them.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import soundfile as sf
from huggingface_hub import model_info
from kokoro import KPipeline


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "assets" / "voice-packs" / "dreamchord-starter" / "manifest.json"
EXPECTED_MODEL = "hexgrad/Kokoro-82M"
EXPECTED_LICENSE = "apache-2.0"
SAMPLE_RATE = 24_000


def verify_model_license(model_id: str) -> None:
    info = model_info(model_id)
    card_data = info.card_data or {}
    license_name = str(card_data.get("license", "")).lower()
    if license_name != EXPECTED_LICENSE:
        raise RuntimeError(
            f"Refusing to generate: {model_id} reports license {license_name!r}, "
            f"expected {EXPECTED_LICENSE!r}."
        )


def safe_output_path(relative_path: str) -> Path:
    pack_root = MANIFEST_PATH.parent.resolve()
    output = (pack_root / relative_path).resolve()
    if pack_root not in output.parents or output.suffix.lower() != ".wav":
        raise ValueError(f"Unsafe starter voice output path: {relative_path}")
    return output


def generate_voice(pipeline: KPipeline, text: str, voice_id: str, output: Path) -> tuple[str, float]:
    chunks = [np.asarray(audio, dtype=np.float32) for _, _, audio in pipeline(text, voice=voice_id, speed=1)]
    if not chunks:
        raise RuntimeError(f"Kokoro returned no audio for {voice_id}")

    audio = np.concatenate(chunks)
    duration = len(audio) / SAMPLE_RATE
    if not 3 <= duration <= 30:
        raise RuntimeError(f"Generated {voice_id} duration {duration:.2f}s is outside 3–30s")

    output.parent.mkdir(parents=True, exist_ok=True)
    sf.write(output, audio, SAMPLE_RATE, subtype="PCM_16")
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    return digest, round(duration, 3)


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if manifest.get("sourceModel") != EXPECTED_MODEL:
        raise RuntimeError("Starter manifest points at an unexpected source model")
    if manifest.get("sourceLicense", "").lower() != EXPECTED_LICENSE or manifest.get("syntheticSource") is not True:
        raise RuntimeError("Starter manifest must declare an Apache-2.0 synthetic source")

    verify_model_license(EXPECTED_MODEL)
    pipeline = KPipeline(lang_code="z", repo_id=EXPECTED_MODEL)

    for voice in manifest["voices"]:
        output = safe_output_path(voice["outputFile"])
        digest, duration = generate_voice(pipeline, voice["transcript"], voice["sourceVoiceId"], output)
        voice["sha256"] = digest
        voice["durationSeconds"] = duration
        print(f"generated {voice['name']}: {duration:.2f}s, sha256={digest[:12]}…")

    manifest["generatedAt"] = datetime.now(timezone.utc).isoformat()
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
