"""
Draws the patent figures (FIG. 1 to FIG. 6) as black-and-white line drawings.

Patent drawings are expected in black ink on white, with reference numerals and
no colour, so these are drawn from scratch rather than reused from the colour
diagrams in docs/assets/diagrams. Re-run after changing a label:

    python docs/patent/build_figures.py
"""

import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "figures")
os.makedirs(OUT, exist_ok=True)

W, H = 1700, 2200
INK = (0, 0, 0)
LINE = 4


def font(size, bold=False):
    names = ["arialbd.ttf", "DejaVuSans-Bold.ttf"] if bold else ["arial.ttf", "DejaVuSans.ttf"]
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


F_TEXT = font(30)
F_SMALL = font(26)
F_NUM = font(30, bold=True)
F_TITLE = font(46, bold=True)


def canvas(title):
    img = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(img)
    tw = d.textlength(title, font=F_TITLE)
    d.text(((W - tw) / 2, H - 110), title, fill=INK, font=F_TITLE)
    return img, d


def wrap(d, text, width_px, fnt):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if d.textlength(trial, font=fnt) <= width_px:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def box(d, x, y, w, h, text, num=None, fnt=F_TEXT, dashed=False, shape="rect", align="center",
        num_left=False):
    """A labelled box; returns its anchor points."""
    if shape == "rect":
        if dashed:
            dash_rect(d, x, y, w, h)
        else:
            d.rectangle([x, y, x + w, y + h], outline=INK, width=LINE)
    elif shape == "round":
        d.rounded_rectangle([x, y, x + w, y + h], radius=40, outline=INK, width=LINE)
    elif shape == "diamond":
        cx, cy = x + w / 2, y + h / 2
        d.polygon([(cx, y), (x + w, cy), (cx, y + h), (x, cy)], outline=INK, width=LINE)
    inner = w - (160 if shape == "diamond" else 40)
    lines = wrap(d, text, inner, fnt)
    lh = fnt.size + 8
    ty = y + (h - lh * len(lines)) / 2
    for line in lines:
        lw = d.textlength(line, font=fnt)
        tx = x + (w - lw) / 2 if align == "center" else x + 24
        d.text((tx, ty), line, fill=INK, font=fnt)
        ty += lh
    if num is not None:
        if num_left:
            d.text((x - 10 - d.textlength(str(num), font=F_NUM), y - 20), str(num), fill=INK, font=F_NUM)
        else:
            label(d, x + w + 8, y + 6, num)
    return {"top": (x + w / 2, y), "bottom": (x + w / 2, y + h), "left": (x, y + h / 2),
            "right": (x + w, y + h / 2)}


def label(d, x, y, num):
    """A reference numeral with a short leader line, as patent drawings use."""
    d.line([x, y + 18, x + 26, y + 4], fill=INK, width=3)
    d.text((x + 30, y - 16), str(num), fill=INK, font=F_NUM)


def dash_rect(d, x, y, w, h, dash=22, gap=14):
    for (x1, y1, x2, y2) in [(x, y, x + w, y), (x + w, y, x + w, y + h),
                             (x, y + h, x + w, y + h), (x, y, x, y + h)]:
        length = max(abs(x2 - x1), abs(y2 - y1))
        pos = 0
        while pos < length:
            end = min(pos + dash, length)
            if x1 == x2:
                d.line([x1, y1 + pos, x2, y1 + end], fill=INK, width=LINE)
            else:
                d.line([x1 + pos, y1, x1 + end, y2], fill=INK, width=LINE)
            pos += dash + gap


def arrow(d, a, b, text=None, both=False, text_side="right"):
    d.line([a, b], fill=INK, width=LINE)
    head(d, a, b)
    if both:
        head(d, b, a)
    if text:
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        if a[1] == b[1]:
            # Horizontal: above the line, clear of the arrowhead.
            d.text((mx - d.textlength(text, font=F_SMALL) / 2, my - 44), text, fill=INK, font=F_SMALL)
        else:
            off = 14 if text_side == "right" else -14 - d.textlength(text, font=F_SMALL)
            d.text((mx + off, my - 16), text, fill=INK, font=F_SMALL)


