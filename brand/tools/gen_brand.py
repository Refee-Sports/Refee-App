"""Generate every Refee brand SVG from one geometry definition.

Run:  python brand/tools/gen_brand.py   (needs fontTools; outlines Inter Tight Black)
Writes SVGs under brand/logo, brand/app-icon, brand/store, brand/social, brand/web.
Rendering to PNG is brand/tools/render.sh.
"""
import os

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REPO = os.path.dirname(ROOT)
FONT_DIR = os.path.join(REPO, "node_modules/@expo-google-fonts")
BLACK = os.path.join(FONT_DIR, "inter-tight/InterTight_900Black.ttf")
MONO = os.path.join(FONT_DIR, "jetbrains-mono/JetBrainsMono_700Bold.ttf")

# Palette: identical to apps/mobile/tailwind.config.js
INK, PAPER, CHALK = "#08111C", "#E5E1D6", "#F5F2EA"
SIGNAL, SIGNAL_DARK, SIGNAL_DEEP = "#1F4FCC", "#4F8CFF", "#0B2880"
HIVIS = "#C9F031"
COURT_DEEP = "#009150"  # live square on light grounds: 3.1:1 on paper (court #00A85C is only 2.4:1)
WHITE, BLACK_ = "#FFFFFF", "#000000"

# Mark proportions, all as fractions of the R's cap height (h)
GAP, BAR, DOT = 0.07, 0.16, 0.17   # R→zebra gap, zebra bar height, live-square size
ZEBRA_CELLS = 7                     # 4 filled, 3 empty: same rhythm as ZebraRule


class Font:
    def __init__(self, path):
        self.f = TTFont(path)
        self.gs = self.f.getGlyphSet()
        self.cmap = self.f.getBestCmap()
        self.upm = self.f["head"].unitsPerEm
        self.cap = self.f["OS/2"].sCapHeight

    def text(self, s, cap_px, tracking_em=0.0):
        """Outline s so its cap height is cap_px. Returns (glyphs, ink_bbox) with baseline y=0, y down.
        glyphs is a list of (char, path_d) already positioned."""
        size = cap_px * self.upm / self.cap
        k = size / self.upm
        x, out = 0.0, []
        minx = miny = 1e9
        maxx = maxy = -1e9
        for i, ch in enumerate(s):
            g = self.cmap[ord(ch)]
            pen = SVGPathPen(self.gs)
            self.gs[g].draw(TransformPen(pen, (k, 0, 0, -k, x, 0)))
            out.append((ch, pen.getCommands()))
            b = BoundsPen(self.gs)
            self.gs[g].draw(b)
            if b.bounds:
                x0, y0, x1, y1 = b.bounds
                minx, maxx = min(minx, x + x0 * k), max(maxx, x + x1 * k)
                miny, maxy = min(miny, -y1 * k), max(maxy, -y0 * k)
            x += self.f["hmtx"][g][0] * k + (tracking_em * size if i < len(s) - 1 else 0)
        return out, (minx, miny, maxx, maxy)


black = Font(BLACK)
mono = Font(MONO)


