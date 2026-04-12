#!/usr/bin/env python3

import os
from pathlib import Path

EXTENSIONS = {".ts", ".tsx", ".rs"}

def count_lines(path: Path) -> int:
    with path.open("r", encoding="utf-8", errors="ignore") as f:
        return sum(1 for _ in f)


def main():
    total_lines = 0
    files = []
    search_dirs = [Path("src"), Path("src-tauri") / "src"]

    for search_dir in search_dirs:
        if not search_dir.is_dir():
            continue
        for dirpath, _, filenames in os.walk(search_dir):
            for filename in filenames:
                ext = Path(filename).suffix.lower()
                if ext in EXTENSIONS:
                    file_path = Path(dirpath) / filename
                    files.append(file_path)

    files.sort()

    for file_path in files:
        lines = count_lines(file_path)
        total_lines += lines
        print(f"{lines:7d}  {file_path}")

    print("=" * 48)
    print(f"Total .ts/.rs files: {len(files)}")
    print(f"Total lines: {total_lines}")


if __name__ == "__main__":
    main()