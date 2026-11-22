"""Build HUXIAGO EP.02 web pages and single-language offline HTML."""
import argparse
import base64
import hashlib
import json
import re
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTENT = ROOT / "docs/ep02-content.json"
CSS = ROOT / "ep02/guide.css"
LOCALES = ("zh-Hant", "zh-Hans", "en")
LABELS = ("繁體中文", "简体中文", "English")
TITLE_ART = {"zh-Hant": "zh-tw", "zh-Hans": "zh-cn", "en": "en"}


def data_uri(path, mime):
    raw = path.read_bytes()
    if mime == "image/svg+xml":
        raw = raw.replace(b"\r\n", b"\n")
    return f'data:{mime};base64,{base64.b64encode(raw).decode("ascii")}'


def photo(asset, locale_index, css_class=""):
    src = data_uri(ROOT / "ep02" / asset["file"], "image/webp")
    caption = escape(asset["captions"][locale_index], quote=True)
    return (f'<figure class="{css_class}"><img src="{src}" alt="{caption}" '
            f'loading="lazy" decoding="async"><figcaption>{caption}</figcaption></figure>')


def render(data, lang, offline, css):
    t = data["locales"][lang]
    ix = LOCALES.index(lang)
    offer = data["offer"]
    title_asset = TITLE_ART[lang]
    logo = data_uri(ROOT / f"media/huxiago-title-{title_asset}.svg", "image/svg+xml")
    hero = data_uri(ROOT / "media/ea863e999767b920.webp", "image/webp")
    download = f"HUXIAGO_Bangkok_EP02_{lang}.html"
    controls = ""
    episode = '<span class="vol">Ep.02</span>'
    acquire = ""
    if not offline:
        buttons = "".join(
            f'<button type="button" data-hux-lang="{code}" lang="{code}" aria-label="{label}" '
            f'aria-pressed="{str(code == lang).lower()}">{short}</button>'
            for code, label, short in zip(LOCALES, LABELS, ("繁", "简", "EN"))
        )
        controls = f'<div class="hux-language-bar"><div class="hux-language-switch" role="group" aria-label="Language">{buttons}</div></div>'
        episode = f"""<span class="episode-picker">
<button class="vol episode-trigger" type="button" aria-expanded="false" aria-controls="episode-menu">Ep.02
<svg aria-hidden="true" class="episode-chevron" viewBox="0 0 16 16" fill="none"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
</button><span id="episode-menu" class="episode-menu" hidden>
<a class="episode-upcoming" href="index.html">{escape(t[7])}</a>
<span class="episode-current"><b>Ep.02</b><em>{escape(t[6])}</em></span>
</span></span>"""
        acquire = f"""<div class="acquire-guide">
<a class="acquire-button" href="{download}" download="{download}">
<span class="acquire-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v3h16v-3"/></svg></span>
<span>{escape(t[4])}<small>{escape(t[14])}</small></span><span class="acquire-arrow" aria-hidden="true">↗</span></a></div>"""
    category = data["categories"]
    toc = []
    stops = []
    for s in data["stops"]:
        title, intro, detail = map(escape, s["copy"][ix])
        name = escape(s["name"])
        cat = escape(category[s["id"]][ix])
        route = ""
        if s["id"] == "saen-saep":
            piers = "".join(f"<li>{escape(pier)}</li>" for pier in data["piers"])
            route = f'<h4 class="story-heading">{escape(t[16])}</h4><ol class="story-list canal">{piers}</ol>'
        media = ""
        thumb = ""
        if s["id"] in data["photos"]:
            asset = data["photos"][s["id"]]
            media = '<div class="gallery">' + photo(asset, ix) + '</div>'
            src = data_uri(ROOT / "ep02" / asset["file"], "image/webp")
            thumb = f'<img class="thumb" src="{src}" alt="" loading="lazy">'
        else:
            thumb = f'<span class="thumb ep02-text-thumb" aria-hidden="true">{s["label"]}</span>'
        toc.append(
            f'<a class="toc-item" href="#{s["id"]}" data-category="{cat}">'
            f'<span class="toc-item-number" aria-hidden="true">{s["label"]}</span>'
            f'<span class="toc-item-content"><strong class="toc-item-title">{name}</strong>'
            f'<small class="toc-item-description">{title}</small></span>'
            f'<span class="toc-item-side"><span class="toc-item-tag">{cat}</span>'
            f'<span class="toc-item-action">{escape(data["labels"]["open"][ix])} →</span></span></a>'
        )
        stops.append(
            f'<details class="card stop" id="{s["id"]}"><summary>{thumb}'
            f'<span class="head"><small>{s["label"]} · {cat}</small><h3>{name}</h3><p>{title}</p></span>'
            f'<span aria-hidden="true" class="chev">⌄</span></summary>'
            f'<div class="body">{media}<p>{intro}</p>{route}'
            f'<div class="info"><b>{escape(t[17])}</b>{detail}</div>'
            f'<a class="btn" href="{escape(s["url"], quote=True)}" target="_blank" rel="noopener noreferrer">↗ {escape(t[s["action"]])}</a>'
            f'</div></details>'
        )
    all_label = data["labels"]["all"][ix]
    filter_names = [all_label] + list(dict.fromkeys(category[s["id"]][ix] for s in data["stops"]))
    filters = "".join(
        f'<button type="button" data-filter="{escape(label, quote=True)}" aria-pressed="{str(n == 0).lower()}">{escape(label)}</button>'
        for n, label in enumerate(filter_names)
    )
    return f"""<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>{escape(t[0])} EP.02 | HUXIAGO</title>
<style>{css}</style>
</head>
<body class="visual-v7">
<div class="wrap">
<header class="cover" id="top">
<div aria-hidden="true" class="hero-doodles"><span class="doodle d-star">✦</span><span class="doodle d-flower">✿</span><span class="doodle d-sun">☀</span><span class="doodle d-plane">➜</span><span class="doodle d-spark">✧</span></div>
<div class="hux-cover-topbar"><p class="kicker"><strong>HUXIAGO</strong><span>BKK GUIDE</span></p>{controls}</div>
<h1 class="cover-title" aria-label="{escape(t[0], quote=True)} EP.02"><img class="cover-title-art" src="{logo}" alt="" aria-hidden="true" decoding="async">
<span class="cover-title-meta"><span class="cover-title-sub">{escape(data["labels"]["bangkok"][ix])}</span>{episode}</span></h1>
{acquire}
<div class="hero"><img fetchpriority="high" decoding="async" alt="Zev &amp; Kik" src="{hero}"><span>{escape(t[5] if offline else t[6])}</span></div>
<p class="byline">by 胡搞夏搞 Zev and Kik · @huxia.thai</p>
<div aria-hidden="true" class="travel-stamp">BANGKOK / 2026</div></header>
<nav class="pocket-nav" aria-label="{escape(data["labels"]["toc"][ix], quote=True)}"><a href="#deals">{escape(t[3])}</a><a href="#toc">{escape(data["labels"]["toc"][ix])}</a><a href="#spots">{escape(t[2])}</a></nav>
<p class="intro">{escape(t[1])}</p>
<section aria-labelledby="ep02-deals-title" class="deal-zone" id="deals">
<p class="deal-kicker">HUXIAGO POCKET DEALS</p><h2 id="ep02-deals-title">{escape(data["labels"]["deal_line"][ix])}</h2>
<div class="deal-track">
<article class="deal-ticket deal-yellow">
<div class="ticket-top"><span class="ticket-no">#01</span><span class="ticket-eyebrow">{escape(data["labels"]["food_deal"][ix])}</span></div>
<h3>{escape(offer["name"])}</h3><div class="ticket-value">{escape(t[11])}</div>
{photo(data["photos"]["kushiro"], ix, "ep02-deal-photo")}
<p>{escape(t[13])}</p>
<a class="ticket-cta" href="{escape(offer["url"], quote=True)}" data-cta-id="ep02-kushiro-offer" target="_blank" rel="noopener noreferrer"><span class="ticket-cta-label">{escape(t[12])}</span></a>
<div aria-hidden="true" class="ticket-dots">• • •</div></article>
</div></section>
<nav aria-label="{escape(data["labels"]["toc"][ix], quote=True)}" class="toc" id="toc">
<h2 class="sec-title">{escape(data["labels"]["toc"][ix])}</h2>
<div class="toc-filters">{filters}</div><div class="toc-list">{"".join(toc)}</div></nav>
<section aria-labelledby="spots"><h2 id="spots" class="sec-title">{escape(t[15])}</h2>{"".join(stops)}</section>
<footer class="footer">HUXIAGO Ep.02 · {escape(t[14] if offline else t[18])}</footer>
</div>
<script>
const buttons = [...document.querySelectorAll('[data-filter]')];
const rows = [...document.querySelectorAll('.toc-item')];
buttons.forEach((button, index) => button.addEventListener('click', () => {{
  buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  rows.forEach(row => {{ row.style.display = index === 0 || row.dataset.category === button.dataset.filter ? '' : 'none'; }});
}}));
rows.forEach(row => row.addEventListener('click', () => {{
  document.querySelector(row.getAttribute('href')).open = true;
}}));
document.querySelectorAll('[data-hux-lang]').forEach(button => button.addEventListener('click', () => {{
  location.href = 'ep02-' + button.dataset.huxLang + '.html' + location.hash;
}}));
const menu = document.getElementById('episode-menu');
const trigger = document.querySelector('.episode-trigger');
trigger?.addEventListener('click', () => {{
  menu.hidden = !menu.hidden;
  trigger.setAttribute('aria-expanded', String(!menu.hidden));
}});
trigger?.addEventListener('keydown', event => {{
  if (event.key === 'Escape') {{ menu.hidden = true; trigger.setAttribute('aria-expanded','false'); }}
}});
</script>
</body>
</html>
"""