def fmt(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")


# ---------------------------------------------------------------- mark ----
def mark(h, left, top, r=PAPER, zebra=SIGNAL_DARK, dot=HIVIS, small=False):
    """The On Call mark. h = cap height of the R. (left, top) = top-left of the R's ink box.
    Returns (svg, width, total_height). The live square overhangs top-right by design."""
    glyphs, (x0, y0, x1, y1) = black.text("R", h)
    w = x1 - x0
    tx, ty = left - x0, top + h
    parts = [f'<path fill="{r}" transform="translate({fmt(tx)} {fmt(ty)})" d="{glyphs[0][1]}"/>']
    by = top + h + h * GAP
    bh = h * BAR
    if small:  # below ~24 px the stripes merge: draw one solid bar, slightly heavier
        parts.append(f'<rect fill="{zebra}" x="{fmt(left)}" y="{fmt(by)}" width="{fmt(w)}" height="{fmt(bh * 1.15)}"/>')
    else:
        cw = w / ZEBRA_CELLS
        for i in range(0, ZEBRA_CELLS, 2):
            parts.append(f'<rect fill="{zebra}" x="{fmt(left + i * cw)}" y="{fmt(by)}" width="{fmt(cw)}" height="{fmt(bh)}"/>')
    ds = h * DOT * (1.2 if small else 1)
    if dot:
        parts.append(f'<rect fill="{dot}" x="{fmt(left + w - ds * 0.55)}" y="{fmt(top - ds * 0.45)}" width="{fmt(ds)}" height="{fmt(ds)}"/>')
    return "".join(parts), w, h * (1 + GAP + BAR)


def mark_centered(h, cx, cy, **kw):
    """Centre on the mark's optical body (R + zebra), ignoring the live-square overhang."""
    _, (x0, _, x1, _) = black.text("R", h)
    w = x1 - x0
    total = h * (1 + GAP + BAR)
    return mark(h, cx - w / 2, cy - total / 2, **kw)[0]


def mark_extent(h):
    """Full ink box including the live square: (width, height, dx_overhang_right, dy_overhang_top)."""
    _, (x0, _, x1, _) = black.text("R", h)
    w = x1 - x0
    ds = h * DOT
    return w, h * (1 + GAP + BAR), ds * 0.45, ds * 0.45


# ------------------------------------------------------------ wordmark ----
def wordmark(cap, left, baseline, ref=INK, ee=SIGNAL):
    glyphs, (x0, y0, x1, y1) = black.text("REFEE", cap, -0.04)
    parts = []
    for i, (ch, d) in enumerate(glyphs):
        parts.append(f'<path fill="{ref if i < 3 else ee}" transform="translate({fmt(left - x0)} {fmt(baseline)})" d="{d}"/>')
    return "".join(parts), x1 - x0


def mono_text(s, cap, left, baseline, fill, tracking=0.12):
    glyphs, (x0, _, x1, _) = mono.text(s, cap, tracking)
    return "".join(f'<path fill="{fill}" transform="translate({fmt(left - x0)} {fmt(baseline)})" d="{d}"/>' for _, d in glyphs), x1 - x0


def svg(w, h, body, bg=None, title=None):
    t = f"<title>{title}</title>" if title else ""
    b = f'<rect width="{fmt(w)}" height="{fmt(h)}" fill="{bg}"/>' if bg else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(w)} {fmt(h)}">{t}{b}{body}</svg>\n'


def write(rel, content):
    p = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w") as fh:
        fh.write(content)


# ---------------------------------------------------------------- logos ----
SCHEMES = {
    # name: (R/REF colour, zebra/EE colour, live-square colour, background for previews)
    "reverse": (PAPER, SIGNAL_DARK, HIVIS),      # home: on ink
    "positive": (INK, SIGNAL, COURT_DEEP),       # on paper/chalk/white — hi-vis vanishes on light grounds
    "mono-white": (WHITE, WHITE, WHITE),
    "mono-black": (BLACK_, BLACK_, BLACK_),
}