def elbow(d, points, text=None):
    for p, q in zip(points, points[1:]):
        d.line([p, q], fill=INK, width=LINE)
    head(d, points[-2], points[-1])
    if text:
        (x1, y1), (x2, y2) = points[0], points[1]
        d.text(((x1 + x2) / 2 + 12, (y1 + y2) / 2 - 36), text, fill=INK, font=F_SMALL)


def head(d, a, b, size=22):
    import math
    ang = math.atan2(b[1] - a[1], b[0] - a[0])
    p1 = (b[0] - size * math.cos(ang - 0.4), b[1] - size * math.sin(ang - 0.4))
    p2 = (b[0] - size * math.cos(ang + 0.4), b[1] - size * math.sin(ang + 0.4))
    d.polygon([b, p1, p2], fill=INK)


def save(img, name):
    path = os.path.join(OUT, name)
    img.save(path)
    print("saved", path)


# ------------------------------------------------------------------ FIG. 1
img, d = canvas("FIG. 1")
dash_rect(d, 60, 60, 1000, 1880)
d.text((90, 80), "USER DEVICE", fill=INK, font=F_NUM)
label(d, 1066, 66, 100)
b102 = box(d, 110, 150, 880, 110, "Display and input (touch, camera)", 102)
b110 = box(d, 110, 320, 880, 110, "Presentation layer (screens)", 110)
b120 = box(d, 110, 490, 880, 110, "State layer (per-feature stores)", 120)
b140 = box(d, 110, 660, 410, 170, "Progress engine (derived, never stored)", 140)
b170 = box(d, 580, 660, 410, 170, "Proposal validator and review interface", 170)
b130 = box(d, 110, 890, 880, 230,
           "Local relational database — authoritative copy: hierarchy rows, "
           "client-generated time-ordered IDs, sync status 132, tombstones 134", 130)
b150 = box(d, 110, 1190, 880, 170, "Synchronisation engine (pull, merge, push; watermark)", 150)
b160 = box(d, 110, 1430, 410, 190, "Assistant client and reply renderer", 160)
b162 = box(d, 580, 1430, 410, 190, "Image pre-processor (resize, re-encode)", 162)
b180 = box(d, 110, 1690, 880, 170, "Session scheduler: sign-in, interval, backgrounding, reconnect", 180)
for a, b in [(b102, b110), (b110, b120)]:
    arrow(d, a["bottom"], b["top"], both=True)
arrow(d, (315, 600), (315, 660), both=True)
arrow(d, (785, 600), (785, 660), both=True)
arrow(d, (550, 600), (550, 890), both=True)
arrow(d, b130["bottom"], b150["top"], both=True)
arrow(d, (550, 1690), (550, 1360))
arrow(d, (580, 1525), (520, 1525))

dash_rect(d, 1150, 60, 440, 1320)
d.text((1170, 80), "SERVER SYSTEM", fill=INK, font=F_NUM)
label(d, 1480, 20, 200)
b210 = box(d, 1175, 160, 380, 150, "Authentication service", 210)
b220 = box(d, 1175, 380, 380, 230, "Cloud database with row-level security 222", 220)
b230 = box(d, 1175, 690, 380, 620,
           "AI proxy function: request validator 232, rate limiter 234, "
           "server-held credential 236, instruction composer 238", 230)
b300 = box(d, 1175, 1600, 380, 200, "Generative model service", 300)
arrow(d, (990, 1275), (1175, 495), text="400", both=True)
arrow(d, (990, 1525), (1175, 1000), text="400", both=True)
arrow(d, b230["bottom"], b300["top"], both=True)
save(img, "fig1-system.png")