def build():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Fail if outputs differ from the source data.")
    args = parser.parse_args()
    data = json.loads(CONTENT.read_text(encoding="utf-8-sig"))
    index = (ROOT / "index.html").read_bytes()
    donor = index.decode("utf-8")
    css = "\n".join(re.findall(r"<style\b[^>]*>(.*?)</style>", donor, re.S | re.I))
    css += "\n" + CSS.read_text(encoding="utf-8-sig")
    css = "\n".join(line.rstrip() for line in css.splitlines())
    manifest_path = ROOT / "site-files.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    outputs = {}
    for lang in LOCALES:
        outputs[f"ep02-{lang}.html"] = render(data, lang, False, css).encode("utf-8")
        outputs[f"HUXIAGO_Bangkok_EP02_{lang}.html"] = render(data, lang, True, css).encode("utf-8")
    for name, raw in outputs.items():
        manifest["files"][name] = {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
    for suffix in TITLE_ART.values():
        name = f"media/huxiago-title-{suffix}.svg"
        raw = (ROOT / name).read_bytes().replace(b"\r\n", b"\n")
        manifest["files"][name] = {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
    manifest["files"]["index.html"] = {"bytes": len(index), "sha256": hashlib.sha256(index).hexdigest()}
    outputs["site-files.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    for name, raw in outputs.items():
        target = ROOT / name
        if args.check:
            if not target.is_file() or target.read_bytes() != raw:
                parser.exit(1, f"Out of date: {name}\n")
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw)
    print(f"{len(outputs) - 1} EP.02 guides verified" if args.check else f"{len(outputs) - 1} EP.02 guides built")


if __name__ == "__main__":
    build()