def build_logos():
    pad = 0  # SVGs are cropped to ink; clear space is a usage rule, not baked in
    H = 400
    for name, (r, z, d) in SCHEMES.items():
        w, th, ox, oy = mark_extent(H)
        body = mark(H, pad, oy, r=r, zebra=z, dot=d)[0]
        write(f"logo/mark-{name}.svg", svg(w + ox, th + oy, body, title="Refee"))
        # small-size mark (16–24 px uses)
        ws, ths, oxs, oys = w, H * (1 + GAP + BAR * 1.15), H * DOT * 1.2 * 0.45, H * DOT * 1.2 * 0.45
        body = mark(H, 0, oys, r=r, zebra=z, dot=d, small=True)[0]
        write(f"logo/mark-small-{name}.svg", svg(ws + oxs, ths + oys, body, title="Refee"))

        # wordmark
        cap = 200
        wm, ww = wordmark(cap, 0, cap, ref=r, ee=z)
        write(f"logo/wordmark-{name}.svg", svg(ww, cap, wm, title="Refee"))

        # horizontal lockup: mark body height = 1.6 × wordmark cap; wordmark centred on the R's cap
        mh = 200
        mw, mth, mox, moy = mark_extent(mh)
        mcap = mh / 1.45
        gapx = mh * 0.42
        mk = mark(mh, 0, moy, r=r, zebra=z, dot=d)[0]
        wm_top = moy + (mh - mcap) / 2
        wm2, ww2 = wordmark(mcap, mw + mox + gapx, wm_top + mcap, ref=r, ee=z)
        write(f"logo/lockup-horizontal-{name}.svg", svg(mw + mox + gapx + ww2, mth + moy, mk + wm2, title="Refee"))

        # stacked lockup: mark above wordmark, centred
        wcap = 120
        _, (a, _, b, _) = black.text("REFEE", wcap, -0.04)
        sw = b - a
        mh3 = 300
        mw3, mth3, mox3, moy3 = mark_extent(mh3)
        total_w = max(sw, mw3 + 2 * mox3)
        mk3 = mark(mh3, (total_w - mw3) / 2, moy3, r=r, zebra=z, dot=d)[0]
        gy = moy3 + mth3 + mh3 * 0.28
        wm3, _ = wordmark(wcap, (total_w - sw) / 2, gy + wcap, ref=r, ee=z)
        write(f"logo/lockup-stacked-{name}.svg", svg(total_w, gy + wcap, mk3 + wm3, title="Refee"))


# ------------------------------------------------------------ app icons ----
def build_app_icons():
    S = 1024
    # Light-first: the icon is a paper tile (ink R, signal zebra, court-deep square). Dark-ground
    # surfaces (iOS dark, splash in dark mode) keep the reverse colours.
    POS = dict(r=INK, zebra=SIGNAL, dot=COURT_DEEP)
    # iOS: opaque, square; the system applies the mask. Mark body ≈ 58% of the tile height.
    H = 470
    write("app-icon/ios-app-icon.svg", svg(S, S, mark_centered(H, S / 2, S / 2 + 6, **POS), bg=PAPER, title="Refee app icon"))
    # iOS 18 dark: transparent ground so the system supplies its dark gradient
    write("app-icon/ios-app-icon-dark.svg", svg(S, S, mark_centered(H, S / 2, S / 2 + 6)))
    # iOS 18 tinted: greyscale on transparent, system tints it — keep contrast between the parts
    write("app-icon/ios-app-icon-tinted.svg",
          svg(S, S, mark_centered(H, S / 2, S / 2 + 6, r="#FFFFFF", zebra="#9A9A9A", dot="#FFFFFF")))

    # Android adaptive: 108 dp canvas at 1024 px; mark body inside the 66 dp safe zone (626 px)
    # and must survive a circle mask (72 dp visible). Body height ≈ 50% of canvas.
    Ha = 330
    write("app-icon/android-adaptive-foreground.svg", svg(S, S, mark_centered(Ha, S / 2, S / 2 + 4, **POS), title="Refee adaptive foreground"))
    write("app-icon/android-adaptive-background.svg", svg(S, S, "", bg=PAPER))
    write("app-icon/android-monochrome.svg",
          svg(S, S, mark_centered(Ha, S / 2, S / 2 + 4, r=WHITE, zebra=WHITE, dot=WHITE), title="Refee monochrome"))

    # Android notification: 24 dp, white alpha only; 2 dp padding; small-size geometry
    Hn = 14.5
    w, _, _, _ = mark_extent(Hn)
    body_h = Hn * (1 + GAP + BAR * 1.15)
    write("app-icon/android-notification.svg",
          svg(24, 24, mark(Hn, 12 - w / 2, 12 - body_h / 2 + 0.6, r=WHITE, zebra=WHITE, dot=WHITE, small=True)[0]))

    # Splash: Expo draws `image` centred on backgroundColor at `imageWidth` dp; transparent mark only.
    # Light = paper ground + positive mark; dark = ink ground + reverse mark (app.json splash.dark).
    write("app-icon/splash-icon.svg", svg(S, S, mark_centered(560, S / 2, S / 2 + 8, **POS), title="Refee splash"))
    write("app-icon/splash-icon-dark.svg", svg(S, S, mark_centered(560, S / 2, S / 2 + 8), title="Refee splash (dark)"))

    # Web favicon (small-size geometry on paper, square) and Safari pinned tab
    write("web/favicon.svg", svg(64, 64, mark(34, 32 - mark_extent(34)[0] / 2 - 1, 10.5, small=True, **POS)[0], bg=PAPER, title="Refee"))


