from __future__ import annotations

from typing import List

NOTE_NAMES = {
    "C": 0,
    "C#": 1,
    "Db": 1,
    "D": 2,
    "D#": 3,
    "Eb": 3,
    "E": 4,
    "F": 5,
    "F#": 6,
    "Gb": 6,
    "G": 7,
    "G#": 8,
    "Ab": 8,
    "A": 9,
    "A#": 10,
    "Bb": 10,
    "B": 11,
}

MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]
MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10]


def scale_pitches(key: str, octave: int, scale_type: str) -> List[int]:
    """Return one octave of scale tones as MIDI note values."""
    if key not in NOTE_NAMES:
        raise ValueError(f"Unknown key '{key}'. Supported keys: {', '.join(sorted(NOTE_NAMES.keys()))}")

    if scale_type not in {"major", "minor"}:
        raise ValueError("scale_type must be 'major' or 'minor'")

    root = NOTE_NAMES[key]
    steps = MAJOR_STEPS if scale_type == "major" else MINOR_STEPS
    return [12 * octave + root + step for step in steps]


def clamp_midi(note: int) -> int:
    """Clamp a number into valid MIDI range [0, 127]."""
    return max(0, min(127, note))
