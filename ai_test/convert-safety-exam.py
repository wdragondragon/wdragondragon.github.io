import argparse
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


DEFAULT_SOURCE = (
    r"C:\Users\jdrag\Desktop\安规考试报名\安规考试报名与题库"
    r"\安规考试题库\21.南方电网公司安全工作规程考试题库-信息网络.xlsx"
)
DEFAULT_OUTPUT = Path(__file__).with_name("safety-question-data.js")

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"m": MAIN_NS, "pr": PKG_REL_NS}
OPTION_LETTERS = list("ABCDEFGHI")
TYPE_LABELS = {
    "单选题": "single",
    "多选题": "multiple",
    "判断题": "judge",
}
JUDGE_ANSWER_MAP = {
    "A": "正确",
    "B": "错误",
    "正确": "正确",
    "错误": "错误",
}


def col_index(cell_ref):
    match = re.match(r"([A-Z]+)", cell_ref)
    if not match:
        return None

    value = 0
    for char in match.group(1):
        value = value * 26 + ord(char) - ord("A") + 1
    return value - 1


def text_content(node):
    return "".join(text.text or "" for text in node.findall(".//m:t", NS)).strip()


def cell_value(cell, shared_strings):
    cell_type = cell.attrib.get("t")
    value = cell.find("m:v", NS)

    if cell_type == "inlineStr":
        return text_content(cell)

    if value is None:
        return None

    raw_value = (value.text or "").strip()
    if cell_type == "s":
        return shared_strings[int(raw_value)].strip()
    if cell_type == "b":
        return "TRUE" if raw_value == "1" else "FALSE"
    return raw_value


def read_row(row, shared_strings, width=20):
    values = [None] * width
    for cell in row.findall("m:c", NS):
        index = col_index(cell.attrib.get("r", ""))
        if index is not None and index < width:
            values[index] = cell_value(cell, shared_strings)
    return values


def read_shared_strings(archive):
    if "xl/sharedStrings.xml" not in archive.namelist():
        return []

    root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
    return [text_content(item) for item in root.findall("m:si", NS)]


def read_sheet_paths(archive):
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
    target_by_id = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in relationships.findall("pr:Relationship", NS)
    }

    sheets = []
    for sheet in workbook.findall("m:sheets/m:sheet", NS):
        rel_id = sheet.attrib[f"{{{REL_NS}}}id"]
        target = target_by_id[rel_id].lstrip("/")
        sheets.append((sheet.attrib["name"], f"xl/{target}"))
    return sheets


def normalize_whitespace(value):
    return re.sub(r"\s+", " ", str(value or "").replace("\u00a0", " ")).strip()


def normalize_answer(raw_answer, question_type):
    answer = normalize_whitespace(raw_answer).upper()
    if question_type == "judge":
        return JUDGE_ANSWER_MAP.get(answer, normalize_whitespace(raw_answer))

    letters = re.findall(r"[A-I]", answer)
    return "".join(sorted(dict.fromkeys(letters))) if letters else normalize_whitespace(raw_answer)


def infer_case_question_type(stem):
    match = re.search(r"[（(](单选题|多选题|判断题)[）)]\s*$", stem or "")
    if match:
        return TYPE_LABELS[match.group(1)]
    return "single"


def remove_case_type_suffix(stem):
    return re.sub(r"[（(](单选题|多选题|判断题)[）)]\s*$", "", stem or "").strip()


def option_objects(values):
    options = []
    for letter, text in zip(OPTION_LETTERS, values):
        if text is not None and normalize_whitespace(text):
            options.append({"letter": letter, "text": normalize_whitespace(text)})
    return options


def make_question(seq, sheet_name, source_no, raw_type, stem, options, answer, explanation,
                  difficulty, category, keywords, specialty, life_value, case_no=None,
                  case_stem=None):
    question_type = TYPE_LABELS.get(raw_type) or infer_case_question_type(stem)
    clean_stem = remove_case_type_suffix(normalize_whitespace(stem)) if case_stem else normalize_whitespace(stem)
    normalized_answer = normalize_answer(answer, question_type)

    return {
        "id": seq,
        "seq": seq,
        "type": question_type,
        "sourceSheet": sheet_name,
        "sourceNo": str(source_no or ""),
        "caseNo": str(case_no) if case_no is not None else None,
        "caseStem": normalize_whitespace(case_stem) if case_stem else "",
        "question": clean_stem,
        "options": options,
        "answer": normalized_answer,
        "explanation": normalize_whitespace(explanation),
        "difficulty": normalize_whitespace(difficulty),
        "category": normalize_whitespace(category),
        "keywords": normalize_whitespace(keywords),
        "specialty": normalize_whitespace(specialty),
        "isLifeSaving": normalize_whitespace(life_value) == "是",
    }


