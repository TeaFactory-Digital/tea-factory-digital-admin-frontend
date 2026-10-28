"""Check a translated handbook against its English source.

    python3 -I docs/handbooks/src/check_translation.py console.en.html console.si.html

Fails when the translation lost or added a tag, lost a figure, kept an English sentence,
or contains an em dash. Run from the admin repo root.
"""

import re
import sys
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

SRC = Path(__file__).parent


class Shape(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tags = []
        self.text = []

    def handle_starttag(self, tag, attrs):
        cls = dict(attrs).get("class", "")
        self.tags.append(f"{tag}.{cls}")

    def handle_data(self, data):
        self.text.append(data)


def shape(path):
    parser = Shape()
    parser.feed((SRC / path).read_text(encoding="utf-8"))
    return parser.tags, " ".join(parser.text)


def figures(text):
    # Every number as written, ignoring thousands separators: 114,644.91 -> 114644.91
    return Counter(n.replace(",", "") for n in re.findall(r"\d[\d,]*(?:\.\d+)?", text))


def main():
    en_file, tr_file = sys.argv[1], sys.argv[2]
    en_tags, en_text = shape(en_file)
    tr_tags, tr_text = shape(tr_file)
    raw = (SRC / tr_file).read_text(encoding="utf-8")
    problems = []

    if en_tags != tr_tags:
        for i, (a, b) in enumerate(zip(en_tags, tr_tags)):
            if a != b:
                problems.append(f"tag {i}: English has <{a}>, translation has <{b}>")
                break
        if len(en_tags) != len(tr_tags):
            problems.append(f"tag count: English {len(en_tags)}, translation {len(tr_tags)}")

    missing = figures(en_text) - figures(tr_text)
    if missing:
        problems.append(f"figures missing or changed: {dict(missing)}")

    if "\u2014" in raw:
        problems.append(f"em dash found {raw.count(chr(0x2014))} times")

    lang = re.search(r'<html lang="(\w+)"', raw)
    if not lang or lang.group(1) == "en":
        problems.append('set <html lang="si"> or <html lang="ta">')

    # Long runs of English words left untranslated (names and codes are short).
    for run in re.findall(r"(?:\b[A-Za-z][a-z']+\b[ ,]+){6,}", tr_text):
        problems.append(f"English left in: {run.strip()[:80]}")

    if problems:
        print("\n".join(problems))
        sys.exit(1)
    print(f"ok: {len(tr_tags)} tags, every figure kept, no em dash")


main()
