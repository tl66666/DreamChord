"""Inspect source tracks for editorial selection; this does not claim a listening review."""
import json
import pathlib
import sys
import librosa
import numpy as np

root = pathlib.Path(sys.argv[1])
for name in sys.argv[2:]:
    y, sr = librosa.load(root / name, sr=22050)
    tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
    print(json.dumps({"file": name, "durationSeconds": round(len(y) / sr, 2), "tempoBpm": round(float(np.asarray(tempo).reshape(-1)[0])), "spectralCentroidHz": round(float(librosa.feature.spectral_centroid(y=y, sr=sr).mean())), "rms": round(float(librosa.feature.rms(y=y).mean()), 4)}, ensure_ascii=False), flush=True)
