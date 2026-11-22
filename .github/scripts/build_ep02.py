"""Build the HUXIAGO issues and synchronize cross-issue offers."""
import argparse
import base64
import hashlib
import json
import re
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSS = ROOT / "ep02/guide.css"
LOCALES = ("zh-Hant", "zh-Hans", "en")
TITLE_ART = {"zh-Hant": "zh-tw", "zh-Hans": "zh-cn", "en": "en"}


def data_uri(path, mime):
    raw = path.read_bytes()
    if mime == "image/svg+xml":
        raw = raw.replace(b"\r\n", b"\n")
    return f'data:{mime};base64,{base64.b64encode(raw).decode("ascii")}'


def gallery(assets, index):
    figures = []
    for filename, *captions in assets:
        caption = escape(captions[index], quote=True)
        src = data_uri(ROOT / "ep02" / filename, "image/webp")
        figures.append(f'<figure><img src="{src}" alt="{caption}" loading="lazy" decoding="async">'
                       f'<figcaption>{caption}</figcaption></figure>')
    return '<div class="gallery">' + "".join(figures) + '</div>'


TICKET_ICONS = {
    "phone": '<rect x="6" y="2.7" width="12" height="18.6" rx="3.2" fill="#fffaf0"/>'
             '<path d="M10 6h4m-3 12h2"/><path d="M9.6 12.1a3.8 3.8 0 0 1 4.8 0m-3.3 1.8a1.5 1.5 0 0 1 1.8 0"/>',
    "dining": '<path d="M4 4v4a3 3 0 0 0 6 0V4M7 4v16"/>'
              '<path d="M18 20V4c-3 1-4.5 4-4.5 7.5V13H18" fill="#fffaf0"/>',
    "taxi": '<path d="m5 11 1.5-4A2 2 0 0 1 8.4 6h7.2a2 2 0 0 1 1.9 1l1.5 4M10 6V3.5h4V6" fill="#fffaf0"/>'
            '<rect x="3.5" y="10" width="17" height="8" rx="3" fill="#fffaf0"/>'
            '<path d="M6 18v2m12-2v2M7 14h1m8 0h1"/>',
}


def ticket_icon(category):
    return (f'<span class="ticket-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false" '
            f'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" '
            f'stroke-linejoin="round">{TICKET_ICONS[category]}</svg></span>')


TRACK_LABELS = ("優惠票券", "优惠票券", "Offer tickets")
SWIPE_LABELS = ("左右滑動收好康  →", "左右滑动收好康  →", "Swipe for more offers →")
PREVIEW_COLORS = {"transport": "deal-pink", "dining-experiences": "deal-blue"}


def map_link(place, index, css_class="btn map-link"):
    label = place["labels"][index] if "labels" in place else "Google Maps"
    return (f'<a class="{css_class}" href="{escape(place["url"], quote=True)}" '
            f'target="_blank" rel="noopener noreferrer">↗ {escape(label)}</a>')


def location_block(places, index, action=""):
    items = "".join(
        f'<li><span class="location-address">{escape(place["address"])}</span>'
        f'<div class="place-actions">{map_link(place, index)}{action}</div></li>'
        for place in places
    )
    return f'<ul class="place-locations" role="list">{items}</ul>'


def deal_actions(offer, locations, index):
    primary = (
        f'<a class="ticket-cta" href="{escape(offer["url"], quote=True)}" data-cta-id="{offer["id"]}" '
        f'target="_blank" rel="noopener noreferrer"><span class="ticket-cta-label">{escape(offer["cta"][index])}</span></a>'
    )
    if "location" not in offer:
        return f'<div class="ticket-actions">{primary}</div>'
    place, = locations[offer["location"]]
    address = f'<p class="ticket-address">{escape(place["address"])}</p>'
    return f'{address}<div class="ticket-actions">{primary}{map_link(place, index, "map-link ticket-map")}</div>'