def parse_standard_sheet(rows, sheet_name, start_seq):
    questions = []
    seq = start_seq

    for row in rows[2:]:
        if not row[4]:
            continue

        is_judge_sheet = sheet_name == "判断题"
        if is_judge_sheet:
            explanation = row[16]
            keywords = row[17]
            specialty = row[18]
            life_value = row[19]
        else:
            explanation = row[15]
            keywords = row[16]
            specialty = row[17]
            life_value = row[18]

        questions.append(make_question(
            seq=seq,
            sheet_name=sheet_name,
            source_no=row[0],
            raw_type=row[1],
            stem=row[4],
            options=option_objects(row[5:14]),
            answer=row[14],
            explanation=explanation,
            difficulty=row[2],
            category=specialty,
            keywords=keywords,
            specialty=specialty,
            life_value=life_value,
        ))
        seq += 1

    return questions, seq


def parse_case_sheet(rows, sheet_name, start_seq):
    questions = []
    seq = start_seq
    current_case = None

    for row in rows[2:]:
        if row[1] == "题干":
            current_case = {
                "caseNo": row[0],
                "stem": row[5],
            }
            continue

        if not row[5]:
            continue

        source_no = f"{current_case['caseNo']}.{row[1]}" if current_case else row[1]
        questions.append(make_question(
            seq=seq,
            sheet_name=sheet_name,
            source_no=source_no,
            raw_type=row[2],
            stem=row[5],
            options=option_objects(row[6:15]),
            answer=row[15],
            explanation=row[16],
            difficulty=row[3],
            category=row[18],
            keywords=row[17],
            specialty=row[18],
            life_value=row[19],
            case_no=current_case["caseNo"] if current_case else None,
            case_stem=current_case["stem"] if current_case else "",
        ))
        seq += 1

    return questions, seq


def parse_workbook(source_path):
    questions = []
    seq = 1

    with zipfile.ZipFile(source_path) as archive:
        shared_strings = read_shared_strings(archive)
        for sheet_name, sheet_path in read_sheet_paths(archive):
            if sheet_name == "参考文件":
                continue

            root = ET.fromstring(archive.read(sheet_path))
            rows = [
                read_row(row, shared_strings)
                for row in root.findall("m:sheetData/m:row", NS)
            ]

            if sheet_name in {"小案例题", "大案例题"}:
                sheet_questions, seq = parse_case_sheet(rows, sheet_name, seq)
            else:
                sheet_questions, seq = parse_standard_sheet(rows, sheet_name, seq)
            questions.extend(sheet_questions)

    return questions


def validate_questions(questions):
    errors = []
    counts = {"single": 0, "multiple": 0, "judge": 0}
    life_counts = {"single": 0, "multiple": 0, "judge": 0}

    for question in questions:
        counts[question["type"]] += 1
        if question["isLifeSaving"]:
            life_counts[question["type"]] += 1

        if not question["question"]:
            errors.append(f"第 {question['id']} 题缺少题干")
        if not question["answer"]:
            errors.append(f"第 {question['id']} 题缺少答案")
        if len(question["options"]) < 2:
            errors.append(f"第 {question['id']} 题选项不足")
        if question["sourceSheet"] in {"小案例题", "大案例题"} and not question["caseStem"]:
            errors.append(f"第 {question['id']} 题缺少案例背景")

    if len(questions) != 474:
        errors.append(f"题目总数应为 474，实际为 {len(questions)}")

    expected_counts = {"single": 238, "multiple": 115, "judge": 121}
    if counts != expected_counts:
        errors.append(f"题型统计不一致：{counts}")

    return errors, counts, life_counts


def write_js(output_path, source_path, questions, counts, life_counts):
    payload = {
        "sourceFile": str(source_path),
        "generatedBy": "ai_test/convert-safety-exam.py",
        "total": len(questions),
        "typeCounts": counts,
        "lifeSavingTypeCounts": life_counts,
        "questions": questions,
    }
    json_payload = json.dumps(payload, ensure_ascii=False, indent=2).replace("</", "<\\/")
    content = f"// 安规考试题库数据 - 自动生成\nwindow.SAFETY_EXAM_DATA = {json_payload};\n"
    output_path.write_text(content, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Convert safety exam XLSX into browser JS data.")
    parser.add_argument("--source", default=DEFAULT_SOURCE)
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    source_path = Path(args.source)
    output_path = Path(args.output)
    if not source_path.exists():
        raise FileNotFoundError(source_path)

    questions = parse_workbook(source_path)
    errors, counts, life_counts = validate_questions(questions)
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        raise SystemExit(1)

    write_js(output_path, source_path, questions, counts, life_counts)
    print(f"Generated {output_path}")
    print(f"Total: {len(questions)}")
    print(f"Type counts: {counts}")
    print(f"Life-saving type counts: {life_counts}")


if __name__ == "__main__":
    main()
