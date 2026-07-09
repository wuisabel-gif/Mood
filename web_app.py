from __future__ import annotations

import argparse
import json
import mimetypes
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from engine.rhythm import QUARTER_TICKS, build_melody_durations
from generate import Config, build_midi_file, generate_piece, midi_to_bytes, normalize_key

ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"


def parse_web_config(raw: dict[str, Any]) -> Config:
    seed = int(raw.get("seed", 42))
    mode = str(raw.get("mode", "stack"))
    key = normalize_key(str(raw.get("key", "C")))
    scale_type = str(raw.get("scale", "major"))
    bpm = int(raw.get("tempo", 96))
    bars = int(raw.get("bars", 8))

    if mode not in {"stack", "queue", "dfs", "recursion"}:
        raise ValueError("mode must be one of stack, queue, dfs, recursion")
    if scale_type not in {"major", "minor"}:
        raise ValueError("scale must be major or minor")
    if bars < 1:
        raise ValueError("bars must be >= 1")
    if bpm < 20:
        raise ValueError("tempo must be >= 20")

    return Config(
        seed=seed,
        mode=mode,
        key=key,
        scale_type=scale_type,
        bpm=bpm,
        bars=bars,
        out="output.mid",
        txt_out=None,
    )


def build_payload(cfg: Config) -> dict[str, Any]:
    melody_degrees, bass_degrees, melody, bass = generate_piece(cfg)

    melody_durations = [ticks / 480 for ticks in build_melody_durations(len(melody))]
    bass_durations = [QUARTER_TICKS / 480 for _ in bass]

    return {
        "config": {
            "seed": cfg.seed,
            "mode": cfg.mode,
            "key": cfg.key,
            "scale": cfg.scale_type,
            "tempo": cfg.bpm,
            "bars": cfg.bars,
        },
        "melody": {
            "degrees": melody_degrees,
            "notes": melody,
            "durations": melody_durations,
        },
        "bass": {
            "degrees": bass_degrees,
            "notes": bass,
            "durations": bass_durations,
        },
    }


class MusicHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)

        if parsed.path == "/":
            self.serve_file(ROOT / "index.html", "text/html; charset=utf-8")
            return

        if parsed.path.startswith("/static/"):
            relative = parsed.path.removeprefix("/static/")
            file_path = (STATIC_DIR / relative).resolve()
            if not str(file_path).startswith(str(STATIC_DIR.resolve())) or not file_path.is_file():
                self.send_error(HTTPStatus.NOT_FOUND)
                return

            mime, _ = mimetypes.guess_type(str(file_path))
            self.serve_file(file_path, mime or "application/octet-stream")
            return

        if parsed.path == "/download.mid":
            self.handle_download(parsed.query)
            return

        self.send_error(HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path != "/api/generate":
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)

        try:
            payload = json.loads(body.decode("utf-8"))
            cfg = parse_web_config(payload)
            response = build_payload(cfg)
            self.send_json(response, status=HTTPStatus.OK)
        except (ValueError, json.JSONDecodeError) as exc:
            self.send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)

    def handle_download(self, query: str) -> None:
        try:
            parsed_query = parse_qs(query)
            flat = {key: values[0] for key, values in parsed_query.items()}
            cfg = parse_web_config(flat)

            _, _, melody, bass = generate_piece(cfg)
            midi_file = build_midi_file(cfg, melody, bass)
            midi_bytes = midi_to_bytes(midi_file)
            filename = f"{cfg.mode}_{cfg.key}_{cfg.scale_type}_{cfg.seed}.mid"

            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "audio/midi")
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            self.send_header("Content-Length", str(len(midi_bytes)))
            self.end_headers()
            self.wfile.write(midi_bytes)
        except ValueError as exc:
            self.send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)

    def send_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def serve_file(self, file_path: Path, content_type: str) -> None:
        if not file_path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        data = file_path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def run_server(host: str = "127.0.0.1", port: int = 5000) -> None:
    server = ThreadingHTTPServer((host, port), MusicHandler)
    print(f"Serving on http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        server.server_close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the Algorithmic Music Generator web UI.")
    parser.add_argument("--host", default="127.0.0.1", help="Host interface to bind.")
    parser.add_argument("--port", type=int, default=5000, help="Port to bind.")
    args = parser.parse_args()
    run_server(host=args.host, port=args.port)