def add_ep01_locations(source, locations, lang, online):
    start, end = "<!--hux-muvmi-map:start-->", "<!--hux-muvmi-map:end-->"
    place, = locations["muvmi-ari"]
    index = LOCALES.index(lang)
    if online:
        # EP.01 switches language in place. Use its existing locale selectors.
        labels = "".join(f'<span class="location-label" lang="{code}">↗ {escape(label)}</span>'
                         for code, label in zip(LOCALES, place["labels"]))
        link = f'<a class="btn map-link" href="{escape(place["url"], quote=True)}" target="_blank" rel="noopener noreferrer">{labels}</a>'
        pins = (f'<ul class="place-locations" role="list" translate="no"><li><span class="location-address">'
                f'{escape(place["address"])}</span>{link}</li></ul>')
    else:
        pins = location_block([place], index)
    block = start + pins + end
    if start in source:
        return re.sub(re.escape(start) + ".*?" + re.escape(end), lambda _: block, source, count=1, flags=re.S)
    pattern = r'(<details class="card" id="spot-6">(?:(?!</details>).)*?)(</div></details>)'
    updated, count = re.subn(pattern, lambda m: m[1] + block + m[2], source, count=1, flags=re.S)
    if count != 1:
        raise ValueError("EP.01 MuvMi card missing")
    return updated


def deal_content(deals, locations, index):
    cards = []
    previews = []
    for key, offer in deals.items():
        icon = ticket_icon(offer["category"])
        name = escape(offer.get("ticket_name", offer["name"][index]))
        badge = escape(offer["badge"][index])
        if "url" not in offer:
            previews.append(
                f'<li class="deal-preview {PREVIEW_COLORS[key]}" data-upcoming-deal="{key}">'
                f'{icon}<span><strong>{name}</strong><small>{badge}</small></span></li>'
            )
            continue
        terms = f'<p class="ticket-terms">{escape(offer["terms"][index])}</p>' if "terms" in offer else ""
        actions = deal_actions(offer, locations, index)
        cards.append(
            f'<article class="deal-ticket deal-yellow" data-shared-deal="{key}" translate="no">'
            f'<div class="ticket-top">{icon}<span class="ticket-eyebrow">{escape(offer["label"][index])}</span></div>'
            f'<h3>{name}</h3><div class="ticket-value">{badge}</div><p>{escape(offer["body"][index])}</p>{terms}'
            f'{actions}'
            '<div aria-hidden="true" class="ticket-dots">• • •</div></article>'
        )
    upcoming = '<ul class="deal-previews" role="list">' + "".join(previews) + '</ul>' if previews else ""
    return (f'<div class="deal-layout"><div class="deal-track" aria-label="{TRACK_LABELS[index]}">{"".join(cards)}</div>'
            f'<p class="deal-swipe">{SWIPE_LABELS[index]}</p>{upcoming}</div>')


def update_ep01(source, deals, locations, online, lang):
    start = "<!--hux-shared-deals:start-->"
    end = "<!--hux-shared-deals:end-->"
    content = deal_content(deals, locations, LOCALES.index(lang))
    if online:
        templates = "".join(f'<template id="shared-deals-{code}">{deal_content(deals, locations, i)}</template>'
                            for i, code in enumerate(LOCALES))
        switcher = """<script>(()=>{const deals=document.getElementById('hux-shared-deals'),
root=document.documentElement;let locale=deals.dataset.locale;
function sync(){const next=root.lang;const tpl=document.getElementById('shared-deals-'+next);
if(!tpl||locale===next)return;locale=next;
deals.replaceChildren(tpl.content.cloneNode(true));}
sync();new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['lang']});})();</script>"""
        content = (f'<div id="hux-shared-deals" data-locale="{lang}" translate="no">{content}</div>'
                   + templates + switcher)
    ticket_css = (ROOT / "ep02/shared-tickets.css").read_text(encoding="utf-8")
    source = re.sub(r'<style id="hux-shared-ticket-icons">.*?</style>', "", source, flags=re.S)
    source = source.replace("</head>", f'<style id="hux-shared-ticket-icons">{ticket_css}</style></head>', 1)
    block = start + content + end
    # Accept the original EP.01 track, the former ticket-only marker, and the full managed block.
    track = r'<div\b[^>]*\bclass="deal-track"[^>]*>'
    swipe = r'<p class="deal-swipe"[^>]*>.*?</p>'
    managed = re.escape(start) + ".*?" + re.escape(end)
    if start not in source:
        pattern = track + ".*?" + swipe
    elif re.search(track + re.escape(start), source):
        pattern = track + managed + ".*?" + swipe
    else:
        pattern = managed
    updated, count = re.subn(pattern, lambda _: block, source, count=1, flags=re.S)
    if count != 1 or "esimconnect.com.tw" not in source:
        raise ValueError("EP.01 deals template missing")
    return add_ep01_locations(updated, locations, lang, online)


