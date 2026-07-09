"""Algorithmic music generation engines and helpers."""

from .modes import transform_motif
from .rhythm import build_melody_durations, eighth_note_pattern
from .scales import clamp_midi, scale_pitches

__all__ = [
    "transform_motif",
    "build_melody_durations",
    "eighth_note_pattern",
    "clamp_midi",
    "scale_pitches",
]
