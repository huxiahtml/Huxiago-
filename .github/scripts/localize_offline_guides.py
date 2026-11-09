"""Generate the two translated, self-contained downloads from the Traditional Chinese guide."""
from base64 import b64encode
from hashlib import sha256
from html import escape, unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
HAN = re.compile(r"[\u3400-\u9fff]")
ATTRIBUTE = re.compile(r'''(\s(?:aria-label|alt|title|placeholder|content)=)(["'])(.*?)\2''', re.S)
SCRIPT = re.compile(r'(<script id="(?:v10-share-and-details-script|v12-share-positioning)">)(.*?)(</script>)', re.S)
TEMPLATE = re.compile(r"(\x60)([^\x60]*)(\x60)", re.S)
COVER_FILES = {"zh-Hans": "huxiago-title-zh-cn.svg", "en": "huxiago-title-en.svg"}


def payload(html, element_id):
    match = re.search(r'<script type="application/json" id="' + element_id + r'">(.*?)</script>', html, re.S)
    return json.loads(match[1])


class LocalizedHTML(HTMLParser):
    def __init__(self, html, translate):
        super().__init__(convert_charrefs=False)
        self.html = html
        self.translate = translate
        self.lines = [0, *(m.end() for m in re.finditer("\n", html))]
        self.edits = []
        self.raw = False
        self.pending_text = None

    def source_position(self):
        line, column = self.getpos()
        return self.lines[line - 1] + column

    def edit(self, old, new):
        if new != old:
            start = self.source_position()
            self.edits.append((start, start + len(old), new))

    def handle_starttag(self, tag, attrs):
        self.flush_text()
        if tag in {"script", "style"}:
            self.raw = True
        old = self.get_starttag_text()

        def attr(match):
            value = unescape(match[3])
            translated = self.translate(value)
            return match[0] if translated == value else f'{match[1]}"{escape(translated, quote=True)}"'

        self.edit(old, ATTRIBUTE.sub(attr, old))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        self.flush_text()
        if tag in {"script", "style"}:
            self.raw = False

    def handle_data(self, data):
        if not self.raw:
            self.queue_text(len(data))

    def queue_text(self, length):
        start = self.source_position()
        if self.pending_text is None or self.pending_text[1] != start:
            self.flush_text()
            self.pending_text = (start, start + length)
        else:
            self.pending_text = (self.pending_text[0], start + length)

    def handle_entityref(self, name):
        length = len(name) + 1
        self.queue_text(length + self.html.startswith(";", self.source_position() + length))

    def handle_charref(self, name):
        length = len(name) + 2
        self.queue_text(length + self.html.startswith(";", self.source_position() + length))

    def flush_text(self):
        if self.pending_text is None:
            return
        start, end = self.pending_text
        self.pending_text = None
        text = unescape(self.html[start:end])
        translated = self.translate(text)
        if translated != text:
            self.edits.append((start, end, escape(translated, quote=False)))

    def render(self):
        self.feed(self.html)
        self.close()
        self.flush_text()
        parts = []
        end = 0
        for left, right, replacement in self.edits:
            parts.extend((self.html[end:left], replacement))
            end = right
        parts.append(self.html[end:])
        return "".join(parts)


def translate_guide(source, original_name, locale, filename, strings, characters):
    column = ("zh-Hans", "en").index(locale)
    keys = sorted((key for key in strings if HAN.search(key)), key=len, reverse=True)
    simplified = str.maketrans(characters)

    def translate(text):
        if not HAN.search(text):
            return text
        stripped = text.strip()
        key = " ".join(stripped.split())
        if key in strings:
            return text.replace(stripped, strings[key][column], 1)
        if column == 0:
            return text.translate(simplified)
        for phrase in keys:
            if phrase in text:
                text = text.replace(phrase, strings[phrase][column])
        return text

    def localize_script(match):
        script = TEMPLATE.sub(
            lambda m: m[1] + LocalizedHTML(m[2], translate).render() + m[3] if HAN.search(m[2]) else m[0],
            match[2],
        )
        script = re.sub(r"'(<h3>.*?</p>)'", lambda m: json.dumps(
            LocalizedHTML(m[1], translate).render(), ensure_ascii=False), script)
        for phrase in strings:
            if not HAN.search(phrase):
                continue
            literal = "'" + phrase + "'"
            if literal in script:
                script = script.replace(literal, json.dumps(translate(phrase), ensure_ascii=False))
        for message in re.findall(r"'([^'\n]*\\n[^'\n]*)'", script):
            if HAN.search(message):
                script = script.replace("'" + message + "'", json.dumps(
                    translate(message.replace(r"\n", "\n")), ensure_ascii=False))
        return match[1] + script + match[3]

    result = LocalizedHTML(source, translate).render()
    result = SCRIPT.sub(localize_script, result)
    result = re.sub(r'(<style[^>]*>)(.*?)(</style>)',
                    lambda m: m[1] + re.sub(r'content:"([^"]+)"',
                    lambda label: "content:" + json.dumps(translate(label[1]), ensure_ascii=False), m[2]) + m[3],
                    result, flags=re.S)
    result = result.replace('<html lang="zh-Hant">', f'<html lang="{locale}">', 1)
    result = result.replace(original_name, filename)
    cover = ROOT / "media" / COVER_FILES[locale]
    svg = cover.read_bytes()
    cover_title = re.search(r"<title[^>]*>(.*?)</title>", svg.decode("utf-8"), re.S)[1]
    result = re.sub(r'(<h1 class="cover-title" aria-label=")[^"]+', lambda m: m[1] + escape(cover_title, quote=True), result, count=1)
    result = result.replace("'https://huxiago.com/' : location", f"'https://huxiago.com/?lang={locale}' : location", 1)
    cover_src = "data:image/svg+xml;base64," + b64encode(svg).decode("ascii")
    result, count = re.subn(r'(<img class="cover-title-art" src=")[^"]+',
                            lambda _: '<img class="cover-title-art" style="aspect-ratio:1638 / 739" src="' + cover_src,
                            result, count=1)
    if count != 1:
        raise ValueError("Offline cover art not found")
    return result.replace("\r\n", "\n").encode("utf-8")


def main():
    home = ROOT / "index.html"
    html = home.read_bytes().decode("utf-8")
    downloads = payload(html, "hux-guide-downloads")["files"]
    language = payload(html, "hux-language-data")
    strings = {" ".join(key.split()): value for key, value in language["strings"].items()}
    source = (ROOT / downloads["zh-Hant"]).read_bytes().decode("utf-8")
    manifest = ROOT / "site-files.json"
    previous = manifest.read_bytes()
    data = json.loads(previous)
    for locale, filename in downloads.items():
        file = ROOT / filename
        if locale != "zh-Hant":
            file.write_bytes(translate_guide(source, downloads["zh-Hant"], locale, filename, strings,
                                             language["simplifiedCharacters"]))
        content = file.read_bytes()
        data["files"][filename] = {"bytes": len(content), "sha256": sha256(content).hexdigest()}
        print(f"{locale}  {len(content):,} bytes  {filename}")
    content = home.read_bytes()
    data["files"][home.name] = {"bytes": len(content), "sha256": sha256(content).hexdigest()}
    manifest.write_bytes((json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))


if __name__ == "__main__":
    main()
