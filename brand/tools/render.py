"""Render brand SVGs to PNG with headless Chrome (alpha kept) and downscale with macOS `sips`.

Run:  python3 brand/tools/render.py      (stdlib only; needs Google Chrome + sips)
Writes brand/export/** and copies the app's files into apps/mobile/assets/images.
"""
import os
import shutil
import subprocess
import tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REPO = os.path.dirname(ROOT)
OUT = os.path.join(ROOT, "export")
MOBILE_ASSETS = os.path.join(REPO, "apps/mobile/assets/images")
WEB_APP = os.path.join(REPO, "apps/web/app")
WEB_PUBLIC = os.path.join(REPO, "apps/web/public")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def render(svg_rel, out_rel, w, h, bg=None):
    """Render at exact pixel size. bg=None keeps transparency."""
    src = os.path.join(ROOT, svg_rel)
    out = os.path.join(OUT, out_rel)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        html = os.path.join(tmp, "r.html")
        page_bg = bg or "transparent"
        # Chrome headless has a minimum window (~500 px): render small targets at k× and downscale with sips
        k = max(1, -(-500 // min(w, h)))
        with open(html, "w") as fh:
            fh.write(f'<html><body style="margin:0;background:{page_bg}">'
                     f'<img src="file://{src}" style="display:block;width:{w * k}px;height:{h * k}px"></body></html>')
        shot = os.path.join(tmp, "s.png")
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                        "--default-background-color=00000000", f"--window-size={w * k},{h * k}",
                        f"--screenshot={shot}", f"file://{html}"], check=True, capture_output=True, timeout=60)
        if k > 1:
            subprocess.run(["sips", "-z", str(h), str(w), shot], check=True, capture_output=True)
        shutil.move(shot, out)
    return out


def downscale(src_rel, out_rel, size):
    src, out = os.path.join(OUT, src_rel), os.path.join(OUT, out_rel)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    subprocess.run(["sips", "-z", str(size), str(size), src, "--out", out], check=True, capture_output=True)
    return out