# ------------------------------------------------------------------ FIG. 2
img, d = canvas("FIG. 2")
b500 = box(d, 600, 80, 500, 120, "Course", 500)
b510 = box(d, 600, 290, 500, 120, "Subject", 510)
b520a = box(d, 200, 520, 520, 150, "Chapter A: 1 topic, 1 complete", 520)
b520b = box(d, 980, 520, 520, 150, "Chapter B: 99 topics, 0 complete", 522)
arrow(d, b500["bottom"], b510["top"])
arrow(d, (850, 410), (460, 520))
arrow(d, (850, 410), (1240, 520))
b530 = box(d, 980, 770, 520, 130, "Topic (1 unit, or its sub-topics)", 530)
b540 = box(d, 980, 990, 520, 130, "Optional sub-topic (1 unit each)", 540)
arrow(d, b520b["bottom"], b530["top"])
arrow(d, b530["bottom"], b540["top"])
box(d, 150, 1250, 1400, 170,
    "Topic-weighted: subject progress = completed units / total units = 1 / 100 = 1%", 550)
box(d, 150, 1480, 1400, 170,
    "Averaging chapter percentages (rejected): (100% + 0%) / 2 = 50%", 552, dashed=True)
box(d, 150, 1710, 1400, 170,
    "A scope with no units reports 'unmeasured' (no value), never 0%", 554)
save(img, "fig2-progress.png")

# ------------------------------------------------------------------ FIG. 3
img, d = canvas("FIG. 3")
steps = [
    ("S300", "Trigger: sign-in, periodic interval while in foreground, app leaving the foreground, or network restored"),
    ("S310", "Select next table in dependency order (course, subject, chapter, topic, sub-topic, ...)"),
    ("S320", "Pull rows changed since (watermark − 60 s), in pages until a page is empty"),
    ("S330", "Reconcile by row identifier: new rows inserted; existing rows form conflict pairs"),
    ("S340", "Merge each pair (FIG. 4); rows merged from both sides are marked pending"),
    ("S350", "Push every row marked pending (idempotent upsert on the same identifier)"),
    ("S360", "More tables?"),
    ("S370", "Advance watermark to the latest server timestamp seen — only if the whole pass succeeded"),
    ("S380", "Signal screens to re-read if any row was pulled"),
]
y = 70
prev = None
pos = {}
for i, (num, text) in enumerate(steps):
    shape = "diamond" if num == "S360" else "rect"
    h = 200 if shape == "diamond" else 150
    b = box(d, 300, y, 1100, h, text, None, shape=shape)
    d.text((140, y + h / 2 - 18), num, fill=INK, font=F_NUM)
    if prev:
        arrow(d, prev["bottom"], b["top"])
    pos[num] = (b, y, h)
    prev = b
    y += h + 60
b360, y360, h360 = pos["S360"]
_, y310, h310 = pos["S310"]
elbow(d, [(1400, y360 + h360 / 2), (1560, y360 + h360 / 2), (1560, y310 + h310 / 2),
          (1400, y310 + h310 / 2)], text="yes")
d.text((870, y360 + h360 + 4), "no", fill=INK, font=F_SMALL)
save(img, "fig3-sync.png")

# ------------------------------------------------------------------ FIG. 4
img, d = canvas("FIG. 4")
DX, DW, DH = 170, 760, 250
RX, RW, RH = 1080, 450, 190
q1 = box(d, DX, 80, DW, DH, "Either copy deleted (tombstone)?", 410, shape="diamond", num_left=True)
r1 = box(d, RX, 110, RW, RH, "Keep deletion, earliest deletion time", 412)
q2 = box(d, DX, 430, DW, DH, "Row carries a completion state?", 420, shape="diamond", num_left=True)
r2 = box(d, RX, 460, RW, RH, "Whole row: later update time; exact tie keeps local", 422)
q3 = box(d, DX, 780, DW, DH, "Completion change times differ?", 430, shape="diamond", num_left=True)
r3 = box(d, RX, 810, RW, RH, "Completion from the later completion change", 432)
r4 = box(d, DX + 80, 1130, DW - 160, 170, "Equal times: resolve to COMPLETED", 434, num_left=True)
r5 = box(d, 170, 1450, 1360, 200,
         "Other fields from the side with the later update time; result written locally "
         "and marked pending when it combines both sides", 440)
arrow(d, q1["right"], r1["left"], text="yes")
arrow(d, q1["bottom"], q2["top"], text="no")
arrow(d, q2["right"], r2["left"], text="no")
arrow(d, q2["bottom"], q3["top"], text="yes")
arrow(d, q3["right"], r3["left"], text="yes")
arrow(d, q3["bottom"], r4["top"], text="no")
arrow(d, r4["bottom"], r5["top"])
elbow(d, [r3["bottom"], (RX + RW / 2, 1450)])
save(img, "fig4-merge.png")

