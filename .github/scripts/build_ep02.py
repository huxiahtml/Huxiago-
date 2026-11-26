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


def media_source(path, mime, offline):
    return data_uri(ROOT / path, mime) if offline else path


def guide_photo(filename, offline):
    return media_source(f"ep02/{filename}", "image/webp", offline)


REEL_LABELS = (
    ("播放影片", "原片 ↗", "浮動播放", "關閉浮動影片"),
    ("播放视频", "原片 ↗", "浮动播放", "关闭浮动视频"),
    ("Play Reel", "Original ↗", "Floating player", "Close floating player"),
)
PIP_ICON = ('<svg viewBox="0 0 24 24" aria-hidden="true" fill="none">'
            '<rect x="2.5" y="3.5" width="16" height="12.5" rx="1.8" stroke="currentColor" stroke-width="1.7"/>'
            '<path d="M5.2 6.2h4.3L8 7.7l2.5 2.5-1.4 1.4-2.5-2.5-1.4 1.4V6.2Z" fill="currentColor"/>'
            '<rect x="10.5" y="10" width="11.5" height="10" rx="2" fill="currentColor" stroke="#252532" stroke-width="1.4"/></svg>')


# Match the EP.01 episode picker's rounded, 1.8px line icon.
def arrow_icon(direction="out"):
    paths = {
        "out": "M4 12 12 4m-6 0h6v6",
        "right": "M3 8h10m-4-4 4 4-4 4",
        "down": "M8 3v10m-4-4 4 4 4-4",
        "up": "M8 13V3M4 7l4-4 4 4",
        "chevron": "M4 6l4 4 4-4",
    }
    return (f'<svg class="hux-arrow hux-arrow-{direction}" viewBox="0 0 16 16" aria-hidden="true" '
            f'focusable="false" fill="none"><path d="{paths[direction]}" stroke="currentColor" '
            'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>')


def ep02_ui_arrows(page):
    glyphs = {"↗": "out", "→": "right", "↑": "up", "⌄": "chevron"}
    def replace(match):
        content = match[0]
        if content.startswith(("<script", "<style")):
            return content
        return re.sub(r'(?<=>)[^<>]+(?=<)', lambda m: re.sub(
            r'[↗→↑⌄][\ufe0e\ufe0f]?', lambda g: arrow_icon(glyphs[g[0][0]]), m[0]), content)
    return re.sub(
        r'<(?:script|style)\b[^>]*>.*?</(?:script|style)>'
        r'|<a\b[^>]*>.*?</a>'
        r'|<p class="deal-swipe">.*?</p>|<span aria-hidden="true" class="chev">.*?</span>',
        replace, page, flags=re.S,
    )


def reel_card(title, index, poster="", video="", original=""):
    play, original_label, pip, close = REEL_LABELS[index]
    title = escape(title, quote=True)
    classes = "reel-figure ep02-reel" + (" ep01-gallery-reel" if poster else "")
    image = f'<img src="{poster}" alt="" loading="lazy" decoding="async">' if poster else ""
    if original and not re.fullmatch(r"https://www\.instagram\.com/(?:p|reel)/[A-Za-z0-9_-]+/", original):
        raise ValueError(f"Expected an Instagram post or Reel permalink: {original}")
    if not video:
        watch = ("在 Instagram 觀看", "在 Instagram 观看", "Watch on Instagram")[index]
        return (
            f'<figure class="{classes}" data-kind="reel">'
            f'<div class="reel-viewport">{image}'
            f'<a class="reel-placeholder ep01-reel-play reel-external" href="{original}" '
            f'target="_blank" rel="noopener noreferrer" aria-label="{watch} · {title}">'
            f'<span aria-hidden="true">{watch} {arrow_icon()}</span></a>'
            f'</div><figcaption>{title}</figcaption></figure>'
        )
    link = (f'<a class="reel-origin" href="{original}" target="_blank" '
            f'rel="noopener noreferrer">{original_label.rstrip(" ↗")} {arrow_icon()}</a>') if original else ""
    if index == 2 and not original:
        play = "Play video"
    return (
        f'<figure class="{classes} local-video-figure" data-kind="video" data-video="{video}" data-close="{close}">'
        f'<div class="reel-viewport">{image}<button class="reel-placeholder ep01-reel-play" type="button" '
        f'aria-label="{play} · {title}"><span aria-hidden="true">{play}</span></button>'
        f'{link}<button class="reel-pip-launch" type="button" aria-label="{pip}" aria-pressed="false">{PIP_ICON}</button>'
        f'</div><figcaption>{title}</figcaption></figure>'
    )