def extract(source, pattern):
    match = re.search(pattern, source, re.S)
    if not match:
        raise ValueError(f"EP.01 template component missing: {pattern}")
    return match[0]


def script(source, id):
    return extract(source, rf'<script id="{id}">.*?</script>')


def issue_shell(donor, localized, lang, labels, count, offline, legacy_download):
    download = f"HUXIAGO_Bangkok_EP02_{lang}.html"
    rail_pattern = r'<aside class="desktop-rail"[^>]*>.*?</aside>'
    rail = extract(localized, rail_pattern)
    if not offline:
        # Use EP.01 web navigation order and its starting state, with localized labels.
        links = {href: label for href, label in re.findall(
            r'<a href="#([^"]+)"><span>\d+</span>(.*?)</a>', rail)}
        web_rail = extract(donor, rail_pattern)
        nav = extract(web_rail, r'<nav class="rail-links"[^>]*>.*?</nav>')
        localized_nav = extract(rail, r'<nav class="rail-links"[^>]*>.*?</nav>')
        nav = re.sub(r'(<a href="#([^"]+)"><span>\d+</span>).*?(</a>)',
                     lambda m: m[1] + links[m[2]] + m[3], nav)
        rail = rail.replace(localized_nav, localized_nav.split(">", 1)[0] + ">" + nav.split(">", 1)[1])
    rail = rail.replace("Ep.01", "Ep.02").replace(">12 ", f">{count} ")
    cover = extract(localized, r'<header class="cover"[^>]*>.*?</header>').replace("Ep.01", "Ep.02")
    title_src = data_uri(ROOT / f"media/huxiago-title-{TITLE_ART[lang]}.svg", "image/svg+xml")
    hero_src = data_uri(ROOT / "media/ea863e999767b920.webp", "image/webp")
    cover = re.sub(r'(<img class="cover-title-art") [^>]*src="[^"]+"',
                   lambda m: f'{m[1]} src="{title_src}"', cover, count=1)
    cover = re.sub(r'(<div class="hero"><img [^>]*src=")[^"]+("[^>]*><span>)[^<]+',
                   lambda m: f'{m[1]}{hero_src}{m[2]}{escape(labels["hero_badge"].format(count=count))}',
                   cover, count=1)
    cover = re.sub(r'(<span class="cover-title-sub">)[^<]+',
                   lambda m: m[1] + escape(labels["bangkok"]), cover, count=1)
    if not offline:
        language = extract(donor, r'<div class="hux-language-bar">.*?</div></div>')
        language = re.sub(r'(data-hux-lang="([^"]+)"[^>]+aria-pressed=")(?:true|false)',
                          lambda m: m[1] + str(m[2] == lang).lower(), language)
        kicker = extract(cover, r'<p class="kicker">.*?</p>')
        cover = cover.replace(kicker, f'<div class="hux-cover-topbar">{kicker}{language}</div>', 1)
        picker = extract(donor, r'<span class="episode-picker"[^>]*>.*?</a></span></span>')
        picker = picker.replace('Ep.01 <svg', 'Ep.02 <svg', 1)
        picker = re.sub(r' aria-label="[^"]+"', "", picker, count=1)
        menu_title, current = map(escape, labels["picker"])
        ep01 = f'<a class="episode-upcoming" href="index.html?lang={lang}"><span><b>Ep.01</b></span></a>'
        active = f'<span class="episode-current"><span><b>Ep.02</b></span><em>{current}</em></span>'
        picker = re.sub(r'(<span id="episode-menu"[^>]*>).*?</a></span></span>',
                        lambda m: f'{m[1]}<span class="episode-menu-title">{menu_title}</span>{ep01}{active}</span></span>',
                        picker, flags=re.S)
        cover = cover.replace('<span class="vol">Ep.02</span>', picker, 1)
    rail = rail.replace(f'href="" download="{legacy_download}"', f'href="{download}" download="{download}"')
    cover = cover.replace(f'href="" download="{legacy_download}"', f'href="{download}" download="{download}"')
    mobile_nav = extract(localized, r'<nav [^>]*class="pocket-nav"[^>]*>.*?</nav>')
    about = extract(localized, r'<section class="about-huxia"[^>]*>.*?</section>')
    about = re.sub(r'<p>[^<]*Ep\.02[^<]*</p>', lambda _: f'<p>{escape(labels["about_follow"])}</p>', about)
    footer_link = extract(localized, r'<a class="hux-back-top"[^>]*>.*?</a>')
    return rail, cover, mobile_nav, about, footer_link