# ------------------------------------------------------------------ FIG. 5
img, d = canvas("FIG. 5")
flow = [
    (510, "Model reply received by the device"),
    (520, "Extract fenced proposal block; remaining text is displayed as prose"),
    (530, "Block conforms to restricted grammar? (only 'add chapters' / 'add topics'; valid names)"),
    (540, "Store as inert proposal attached to the message; show size summary"),
    (550, "Student opens review: every chapter and topic that would be added is listed"),
    (560, "Student confirms?"),
    (570, "Proposal within review limit (≤ 200 topics)?"),
    (580, "Apply: add to the named subject (case-insensitive match) or create it"),
]
y = 60
b = {}
for num, text in flow:
    shape = "diamond" if num in (530, 560, 570) else "rect"
    h = 230 if shape == "diamond" else 140
    b[num] = box(d, 250, y, 1000, h, text, num, shape=shape, fnt=F_SMALL if shape == "diamond" else F_TEXT)
    y += h + 45
order = [n for n, _ in flow]
for a_, c_ in zip(order, order[1:]):
    arrow(d, b[a_]["bottom"], b[c_]["top"], text="yes" if a_ in (530, 560, 570) else None)
side = [(530, "No proposal: prose only; nothing can be changed", 532),
        (560, "Discard; tracker unchanged", 562),
        (570, "Refuse; ask for a smaller part", 572)]
for num, text, ref in side:
    by = b[num]["right"][1]
    box(d, 1320, by - 80, 340, 160, text, None, fnt=F_SMALL)
    label(d, 1600, by - 120, ref)
    arrow(d, (1250, by), (1320, by), text=None)
    d.text((1262, by - 44), "no", fill=INK, font=F_SMALL)
save(img, "fig5-proposal.png")

# ------------------------------------------------------------------ FIG. 6
img, d = canvas("FIG. 6")
left = [
    (610, "Capture photo or select from gallery (camera permission only for capture)"),
    (620, "Resize so the longest side ≤ 1600 px; re-encode as JPEG"),
    (630, "Encode as base64; attach to the question (a default question if none typed)"),
]
right = [
    (640, "Validate: permitted image type, well-formed encoding, size limit"),
    (650, "Per-account rate limit"),
    (660, "Compose request: image part first, then question; instruction forbids LaTeX"),
    (670, "Generative model reads the image and answers"),
]
y = 120
lb = []
for num, text in left:
    lb.append(box(d, 80, y, 640, 220, text, num))
    y += 300
dash_rect(d, 40, 60, 760, 1000)
d.text((60, 70), "DEVICE 100", fill=INK, font=F_NUM)
y = 120
rb = []
for num, text in right:
    rb.append(box(d, 940, y, 640, 200, text, num))
    y += 270
dash_rect(d, 900, 60, 760, 1160)
d.text((920, 70), "SERVER 200 / MODEL 300", fill=INK, font=F_NUM)
for a_, c_ in zip(lb, lb[1:]):
    arrow(d, a_["bottom"], c_["top"])
for a_, c_ in zip(rb, rb[1:]):
    arrow(d, a_["bottom"], c_["top"])
arrow(d, lb[-1]["right"], rb[0]["left"])
rej = box(d, 940, 1300, 640, 200, "Reject (malformed: 400; too large: 413) before any model call", 642)
elbow(d, [(1580, rb[0]["right"][1]), (1640, rb[0]["right"][1]), (1640, 1400), (1580, 1400)], text=None)
r680 = box(d, 80, 1300, 640, 220, "Receive reply; parse markdown into styled blocks", 680)
r690 = box(d, 80, 1600, 640, 250, "Rewrite math notation as Unicode (a/b, x², √x, π); render", 690)
elbow(d, [(1260, rb[-1]["bottom"][1]), (1260, 1250), (400, 1250), (400, 1300)])
arrow(d, r680["bottom"], r690["top"])
save(img, "fig6-image.png")