def video_source(filename, offline):
    return media_source(f"media/{filename}", "video/mp4", offline)


def instagram_card(url, title, index, poster, sources, offline):
    asset = sources.get(url)
    filename = asset.get("offline" if offline else "web") if asset else None
    video = video_source(filename, offline) if filename else ""
    return reel_card(title, index, poster, video=video, original=url)


def photo_figure(asset, index, offline, css_class=""):
    filename, *captions = asset
    caption = escape(captions[index], quote=True)
    src = guide_photo(filename, offline)
    class_attr = f' class="{css_class}"' if css_class else ""
    return (f'<figure{class_attr}><img src="{src}" alt="{caption}" loading="lazy" decoding="async">'
            f'<figcaption>{caption}</figcaption></figure>')


CLIP_LABELS = (
    ("盛桑運河快船｜現場短片", "播放影片", "暫停影片", "開啟聲音", "關閉聲音", "浮動播放", "關閉浮動影片"),
    ("盛桑运河快船｜现场短片", "播放视频", "暂停视频", "开启声音", "关闭声音", "浮动播放", "关闭浮动视频"),
    ("On board the Saen Saep Express Boat", "Play video", "Pause video", "Turn sound on", "Mute", "Floating player", "Close floating player"),
)

CLIP_ICONS = (
    ('<path d="M8 5.8v12.4L18 12z" fill="currentColor"/>', '<path d="M7.5 5.5h3v13h-3zm6 0h3v13h-3z" fill="currentColor"/>'),
    ('<path d="M4.5 9.2v5.6h3.2l4.1 3.2V6L7.7 9.2zM16 9l4 4m0-4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
     '<path d="M4.5 9.2v5.6h3.2l4.1 3.2V6L7.7 9.2zM15 8.5q3 3.5 0 7m2.7-9.3q5.4 5.8 0 11.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'),
)


def clip_control(css_class, off, on, icons):
    glyphs = "".join(
        f'<svg class="clip-icon-{state}" viewBox="0 0 24 24" aria-hidden="true">{icon}</svg>'
        for state, icon in zip(("off", "on"), icons)
    )
    return (f'<button type="button" class="{css_class}" aria-pressed="false" aria-label="{off}" '
            f'data-off-label="{off}" data-on-label="{on}">{glyphs}</button>')


def story_clips(assets, index, offline):
    heading, play, pause, sound_on, mute, pip, close = map(escape, CLIP_LABELS[index])
    clips = []
    for filename, hant, hans, english, entry in assets:
        caption = escape((hant, hans, english)[index])
        poster = guide_photo(filename, offline)
        src = video_source(entry["video"], offline)
        clips.append(
            f'<figure class="clip canal-clip ep02-reel" data-kind="video" data-video="{src}" data-close="{close}">'
            f'<figcaption>{caption}</figcaption><div class="clip-media reel-viewport">'
            f'<img src="{poster}" alt="" loading="lazy" decoding="async"><div class="clip-actions">'
            f'{clip_control("clip-pause", play, pause, CLIP_ICONS[0])}'
            f'{clip_control("clip-sound", sound_on, mute, CLIP_ICONS[1])}'
            f'<button type="button" class="clip-pip reel-pip-launch" aria-label="{pip}" aria-pressed="false">{PIP_ICON}</button>'
            '</div></div></figure>'
        )
    return (f'<section class="story-media canal-clips" aria-label="{heading}"><h4>{heading}</h4>'
            f'<div class="story-video-track" tabindex="0" aria-label="{heading}">{"".join(clips)}</div></section>')


