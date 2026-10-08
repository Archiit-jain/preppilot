"""Checks whether the official syllabus documents behind the library have changed.

Usage:
  python check_sources.py                 check every source; exit 1 if any changed
  python check_sources.py --record <dir>  record the baseline from the PDFs used to
                                          build the templates (<dir>/<key>.pdf)

`sources.json` lists each official document, the templates built from it, and
fingerprints of the copy that was used: the file's SHA-256, and a hash of its text
with everything but letters and digits removed. A changed file whose text is the
same (re-saved, new metadata) is reported but not counted as a change.

It reads PDFs (with `pdftotext`, poppler-utils) and web pages (by their visible text). Government sites are sometimes slow or block
some networks; a source that cannot be fetched is reported as unreachable and does
not fail the check.

This only notices changes to the documents it knows. A new exam cycle often
publishes its syllabus at a new address; that has to be added here by hand.
"""

import datetime
import hashlib
import html
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

MANIFEST = Path(__file__).resolve().parent.parent / "sources.json"
USER_AGENT = "Mozilla/5.0 (PrepPilot syllabus check)"


def is_pdf(path: Path) -> bool:
    return path.read_bytes()[:4] == b"%PDF"


def page_text(path: Path) -> str:
    """The visible text of a web page: scripts, styles and tags removed."""
    page = path.read_bytes().decode("utf8", "replace")
    page = re.sub(r"(?is)<(script|style|noscript)\b.*?</\1>", " ", page)
    return html.unescape(re.sub(r"<[^>]+>", " ", page))


def text_hash(path: Path) -> str:
    if is_pdf(path):
        out = subprocess.run(
            ["pdftotext", "-enc", "UTF-8", str(path), "-"], capture_output=True, check=True
        ).stdout.decode("utf8", "replace")
    else:
        out = page_text(path)
    # Different pdftotext versions space and break lines differently; letters
    # and digits are what matter.
    return hashlib.sha256(re.sub(r"[^0-9a-z]", "", out.lower()).encode()).hexdigest()


def file_hash(path: Path) -> str:
    # A web page's bytes change on every load (tokens, timestamps), so a page is
    # compared by its text only.
    return hashlib.sha256(path.read_bytes()).hexdigest() if is_pdf(path) else text_hash(path)


def fetch(url: str, dest: Path, attempts: int = 3) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    for attempt in range(attempts):
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                data = response.read()
            break
        except OSError:
            if attempt == attempts - 1:
                raise
    if not data.startswith(b"%PDF") and b"<html" not in data[:2000].lower():
        raise ValueError("the response is neither a PDF nor a web page")
    dest.write_bytes(data)


def record(directory: Path) -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf8"))
    today = datetime.date.today().isoformat()
    for source in manifest["sources"]:
        pdf = directory / f"{source['key']}.pdf"
        if not pdf.exists():
            pdf = directory / f"{source['key']}.html"
        if not pdf.exists():
            print(f"skip {source['key']}: no {source['key']}.pdf or .html")
            continue
        source["sha256"] = file_hash(pdf)
        source["textHash"] = text_hash(pdf)
        source["recorded"] = today
        print(f"recorded {source['key']}")
    MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf8")


def check() -> int:
    manifest = json.loads(MANIFEST.read_text(encoding="utf8"))
    changed, resaved, unreachable, same = [], [], [], 0
    with tempfile.TemporaryDirectory() as tmp:
        for source in manifest["sources"]:
            pdf = Path(tmp) / f"{source['key']}.pdf"
            try:
                fetch(source["url"], pdf)
            except Exception as error:  # noqa: BLE001 - any failure means "could not check"
                unreachable.append((source, str(error)))
                continue
            if file_hash(pdf) == source["sha256"]:
                same += 1
            elif text_hash(pdf) == source["textHash"]:
                resaved.append(source)
            else:
                changed.append(source)

    lines = [f"# Syllabus source check, {datetime.date.today().isoformat()}", ""]
    lines.append(f"{same} unchanged, {len(changed)} changed, {len(resaved)} re-saved with the same text, "
                 f"{len(unreachable)} unreachable, of {len(manifest['sources'])} sources.")
    if changed:
        lines += ["", "## Changed: rebuild these templates", ""]
        lines += [f"- **{s['key']}** ({s['url']}): {', '.join(s['templates'])}" for s in changed]
    if resaved:
        lines += ["", "## Re-saved, text unchanged", ""]
        lines += [f"- {s['key']}" for s in resaved]
    if unreachable:
        lines += ["", "## Could not fetch (check by hand)", ""]
        lines += [f"- {s['key']} ({s['url']}): {error}" for s, error in unreachable]
    report = "\n".join(lines) + "\n"
    print(report)
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf8") as handle:
            handle.write(report)
    return 1 if changed else 0


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "--record":
        record(Path(sys.argv[2]))
    elif len(sys.argv) == 1:
        sys.exit(check())
    else:
        print(__doc__)
        sys.exit(2)
