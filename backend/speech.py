"""Local neural voices with deterministic prosody controls and eSpeak fallback."""

import os
from pathlib import Path
import shutil
import subprocess
import threading

MODEL_DIR = Path(os.getenv("PANEL_MODEL_DIR", "/workspace/panel-models"))
NEURAL_VOICES = {
    "warm": "am_michael",
    "bright": "af_heart",
    "deep": "bm_george",
    "soft": "bf_emma",
    "electric": "am_echo",
}
ENGINE = None
INIT_LOCK = threading.Lock()


def neural_available():
    return all(
        (MODEL_DIR / f).exists() for f in ["kokoro-v1.0.onnx", "voices-v1.0.bin"]
    )


def synthesize(text, voice, emotion, age, out, fallback):
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
        speeds = {
            "neutral": 1.0,
            "excited": 1.12,
            "angry": 1.08,
            "sad": 0.88,
            "whispering": 0.9,
            "surprised": 1.06,
        }
        pitch = {
            "neutral": 1.0,
            "excited": 1.045,
            "angry": 0.975,
            "sad": 0.965,
            "whispering": 0.985,
            "surprised": 1.065,
        }[emotion]
        if age in ("child", "teen"):
            pitch *= 1.04
        elif age == "older adult":
            pitch *= 0.97
        samples, rate = ENGINE.create(
            text,
            voice=NEURAL_VOICES[voice],
            speed=speeds[emotion],
            lang="en-gb" if voice in ("soft", "deep") else "en-us",
        )
        if pitch != 1.0 or emotion == "whispering":
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
                        f"asetrate={round(rate * pitch)},aresample={rate},atempo={1 / pitch},volume={0.65 if emotion == 'whispering' else 1.0}",
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
