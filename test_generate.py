"""Pins the generator's deterministic output. Run: python3 test_generate.py

A fixed seed + config must always produce the same notes; if this fails, the
musical output changed (intentionally or not).
"""

from generate import Config, generate_piece

CFG = Config(
    seed=42, mode="stack", key="C", scale_type="major",
    bpm=96, bars=4, out="x.mid", txt_out=None,
)

EXPECTED_MELODY = [69, 60, 60, 69, 64, 62, 62, 62, 71, 60, 60, 69, 65, 62, 64, 62,
                   69, 60, 60, 69, 64, 62, 62, 62, 71, 60, 60, 69, 65, 62, 62, 60]
EXPECTED_BASS = [36, 43, 43, 36, 36, 41, 43, 36, 36, 41, 43, 36, 36, 41, 43, 36]


def test_seed_is_deterministic():
    _, _, mel, bass = generate_piece(CFG)
    assert mel == EXPECTED_MELODY, mel
    assert bass == EXPECTED_BASS, bass

    _, _, mel2, bass2 = generate_piece(CFG)  # same seed -> identical
    assert mel2 == mel and bass2 == bass


if __name__ == "__main__":
    test_seed_is_deterministic()
    print("ok")