def strip_alpha(path):
    """App Store Connect rejects a marketing icon with an alpha channel, even a fully opaque one.
    Decode the RGBA PNG (undo scanline filters), drop A, re-encode as 8-bit RGB. Stdlib only."""
    import struct
    import zlib
    data = open(path, "rb").read()
    pos, chunks = 8, []
    while pos < len(data):
        n = struct.unpack(">I", data[pos:pos + 4])[0]
        chunks.append((data[pos + 4:pos + 8], data[pos + 8:pos + 8 + n]))
        pos += 12 + n
    ihdr = next(c for t, c in chunks if t == b"IHDR")
    w, h, depth, ctype = struct.unpack(">IIBB", ihdr[:10])
    if ctype != 6 or depth != 8:
        return
    raw = zlib.decompress(b"".join(c for t, c in chunks if t == b"IDAT"))
    bpp, stride = 4, w * 4
    prev = bytearray(stride)
    rgb = bytearray()
    for y in range(h):
        ft = raw[y * (stride + 1)]
        line = bytearray(raw[y * (stride + 1) + 1:(y + 1) * (stride + 1)])
        for i in range(stride):
            a = line[i - bpp] if i >= bpp else 0
            b = prev[i]
            c = prev[i - bpp] if i >= bpp else 0
            if ft == 1:
                line[i] = (line[i] + a) & 255
            elif ft == 2:
                line[i] = (line[i] + b) & 255
            elif ft == 3:
                line[i] = (line[i] + (a + b) // 2) & 255
            elif ft == 4:
                p_ = a + b - c
                pa, pb, pc = abs(p_ - a), abs(p_ - b), abs(p_ - c)
                line[i] = (line[i] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        prev = line
        rgb.append(0)
        for i in range(0, stride, 4):
            rgb += line[i:i + 3]

    def chunk(t, c):
        return struct.pack(">I", len(c)) + t + c + struct.pack(">I", zlib.crc32(t + c) & 0xFFFFFFFF)
    out = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) \
        + chunk(b"IDAT", zlib.compress(bytes(rgb), 9)) + chunk(b"IEND", b"")
    open(path, "wb").write(out)


def main():
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)

    # ---- logos: 2000 px wide PNGs for docs/decks; SVG stays the master
    for name in sorted(os.listdir(os.path.join(ROOT, "logo"))):
        if not name.endswith(".svg"):
            continue
        with open(os.path.join(ROOT, "logo", name)) as fh:
            vb = fh.read().split('viewBox="')[1].split('"')[0].split()
        vw, vh = float(vb[2]), float(vb[3])
        W = 1200
        render(f"logo/{name}", f"logo/{name[:-4]}.png", W, round(W * vh / vw))

    # ---- iOS
    strip_alpha(render("app-icon/ios-app-icon.svg", "ios/AppIcon-1024.png", 1024, 1024, bg="#E5E1D6"))
    render("app-icon/ios-app-icon-dark.svg", "ios/AppIcon-1024-dark.png", 1024, 1024)
    render("app-icon/ios-app-icon-tinted.svg", "ios/AppIcon-1024-tinted.png", 1024, 1024)

    # ---- Android
    render("app-icon/android-adaptive-foreground.svg", "android/adaptive-foreground-1024.png", 1024, 1024)
    render("app-icon/android-monochrome.svg", "android/adaptive-monochrome-1024.png", 1024, 1024)
    strip_alpha(render("app-icon/ios-app-icon.svg", "android/play-store-icon-512.png", 512, 512, bg="#E5E1D6"))
    render("app-icon/android-notification.svg", "android/notification-icon-96.png", 96, 96)
    for dpi, px in (("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)):
        downscale("android/play-store-icon-512.png", f"android/legacy/ic_launcher-{dpi}-{px}.png", px)
    render("store/play-feature-graphic.svg", "android/play-feature-graphic-1024x500.png", 1024, 500, bg="#08111C")

    # ---- Splash (Expo expo-splash-screen: image centred on backgroundColor)
    render("app-icon/splash-icon.svg", "splash/splash-icon-1024.png", 1024, 1024)
    render("app-icon/splash-icon-dark.svg", "splash/splash-icon-dark-1024.png", 1024, 1024)

    # ---- Web
    render("web/favicon.svg", "web/favicon-512.png", 512, 512, bg="#E5E1D6")
    for px in (16, 32, 48):
        downscale("web/favicon-512.png", f"web/favicon-{px}.png", px)
    render("app-icon/ios-app-icon.svg", "web/apple-touch-icon-180.png", 180, 180, bg="#E5E1D6")
    render("app-icon/android-adaptive-foreground.svg", "web/maskable-icon-512.png", 512, 512, bg="#E5E1D6")
    render("web/opengraph.svg", "web/opengraph-1200x630.png", 1200, 630, bg="#08111C")
    render("web/email-header.svg", "web/email-header-1200x240.png", 1200, 240, bg="#08111C")

    # ---- Social
    render("social/avatar.svg", "social/avatar-1080.png", 1080, 1080, bg="#E5E1D6")
    render("social/launch-post-1080x1350.svg", "social/launch-post-1080x1350.png", 1080, 1350, bg="#08111C")
    render("social/story-1080x1920.svg", "social/story-1080x1920.png", 1080, 1920, bg="#08111C")

    # ---- Hand the app what it needs
    os.makedirs(MOBILE_ASSETS, exist_ok=True)
    for src, dst in (("ios/AppIcon-1024.png", "icon.png"),
                     ("ios/AppIcon-1024-dark.png", "icon-dark.png"),
                     ("ios/AppIcon-1024-tinted.png", "icon-tinted.png"),
                     ("android/adaptive-foreground-1024.png", "adaptive-icon.png"),
                     ("android/adaptive-monochrome-1024.png", "adaptive-icon-monochrome.png"),
                     ("android/notification-icon-96.png", "notification-icon.png"),
                     ("splash/splash-icon-1024.png", "splash-icon.png"),
                     ("splash/splash-icon-dark-1024.png", "splash-icon-dark.png")):
        shutil.copy(os.path.join(OUT, src), os.path.join(MOBILE_ASSETS, dst))
    shutil.copy(os.path.join(ROOT, "web/favicon.svg"), os.path.join(WEB_PUBLIC, "favicon.svg"))
    shutil.copy(os.path.join(OUT, "web/apple-touch-icon-180.png"), os.path.join(WEB_APP, "apple-icon.png"))
    shutil.copy(os.path.join(OUT, "web/opengraph-1200x630.png"), os.path.join(WEB_APP, "opengraph-image.png"))
    print("rendered to", OUT)


if __name__ == "__main__":
    main()
