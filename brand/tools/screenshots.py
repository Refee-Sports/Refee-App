"""Frame raw app captures into store screenshots.

1. Capture on the iPhone 16 Pro Max / 17 Pro Max simulator (native 1320×2868):
     xcrun simctl io booted screenshot brand/screenshots/raw/01.png
   Use the seeded test accounts so every screen has real-looking data (see docs/TESTING.md).
2. python3 brand/tools/screenshots.py
   → brand/screenshots/app-store/NN.png  (1320×2868, iPhone 6.9")
   → brand/screenshots/play/NN.png       (1080×2340, Android phone)

Stdlib only; renders with headless Chrome. Captions live in SHOTS below. Keep them literal:
Apple rejects screenshots that promise what the app doesn't do (e.g. "instant" bank payouts).
"""
import os
import subprocess
import tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REPO = os.path.dirname(ROOT)
RAW = os.path.join(ROOT, "screenshots/raw")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
FONTS = os.path.join(REPO, "node_modules/@expo-google-fonts")

# (file, eyebrow, headline lines; [brackets] mark the signal-blue word, what to capture)
SHOTS = [
    ("01.png", "FOR OFFICIALS", ["EARN ON", "YOUR [CALL.]"], "Jobs feed, Available tab, 4+ games with pay and miles"),
    ("02.png", "SET YOUR RATE", ["PICK YOUR", "[GAMES.]"], "Job detail: pay, crew size, venue, tip-off time"),
    ("03.png", "CLEAR PAY STATUS", ["TRACK EVERY", "[PAYOUT.]"], "Profile earnings card on MONTH (use the earnings test ref)"),
    ("04.png", "CREW CHAT", ["YOUR CREW,", "ONE [THREAD.]"], "Crew group thread with 3–4 messages"),
    ("05.png", "VETTED", ["VERIFIED.", "[CHECKED.]"], "Referee profile: headshot, certs, levels, background check current"),
    ("06.png", "FOR DIRECTORS", ["STAFF EVERY", "[GAME.]"], "Director game detail with applicants to accept"),
]

SIZES = {"app-store": (1320, 2868), "play": (1080, 2340)}


def page(w, h, raw, eyebrow, lines):
    k = w / 1320
    head = "<br>".join(l.replace("[", '<span class="s">').replace("]", "</span>") for l in lines)
    return f"""<html><head><style>
@font-face{{font-family:D;src:url(file://{FONTS}/inter-tight/InterTight_900Black.ttf)}}
@font-face{{font-family:M;src:url(file://{FONTS}/jetbrains-mono/JetBrainsMono_700Bold.ttf)}}
body{{margin:0;width:{w}px;height:{h}px;background:#08111C;overflow:hidden;position:relative}}
.z{{height:{24*k}px;background:repeating-linear-gradient(90deg,#4F8CFF 0 {24*k}px,transparent {24*k}px {48*k}px)}}
.e{{font:{34*k}px M;letter-spacing:.14em;color:#C9F031;margin:{120*k}px {110*k}px 0;display:flex;align-items:center;gap:{18*k}px}}
.e i{{width:{30*k}px;height:{30*k}px;background:#C9F031;display:block}}
h1{{font:{150*k}px/0.95 D;letter-spacing:-.035em;color:#E5E1D6;margin:{40*k}px {110*k}px 0}}
.s{{color:#4F8CFF}}
.shot{{position:absolute;left:{160*k}px;right:{160*k}px;top:{640*k}px;border:{4*k}px solid #E5E1D6;border-bottom:0}}
.shot img{{display:block;width:100%}}
</style></head><body><div class="z"></div><div class="e"><i></i>{eyebrow}</div><h1>{head}</h1>
<div class="shot"><img src="file://{raw}"></div></body></html>"""


def main():
    todo = [s for s in SHOTS if os.path.exists(os.path.join(RAW, s[0]))]
    if not todo:
        print(f"No captures in {RAW}. Expected:")
        for f, _, lines, what in SHOTS:
            print(f"  {f}  {' '.join(lines).replace('[', '').replace(']', ''):28}  ← {what}")
        return
    for store, (w, h) in SIZES.items():
        out_dir = os.path.join(ROOT, "screenshots", store)
        os.makedirs(out_dir, exist_ok=True)
        for f, eyebrow, lines, _ in todo:
            with tempfile.TemporaryDirectory() as tmp:
                html = os.path.join(tmp, "p.html")
                open(html, "w").write(page(w, h, os.path.join(RAW, f), eyebrow, lines))
                subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                                "--force-device-scale-factor=1", "--allow-file-access-from-files",
                                f"--window-size={w},{h}", f"--screenshot={os.path.join(out_dir, f)}", f"file://{html}"],
                               check=True, capture_output=True, timeout=60)
            print("framed", store, f)


if __name__ == "__main__":
    main()
