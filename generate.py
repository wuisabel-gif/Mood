from __future__ import annotations

import argparse
import io
import random
from dataclasses import dataclass
from pathlib import Path
from typing import List

import mido

from engine.modes import transform_motif
from engine.rhythm import QUARTER_TICKS, build_melody_durations
from engine.scales import clamp_midi, scale_pitches


@dataclass
class Config:
    seed: int
    mode: str
    key: str
    scale_type: str
    bpm: int
    bars: int
    out: str
    txt_out: str | None
    meter_num: int = 4
    meter_den: int = 4


def normalize_key(raw_key: str) -> str:
    cleaned = raw_key.strip()
    if not cleaned:
        return cleaned
    if len(cleaned) == 1:
        return cleaned.upper()
    return cleaned[0].upper() + cleaned[1:]


def bpm_to_tempo(bpm: int) -> int:
    return int(60_000_000 / bpm)


def gen_motif(rng: random.Random, length: int = 8) -> List[int]:
    motif = [rng.randrange(0, 7) for _ in range(length)]
    motif[-1] = 1 if length > 1 else 0
    return motif


def vary_motif(rng: random.Random, motif: List[int]) -> List[int]:
    """Small variation for phrase repetition while keeping contour playable."""
    out = motif[:]
    for index in range(0, len(out), 2):
        delta = rng.choice([-1, 0, 1])
        out[index] = max(0, min(6, out[index] + delta))
    return out


def apply_cadence(rng: random.Random, degrees: List[int], scale_type: str) -> None:
    """Force final motion toward tonic: 2->1 (major/minor) or 7->1 occasionally."""
    if len(degrees) < 2:
        if degrees:
            degrees[-1] = 0
        return

    lead = 1 if scale_type == "minor" else rng.choice([1, 6])
    degrees[-2] = lead
    degrees[-1] = 0


