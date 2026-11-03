"""Local neural voices with deterministic prosody controls and eSpeak fallback."""

import os
from pathlib import Path
import shutil
import subprocess
import threading
from backend.voice_catalog import VOICES, PROSODY

MODEL_DIR = Path(os.getenv("PANEL_MODEL_DIR", "/workspace/panel-models"))
NEURAL_VOICES = {code: profile["neural"] for code, profile in VOICES.items()}
ENGINE = None
INIT_LOCK = threading.Lock()


def neural_available():
    return all(
        (MODEL_DIR / f).exists() for f in ["kokoro-v1.0.onnx", "voices-v1.0.bin"]
    )


def synthesize(text, voice, emotion, age, out, fallback, intensity=1.0):
    global ENGINE
    if neural_available():
        from kokoro_onnx import Kokoro
        import soundfile as sf

        with INIT_LOCK:
            if ENGINE is None:
                import onnxruntime as ort

                options = ort.SessionOptions()
                options.intra_op_num_threads = 2
                options.inter_op_num_threads = 1
                session = ort.InferenceSession(
                    str(MODEL_DIR / "kokoro-v1.0.onnx"),
                    sess_options=options,
                    providers=["CPUExecutionProvider"],
                )
                ENGINE = Kokoro.from_session(
                    session, str(MODEL_DIR / "voices-v1.0.bin")
                )
        strength = 0.55 + 0.45 * max(0.0, min(1.0, float(intensity)))
        speed, pitch, volume = (
            1.0 + (value - 1.0) * strength for value in PROSODY[emotion]
        )
        if age in ("child", "teen"):
            pitch *= 1.04
        elif age == "older adult":
            pitch *= 0.97
        samples, rate = ENGINE.create(
            text,
            voice=NEURAL_VOICES[voice],
            speed=speed,
            lang=VOICES[voice]["language"],
        )
        if pitch != 1.0 or volume != 1.0:
            temp = out.with_suffix(".tmp.wav")
            sf.write(temp, samples, rate)
            try:
                subprocess.run(
                    [
                        "ffmpeg",
                        "-nostdin",
                        "-y",
                        "-loglevel",
                        "error",
                        "-i",
                        str(temp),
                        "-af",
                        f"asetrate={round(rate * pitch)},aresample={rate},atempo={1 / pitch},volume={volume}",
                        str(out),
                    ],
                    check=True,
                    timeout=30,
                    capture_output=True,
                )
            finally:
                temp.unlink(missing_ok=True)
        else:
            sf.write(out, samples, rate)
        return
    engine = shutil.which("espeak-ng") or shutil.which("espeak")
    if not engine:
        raise RuntimeError("No speech engine is installed")
    v, pitch, rate = fallback
    subprocess.run(
        [
            engine,
            "-v",
            v["voice"],
            "-p",
            str(max(0, min(99, v["pitch"] + pitch))),
            "-s",
            str(max(90, min(240, v["rate"] + rate))),
            "-a",
            "75" if emotion == "whispering" else "100",
            "-w",
            str(out),
            "--stdin",
        ],
        input=text,
        text=True,
        check=True,
        timeout=30,
        capture_output=True,
    )
