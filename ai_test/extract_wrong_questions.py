from pathlib import Path
import re
import sys

try:
    from bs4 import BeautifulSoup
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Missing dependency: bs4") from exc


WRONG_PATTERNS = [
    re.compile(r"\u4f60\s*\u7b54\s*\u9519\s*\u4e86"),
    re.compile(r"\u4f60\s*\u7b54\u9519\s*\u4e86"),
]
PARTIAL_PATTERNS = [
    re.compile(r"\u56de\s*\u7b54\s*\u90e8\s*\u5206\s*\u6b63\s*\u786e"),
]


def normalize_text(text: str) -> str:
    text = text or ""
    text = text.replace("\xa0", " ")
    text = re.sub(r"<br\s*/?>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+", "", text)
    replacements = {
        "\uff08": "(",
        "\uff09": ")",
        "\u201c": '"',
        "\u201d": '"',
        "\u2018": "'",
        "\u2019": "'",
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    return text.strip()


def parse_bank_blocks(bank_text: str):
    matches = list(re.finditer(r"(?m)^(\d+)\.\s+.+$", bank_text))
    blocks = []
    for index, match in enumerate(matches):
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(bank_text)
        raw_block = bank_text[start:end].strip()
        first_line = raw_block.splitlines()[0].strip()
        question_match = re.match(r"^(\d+)\.\s+(.+)$", first_line)
        if not question_match:
            continue
        blocks.append(
            {
                "id": int(question_match.group(1)),
                "question": question_match.group(2).strip(),
                "raw": raw_block,
            }
        )
    return blocks


def extract_wrong_stems(html_text: str):
    soup = BeautifulSoup(html_text, "html.parser")
    wrong_items = []
    for block in soup.select(".js-testpaper-question-block .js-testpaper-question"):
        result = block.select_one(".testpaper-question-result")
        if not result:
            continue
        result_text = result.get_text(" ", strip=True)
        is_wrong = any(pattern.search(result_text) for pattern in WRONG_PATTERNS)
        is_partial = any(pattern.search(result_text) for pattern in PARTIAL_PATTERNS)
        if not (is_wrong or is_partial):
            continue
        seq_node = block.select_one(".testpaper-question-seq")
        stem_node = block.select_one(".testpaper-question-stem")
        if not seq_node or not stem_node:
            continue
        wrong_items.append(
            {
                "seq": int(seq_node.get_text(" ", strip=True)),
                "stem": stem_node.get_text(" ", strip=True),
                "status": "partial" if is_partial else "wrong",
            }
        )
    return wrong_items


def build_output(root: Path):
    html_path = root / "error.html"
    bank_candidates = [p for p in root.glob("*1432*txt") if p.is_file() and not p.name.endswith(".bak")]
    if not html_path.exists():
        raise FileNotFoundError(f"Missing file: {html_path}")
    if not bank_candidates:
        raise FileNotFoundError("Could not find the 1432-question bank text file.")

    bank_path = bank_candidates[0]
    html_text = html_path.read_text(encoding="utf-8", errors="ignore")
    bank_text = bank_path.read_text(encoding="utf-8", errors="ignore")

    bank_blocks = parse_bank_blocks(bank_text)
    bank_index = {}
    for block in bank_blocks:
        bank_index.setdefault(normalize_text(block["question"]), []).append(block)

    wrong_items = extract_wrong_stems(html_text)
    matched_blocks = []
    unmatched = []
    ambiguous = []

    for item in wrong_items:
        candidates = bank_index.get(normalize_text(item["stem"]), [])
        if len(candidates) == 1:
            matched = candidates[0].copy()
            matched["seq"] = item["seq"]
            matched_blocks.append(matched)
        elif not candidates:
            unmatched.append(item)
        else:
            ambiguous.append({"item": item, "candidates": candidates})

    return matched_blocks, unmatched, ambiguous


def main():
    root = Path(__file__).resolve().parent
    output_path = root / "wrong_questions_formatted.txt"

    matched_blocks, unmatched, ambiguous = build_output(root)

    if unmatched or ambiguous:
        print(f"Matched: {len(matched_blocks)}")
        print(f"Unmatched: {len(unmatched)}")
        print(f"Ambiguous: {len(ambiguous)}")
        sys.exit(1)

    output_text = "\n\n".join(block["raw"] for block in matched_blocks).strip() + "\n"
    output_path.write_text(output_text, encoding="utf-8")

    ids = [str(block["id"]) for block in matched_blocks]
    print(f"Extracted {len(matched_blocks)} wrong questions.")
    print(f"Output: {output_path}")
    print("Original question ids: " + ", ".join(ids))


if __name__ == "__main__":
    main()