def render(data, deals, stories, galleries, locations, lang, offline, donor, localized, legacy_download):
    t = data["locales"][lang]
    ix = LOCALES.index(lang)
    labels = {**data["layout"][lang], "bangkok": data["labels"]["bangkok"][ix]}
    rail, cover, mobile_nav, about, back_top = issue_shell(
        donor, localized, lang, labels, len(data["stops"]), offline, legacy_download)
    css_source = localized if offline else donor
    css = "\n".join(re.findall(r"<style\b[^>]*>(.*?)</style>", css_source, re.S | re.I))
    css += "\n" + CSS.read_text(encoding="utf-8-sig")
    css = "\n".join(line.rstrip() for line in css.splitlines())
    share = script(localized, "v10-share-and-details-script").replace("Ep.01", "Ep.02")
    canonical = json.dumps(f"https://huxiago.com/ep02-{lang}.html")
    share = re.sub(r"const getPageUrl=.*?;", f"const getPageUrl=()=> {canonical};", share, count=1)
    scripts = "\n".join((
        share,
        script(localized, "v12-share-positioning"),
        script(donor, "v15-rail-navigation"),
        script(localized, "v16-get-guide-script").replace(legacy_download, f"HUXIAGO_Bangkok_EP02_{lang}.html"),
        script(donor, "v17-details-motion"),
        script(donor, "v22-draggable-share"),
        "" if offline else script(donor, "episode-picker-script"),
    ))
    category = data["categories"]
    toc = []
    stops = []
    for s in data["stops"]:
        title, _, detail = map(escape, s["copy"][ix])
        name = escape(s["name"])
        cat = escape(category[s["id"]][ix])
        route = ""
        if s["id"] == "saen-saep":
            piers = "".join(f"<li>{escape(pier)}</li>" for pier in data["piers"])
            route = f'<h4 class="story-heading">{escape(t[16])}</h4><ol class="story-list canal">{piers}</ol>'
        assets = galleries.get(s["id"], [])
        media = gallery(assets, ix) if assets else ""
        if assets:
            src = data_uri(ROOT / "ep02" / assets[0][0], "image/webp")
            thumb = f'<img class="thumb" src="{src}" alt="" loading="lazy">'
        else:
            thumb = f'<span class="thumb ep02-text-thumb" aria-hidden="true">{s["label"]}</span>'
        story = "".join(f'<h4 class="story-heading">{escape(heading)}</h4><p>{escape(text)}</p>'
                        for heading, text in stories[s["id"]][ix])
        toc.append(
            f'<a class="toc-item" href="#{s["id"]}" data-category="{cat}">'
            f'<span class="toc-item-number" aria-hidden="true">{s["label"]}</span>'
            f'<span class="toc-item-content"><strong class="toc-item-title">{name}</strong>'
            f'<small class="toc-item-description">{title}</small></span>'
            f'<span class="toc-item-side"><span class="toc-item-tag">{cat}</span>'
            f'<span class="toc-item-action">{escape(data["labels"]["open"][ix])} →</span></span></a>'
        )
        action = ""
        if "url" in s:
            action = (f'<a class="btn" href="{escape(s["url"], quote=True)}" target="_blank" '
                      f'rel="noopener noreferrer">↗ {escape(t[s["action"]])}</a>')
        places = locations[s["id"]]
        maps = location_block(places, ix, action if len(places) == 1 else "")
        route_action = action if len(places) > 1 else ""
        stops.append(
            f'<details class="card stop" id="{s["id"]}"><summary>{thumb}'
            f'<span class="head"><small>{s["label"]} · {cat}</small><h3>{name}</h3><p>{title}</p></span>'
            f'<span aria-hidden="true" class="chev">⌄</span></summary>'
            f'<div class="body">{media}<div class="story-copy">{story}{route}</div>'
            f'<div class="info"><b>{escape(t[17])}</b>{detail}</div>'
            f'{maps}{route_action}'
            f'</div></details>'
        )
    all_label = data["labels"]["all"][ix]
    filter_names = [all_label] + list(dict.fromkeys(category[s["id"]][ix] for s in data["stops"]))
    filters = "".join(
        f'<button type="button" data-filter="{escape(label, quote=True)}" aria-pressed="{str(n == 0).lower()}">{escape(label)}</button>'
        for n, label in enumerate(filter_names)
    )
    section_head = extract(localized, r'<div class="section-head"><span.*?id="spots".*?</div>')
    deals_section = f"""
<section aria-labelledby="ep02-deals-title" class="deal-zone" id="deals">
<p class="deal-kicker">HUXIAGO POCKET DEALS</p><h2 id="ep02-deals-title">{escape(data["labels"]["deal_line"][ix])}</h2>
{deal_content(deals, locations, ix)}</section>"""
    toc_section = f"""
<nav aria-label="{escape(data["labels"]["toc"][ix], quote=True)}" class="toc" id="toc">
<h2 class="sec-title">{escape(data["labels"]["toc"][ix])}</h2>
<div class="toc-filters" aria-label="{escape(labels["filter"], quote=True)}">{filters}</div>
<div class="toc-list">{"".join(toc)}</div></nav>"""
    sections = toc_section + deals_section if offline else deals_section + toc_section
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
{rail}
<div class="wrap">
{cover}
{mobile_nav}
<p class="intro">{escape(t[1])}</p>
{sections}
<section aria-labelledby="spots">{section_head}{"".join(stops)}</section>
{about}
{back_top}
<footer class="footer">HUXIAGO Ep.02 · {escape(t[14] if offline else t[18])}</footer>
</div>
<script>
const buttons = [...document.querySelectorAll('[data-filter]')];
const rows = [...document.querySelectorAll('.toc-item')];
buttons.forEach((button, index) => button.addEventListener('click', () => {{
  buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  rows.forEach(row => {{ row.hidden = index !== 0 && row.dataset.category !== button.dataset.filter; }});
}}));
document.querySelectorAll('[data-hux-lang]').forEach(button => button.addEventListener('click', () => {{
  location.href = 'ep02-' + button.dataset.huxLang + '.html' + location.hash;
}}));
</script>
{scripts}
<script>
document.getElementById('about').before(document.getElementById('share-strip'));
</script>
</body>
</html>
"""



def build():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Fail if outputs differ from the source data.")
    args = parser.parse_args()
    data, deals, stories, galleries, locations = (
        json.loads((ROOT / "docs" / name).read_text(encoding="utf-8-sig"))
        for name in ("ep02-content.json", "shared-deals.json", "ep02-stories.json", "ep02-galleries.json", "guide-locations.json")
    )
    index_path = ROOT / "index.html"
    index_original = index_path.read_bytes()
    donor = index_original.decode("utf-8")
    outputs = {"index.html": update_ep01(donor, deals, locations, True, "zh-Hant").encode("utf-8")}
    ep01_files = {
        "zh-Hant": next(ROOT.glob("HUXIAGO_*_vol01.html")).name,
        "zh-Hans": "HUXIAGO_Bangkok_EP01_zh-Hans.html",
        "en": "HUXIAGO_Bangkok_EP01_en.html",
    }
    for lang, name in ep01_files.items():
        source = (ROOT / name).read_bytes().decode("utf-8")
        if lang != "zh-Hant":
            source = source.replace("\r\n", "\n")
        outputs[name] = update_ep01(source, deals, locations, False, lang).encode("utf-8")
    for lang, legacy_download in ep01_files.items():
        localized = outputs[legacy_download].decode("utf-8")
        for offline, name in ((False, f"ep02-{lang}.html"), (True, f"HUXIAGO_Bangkok_EP02_{lang}.html")):
            outputs[name] = render(
                data, deals, stories, galleries, locations, lang, offline, outputs["index.html"].decode("utf-8"),
                localized, legacy_download).encode("utf-8")
    manifest_path = ROOT / "site-files.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    for name, raw in outputs.items():
        manifest["files"][name] = {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
    for suffix in TITLE_ART.values():
        name = f"media/huxiago-title-{suffix}.svg"
        raw = (ROOT / name).read_bytes().replace(b"\r\n", b"\n")
        manifest["files"][name] = {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
    outputs["site-files.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    for name, raw in outputs.items():
        target = ROOT / name
        if args.check:
            if not target.is_file() or target.read_bytes() != raw:
                parser.exit(1, f"Out of date: {name}\n")
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw)
    print(f"{len(outputs) - 1} issue files verified" if args.check else f"{len(outputs) - 1} issue files built")


if __name__ == "__main__":
    build()