# ---------------------------------------------------------- store/social ----
def zebra_rule(x, y, w, h, color, cell=None):
    cell = cell or h
    n = int(w // cell) + 1
    return "".join(f'<rect fill="{color}" x="{fmt(x + i * cell)}" y="{fmt(y)}" width="{fmt(min(cell, x + w - (x + i * cell)))}" height="{fmt(h)}"/>'
                   for i in range(0, n, 2) if x + i * cell < x + w)


def headline(lines, cap, left, top, lh, colors=None):
    """Display type, stacked. lines: list of list of (text, colour) runs."""
    out = []
    y = top + cap
    for runs in lines:
        x = left
        for run in runs:
            text, col = run[0], run[1]
            glued = len(run) > 2 and run[2] == "glue"
            if glued:
                x -= space
            g, (x0, _, x1, _) = black.text(text, cap, -0.03)
            out.append("".join(f'<path fill="{col}" transform="translate({fmt(x - x0)} {fmt(y)})" d="{d}"/>' for _, d in g))
            space = black.text("R", cap)[1][2] * 0.28
            x += (x1 - x0) + space
        y += lh
    return "".join(out)


def build_store():
    # Google Play feature graphic 1024×500. Play may overlay a play button centre-bottom
    # when a video is attached, and crops on some surfaces: keep type inside the centre 900×400.
    W, H = 1024, 500
    b = zebra_rule(0, 0, W, 14, SIGNAL_DARK, 14)
    b += mark(210, 96, 150)[0]
    hl = headline([[("EARN ON", PAPER)], [("YOUR", PAPER), ("CALL.", SIGNAL_DARK)]], 74, 400, 150, 96)
    b += hl
    t, _ = mono_text("THE ON-DEMAND MARKETPLACE FOR SPORTS OFFICIALS", 13, 402, 380, PAPER, 0.14)
    b += f'<g opacity="0.6">{t}</g>'
    b += f'<rect fill="{HIVIS}" x="402" y="404" width="14" height="14"/>'
    t2, _ = mono_text("LAUNCHING OCT 2026", 13, 426, 417, HIVIS, 0.14)
    b += t2
    write("store/play-feature-graphic.svg", svg(W, H, b, bg=INK, title="Refee feature graphic"))

    # OpenGraph / link preview 1200×630
    W, H = 1200, 630
    b = zebra_rule(0, 0, W, 16, SIGNAL_DARK, 16)
    lk_mh = 120
    mw, mth, mox, moy = mark_extent(lk_mh)
    b += mark(lk_mh, 80, 90 + moy)[0]
    wm, _ = wordmark(lk_mh / 1.45, 80 + mw + mox + 50, 90 + moy + (lk_mh - lk_mh / 1.45) / 2 + lk_mh / 1.45, ref=PAPER, ee=SIGNAL_DARK)
    b += wm
    b += headline([[("GAMES NEED", PAPER)], [("OFFICIALS.", PAPER)], [("OFFICIALS NEED", PAPER), ("GAMES.", SIGNAL_DARK)]], 62, 80, 300, 82)
    t, _ = mono_text("REFEE.APP", 16, 80, 580, HIVIS, 0.16)
    b += t
    write("web/opengraph.svg", svg(W, H, b, bg=INK, title="Refee"))

    # Social avatar 1080 (safe inside the circular crop)
    write("social/avatar.svg", svg(1080, 1080, mark_centered(460, 540, 548, r=INK, zebra=SIGNAL, dot=COURT_DEEP), bg=PAPER, title="Refee"))

    # Launch post 1080×1350 (Instagram portrait)
    W, H = 1080, 1350
    b = zebra_rule(0, 0, W, 18, SIGNAL_DARK, 18)
    b += f'<rect fill="{HIVIS}" x="80" y="128" width="22" height="22"/>' + mono_text("CALLED UP · OCT 2026", 22, 120, 150, HIVIS, 0.14)[0]
    b += headline([[("REF", PAPER), ("EE", SIGNAL_DARK, "glue")], [("EARN ON", PAPER)], [("YOUR", PAPER), ("CALL.", SIGNAL_DARK)]], 118, 80, 290, 146)
    t, _ = mono_text("FIND GAMES · SET YOUR RATE · GET PAID", 20, 80, 1000, PAPER, 0.12)
    b += f'<g opacity="0.7">{t}</g>'
    mw, mth, mox, moy = mark_extent(90)
    b += mark(90, 80, 1110 + moy)[0]
    wm, _ = wordmark(90 / 1.45, 80 + mw + mox + 38, 1110 + moy + (90 - 90 / 1.45) / 2 + 90 / 1.45, ref=PAPER, ee=SIGNAL_DARK)
    b += wm
    b += zebra_rule(0, H - 18, W, 18, SIGNAL_DARK, 18)
    write("social/launch-post-1080x1350.svg", svg(W, H, b, bg=INK, title="Refee launch"))

    # Story 1080×1920: keep content between y=250 and y=1670 (UI chrome)
    W, H = 1080, 1920
    b = zebra_rule(0, 250, W, 18, SIGNAL_DARK, 18)
    b += mark_centered(300, 540, 560)
    b += headline([[("EARN ON", PAPER)], [("YOUR", PAPER), ("CALL.", SIGNAL_DARK)]], 120, 110, 860, 150)
    t, _ = mono_text("ON THE APP STORE + GOOGLE PLAY", 22, 110, 1260, PAPER, 0.12)
    b += f'<g opacity="0.7">{t}</g>'
    b += f'<rect fill="{HIVIS}" x="110" y="1330" width="860" height="110"/>'
    t, tw = mono_text("DOWNLOAD REFEE  →", 30, 0, 0, INK, 0.12)
    b += f'<g transform="translate({fmt(540 - tw / 2)} 1400)">{t}</g>'
    b += zebra_rule(0, 1650, W, 18, SIGNAL_DARK, 18)
    write("social/story-1080x1920.svg", svg(W, H, b, bg=INK, title="Refee launch story"))

    # Email header 600×120 (use as a hosted PNG at 2×)
    b = zebra_rule(0, 0, 600, 6, SIGNAL_DARK, 6)
    mh = 50
    mw, mth, mox, moy = mark_extent(mh)
    top = (120 - mth - moy) / 2 + moy
    b += mark(mh, 32, top)[0]
    b += wordmark(mh / 1.45, 32 + mw + mox + 18, top + (mh - mh / 1.45) / 2 + mh / 1.45, ref=PAPER, ee=SIGNAL_DARK)[0]
    write("web/email-header.svg", svg(600, 120, b, bg=INK, title="Refee"))


if __name__ == "__main__":
    build_logos()
    build_app_icons()
    build_store()
    print("SVGs written under", ROOT)
