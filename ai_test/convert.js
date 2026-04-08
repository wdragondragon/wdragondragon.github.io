const fs = require('fs');
const path = require('path');

const SOURCE_TXT_PATH = path.join(__dirname, '试题库_1432题.txt');
const EXAM_TXT_PATH = path.join(__dirname, '考试练习_400题.txt');
const QUESTION_DATA_JS_PATH = path.join(__dirname, 'question-data.js');
const EXAM_MAP_JS_PATH = path.join(__dirname, 'exam-question-map.js');

const MANUAL_EXAM_MAPPING = {
  96: 127
};

function escapeTemplateLiteral(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');
}

function normalizeAnswer(rawAnswer) {
  const value = String(rawAnswer || '').trim();
  if (!value) return '';
  if (value === '正确' || value === '错误') return value;
  const letters = value.toUpperCase().match(/[A-D]/g);
  return letters ? Array.from(new Set(letters)).sort().join('') : value;
}

function inferQuestionType(answer) {
  if (answer === '正确' || answer === '错误') return 'judge';
  if (/^[A-D]+$/.test(answer) && answer.length > 1) return 'multiple';
  return 'single';
}

function parseTxtContent(txtContent) {
  const questions = [];
  const lines = String(txtContent || '').split(/\r?\n/);
  let currentQuestion = null;
  let optionLines = [];
  let isReadingExplanation = false;

  function finalizeCurrentQuestion() {
    if (!currentQuestion) return;

    const normalizedAnswer = normalizeAnswer(currentQuestion.answer);
    questions.push({
      id: currentQuestion.id,
      type: inferQuestionType(normalizedAnswer),
      question: currentQuestion.question.trim(),
      options: optionLines.map((option) => ({
        letter: option.letter,
        text: option.text.trim()
      })),
      answer: normalizedAnswer,
      explanation: currentQuestion.explanation.trim()
    });

    currentQuestion = null;
    optionLines = [];
    isReadingExplanation = false;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index].replace(/\uFEFF/g, '');
    const line = rawLine.trim();

    if (!line) continue;

    const questionMatch = line.match(/^(\d+)\.\s*(.+)$/);
    if (questionMatch) {
      finalizeCurrentQuestion();
      currentQuestion = {
        id: Number(questionMatch[1]),
        question: questionMatch[2],
        answer: '',
        explanation: ''
      };
      continue;
    }

    if (!currentQuestion) continue;

    const optionMatch = line.match(/^([A-D])\.\s*(.+)$/);
    if (optionMatch) {
      optionLines.push({
        letter: optionMatch[1],
        text: optionMatch[2]
      });
      isReadingExplanation = false;
      continue;
    }

    const answerMatch = line.match(/^答案:\s*(.+)$/);
    if (answerMatch) {
      currentQuestion.answer = answerMatch[1];
      isReadingExplanation = false;
      continue;
    }

    const explanationMatch = line.match(/^解析:\s*(.*)$/);
    if (explanationMatch) {
      currentQuestion.explanation = explanationMatch[1];
      isReadingExplanation = true;
      continue;
    }

    if (isReadingExplanation) {
      currentQuestion.explanation = [currentQuestion.explanation, line].filter(Boolean).join(' ');
      continue;
    }

    if (!currentQuestion.answer && optionLines.length > 0) {
      optionLines[optionLines.length - 1].text = [optionLines[optionLines.length - 1].text, line].join(' ');
      continue;
    }

    currentQuestion.question = [currentQuestion.question, line].join(' ');
  }

  finalizeCurrentQuestion();
  return questions;
}

