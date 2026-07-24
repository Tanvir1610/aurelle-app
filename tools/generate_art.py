#!/usr/bin/env python3
"""
Aurelle — original artwork generator.

Produces brand-consistent SVG imagery (product tiles, category tiles, hero
banners, editorial bands, review avatars) so the storefront ships complete
with zero external dependencies and zero third-party imagery.

Run:  python3 tools/generate_art.py
Out:  assets/img/*.svg
"""

import math
import os
import random

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "img")
os.makedirs(OUT, exist_ok=True)

GOLD = "#b8935a"
GOLD_D = "#9c7a44"
GOLD_L = "#dcc08a"
INK = "#1a1512"
IVORY = "#faf6f0"


def defs(uid, tint_a, tint_b):
    """Warm radial ground + gold metal gradient + soft vignette."""
    return f"""
  <defs>
    <radialGradient id="g{uid}" cx="50%" cy="38%" r="78%">
      <stop offset="0%" stop-color="{tint_a}"/>
      <stop offset="100%" stop-color="{tint_b}"/>
    </radialGradient>
    <linearGradient id="m{uid}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{GOLD_L}"/>
      <stop offset="45%" stop-color="{GOLD}"/>
      <stop offset="100%" stop-color="{GOLD_D}"/>
    </linearGradient>
    <radialGradient id="v{uid}" cx="50%" cy="50%" r="72%">
      <stop offset="60%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#3d352e" stop-opacity="0.13"/>
    </radialGradient>
  </defs>"""


def gem(cx, cy, r, uid, fill=None):
    """Faceted marquise/round stone."""
    f = fill or f"url(#m{uid})"
    pts = []
    for i in range(8):
        a = math.pi * 2 * i / 8 - math.pi / 2
        rr = r if i % 2 == 0 else r * 0.72
        pts.append(f"{cx + rr * math.cos(a):.1f},{cy + rr * math.sin(a):.1f}")
    return (
        f'<polygon points="{" ".join(pts)}" fill="{f}" opacity="0.95"/>'
        f'<circle cx="{cx - r*0.22:.1f}" cy="{cy - r*0.26:.1f}" r="{r*0.2:.1f}" fill="#fff" opacity="0.55"/>'
    )


def beaded_arc(cx, cy, rx, ry, uid, beads=13, start=200, end=340, bead_r=4):
    """Chain arc with evenly spaced beads — the core necklace motif."""
    p = []
    x0 = cx + rx * math.cos(math.radians(start))
    y0 = cy + ry * math.sin(math.radians(start))
    x1 = cx + rx * math.cos(math.radians(end))
    y1 = cy + ry * math.sin(math.radians(end))
    p.append(
        f'<path d="M {x0:.1f} {y0:.1f} A {rx} {ry} 0 0 0 {x1:.1f} {y1:.1f}" '
        f'fill="none" stroke="url(#m{uid})" stroke-width="2.2" stroke-linecap="round"/>'
    )
    for i in range(beads):
        t = start + (end - start) * i / (beads - 1)
        bx = cx + rx * math.cos(math.radians(t))
        by = cy + ry * math.sin(math.radians(t))
        rr = bead_r * (1.0 + 0.5 * math.sin(math.pi * i / (beads - 1)))
        p.append(f'<circle cx="{bx:.1f}" cy="{by:.1f}" r="{rr:.1f}" fill="url(#m{uid})"/>')
    return "".join(p)


# ---------------------------------------------------------------- glyphs ----
def glyph_necklace(uid):
    s = [beaded_arc(400, 250, 210, 150, uid, beads=15, start=200, end=340, bead_r=4.5)]
    s.append(f'<path d="M 400 400 L 400 432" stroke="url(#m{uid})" stroke-width="2.4"/>')
    s.append(gem(400, 468, 42, uid))
    s.append(gem(340, 372, 15, uid))
    s.append(gem(460, 372, 15, uid))
    return "".join(s)


