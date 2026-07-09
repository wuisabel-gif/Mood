from __future__ import annotations

from typing import List

EIGHTH_TICKS = 240
QUARTER_TICKS = 480


def eighth_note_pattern(length: int) -> List[int]:
    """Mostly eighth notes with a quarter-note phrase landing every 4th note."""
    out: List[int] = []
    for index in range(length):
        out.append(EIGHTH_TICKS if index % 4 != 3 else QUARTER_TICKS)
    return out


def build_melody_durations(num_notes: int) -> List[int]:
    return eighth_note_pattern(num_notes)