def gallery(assets, index, offline, reel_sources):
    figures = []
    for filename, hant, hans, english, *links in assets:
        if links:
            caption = (hant, hans, english)[index]
            src = guide_photo(filename, offline)
            entry = links[0]
            if isinstance(entry, dict):
                filename = entry.get("offline_video", entry["video"]) if offline else entry["video"]
                video = video_source(filename, offline)
                figures.append(reel_card(caption, index, src, video=video))
            else:
                figures.append(instagram_card(entry, caption, index, src, reel_sources, offline))
        else:
            figures.append(photo_figure((filename, hant, hans, english), index, offline))
    return '<div class="gallery">' + "".join(figures) + '</div>'


TICKET_ICONS = {
    "phone": '<rect x="6" y="2.7" width="12" height="18.6" rx="3.2" fill="#fffaf0"/>'
             '<path d="M10 6h4m-3 12h2"/><path d="M9.6 12.1a3.8 3.8 0 0 1 4.8 0m-3.3 1.8a1.5 1.5 0 0 1 1.8 0"/>',
    "dining": '<path d="M4 4v4a3 3 0 0 0 6 0V4M7 4v16"/>'
              '<path d="M18 20V4c-3 1-4.5 4-4.5 7.5V13H18" fill="#fffaf0"/>',
    "hotel": '<path d="M4 12V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v5M8 12V9h4v3m0 0V9h4v3M3 18v2m18-2v2"/>'
             '<rect x="2.5" y="12" width="19" height="6" rx="2"/>',
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
DEAL_INTRO = ("更多泰國優惠、折扣，不定期更新。", "更多泰国优惠、折扣，不定期更新。",
              "More Thailand offers and discounts, updated from time to time.")
UPCOMING_COLORS = {"transport": "deal-pink", "dining-experiences": "deal-blue"}


def map_link(place, index):
    label = place["labels"][index] if "labels" in place else "Google Maps"
    return (f'<a class="btn map-link" href="{escape(place["url"], quote=True)}" '
            f'target="_blank" rel="noopener noreferrer">↗ {escape(label)}</a>')


def location_block(places, index, action=""):
    items = "".join(
        f'<li><span class="location-address">{escape(place["address"])}</span>'
        f'<div class="place-actions">{map_link(place, index)}{action}</div></li>'
        for place in places
    )
    return f'<ul class="place-locations" role="list">{items}</ul>'


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


def deal_content(deals, index, offline=True):
    cards = []
    for number, (key, offer) in enumerate(deals.items(), 1):
        icon = ticket_icon(offer["category"])
        name = escape(offer.get("ticket_name", offer["name"][index]))
        badge = escape(offer["badge"][index])
        label = escape(offer["label"][index])
        if "url" not in offer:
            cards.append(
                f'<article class="deal-ticket {UPCOMING_COLORS[key]} ticket-coming" data-upcoming-deal="{key}">'
                f'<div class="ticket-top">{icon}<span class="ticket-eyebrow">{label}</span></div>'
                f'<h3>{name}</h3><div class="ticket-value">{badge}</div>'
                '<div aria-hidden="true" class="ticket-dots">• • •</div></article>'
            )
            continue
        if "photo" in offer:
            src = guide_photo(offer["photo"], offline)
            logo = ""
            if "photo_logo" in offer:
                logo_src = guide_photo(offer["photo_logo"], offline)
                logo = f'<img class="ticket-photo-logo" src="{logo_src}" alt="" loading="lazy" decoding="async">'
            middle = (
                f'<div class="ticket-photo"><img class="ticket-photo-image" src="{src}" alt="" '
                f'loading="lazy" decoding="async">{logo}</div>'
            )
        else:
            middle = ""
        if "body" in offer:
            middle += f'<p class="ticket-copy">{escape(offer["body"][index])}</p>'
        if related := offer.get("related"):
            link = escape(related["url"], quote=True)
            text = escape(related["label"][index])
            middle += (f'<a class="ticket-related" href="{link}" target="_blank" rel="noopener noreferrer">'
                       f'{text} {arrow_icon("out")}</a>')
        badge_icon = f'<span class="ticket-no">#{number:02d}</span>' if key == "esim" else icon
        code = f'<span class="ticket-code">{escape(offer["code"])}</span>' if "code" in offer else ""
        primary = (
            f'<a class="ticket-cta" href="{escape(offer["url"], quote=True)}" data-cta-id="{escape(offer["id"])}" '
            f'target="_blank" rel="noopener noreferrer"><span class="ticket-cta-label">{escape(offer["cta"][index])}</span>'
            f'{arrow_icon("down" if key == "esim" else "out")}</a>'
        )
        cards.append(
            f'<article class="deal-ticket ticket-feature" data-shared-deal="{key}" translate="no">'
            f'<div class="ticket-top">{badge_icon}<span class="ticket-eyebrow">{label}</span></div><h3>{name}</h3>'
            f'<div class="ticket-discount"><div class="ticket-value">{badge}</div>{code}</div>'
            f'{middle}<div class="ticket-stub">{primary}</div></article>'
        )
    return (f'<div class="deal-track" role="region" tabindex="0" aria-label="{TRACK_LABELS[index]}">{"".join(cards)}</div>'
            f'<p class="deal-swipe">{SWIPE_LABELS[index].rstrip(" →")} {arrow_icon("right")}</p>')


def update_ep01(source, deals, locations, online, lang):
    source = source.replace("Use it offline when you land in Bangkok", "Use it offline anywhere in Bangkok")
    for original, localized in zip((
        "吃到飽網卡優惠先上線，更多獨家折扣，敬請期待。",
        "吃到饱网卡优惠先上线，更多独家折扣，敬请期待。",
        "Unlimited-data SIM offers are ready. More exclusive deals are coming soon.",
    ), DEAL_INTRO):
        source = source.replace(original, localized)
    start = "<!--hux-shared-deals:start-->"
    end = "<!--hux-shared-deals:end-->"
    content = deal_content(deals, LOCALES.index(lang))
    if online:
        templates = "".join(f'<template id="shared-deals-{code}">{deal_content(deals, i)}</template>'
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
    media_css = (ROOT / "ep02/shared-media.css").read_text(encoding="utf-8")
    source = re.sub(r'<style id="hux-shared-media">.*?</style>', "", source, flags=re.S)
    source = source.replace(
        "</head>",
        f'<style id="hux-shared-ticket-icons">{ticket_css}</style>'
        f'<style id="hux-shared-media">{media_css}</style></head>',
        1,
    )
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


def bonus_reels(donor, videos, sources, index, offline):
    gallery = script(donor, "hux-reels-script")
    i = gallery.index("function useInlinePlay")
    j = gallery.index("const bonusSection", i)
    gallery = gallery[:i] + gallery[j:]
    gallery = gallery.replace("document.querySelectorAll('.reel-figure:not(:has(.ep01-reel-play))')",
                              "bonusGallery.querySelectorAll('.reel-figure:not(.ep02-reel)')")
    if offline:
        loading = gallery.index("if('IntersectionObserver' in window)")
        gallery = gallery[:loading] + "})();</script>"
    floating = script(donor, "hux-reel-pip-v21").replace(
        "event.target.closest('.reel-pip-launch')",
        "event.target.closest('#bonus-reels .reel-figure:not(.ep02-reel) .reel-pip-launch')",
    )
    # Keep the EP.01 player and accessibility labels with this issue’s selection.
    locale_script = extract(donor, r'<script type="application/json" id="hux-language-data">.*?</script>')
    translations = json.loads(locale_script.split(">", 1)[1].rsplit("<", 1)[0])["strings"]
    if index:
        for original, translated in sorted(translations.items(), key=lambda entry: -len(entry[0])):
            if original in gallery:
                gallery = gallery.replace(original, translated[index - 1].replace("'", "’"))
            if original in floating:
                floating = floating.replace(original, translated[index - 1].replace("'", "’"))
        localized_dot = ("第 '+(index+1)+' 支影片", "第 '+(index+1)+' 支视频", "Video '+(index+1)+'")[index]
        gallery = gallery.replace("第 '+(index+1)+' 支影片", localized_dot)
    titles = [[title[index], kind, url_id] for title, kind, url_id in videos]
    bonus_data = json.dumps(titles, ensure_ascii=False)
    declaration = extract(gallery, r"const spotReels=.*?},bonus=.*?;")
    gallery = gallery.replace(declaration, f"const bonus={bonus_data};", 1)
    native_cards = []
    for title, kind, reel_id in titles:
        url = f"https://www.instagram.com/{kind}/{reel_id}/"
        source = sources.get(url)
        poster = guide_photo(source["poster"], offline) if source else ""
        native_cards.append(instagram_card(url, title, index, poster, sources, offline) if source else None)
    card_code = json.dumps(native_cards, ensure_ascii=False).replace("</", "<\\/")
    original_loop = "for(const [title,kind,id] of bonus)bonusGallery.append(card(title,kind,id));"
    replacement = (
        f"const nativeCards={card_code};"
        "for(const [i,[title,kind,id]] of bonus.entries()){"
        "if(nativeCards[i])bonusGallery.insertAdjacentHTML('beforeend',nativeCards[i]);"
        "else bonusGallery.append(card(title,kind,id));}"
    )
    gallery = gallery.replace(original_loop, replacement, 1)
    for old in ("從我們的故事開始，左右滑動看更多影片。", *translations["從我們的故事開始，左右滑動看更多影片。"]):
        gallery = gallery.replace(old.replace("'", "’"), ("左右滑動看更多曼谷影片。", "左右滑动看更多曼谷视频。", "Swipe for more Bangkok stories.")[index])
    return gallery.replace(" ↗</span>", " " + arrow_icon() + "</span>") + floating.replace(
        "original.textContent=", "original.innerHTML="
    ).replace(" ↗';", " " + arrow_icon() + "';")


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
    cover = cover.replace("\r\n", "\n")
    title_src = media_source(f"media/huxiago-title-{TITLE_ART[lang]}.svg", "image/svg+xml", offline)
    hero_src = media_source("media/ea863e999767b920.webp", "image/webp", offline)
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
    if not offline:
        about_src = extract(donor, r'(?<=<figure class="about-photo"><img src=")[^"]+')
        about = re.sub(r'(<figure class="about-photo"><img src=")[^"]+',
                       lambda m: m[1] + about_src, about, count=1).replace("\r\n", "\n")
    about = re.sub(r'<p>[^<]*Ep\.02[^<]*</p>', lambda _: f'<p>{escape(labels["about_follow"])}</p>', about)
    footer_link = extract(localized, r'<a class="hux-back-top"[^>]*>.*?</a>')
    return rail, cover, mobile_nav, about, footer_link


def story_inline(text):
    parts = []
    for piece in re.split(r"(\*\*[^*\n]+\*\*|\[[^\]\n]+\]\(https?://[^()\s]+\))", text):
        if piece.startswith("**") and piece.endswith("**") and len(piece) > 4:
            parts.append(f"<strong>{escape(piece[2:-2])}</strong>")
        elif match := re.fullmatch(r"\[([^\]\n]+)\]\((https?://[^()\s]+)\)", piece):
            label, url = match.groups()
            parts.append(f'<a href="{escape(url, quote=True)}" target="_blank" rel="noopener noreferrer">{escape(label)}</a>')
        else:
            parts.append(escape(piece))
    return "".join(parts)


def story_table(rows, heading, unit=""):
    columns, *body = rows
    header = "".join(f'<th scope="col">{escape(cell)}</th>' for cell in columns)
    entries = []
    for label, *values in body:
        name, _, subtitle = label.partition("\n")
        title = escape(name)
        if subtitle:
            title += f'<span class="story-price-subtitle" lang="en">{escape(subtitle)}</span>'
        cells = []
        for value in values:
            text = re.sub(r'\b\d{1,3}(?:,\d{3})+\b',
                          r'<span class="story-amount">\g<0></span>', escape(value))
            cells.append(f"<td>{text}</td>")
        entries.append(f'<tr><th scope="row">{title}</th>{"".join(cells)}</tr>')
    variant = " story-price-wrap" if unit else ""
    caption = f'<caption>{escape(unit)}</caption>' if unit else ""
    return (f'<div class="story-table-wrap{variant}" role="region" tabindex="0" aria-label="{escape(heading, quote=True)}">'
            f'<table class="story-table">{caption}<thead><tr>{header}</tr></thead><tbody>{"".join(entries)}</tbody></table></div>')


def story_promo(offer, index):
    badge = escape(offer["badge"][index])
    title = escape(offer.get("story_label", offer["label"])[index])
    terms = escape(offer["terms"][index])
    url = escape(offer["url"], quote=True)
    cta = escape(offer.get("story_cta", offer["cta"])[index])
    code = f'<code class="story-promo-code">{escape(offer["code"])}</code>' if "code" in offer else ""
    return (
        '<div class="story-promo"><div class="story-promo-heading">'
        f'<strong class="story-promo-discount">{badge}</strong><strong>{title}</strong>{code}</div>'
        f'<div class="story-promo-terms">{terms}</div>'
        f'<a class="story-promo-link" href="{url}" target="_blank" rel="noopener noreferrer">'
        f'<span aria-hidden="true">↗ </span>{cta}</a></div>'
    )


ROUTE_MAP_TEXT = (
    ("盛桑運河快船路線圖", "在站內開啟完整互動地圖", "西端", "東端", "左右滑動地圖，點選碼頭", "上船碼頭", "下船碼頭", "向東", "向西", "相隔 {count} 站", "在 Pratunam 水門碼頭換船", "查看原網站票價與班次", "關閉"),
    ("盛桑运河快船路线图", "在站内打开完整互动地图", "西端", "东端", "左右滑动地图，点选码头", "上船码头", "下船码头", "向东", "向西", "相隔 {count} 站", "在 Pratunam 水门码头换船", "查看原网站票价和班次", "关闭"),
    ("Saen Saep canal route", "Open the interactive map here", "West", "East", "Swipe the map and choose a pier", "Board at", "Get off at", "Eastbound", "Westbound", "{count} stops apart", "Change boats at Pratunam", "Fares and hours on the source site", "Close"),
)


def route_map(filename, index, offline):
    title = ("盛桑運河快船路線圖", "盛桑运河快船路线图", "Saen Saep canal route map")[index]
    label = ("開啟原網站互動路線圖", "打开原网站互动路线图", "Open the original interactive map")[index]
    src = guide_photo(filename, offline)
    return (f'<figure class="route-map"><a class="route-map-open" href="https://www.saensaebcanal.com/" '
            f'target="_blank" rel="noopener noreferrer"><img src="{src}" alt="{escape(title)}" '
            f'loading="lazy" decoding="async"><span>{escape(label)} ↗</span></a></figure>')

def story_menu(groups):
    items = []
    for label, dishes in groups:
        details = "".join(
            f'<li><span lang="th">{escape(thai)}</span> <span>{escape(name)}</span></li>'
            for thai, name in dishes
        )
        items.append(f'<dt>{escape(label)}</dt><dd><ul>{details}</ul></dd>')
    return '<dl class="story-menu">' + "".join(items) + '</dl>'


def render_story(sections, deals, assets, index, offline, reel_sources):
    photos = {row[0]: row for row in assets}
    parts = []
    for heading, blocks in sections:
        parts.append(f'<h4 class="story-heading">{story_inline(heading)}</h4>')
        if isinstance(blocks, str):
            blocks = [blocks]
        for block in blocks:
            if isinstance(block, str):
                if heading.startswith(("從西往東", "从西往东", "Useful piers")) and block.startswith("**") and "：**" in block:
                    pier, description = block[2:].split("：**", 1)
                    parts.append(f'<details class="pier-note"><summary>{escape(pier)}</summary><p>{story_inline(description.strip())}</p></details>')
                elif heading.startswith(("从西往东", "Useful piers")) and block.startswith("**") and (":**" in block or "：**" in block):
                    sep = "：**" if "：**" in block else ":**"
                    pier, description = block[2:].split(sep, 1)
                    parts.append(f'<details class="pier-note"><summary>{escape(pier)}</summary><p>{story_inline(description.strip())}</p></details>')
                else:
                    fact = heading.startswith("HUXIAGO") and re.match(r"^\*\*[^*]+[：:]\*\*", block)
                    class_attr = ' class="story-fact"' if fact else ""
                    parts.append(f"<p{class_attr}>{story_inline(block)}</p>")
            elif "promo" in block:
                parts.append(story_promo(deals[block["promo"]], index))
            elif "reel" in block:
                poster = guide_photo(block["poster"], offline) if "poster" in block else ""
                parts.append(instagram_card(block["reel"], block["title"], index, poster, reel_sources, offline))
            elif "route_map" in block:
                parts.append(route_map(block["route_map"], index, offline))
            elif "photo" in block:
                parts.append(photo_figure(photos[block["photo"]], index, offline, "story-photo"))
            elif "gallery" in block:
                parts.append(gallery([photos[filename] for filename in block["gallery"]], index, offline, reel_sources))
            elif "menu" in block:
                parts.append(story_menu(block["menu"]))
            else:
                parts.append(story_table(block["table"], heading, block.get("table_unit", "")))
    return "".join(parts)


def render(data, deals, stories, galleries, locations, lang, offline, donor, localized, legacy_download):
    reel_sources = data.get("reel_sources", {})
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
    share = share[:share.index('  const closeAllDetails=')] + '})();\n</script>'
    motion = script(donor, "v17-details-motion").replace(
        "      e.preventDefault();",
        "      if (huxMobileStations.matches && !details.__huxAnimation) return;\n      e.preventDefault();",
    )
    canonical = json.dumps(f"https://huxiago.com/ep02-{lang}.html")
    share = re.sub(r"const getPageUrl=.*?;", f"const getPageUrl=()=> {canonical};", share, count=1)
    scripts = "\n".join((
        share,
        script(localized, "v12-share-positioning"),
        script(donor, "v15-rail-navigation"),
        script(localized, "v16-get-guide-script").replace(legacy_download, f"HUXIAGO_Bangkok_EP02_{lang}.html"),
        motion,
        script(donor, "v22-draggable-share"),
        "" if offline else script(donor, "episode-picker-script"),
    ))
    reel_script = (ROOT / "ep02/reels.js").read_text(encoding="utf-8")
    navigation = (ROOT / "ep02/navigation.js").read_text(encoding="utf-8")
    category = data["categories"]
    toc = []
    stops = []
    for s in data["stops"]:
        title, _, detail = map(escape, s["copy"][ix])
        name = escape(s["name"])
        cat = escape(category[s["id"]][ix])
        heading_category = escape(s["heading_category"][ix])
        label = s["label"]
        stop_heading = f"Stop {label} · {heading_category}" if lang == "en" else f"第 {label} 站・{heading_category}"
        assets = galleries.get(s["id"], [])
        clips = []
        if s.get("video_layout") == "story":
            clips = [asset for asset in assets if isinstance(asset[-1], dict) and "video" in asset[-1]]
        story_sections = stories[s["id"]][ix]
        inline_media = {
            filename
            for _, blocks in story_sections
            if isinstance(blocks, list)
            for block in blocks
            if isinstance(block, dict)
            for filename in block.get("gallery", [])
        }
        photos = [asset for asset in assets if asset not in clips and asset[0] not in inline_media]
        media = gallery(photos, ix, offline, reel_sources) if photos and s.get("gallery_layout") != "inline" else ""
        video_section = story_clips(clips, ix, offline) if clips else ""
        if assets:
            src = guide_photo(assets[0][0], offline)
            thumb = f'<img class="thumb" src="{src}" alt="" loading="lazy" decoding="async">'
        else:
            thumb = f'<span class="thumb ep02-text-thumb" aria-hidden="true">{s["label"]}</span>'
        story = render_story(story_sections, deals, assets, ix, offline, reel_sources)
        toc.append(
            f'<a class="toc-item" href="#{s["id"]}" data-category="{cat}">'
            f'<span class="toc-item-content"><span class="toc-item-kicker">{stop_heading}</span>'
            f'<strong class="toc-item-title">{name}</strong>'
            f'<span class="toc-item-description">{title}</span></span>'
            f'<span class="toc-item-action" aria-hidden="true"><span class="toc-item-action-label">'
            f'{escape(data["labels"]["open"][ix])}</span> {arrow_icon("right")}</span></a>'
        )
        action = ""
        if "url" in s:
            action = (f'<a class="btn" href="{escape(s["url"], quote=True)}" target="_blank" '
                      f'rel="noopener noreferrer">↗ {escape(t[s["action"]])}</a>')
        for related in s.get("related", []):
            action += (f'<a class="btn" href="{escape(related["url"], quote=True)}" target="_blank" '
                       f'rel="noopener noreferrer">↗ {escape(related["labels"][ix])}</a>')
        places = locations[s["id"]]
        maps = location_block(places, ix, action if len(places) == 1 else "")
        if s["id"] == "saen-saep":
            example = ("我們這次的搭船路線", "我们这次的搭船路线", "Our trip")[ix]
            maps = f'<div class="trip-example"><b>{example}</b>{maps}</div>'
        route_action = action if len(places) > 1 else ""
        stops.append(
            f'<details class="card stop" id="{s["id"]}"><summary>{thumb}'
            f'<span class="head"><small>{stop_heading}</small><h3>{name}</h3><p>{title}</p></span>'
            f'<span aria-hidden="true" class="chev">⌄</span></summary>'
            f'<div class="body">{media}<div class="story-copy">{story}</div>{video_section}'
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
    deal_intro = DEAL_INTRO[ix]
    deals_section = f"""
<section aria-labelledby="ep02-deals-title" class="deal-zone" id="deals">
<p class="deal-kicker">HUXIAGO POCKET DEALS</p>
<h2 id="ep02-deals-title">{escape(data["labels"]["deal_line"][ix])}</h2>
<p class="deal-intro">{escape(deal_intro)}</p>
{deal_content(deals, ix, offline)}</section>"""
    toc_section = f"""
<nav aria-label="{escape(data["labels"]["toc"][ix], quote=True)}" class="toc" id="toc">
<h2 class="sec-title">{escape(data["labels"]["toc"][ix])}</h2>
<div class="toc-filters" aria-label="{escape(labels["filter"], quote=True)}">{filters}</div>
<div class="toc-list">{"".join(toc)}</div></nav>"""
    sections = toc_section + deals_section if offline else deals_section + toc_section
    outro_title, *outro_paragraphs = data["conclusion"][ix]
    outro = "".join("<p>" + escape(line).replace("\n", "<br>") + "</p>" for line in outro_paragraphs)
    return ep02_ui_arrows(f"""<!doctype html>
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
<section class="outro" aria-labelledby="conclusion-title"><h2 id="conclusion-title">{escape(outro_title)}</h2>{outro}</section>
{about}
{back_top}
<footer class="footer">HUXIAGO Ep.02 · {escape(t[14] if offline else t[18])}</footer>
</div>
<script>const huxMobileStations = matchMedia('(max-width: 979px)');</script>
{scripts}
<script>{navigation}</script>
{bonus_reels(donor, data["bonus_reels"], reel_sources, ix, offline)}
<script>{reel_script}</script>
</body>
</html>
""")



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
    photos = {name.decode() for lang in LOCALES
              for name in re.findall(rb' src="(ep02/[^"/]+\.webp)"', outputs[f"ep02-{lang}.html"])}
    for name in sorted(photos):
        raw = (ROOT / name).read_bytes()
        manifest["files"][name] = {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
    for assets in galleries.values():
        for _, _, _, _, *entries in assets:
            if entries and isinstance(entries[0], dict):
                for key in ("video", "offline_video"):
                    if filename := entries[0].get(key):
                        name = f"media/{filename}"
                        raw = (ROOT / name).read_bytes()
                        manifest["files"][name] = {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()}
    for variants in data.get("reel_sources", {}).values():
        for key, filename in variants.items():
            folder = "ep02" if key == "poster" else "media"
            name = f"{folder}/{filename}"
            raw = (ROOT / name).read_bytes()
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
