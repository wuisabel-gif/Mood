from __future__ import annotations

from collections import deque
from typing import Dict, List, Set


def apply_stack(motif: List[int]) -> List[int]:
    stack: List[int] = []
    out: List[int] = []
    for degree in motif:
        stack.append(degree)
        if len(stack) >= 3:
            out.append(stack.pop())
        else:
            out.append(degree)
    return out


def apply_queue(motif: List[int]) -> List[int]:
    queue: deque[int] = deque()
    out: List[int] = []
    for degree in motif:
        queue.append(degree)
        if len(queue) >= 3:
            out.append(queue.popleft())
        else:
            out.append(degree)
    return out


def apply_dfs(motif: List[int]) -> List[int]:
    neighbors: Dict[int, List[int]] = {
        0: [1, 2],
        1: [0, 2, 3],
        2: [0, 1, 3, 4],
        3: [1, 2, 4, 5],
        4: [2, 3, 5, 6],
        5: [3, 4, 6],
        6: [4, 5],
    }

    start = motif[0] if motif else 0
    stack: List[int] = [start]
    visited: Set[int] = set()
    out: List[int] = []

    while stack and len(out) < len(motif):
        node = stack.pop()
        if node in visited:
            continue
        visited.add(node)
        out.append(node)

        for candidate in reversed(neighbors[node]):
            if candidate not in visited:
                stack.append(candidate)

    while len(out) < len(motif):
        out.append(out[-1] if out else 0)

    if out:
        out[-1] = 0
    return out


def apply_recursion(motif: List[int], depth: int = 2) -> List[int]:
    def expand(sequence: List[int], current_depth: int) -> List[int]:
        if current_depth == 0:
            return sequence

        out: List[int] = []
        for index in range(len(sequence) - 1):
            a, b = sequence[index], sequence[index + 1]
            out.append(a)
            step = 1 if b > a else -1 if b < a else 0
            out.append(max(0, min(6, a + step)))

        out.append(sequence[-1])
        return expand(out, current_depth - 1)

    if not motif:
        return []

    out = expand(motif, depth)
    out[-1] = 0
    return out


def transform_motif(mode: str, motif: List[int]) -> List[int]:
    if mode == "stack":
        return apply_stack(motif)
    if mode == "queue":
        return apply_queue(motif)
    if mode == "dfs":
        return apply_dfs(motif)
    if mode == "recursion":
        return apply_recursion(motif)
    raise ValueError(f"Unknown mode: {mode}")