def glyph_choker(uid):
    s = [beaded_arc(400, 300, 200, 96, uid, beads=19, start=195, end=345, bead_r=6)]
    s.append(gem(400, 396, 34, uid))
    s.append(f'<path d="M 400 430 L 400 452" stroke="url(#m{uid})" stroke-width="2"/>')
    s.append(gem(400, 470, 14, uid))
    return "".join(s)


def glyph_earrings(uid):
    s = []
    for x in (300, 500):
        s.append(f'<circle cx="{x}" cy="220" r="17" fill="none" stroke="url(#m{uid})" stroke-width="3.4"/>')
        s.append(f'<path d="M {x} 237 L {x} 290" stroke="url(#m{uid})" stroke-width="2.2"/>')
        s.append(gem(x, 322, 30, uid))
        s.append(f'<path d="M {x} 352 L {x} 382" stroke="url(#m{uid})" stroke-width="2"/>')
        s.append(gem(x, 404, 19, uid))
    return "".join(s)


def glyph_studs(uid):
    s = []
    for x, y in ((320, 300), (480, 300)):
        for i in range(6):
            a = math.pi * 2 * i / 6
            s.append(gem(x + 44 * math.cos(a), y + 44 * math.sin(a), 20, uid))
        s.append(gem(x, y, 30, uid))
    return "".join(s)


def glyph_ring(uid):
    s = [f'<ellipse cx="400" cy="360" rx="128" ry="132" fill="none" stroke="url(#m{uid})" stroke-width="13"/>']
    s.append(f'<ellipse cx="400" cy="360" rx="128" ry="132" fill="none" stroke="{IVORY}" stroke-width="2" opacity="0.35"/>')
    s.append(f'<path d="M 356 236 L 400 196 L 444 236" fill="none" stroke="url(#m{uid})" stroke-width="4"/>')
    s.append(gem(400, 208, 52, uid))
    return "".join(s)


def glyph_bracelet(uid):
    s = [f'<ellipse cx="400" cy="320" rx="196" ry="112" fill="none" stroke="url(#m{uid})" stroke-width="9"/>']
    for i in range(12):
        a = math.pi * 2 * i / 12
        s.append(gem(400 + 196 * math.cos(a), 320 + 112 * math.sin(a), 15, uid))
    s.append(gem(400, 432, 30, uid))
    return "".join(s)


def glyph_bangle(uid):
    s = []
    for r, w in ((160, 8), (126, 5), (94, 3.2)):
        s.append(f'<circle cx="400" cy="330" r="{r}" fill="none" stroke="url(#m{uid})" stroke-width="{w}"/>')
    for i in range(8):
        a = math.pi * 2 * i / 8 + math.pi / 8
        s.append(gem(400 + 160 * math.cos(a), 330 + 160 * math.sin(a), 14, uid))
    return "".join(s)


def glyph_pendant(uid):
    s = [f'<path d="M 268 190 Q 400 250 532 190" fill="none" stroke="url(#m{uid})" stroke-width="2.4"/>']
    s.append(f'<path d="M 400 232 L 400 300" stroke="url(#m{uid})" stroke-width="2.2"/>')
    s.append(f'<circle cx="400" cy="316" r="16" fill="none" stroke="url(#m{uid})" stroke-width="3"/>')
    s.append(gem(400, 392, 62, uid))
    return "".join(s)


def glyph_tikka(uid):
    s = [f'<path d="M 400 150 L 400 262" stroke="url(#m{uid})" stroke-width="2.4"/>']
    for i in range(6):
        s.append(f'<circle cx="400" cy="{170 + i*18}" r="4.4" fill="url(#m{uid})"/>')
    s.append(gem(400, 316, 56, uid))
    s.append(beaded_arc(400, 300, 132, 60, uid, beads=11, start=200, end=340, bead_r=5))
    s.append(f'<path d="M 400 372 L 400 400" stroke="url(#m{uid})" stroke-width="2"/>')
    s.append(gem(400, 420, 20, uid))
    return "".join(s)