function normalizeComparableText(value) {
  return String(value || '')
    .replace(/\s+/g, '')
    .replace(/[（）()]/g, '')
    .replace(/[“”"'‘’]/g, '')
    .replace(/[，,、；;：:]/g, '')
    .replace(/[。！？?!.]/g, '')
    .toLowerCase();
}

function createMatchKey(question) {
  return [
    normalizeComparableText(question.question),
    question.options.map((option) => option.letter + normalizeComparableText(option.text)).join('|'),
    normalizeAnswer(question.answer)
  ].join('||');
}

function buildExamQuestionMapping(sourceQuestions, examQuestions) {
  const sourceByKey = new Map();
  sourceQuestions.forEach((question) => {
    const key = createMatchKey(question);
    if (!sourceByKey.has(key)) {
      sourceByKey.set(key, question.id);
    }
  });

  const mapping = {};
  const unresolved = [];

  examQuestions.forEach((question) => {
    const mappedId = MANUAL_EXAM_MAPPING[question.id] || sourceByKey.get(createMatchKey(question)) || null;
    mapping[question.id] = mappedId;

    if (!mappedId) {
      unresolved.push(question.id);
    }
  });

  if (unresolved.length > 0) {
    throw new Error(`以下考试题号未能映射到 1432 题库: ${unresolved.join(', ')}`);
  }

  return mapping;
}

function countByType(questions) {
  return questions.reduce((counts, question) => {
    counts[question.type] = (counts[question.type] || 0) + 1;
    return counts;
  }, {
    single: 0,
    multiple: 0,
    judge: 0
  });
}

function writeQuestionData(txtContent) {
  const escaped = escapeTemplateLiteral(txtContent);
  const jsContent = `// 题库数据 - 自动生成\nwindow.FULL_TXT_CONTENT = \`${escaped}\`;\n`;
  fs.writeFileSync(QUESTION_DATA_JS_PATH, jsContent, 'utf8');
  return jsContent.length;
}

function writeExamMap(mapping, sourceQuestions) {
  const sourceIds = Array.from(new Set(Object.values(mapping))).sort((left, right) => left - right);
  const sourceQuestionMap = new Map(sourceQuestions.map((question) => [question.id, question]));
  const uniqueQuestions = sourceIds.map((id) => sourceQuestionMap.get(id)).filter(Boolean);
  const typeCounts = countByType(uniqueQuestions);

  const duplicateCount = Object.values(mapping).length - sourceIds.length;
  const jsContent = [
    '// 模拟考试题号映射 - 自动生成',
    `window.EXAM_QUESTION_ID_MAP = ${JSON.stringify(mapping, null, 2)};`,
    `window.EXAM_SOURCE_IDS = ${JSON.stringify(sourceIds)};`,
    `window.EXAM_SOURCE_META = ${JSON.stringify({
      examQuestionCount: Object.keys(mapping).length,
      uniqueSourceQuestionCount: sourceIds.length,
      duplicateMappingCount: duplicateCount,
      typeCounts,
      manualOverrides: MANUAL_EXAM_MAPPING
    }, null, 2)};`,
    ''
  ].join('\n');

  fs.writeFileSync(EXAM_MAP_JS_PATH, jsContent, 'utf8');
  return {
    size: jsContent.length,
    sourceIds,
    duplicateCount,
    typeCounts
  };
}

function main() {
  const sourceTxtContent = fs.readFileSync(SOURCE_TXT_PATH, 'utf8');
  const examTxtContent = fs.readFileSync(EXAM_TXT_PATH, 'utf8');

  const sourceQuestions = parseTxtContent(sourceTxtContent);
  const examQuestions = parseTxtContent(examTxtContent);
  const mapping = buildExamQuestionMapping(sourceQuestions, examQuestions);

  const questionDataSize = writeQuestionData(sourceTxtContent);
  const examMapInfo = writeExamMap(mapping, sourceQuestions);

  console.log('已生成 question-data.js，大小:', questionDataSize, '字符');
  console.log('已生成 exam-question-map.js，大小:', examMapInfo.size, '字符');
  console.log('考试题映射总数:', examQuestions.length, '唯一原题数:', examMapInfo.sourceIds.length, '重复映射数:', examMapInfo.duplicateCount);
  console.log('映射后的题型分布:', examMapInfo.typeCounts);
}

main();