def build_degree_sequence(cfg: Config, rng: random.Random) -> List[int]:
    melody_len = cfg.bars * 8
    phrase_len = min(8, melody_len)

    base = gen_motif(rng, length=phrase_len)
    transformed = transform_motif(cfg.mode, base)

    # 4-bar-ish phrase structure: motif + varied response.
    variant_source = vary_motif(rng, base)
    transformed_variant = transform_motif(cfg.mode, variant_source)
    phrase = transformed + transformed_variant

    if not phrase:
        phrase = [0]

    degrees = (phrase * ((melody_len // len(phrase)) + 1))[:melody_len]
    apply_cadence(rng, degrees, cfg.scale_type)
    return degrees


def build_bass_degrees(cfg: Config, rng: random.Random) -> List[int]:
    bass_len = cfg.bars * 4
    if cfg.scale_type == "major":
        progression = [0, 3, 4, 0]  # I-IV-V-I
    else:
        progression = [0, 5, 2, 6]  # i-VI-III-VII

    degrees = [progression[i % len(progression)] for i in range(bass_len)]

    # Add slight passing motion every second beat for movement.
    for i in range(1, bass_len, 2):
        choices = [degrees[i], max(0, degrees[i] - 1), min(6, degrees[i] + 1)]
        degrees[i] = rng.choice(choices)

    if bass_len > 0:
        degrees[-1] = 0
    return degrees


def write_midi(cfg: Config, melody_pitches: List[int], bass_pitches: List[int]) -> None:
    midi_file = build_midi_file(cfg, melody_pitches, bass_pitches)
    midi_file.save(cfg.out)


def build_midi_file(cfg: Config, melody_pitches: List[int], bass_pitches: List[int]) -> mido.MidiFile:
    mid = mido.MidiFile(ticks_per_beat=480)

    melody_track = mido.MidiTrack()
    mid.tracks.append(melody_track)
    melody_track.append(mido.MetaMessage("set_tempo", tempo=bpm_to_tempo(cfg.bpm), time=0))
    melody_track.append(
        mido.MetaMessage(
            "time_signature", numerator=cfg.meter_num, denominator=cfg.meter_den, time=0
        )
    )

    for pitch, duration in zip(melody_pitches, build_melody_durations(len(melody_pitches))):
        melody_track.append(
            mido.Message("note_on", note=clamp_midi(pitch), velocity=78, time=0)
        )
        melody_track.append(
            mido.Message("note_off", note=clamp_midi(pitch), velocity=0, time=duration)
        )

    bass_track = mido.MidiTrack()
    mid.tracks.append(bass_track)
    bass_track.append(mido.MetaMessage("set_tempo", tempo=bpm_to_tempo(cfg.bpm), time=0))
    bass_track.append(
        mido.MetaMessage(
            "time_signature", numerator=cfg.meter_num, denominator=cfg.meter_den, time=0
        )
    )

    for pitch in bass_pitches:
        bass_track.append(
            mido.Message("note_on", note=clamp_midi(pitch), velocity=60, time=0)
        )
        bass_track.append(
            mido.Message("note_off", note=clamp_midi(pitch), velocity=0, time=QUARTER_TICKS)
        )

    return mid


def midi_to_bytes(midi_file: mido.MidiFile) -> bytes:
    buffer = io.BytesIO()
    midi_file.save(file=buffer)
    return buffer.getvalue()


def generate_piece(cfg: Config) -> tuple[List[int], List[int], List[int], List[int]]:
    rng = random.Random(cfg.seed)

    melody_scale = scale_pitches(cfg.key, octave=5, scale_type=cfg.scale_type)
    bass_scale = scale_pitches(cfg.key, octave=3, scale_type=cfg.scale_type)

    melody_degrees = build_degree_sequence(cfg, rng)
    bass_degrees = build_bass_degrees(cfg, rng)

    melody = [melody_scale[d] for d in melody_degrees]
    bass = [bass_scale[d] for d in bass_degrees]
    return melody_degrees, bass_degrees, melody, bass


def write_note_list(
    txt_out: str,
    melody_degrees: List[int],
    melody_pitches: List[int],
    bass_degrees: List[int],
    bass_pitches: List[int],
) -> None:
    lines: List[str] = []
    lines.append("melody_index,melody_degree,melody_midi")
    for i, (degree, pitch) in enumerate(zip(melody_degrees, melody_pitches)):
        lines.append(f"{i},{degree},{pitch}")

    lines.append("")
    lines.append("bass_index,bass_degree,bass_midi")
    for i, (degree, pitch) in enumerate(zip(bass_degrees, bass_pitches)):
        lines.append(f"{i},{degree},{pitch}")

    Path(txt_out).write_text("\n".join(lines) + "\n", encoding="ascii")


def parse_args() -> Config:
    parser = argparse.ArgumentParser(description="Generate algorithmic studies as MIDI.")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument(
        "--mode", choices=["stack", "queue", "dfs", "recursion"], default="stack"
    )
    parser.add_argument("--key", default="C")
    parser.add_argument("--scale", choices=["major", "minor"], default="major")
    parser.add_argument("--tempo", type=int, default=96)
    parser.add_argument("--bars", type=int, default=8)
    parser.add_argument("--out", default="output.mid")
    parser.add_argument(
        "--txt-out",
        default=None,
        help="Optional path for generated degree/pitch list (CSV-like text).",
    )

    args = parser.parse_args()
    if args.bars < 1:
        parser.error("--bars must be >= 1")
    if args.tempo < 20:
        parser.error("--tempo must be >= 20")

    return Config(
        seed=args.seed,
        mode=args.mode,
        key=normalize_key(args.key),
        scale_type=args.scale,
        bpm=args.tempo,
        bars=args.bars,
        out=args.out,
        txt_out=args.txt_out,
    )


def main() -> None:
    cfg = parse_args()
    melody_degrees, bass_degrees, melody, bass = generate_piece(cfg)

    write_midi(cfg, melody, bass)

    if cfg.txt_out:
        write_note_list(cfg.txt_out, melody_degrees, melody, bass_degrees, bass)
        print(f"Saved: {cfg.out} and {cfg.txt_out}")
    else:
        print(f"Saved: {cfg.out}")


if __name__ == "__main__":
    main()