GLYPHS = {
    "necklace": glyph_necklace,
    "choker": glyph_choker,
    "earrings": glyph_earrings,
    "studs": glyph_studs,
    "ring": glyph_ring,
    "bracelet": glyph_bracelet,
    "bangle": glyph_bangle,
    "pendant": glyph_pendant,
    "tikka": glyph_tikka,
}


def product_svg(name, kind, tint_a, tint_b, uid):
    body = GLYPHS.get(kind, glyph_necklace)(uid)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" role="img" aria-label="{name}">{defs(uid, tint_a, tint_b)}
  <rect width="800" height="800" fill="url(#g{uid})"/>
  <circle cx="400" cy="352" r="266" fill="#fff" opacity="0.16"/>
  {body}
  <rect width="800" height="800" fill="url(#v{uid})"/>
</svg>"""


def banner_svg(uid, tint_a, tint_b, kind, w=1600, h=900):
    """Full-bleed hero / editorial band with a drifting jewel motif."""
    rnd = random.Random(uid)
    motes = "".join(
        f'<circle cx="{rnd.randint(40, w-40)}" cy="{rnd.randint(40, h-40)}" '
        f'r="{rnd.choice([1.4,2.2,3.0])}" fill="{GOLD_L}" opacity="{rnd.choice([0.25,0.4,0.55])}"/>'
        for _ in range(46)
    )
    inner = GLYPHS.get(kind, glyph_necklace)(uid)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" preserveAspectRatio="xMidYMid slice" role="img">{defs(uid, tint_a, tint_b)}
  <rect width="{w}" height="{h}" fill="url(#g{uid})"/>
  {motes}
  <g transform="translate({w/2 - 400}, {h/2 - 400}) scale(1)" opacity="0.9">{inner}</g>
  <rect width="{w}" height="{h}" fill="url(#v{uid})"/>
</svg>"""


def avatar_svg(initials, uid, tint):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img">{defs(uid, tint, "#ffffff")}
  <circle cx="60" cy="60" r="60" fill="url(#g{uid})"/>
  <text x="60" y="60" text-anchor="middle" dominant-baseline="central"
        font-family="Cormorant Garamond, serif" font-size="44" font-weight="500"
        fill="{GOLD_D}">{initials}</text>
