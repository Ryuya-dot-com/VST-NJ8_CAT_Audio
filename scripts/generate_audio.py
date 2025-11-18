#!/usr/bin/env python3
"""
Generate MP3 audio files for each CorrectAnswer entry in jacet_parameters.csv.

Example:
  python scripts/generate_audio.py
  python scripts/generate_audio.py --force
"""
from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path

from gtts import gTTS

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CSV = PROJECT_ROOT / "public" / "jacet_parameters.csv"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "public" / "audio"


def slugify(word: str) -> str:
    """Create a filesystem-friendly filename from the word."""
    slug = word.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug or "audio"


def read_words(csv_path: Path) -> list[str]:
    targets = ["CorrectAnswer", "Distractor_1", "Distractor_2", "Distractor_3"]
    with csv_path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        words: list[str] = []
        for row in reader:
            for column in targets:
                word = row.get(column)
                if not word:
                    continue
                word = word.strip()
                if word:
                    words.append(word)
    return words


def generate_audio(words: list[str], output_dir: Path, force: bool = False, lang: str = "en"):
    output_dir.mkdir(parents=True, exist_ok=True)

    for word in words:
        filename = f"{slugify(word)}.mp3"
        destination = output_dir / filename

        if destination.exists() and not force:
            print(f"Skipping existing {destination}")
            continue

        print(f"Generating {destination} ...")
        tts = gTTS(text=word, lang=lang, slow=False)
        tts.save(destination.as_posix())


def main():
    parser = argparse.ArgumentParser(description="Generate MP3 files for CAT audio prompts.")
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV, help="Path to jacet_parameters.csv")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_DIR, help="Directory to store MP3 files")
    parser.add_argument("--lang", default="en", help="gTTS language code (default: en)")
    parser.add_argument("--force", action="store_true", help="Regenerate audio even if files exist")

    args = parser.parse_args()

    words = read_words(args.csv)
    unique_words = list(dict.fromkeys(words))  # Preserve order while removing duplicates
    print(f"Loaded {len(unique_words)} words from {args.csv}")
    generate_audio(unique_words, args.output, force=args.force, lang=args.lang)


if __name__ == "__main__":
    main()
