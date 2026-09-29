"""Validate a complete static site ZIP, then replace the tracked site files."""

from __future__ import annotations

import hashlib
import json
import shutil
import sys
import tempfile
import zipfile
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit


ROOT = Path.cwd()
MANIFEST = ROOT / "site-files.json"
MAX_UNPACKED = 200 * 1024 * 1024


class References(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.refs: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = dict(attrs)
        for key in ("src", "href", "poster"):
            if values.get(key):
                self.refs.append(values[key])
        if values.get("srcset"):
            self.refs.extend(item.strip().split()[0] for item in values["srcset"].split(","))


def safe_name(name: str) -> str:
    path = PurePosixPath(name)
    if (not name or name.startswith("/") or "\\" in name or
            any(part in (".", "..") or part.startswith(".") for part in path.parts)):
        raise ValueError(f"Unsafe archive path: {name!r}")
    if not (name == "index.html" or name.startswith("media/") or
            (len(path.parts) == 1 and name.endswith(".html"))):
        raise ValueError(f"Unexpected site file: {name!r}")
    return name


def local_references(stage: Path, html: Path) -> None:
    parser = References()
    parser.feed(html.read_text(encoding="utf-8"))
    missing = []
    for ref in parser.refs:
        parsed = urlsplit(ref)
        if parsed.scheme or parsed.netloc or ref.startswith(("#", "//")):
            continue
        path = unquote(parsed.path).lstrip("/")
        if not path:
            continue
        rel = PurePosixPath(path)
        if ".." in rel.parts or not (stage / path).is_file():
            missing.append(ref)
    if missing:
        raise ValueError(f"{html.name}: missing local references: {missing[:15]}")


def main() -> None:
    archive = ROOT / (sys.argv[1] if len(sys.argv) > 1 else "updates/site.zip")
    if not archive.is_file():
        raise ValueError("Upload updates/site.zip before running this action")
    with tempfile.TemporaryDirectory() as temp:
        stage = Path(temp)
        with zipfile.ZipFile(archive) as zf:
            entries = [item for item in zf.infolist() if not item.is_dir()]
            if not entries or sum(item.file_size for item in entries) > MAX_UNPACKED:
                raise ValueError("Empty or oversized site archive")
            names = [safe_name(item.filename) for item in entries]
            if len(names) != len(set(names)):
                raise ValueError("Duplicate filenames in archive")
            for item, name in zip(entries, names):
                if (item.external_attr >> 16) & 0o170000 == 0o120000:
                    raise ValueError(f"Symlinks are not allowed: {name}")
                target = stage / name
                target.parent.mkdir(parents=True, exist_ok=True)
                with zf.open(item) as source, target.open("wb") as output:
                    shutil.copyfileobj(source, output)

        if not (stage / "index.html").is_file():
            raise ValueError("The ZIP must contain index.html at its root")
        if not any(p.name.startswith("HUXIAGO_") for p in stage.glob("*.html")):
            raise ValueError("The complete offline HUXIAGO HTML is missing")
        for html in stage.glob("*.html"):
            local_references(stage, html)

        previous = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {"files": {}}
        for name in previous["files"]:
            safe_name(name)
            if name not in names:
                (ROOT / name).unlink(missing_ok=True)
        files = {}
        for name in names:
            src, dest = stage / name, ROOT / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)
            files[name] = {"bytes": src.stat().st_size, "sha256": hashlib.sha256(src.read_bytes()).hexdigest()}
        MANIFEST.write_text(json.dumps({"files": dict(sorted(files.items()))}, ensure_ascii=False, indent=2) + "\n")
        archive.unlink()
        print(f"Validated and published {len(files)} complete site files")


if __name__ == "__main__":
    main()