</svg>"""


TINTS = {
    "gold":     ("#f7ecd8", "#e2c99b"),
    "rose":     ("#f8e9e5", "#dfbdb6"),
    "emerald":  ("#e4efe9", "#a8c4b7"),
    "sapphire": ("#e3e9f4", "#adbcd8"),
    "ruby":     ("#f7e2e5", "#dda9b1"),
    "pearl":    ("#faf6f0", "#ddd2c1"),
    "ivory":    ("#fdfbf7", "#e7ddce"),
}

# (slug, display name, glyph kind, tint key)
PRODUCTS = [
    ("rosevine-necklace-set",     "Rosevine Necklace Set",      "necklace", "rose"),
    ("amara-emerald-studs",       "Amara Emerald Studs",        "studs",    "emerald"),
    ("solene-pearl-drops",        "Solene Pearl Drops",         "earrings", "pearl"),
    ("mahira-ruby-hasli",         "Mahira Ruby Hasli Set",      "necklace", "ruby"),
    ("noor-solitaire-pendant",    "Noor Solitaire Pendant",     "pendant",  "gold"),
    ("sitara-choker-set",         "Sitara Choker Set",          "choker",   "sapphire"),
    ("ila-floral-studs",          "Ila Floral Studs",           "studs",    "rose"),
    ("veda-kundan-tikka",         "Veda Kundan Maang Tikka",    "tikka",    "gold"),
    ("anaya-rose-bracelet",       "Anaya Rose Bracelet",        "bracelet", "rose"),
    ("kiara-crystal-bloom-set",   "Kiara Crystal Bloom Set",    "necklace", "emerald"),
    ("zara-sapphire-ring",        "Zara Sapphire Ring",         "ring",     "sapphire"),
    ("meera-pearl-necklace-set",  "Meera Pearl Necklace Set",   "necklace", "pearl"),
    ("tara-halo-hoops",           "Tara Halo Hoops",            "earrings", "gold"),
    ("nisha-stackable-bangles",   "Nisha Stackable Bangles",    "bangle",   "gold"),
    ("aleena-teardrop-danglers",  "Aleena Teardrop Danglers",   "earrings", "ruby"),
    ("riya-minimal-band",         "Riya Minimal Band",          "ring",     "ivory"),
    ("saira-layered-chain",       "Saira Layered Chain",        "pendant",  "gold"),
    ("devi-temple-choker",        "Devi Temple Choker",         "choker",   "gold"),
    ("mira-pearl-bangle",         "Mira Pearl Bangle",          "bangle",   "pearl"),
    ("elara-emerald-ring",        "Elara Emerald Ring",         "ring",     "emerald"),
    ("aisha-jhumka-drops",        "Aisha Jhumka Drops",         "earrings", "ruby"),
    ("naina-charm-bracelet",      "Naina Charm Bracelet",       "bracelet", "gold"),
    ("ruhi-heart-pendant",        "Ruhi Heart Pendant",         "pendant",  "rose"),
    ("ishani-bridal-set",         "Ishani Bridal Necklace Set", "necklace", "ruby"),
    ("lira-pearl-studs",          "Lira Pearl Studs",           "studs",    "pearl"),
    ("avni-chandbali",            "Avni Chandbali Earrings",    "earrings", "gold"),
    ("kaya-twist-ring",           "Kaya Twist Ring",            "ring",     "rose"),
    ("tanvi-polki-tikka",         "Tanvi Polki Maang Tikka",    "tikka",    "ruby"),
]

BANNERS = [
    ("hero-01", "necklace", "gold"),
    ("hero-02", "earrings", "rose"),
    ("hero-03", "choker",   "emerald"),
    ("editorial-bridal",  "necklace", "ruby"),
    ("editorial-everyday","studs",    "ivory"),
    ("editorial-journal", "pendant",  "sapphire"),
    ("story-atelier",     "bangle",   "gold"),
    ("store-front",       "ring",     "pearl"),
]

CATEGORIES = [
    ("cat-necklace-sets", "necklace", "gold"),
    ("cat-earrings",      "earrings", "rose"),
    ("cat-rings",         "ring",     "sapphire"),
    ("cat-bracelets",     "bracelet", "emerald"),
    ("cat-chokers",       "choker",   "ruby"),
    ("cat-pendants",      "pendant",  "gold"),
    ("cat-maang-tikka",   "tikka",    "ruby"),
    ("cat-bangles",       "bangle",   "pearl"),
]

AVATARS = ["AK", "PS", "MR", "SD", "NV", "TJ"]


def write(fname, content):
    with open(os.path.join(OUT, fname), "w", encoding="utf-8") as fh:
        fh.write(content)


count = 0
for i, (slug, name, kind, tint) in enumerate(PRODUCTS):
    a, b = TINTS[tint]
    write(f"p-{slug}.svg", product_svg(name, kind, a, b, 100 + i))
    # second gallery angle — softer ground, shifted composition
    write(f"p-{slug}-alt.svg", product_svg(name, kind, b, a, 300 + i))
    count += 2

for i, (slug, kind, tint) in enumerate(BANNERS):
    a, b = TINTS[tint]
    write(f"b-{slug}.svg", banner_svg(500 + i, a, b, kind))
    count += 1

for i, (slug, kind, tint) in enumerate(CATEGORIES):
    a, b = TINTS[tint]
    write(f"{slug}.svg", product_svg(slug, kind, a, b, 700 + i))
    count += 1

for i, ini in enumerate(AVATARS):
    write(f"avatar-{ini.lower()}.svg", avatar_svg(ini, 900 + i, list(TINTS.values())[i % len(TINTS)][0]))
    count += 1

print(f"generated {count} svg assets in {os.path.abspath(OUT)}")
