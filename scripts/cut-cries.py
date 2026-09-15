"""Cut one short cry per animal out of the supplied recordings.

The recordings are stock clips: some are a single sound, some are ten seconds
of an animal repeating itself. A game cue has to be one sound, start the instant
it is asked for, and sit at the same loudness as the other three, so each one is
trimmed to a single event, levelled against the others, and written out small.

Usage: python3 scripts/cut-cries.py
"""

import os
import subprocess
import sys
import tempfile
import wave

import numpy as np

SOURCE = 'games/seesaw/assets/sounds/source'
OUT = 'games/seesaw/assets/sounds'

# Which recording each animal comes from, and the one sound to take out of it.
# A window of None means the whole file is a single cry already.
CRIES = {
    'chicken': ('ribhavagrawal-chicken-cluking-type-3-293320.mp3', (1.74, 2.40)),
    'cat': ('dragon-studio-meowing-cat-401728.mp3', (2.72, 3.42)),
    'dog': ('dragon-studio-free-dog-bark-419014.mp3', None),
    'bear': ('universfield-bear-growl-191995.mp3', None),
}

RATE = 44100
# Level every cry to the same loudness, measured over the part that is actually
# sounding rather than the silence around it, so one gain in the game covers all
# four. Held under a peak ceiling so nothing that started loud ends up clipped.
TARGET_RMS = 0.17
PEAK_CEILING = 0.95
# Silence at the head of a cue is a delay the child feels, so it is cut to where
# the sound really starts - with just enough left to keep the attack intact.
SILENCE = 0.02
HEAD_PAD, TAIL_PAD = 0.012, 0.09
# Fades, to stop a cut edge from clicking.
FADE_IN, FADE_OUT = 0.006, 0.05


def decode(path):
    """Stock clips arrive as stereo mp3; everything downstream wants mono PCM."""
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, 'decoded.wav')
        subprocess.run(
            ['afconvert', '-f', 'WAVE', '-d', f'LEI16@{RATE}', '-c', '1', path, wav],
            check=True, capture_output=True,
        )
        with wave.open(wav) as w:
            return np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(float) / 32768


def tighten(audio):
    """Cut the silence off both ends, keeping the attack and the tail."""
    loud = np.nonzero(np.abs(audio) > SILENCE)[0]
    if len(loud) == 0:
        return audio
    start = max(0, loud[0] - int(HEAD_PAD * RATE))
    end = min(len(audio), loud[-1] + int(TAIL_PAD * RATE))
    return audio[start:end]


def shape(audio):
    fade_in = min(int(FADE_IN * RATE), len(audio))
    fade_out = min(int(FADE_OUT * RATE), len(audio))
    audio = audio.copy()
    audio[:fade_in] *= np.linspace(0, 1, fade_in)
    audio[len(audio) - fade_out:] *= np.linspace(1, 0, fade_out)
    return audio


def level(audio):
    peak = np.abs(audio).max()
    sounding = audio[np.abs(audio) > peak * 0.08]
    rms = float(np.sqrt((sounding ** 2).mean())) if len(sounding) else 0.0
    if rms == 0:
        return audio
    gain = min(TARGET_RMS / rms, PEAK_CEILING / peak)
    return audio * gain


def write(audio, name):
    """AAC in an m4a: a tenth of the size of the PCM, and Apple's own format."""
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, 'cry.wav')
        with wave.open(wav, 'w') as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(RATE)
            w.writeframes((np.clip(audio, -1, 1) * 32767).astype('<i2').tobytes())
        out = f'{OUT}/{name}.m4a'
        subprocess.run(
            ['afconvert', '-f', 'm4af', '-d', 'aac', '-b', '96000', '-s', '3', wav, out],
            check=True, capture_output=True,
        )
    size = os.path.getsize(out) / 1024
    print(f'{name}: {len(audio) / RATE:.2f}s  {size:.1f}KB')


def main():
    for name, (source, window) in CRIES.items():
        audio = decode(f'{SOURCE}/{source}')
        if window:
            audio = audio[int(window[0] * RATE):int(window[1] * RATE)]
        write(level(shape(tighten(audio))), name)


if __name__ == '__main__':
    sys.exit(main())
