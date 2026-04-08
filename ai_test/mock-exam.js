(function (global) {
    const QUESTION_TYPES = {
        SINGLE: 'single',
        MULTIPLE: 'multiple',
        JUDGE: 'judge'
    };

    const RULE_MODES = {
        INSTANT: 'instant',
        FINAL: 'final',
        TIMER: 'timer'
    };

    const STATUS = {
        UNANSWERED: 'unanswered',
        ANSWERING: 'answering',
        CORRECT: 'correct',
        INCORRECT: 'incorrect'
    };

    const RULE_LABELS = {
        [RULE_MODES.INSTANT]: '单题即判',
        [RULE_MODES.FINAL]: '交卷后统一判分',
        [RULE_MODES.TIMER]: '倒计时交卷'
    };

    const EXAM_CONFIG = {
        total: 100,
        timerMinutes: 120,
        distribution: {
            [QUESTION_TYPES.SINGLE]: 70,
            [QUESTION_TYPES.MULTIPLE]: 20,
            [QUESTION_TYPES.JUDGE]: 10
        }
    };

    const STORAGE_KEY = 'mock_exam_400_progress';
    const SHARED_PROGRESS_KEY = 'question_bank_progress';

    function normalizeAnswer(rawAnswer) {
        const value = String(rawAnswer || '').trim();
        if (!value) {
            return '';
        }

        if (value === '正确' || value === '错误') {
            return value;
        }

        const letters = value.toUpperCase().match(/[A-D]/g);
        if (!letters) {
            return value;
        }

        return Array.from(new Set(letters)).sort().join('');
    }

    function inferQuestionType(answer) {
        if (answer === '正确' || answer === '错误') {
            return QUESTION_TYPES.JUDGE;
        }

        if (/^[A-D]+$/.test(answer) && answer.length > 1) {
            return QUESTION_TYPES.MULTIPLE;
        }

        return QUESTION_TYPES.SINGLE;
    }

    function parseTxtContent(txtContent) {
        const questions = [];
        const lines = String(txtContent || '').split(/\r?\n/);
        let currentQuestion = null;
        let optionLines = [];
        let isReadingExplanation = false;

        function finalizeCurrentQuestion() {
            if (!currentQuestion) {
                return;
            }

            const normalizedAnswer = normalizeAnswer(currentQuestion.answer);
            questions.push({
                id: currentQuestion.id,
                type: inferQuestionType(normalizedAnswer),
                question: currentQuestion.question.trim(),
                options: optionLines.map(function (option) {
                    return {
                        letter: option.letter,
                        text: option.text.trim()
                    };
                }),
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

            if (!line) {
                continue;
            }

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

            if (!currentQuestion) {
                continue;
            }

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

    function cloneQuestion(question, examNo) {
        return {
            examNo: examNo,
            sourceId: question.id,
            type: question.type,
            question: question.question,
            options: (question.options || []).map(function (option) {
                return {
                    letter: option.letter,
                    text: option.text
                };
            }),
            answer: question.answer,
            explanation: question.explanation || '',
            userAnswer: null,
            status: STATUS.UNANSWERED,
            isCorrect: null,
            locked: false
        };
    }

    function shuffle(array) {
        const clone = array.slice();
        for (let index = clone.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            const current = clone[index];
            clone[index] = clone[swapIndex];
            clone[swapIndex] = current;
        }
        return clone;
    }

    function pickQuestions(questions, count) {
        if (questions.length < count) {
            throw new Error('题库数量不足，无法生成指定题型配比的模拟试卷。');
        }

        return shuffle(questions).slice(0, count);
    }

    function generateExamPaper(questionBank, config) {
        const effectiveConfig = config || EXAM_CONFIG;
        const grouped = {
            [QUESTION_TYPES.SINGLE]: [],
            [QUESTION_TYPES.MULTIPLE]: [],
            [QUESTION_TYPES.JUDGE]: []
        };

        questionBank.forEach(function (question) {
            if (grouped[question.type]) {
                grouped[question.type].push(question);
            }
        });

        const selectedSingles = pickQuestions(
            grouped[QUESTION_TYPES.SINGLE],
            effectiveConfig.distribution[QUESTION_TYPES.SINGLE]
        ).sort(function (left, right) { return left.id - right.id; });

        const selectedMultiples = pickQuestions(
            grouped[QUESTION_TYPES.MULTIPLE],
            effectiveConfig.distribution[QUESTION_TYPES.MULTIPLE]
        ).sort(function (left, right) { return left.id - right.id; });

        const selectedJudges = pickQuestions(
            grouped[QUESTION_TYPES.JUDGE],
            effectiveConfig.distribution[QUESTION_TYPES.JUDGE]
        ).sort(function (left, right) { return left.id - right.id; });

        return []
            .concat(selectedSingles, selectedMultiples, selectedJudges)
            .map(function (question, index) {
                return cloneQuestion(question, index + 1);
            });
    }

    function buildExamPaperFromIds(questionBank, sourceIds) {
        const bankMap = new Map(questionBank.map(function (question) {
            return [question.id, question];
        }));

        return sourceIds.map(function (sourceId, index) {
            const sourceQuestion = bankMap.get(sourceId);
            if (!sourceQuestion) {
                throw new Error('恢复考试进度失败，题库题号与缓存不一致。');
            }

            return cloneQuestion(sourceQuestion, index + 1);
        });
    }

    function countByType(questions) {
        return questions.reduce(function (counts, question) {
            counts[question.type] = (counts[question.type] || 0) + 1;
            return counts;
        }, {
            [QUESTION_TYPES.SINGLE]: 0,
            [QUESTION_TYPES.MULTIPLE]: 0,
            [QUESTION_TYPES.JUDGE]: 0
        });
    }

    const MockExamUtils = {
        QUESTION_TYPES: QUESTION_TYPES,
        RULE_MODES: RULE_MODES,
        STATUS: STATUS,
        STORAGE_KEY: STORAGE_KEY,
        EXAM_CONFIG: EXAM_CONFIG,
        normalizeAnswer: normalizeAnswer,
        parseTxtContent: parseTxtContent,
        generateExamPaper: generateExamPaper,
        countByType: countByType
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = MockExamUtils;
    }

    global.MockExamUtils = MockExamUtils;

    if (typeof document === 'undefined') {
        return;
    }

    document.addEventListener('DOMContentLoaded', function () {
        const dom = {
            questionText: document.getElementById('questionText'),
            questionType: document.getElementById('questionType'),
            questionNumber: document.getElementById('questionNumber'),
            ruleSummary: document.getElementById('ruleSummary'),
            resultBanner: document.getElementById('resultBanner'),
            optionsContainer: document.getElementById('optionsContainer'),
            judgmentContainer: document.getElementById('judgmentContainer'),
            judgmentButtons: Array.from(document.querySelectorAll('#judgmentContainer .judgment-btn')),
            emptyState: document.getElementById('emptyState'),
            prevBtn: document.getElementById('prevBtn'),
            nextBtn: document.getElementById('nextBtn'),
            questionSubmitBtn: document.getElementById('questionSubmitBtn'),
            finishExamBtn: document.getElementById('finishExamBtn'),
            restartExamBtn: document.getElementById('restartExamBtn'),
            clearWrongSetBtn: document.getElementById('clearWrongSetBtn'),
            backToPracticeBtn: document.getElementById('backToPracticeBtn'),
            ruleModeSelect: document.getElementById('ruleModeSelect'),
            ruleHint: document.getElementById('ruleHint'),
            timerPanel: document.getElementById('timerPanel'),
            timerDisplay: document.getElementById('timerDisplay'),
            userAnswerText: document.getElementById('userAnswerText'),
            correctAnswerText: document.getElementById('correctAnswerText'),
            answerStatus: document.getElementById('answerStatus'),
            answerNote: document.getElementById('answerNote'),
            explanationBlock: document.getElementById('explanationBlock'),
            explanationText: document.getElementById('explanationText'),
            totalQuestions: document.getElementById('totalQuestions'),
            answeredCount: document.getElementById('answeredCount'),
            correctCount: document.getElementById('correctCount'),
            incorrectCount: document.getElementById('incorrectCount'),
            remainingCount: document.getElementById('remainingCount'),
            scoreValue: document.getElementById('scoreValue'),
            progressFill: document.getElementById('progressFill'),
            progressText: document.getElementById('progressText'),
            singleProgress: document.getElementById('singleProgress'),
            multipleProgress: document.getElementById('multipleProgress'),
            judgeProgress: document.getElementById('judgeProgress'),
            sheetLegend: document.getElementById('sheetLegend'),
            answerSheetGrid: document.getElementById('answerSheetGrid')
        };

        const state = {
            fullQuestionBank: [],
            questionBank: [],
            examQuestions: [],
            currentIndex: 0,
            ruleMode: RULE_MODES.INSTANT,
            isSubmitted: false,
            endTime: null,
            timerHandle: null
        };

        init();

        function init() {
            bindEvents();

            try {
                if (!global.FULL_TXT_CONTENT) {
                    throw new Error('未找到 1432 题主库数据，请确认 question-data.js 已正确加载。');
                }

                if (!global.EXAM_SOURCE_IDS || !Array.isArray(global.EXAM_SOURCE_IDS) || global.EXAM_SOURCE_IDS.length === 0) {
                    throw new Error('未找到考试题号映射，请确认 exam-question-map.js 已正确加载。');
                }

                state.fullQuestionBank = parseTxtContent(global.FULL_TXT_CONTENT);
                const examSourceIds = Array.from(new Set(global.EXAM_SOURCE_IDS.map(function (id) {
                    return Number(id);
                }).filter(Boolean)));
                const sourceIdSet = new Set(examSourceIds);

                state.questionBank = state.fullQuestionBank.filter(function (question) {
                    return sourceIdSet.has(question.id);
                });

                if (state.questionBank.length !== examSourceIds.length) {
                    throw new Error('考试题号映射与 1432 题主库不一致，请重新生成 exam-question-map.js。');
                }

                const sourceCounts = countByType(state.questionBank);
                if (
                    sourceCounts[QUESTION_TYPES.SINGLE] < EXAM_CONFIG.distribution[QUESTION_TYPES.SINGLE] ||
                    sourceCounts[QUESTION_TYPES.MULTIPLE] < EXAM_CONFIG.distribution[QUESTION_TYPES.MULTIPLE] ||
                    sourceCounts[QUESTION_TYPES.JUDGE] < EXAM_CONFIG.distribution[QUESTION_TYPES.JUDGE]
                ) {
                    throw new Error('题库题型数量不足，无法生成 70 单选 / 20 多选 / 10 判断的模拟试卷。');
                }

                const restored = restoreProgress();
                if (!restored) {
                    startNewExam({ silent: true });
                } else {
                    showToast('已恢复上次模拟考试进度', 'info');
                }

                renderAll();
                syncTimer();
            } catch (error) {
                console.error(error);
                setFatalState(error.message || '模拟考试初始化失败，请稍后重试。');
            }
        }

        function bindEvents() {
            dom.prevBtn.addEventListener('click', function () {
                navigateBy(-1);
            });

            dom.nextBtn.addEventListener('click', function () {
                navigateBy(1);
            });

            dom.questionSubmitBtn.addEventListener('click', function () {
                submitCurrentQuestion();
            });

            dom.finishExamBtn.addEventListener('click', function () {
                finishExam(false);
            });

            dom.restartExamBtn.addEventListener('click', function () {
                restartExam();
            });

            if (dom.clearWrongSetBtn) {
                dom.clearWrongSetBtn.addEventListener('click', function () {
                    clearSharedWrongBook();
                });
            }

            dom.backToPracticeBtn.addEventListener('click', function () {
                window.location.href = 'index.html';
            });

            dom.ruleModeSelect.addEventListener('change', function (event) {
                changeRuleMode(event.target.value);
            });

            dom.judgmentButtons.forEach(function (button) {
                button.addEventListener('click', function () {
                    selectAnswer(button.dataset.value);
                });
            });

            window.addEventListener('beforeunload', function () {
                saveProgress();
            });
        }

        function setFatalState(message) {
            clearTimer();
            dom.emptyState.hidden = false;
            dom.emptyState.textContent = message;
            dom.questionText.textContent = message;
            dom.optionsContainer.innerHTML = '';
            dom.judgmentContainer.hidden = true;
            dom.questionSubmitBtn.disabled = true;
            dom.finishExamBtn.disabled = true;
            dom.prevBtn.disabled = true;
            dom.nextBtn.disabled = true;
            dom.ruleModeSelect.disabled = true;
            dom.restartExamBtn.disabled = true;
        }

        function normalizeMappedSourceId(id) {
            const numericId = Number(id);
            if (!numericId) {
                return null;
            }

            const sourceIdSet = new Set(state.questionBank.map(function (question) {
                return question.id;
            }));

            if (sourceIdSet.has(numericId)) {
                return numericId;
            }

            if (global.EXAM_QUESTION_ID_MAP && global.EXAM_QUESTION_ID_MAP[numericId]) {
                return Number(global.EXAM_QUESTION_ID_MAP[numericId]);
            }

            return numericId;
        }

        function restoreProgress() {
            try {
                const savedValue = localStorage.getItem(STORAGE_KEY);
                if (!savedValue) {
                    dom.ruleModeSelect.value = state.ruleMode;
                    return false;
                }

                const savedProgress = JSON.parse(savedValue);
                if (!savedProgress || !Array.isArray(savedProgress.examQuestionIds) || savedProgress.examQuestionIds.length !== EXAM_CONFIG.total) {
                    return false;
                }

                if (RULE_LABELS[savedProgress.ruleMode]) {
                    state.ruleMode = savedProgress.ruleMode;
                }

                const normalizedExamQuestionIds = savedProgress.examQuestionIds
                    .map(normalizeMappedSourceId)
                    .filter(Boolean);

                if (normalizedExamQuestionIds.length !== EXAM_CONFIG.total) {
                    return false;
                }

                state.examQuestions = buildExamPaperFromIds(state.questionBank, normalizedExamQuestionIds);

                const savedAnswerMap = new Map((savedProgress.answers || []).map(function (answer) {
                    const mappedSourceId = normalizeMappedSourceId(answer.sourceId);
                    return [mappedSourceId, Object.assign({}, answer, { sourceId: mappedSourceId })];
                }));

                state.examQuestions.forEach(function (question) {
                    const savedAnswer = savedAnswerMap.get(question.sourceId);
                    if (!savedAnswer) {
                        return;
                    }

                    question.userAnswer = savedAnswer.userAnswer || null;
                    question.status = savedAnswer.status || (question.userAnswer ? STATUS.ANSWERING : STATUS.UNANSWERED);
                    question.locked = Boolean(savedAnswer.locked);
                    question.isCorrect = typeof savedAnswer.isCorrect === 'boolean'
                        ? savedAnswer.isCorrect
                        : deriveIsCorrectFromStatus(question.status);
                });

                state.currentIndex = clamp(savedProgress.currentIndex, 0, state.examQuestions.length - 1);
                state.isSubmitted = Boolean(savedProgress.isSubmitted);
                state.endTime = state.ruleMode === RULE_MODES.TIMER ? savedProgress.endTime || null : null;

                if (state.ruleMode === RULE_MODES.TIMER && !state.isSubmitted && !state.endTime) {
                    state.endTime = Date.now() + EXAM_CONFIG.timerMinutes * 60 * 1000;
                }

                dom.ruleModeSelect.value = state.ruleMode;
                return true;
            } catch (error) {
                console.error('恢复模拟考试进度失败:', error);
                return false;
            }
        }

        function saveProgress() {
            try {
                const serialized = {
                    ruleMode: state.ruleMode,
                    examQuestionIds: state.examQuestions.map(function (question) {
                        return question.sourceId;
                    }),
                    answers: state.examQuestions.map(function (question) {
                        return {
                            sourceId: question.sourceId,
                            userAnswer: question.userAnswer,
                            status: question.status,
                            locked: question.locked,
                            isCorrect: question.isCorrect
                        };
                    }),
                    currentIndex: state.currentIndex,
                    isSubmitted: state.isSubmitted,
                    endTime: state.endTime,
                    savedAt: Date.now()
                };

                localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
            } catch (error) {
                console.error('保存模拟考试进度失败:', error);
            }
        }

        function syncQuestionsToSharedWrongBook(questionIds) {
            const uniqueIds = Array.from(new Set((questionIds || []).map(function (id) {
                return Number(id);
            }).filter(Boolean)));

            if (uniqueIds.length === 0) {
                return;
            }

            try {
                const fullIds = state.fullQuestionBank.map(function (question) {
                    return question.id;
                });
                const savedValue = localStorage.getItem(SHARED_PROGRESS_KEY);
                const progress = savedValue ? JSON.parse(savedValue) : {};
                const existingQuestions = Array.isArray(progress.questions) ? progress.questions : [];
                const byId = new Map(existingQuestions.map(function (entry) {
                    return [entry.id, Object.assign({}, entry)];
                }));

                fullIds.forEach(function (id) {
                    if (!byId.has(id)) {
                        byId.set(id, {
                            id: id,
                            userAnswer: null,
                            status: STATUS.UNANSWERED,
                            isWrongBook: false
                        });
                    }
                });

                uniqueIds.forEach(function (id) {
                    const current = byId.get(id);
                    if (current) {
                        current.isWrongBook = true;
                    }
                });

                progress.questions = fullIds.map(function (id) {
                    return byId.get(id);
                });

                if (typeof progress.currentIndex !== 'number') {
                    progress.currentIndex = 0;
                }
                if (!progress.filter) {
                    progress.filter = 'all';
                }
                if (!progress.categoryFilter) {
                    progress.categoryFilter = 'all';
                }
                if (!progress.typeFilter) {
                    progress.typeFilter = 'all';
                }
                if (typeof progress.currentPage !== 'number') {
                    progress.currentPage = 1;
                }
                if (!progress.mode) {
                    progress.mode = 'normal';
                }
                if (!Array.isArray(progress.examQuestionIds)) {
                    progress.examQuestionIds = [];
                }
                if (!Array.isArray(progress.examQuestionsProgress)) {
                    progress.examQuestionsProgress = [];
                }
                if (!Array.isArray(progress.reviewQuestionsProgress)) {
                    progress.reviewQuestionsProgress = [];
                }
                progress.lastSaveTime = new Date().toISOString();

                localStorage.setItem(SHARED_PROGRESS_KEY, JSON.stringify(progress));
            } catch (error) {
                console.error('同步错题集失败:', error);
            }
        }

        function clearSharedWrongBook() {
            try {
                const savedValue = localStorage.getItem(SHARED_PROGRESS_KEY);
                if (!savedValue) {
                    showToast('错题集已为空', 'info');
                    return;
                }

                const progress = JSON.parse(savedValue);
                if (!Array.isArray(progress.questions) || progress.questions.length === 0) {
                    showToast('错题集已为空', 'info');
                    return;
                }

                const wrongCount = progress.questions.filter(function (question) {
                    return Boolean(question.isWrongBook);
                }).length;

                if (wrongCount === 0) {
                    showToast('错题集已为空', 'info');
                    return;
                }

                if (!confirm(`确定要清空共享错题集吗？将移除 ${wrongCount} 道题目的错题标记。`)) {
                    return;
                }

                progress.questions = progress.questions.map(function (question) {
                    return Object.assign({}, question, { isWrongBook: false });
                });
                progress.reviewQuestionsProgress = [];
                progress.lastSaveTime = new Date().toISOString();

                localStorage.setItem(SHARED_PROGRESS_KEY, JSON.stringify(progress));
                showToast('共享错题集已清空', 'success');
            } catch (error) {
                console.error('清空错题集失败:', error);
                showToast('清空错题集失败，请稍后重试', 'error');
            }
        }

        function startNewExam(options) {
            const settings = options || {};
            clearTimer();
            state.examQuestions = generateExamPaper(state.questionBank, EXAM_CONFIG);
            state.currentIndex = 0;
            state.isSubmitted = false;
            state.endTime = state.ruleMode === RULE_MODES.TIMER
                ? Date.now() + EXAM_CONFIG.timerMinutes * 60 * 1000
                : null;

            saveProgress();
            renderAll();
            syncTimer();

            if (!settings.silent) {
                showToast('已生成新的模拟试卷', 'success');
            }
        }

        function restartExam() {
            if (state.examQuestions.length > 0) {
                const confirmed = confirm('重新抽卷会丢失当前模拟考试进度，确定继续吗？');
                if (!confirmed) {
                    return;
                }
            }

            startNewExam();
        }

        function changeRuleMode(nextMode) {
            if (!RULE_LABELS[nextMode] || nextMode === state.ruleMode) {
                dom.ruleModeSelect.value = state.ruleMode;
                return;
            }

            if (hasActiveExam()) {
                const confirmed = confirm('切换考试规则会重置当前试卷和作答进度，确定继续吗？');
                if (!confirmed) {
                    dom.ruleModeSelect.value = state.ruleMode;
                    return;
                }
            }

            state.ruleMode = nextMode;
            dom.ruleModeSelect.value = nextMode;
            startNewExam({ silent: true });
            showToast('考试规则已切换，已生成新的试卷', 'info');
        }

        function hasActiveExam() {
            if (state.isSubmitted || state.examQuestions.length === 0) {
                return false;
            }

            return state.currentIndex > 0 || state.examQuestions.some(function (question) {
                return Boolean(question.userAnswer);
            });
        }

        function getCurrentQuestion() {
            return state.examQuestions[state.currentIndex] || null;
        }

        function navigateBy(delta) {
            if (!state.examQuestions.length) {
                return;
            }

            const nextIndex = state.currentIndex + delta;
            if (nextIndex < 0 || nextIndex >= state.examQuestions.length) {
                showToast(delta > 0 ? '已经是最后一题了' : '已经是第一题了', 'info');
                return;
            }

            state.currentIndex = nextIndex;
            saveProgress();
            renderAll();
        }

        function selectAnswer(value) {
            const question = getCurrentQuestion();
            if (!question || isQuestionReadOnly(question)) {
                return;
            }

            if (question.type === QUESTION_TYPES.MULTIPLE) {
                const selected = new Set(question.userAnswer ? question.userAnswer.split('') : []);
                if (selected.has(value)) {
                    selected.delete(value);
                } else {
                    selected.add(value);
                }
                question.userAnswer = Array.from(selected).sort().join('') || null;
            } else {
                question.userAnswer = question.userAnswer === value ? null : value;
            }

            question.status = question.userAnswer ? STATUS.ANSWERING : STATUS.UNANSWERED;
            question.isCorrect = null;

            saveProgress();
            renderAll();
        }

        function isQuestionReadOnly(question) {
            return state.isSubmitted || (state.ruleMode === RULE_MODES.INSTANT && question.locked);
        }

        function submitCurrentQuestion() {
            if (state.ruleMode !== RULE_MODES.INSTANT) {
                return;
            }

            const question = getCurrentQuestion();
            if (!question || state.isSubmitted || question.locked) {
                return;
            }

            if (!question.userAnswer) {
                showToast('请先选择答案后再提交本题', 'warning');
                return;
            }

            const isCorrect = isQuestionCorrect(question);
            question.status = isCorrect ? STATUS.CORRECT : STATUS.INCORRECT;
            question.isCorrect = isCorrect;
            question.locked = true;

            if (!isCorrect) {
                syncQuestionsToSharedWrongBook([question.sourceId]);
            }

            saveProgress();
            renderAll();
            showToast(isCorrect ? '本题回答正确' : '本题回答错误', isCorrect ? 'success' : 'error');
        }

        function finishExam(isAutomatic) {
            if (state.isSubmitted || !state.examQuestions.length) {
                return;
            }

            if (!isAutomatic) {
                const unanswered = getExamStats().remaining;
                const confirmMessage = state.ruleMode === RULE_MODES.INSTANT
                    ? (unanswered > 0
                        ? '仍有未作答题目，结束模拟后将立即锁定全卷并出分，确定继续吗？'
                        : '确定结束本次模拟并查看成绩吗？')
                    : (unanswered > 0
                        ? '仍有未作答题目，交卷后将立即判分，确定现在交卷吗？'
                        : '确定交卷并查看成绩吗？');

                if (!confirm(confirmMessage)) {
                    return;
                }
            }

            state.examQuestions.forEach(function (question) {
                if (!question.userAnswer) {
                    question.status = STATUS.UNANSWERED;
                    question.isCorrect = null;
                    question.locked = true;
                    return;
                }

                const isCorrect = isQuestionCorrect(question);
                question.status = isCorrect ? STATUS.CORRECT : STATUS.INCORRECT;
                question.isCorrect = isCorrect;
                question.locked = true;
            });

            syncQuestionsToSharedWrongBook(state.examQuestions.filter(function (question) {
                return question.isCorrect === false;
            }).map(function (question) {
                return question.sourceId;
            }));

            state.isSubmitted = true;
            clearTimer();
            saveProgress();
            renderAll();
            showToast(isAutomatic ? '考试时间结束，已自动交卷' : '已交卷，正在展示成绩', isAutomatic ? 'warning' : 'success');
        }

        function isQuestionCorrect(question) {
            if (!question.userAnswer) {
                return false;
            }

            if (question.type === QUESTION_TYPES.JUDGE) {
                return question.userAnswer === question.answer;
            }

            return normalizeAnswer(question.userAnswer) === normalizeAnswer(question.answer);
        }

        function deriveIsCorrectFromStatus(status) {
            if (status === STATUS.CORRECT) {
                return true;
            }

            if (status === STATUS.INCORRECT) {
                return false;
            }

            return null;
        }

        function syncTimer() {
            clearTimer();

            if (state.ruleMode !== RULE_MODES.TIMER || state.isSubmitted) {
                renderTimer();
                return;
            }

            if (!state.endTime) {
                state.endTime = Date.now() + EXAM_CONFIG.timerMinutes * 60 * 1000;
            }

            const tick = function () {
                const remaining = state.endTime - Date.now();
                if (remaining <= 0) {
                    renderTimer(0);
                    finishExam(true);
                    return;
                }

                renderTimer(remaining);
            };

            tick();
            state.timerHandle = window.setInterval(tick, 1000);
        }

        function clearTimer() {
            if (state.timerHandle) {
                window.clearInterval(state.timerHandle);
                state.timerHandle = null;
            }
        }

        function renderAll() {
            renderQuestion();
            renderAnswerPanel();
            renderStats();
            renderTypeProgress();
            renderAnswerSheet();
            renderButtons();
            renderRuleSummary();
            renderTimer();
            renderResultBanner();
        }

        function renderQuestion() {
            const question = getCurrentQuestion();
            if (!question) {
                dom.emptyState.hidden = false;
                dom.emptyState.textContent = '当前没有可用的模拟试题。';
                dom.optionsContainer.innerHTML = '';
                dom.judgmentContainer.hidden = true;
                dom.questionText.textContent = '当前没有可用的模拟试题。';
                dom.questionType.textContent = '未加载';
                dom.questionNumber.textContent = '第 0 题 / 共 0 题';
                return;
            }

            dom.emptyState.hidden = true;
            dom.questionType.textContent = getTypeLabel(question.type);
            dom.questionNumber.textContent = '题号 ' + question.sourceId + ' · 模拟卷第 ' + question.examNo + ' 题 / 共 ' + state.examQuestions.length + ' 题';
            dom.questionText.textContent = question.sourceId + '. ' + question.question;

            if (question.type === QUESTION_TYPES.JUDGE) {
                renderJudgeOptions(question);
            } else {
                renderChoiceOptions(question);
            }
        }

        function renderChoiceOptions(question) {
            dom.optionsContainer.innerHTML = '';
            dom.optionsContainer.hidden = false;
            dom.judgmentContainer.hidden = true;

            question.options.forEach(function (option) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'option';
                button.disabled = isQuestionReadOnly(question);

                const selected = question.type === QUESTION_TYPES.MULTIPLE
                    ? Boolean(question.userAnswer && question.userAnswer.indexOf(option.letter) >= 0)
                    : question.userAnswer === option.letter;
                const reveal = shouldRevealAnswer(question);
                const answerContainsOption = question.answer.indexOf(option.letter) >= 0;

                if (selected) {
                    button.classList.add('selected');
                }

                if (reveal) {
                    if (answerContainsOption) {
                        button.classList.add('correct');
                    } else if (selected) {
                        button.classList.add('incorrect');
                    }
                }

                if (button.disabled) {
                    button.classList.add('disabled');
                }

                button.innerHTML = [
                    '<span class="option-letter">', option.letter, '</span>',
                    '<span class="option-text">', escapeHtml(option.text), '</span>'
                ].join('');

                button.addEventListener('click', function () {
                    selectAnswer(option.letter);
                });

                dom.optionsContainer.appendChild(button);
            });
        }

        function renderJudgeOptions(question) {
            dom.optionsContainer.hidden = true;
            dom.optionsContainer.innerHTML = '';
            dom.judgmentContainer.hidden = false;

            dom.judgmentButtons.forEach(function (button) {
                const value = button.dataset.value;
                const reveal = shouldRevealAnswer(question);
                const selected = question.userAnswer === value;
                const isCorrect = question.answer === value;

                button.disabled = isQuestionReadOnly(question);
                button.classList.toggle('selected', selected);
                button.classList.toggle('correct', reveal && isCorrect);
                button.classList.toggle('incorrect', reveal && selected && !isCorrect);
            });
        }

        function renderAnswerPanel() {
            const question = getCurrentQuestion();
            if (!question) {
                return;
            }

            const reveal = shouldRevealAnswer(question);
            const userStatus = getAnswerStatusText(question);

            dom.userAnswerText.textContent = question.userAnswer ? formatAnswer(question.userAnswer, question.type) : '未作答';
            dom.correctAnswerText.textContent = reveal ? formatAnswer(question.answer, question.type) : '交卷后显示';
            dom.answerStatus.textContent = userStatus.text;
            dom.answerStatus.className = 'answer-value status-text ' + userStatus.className;

            if (reveal) {
                dom.answerNote.textContent = state.isSubmitted
                    ? '本卷已交卷，当前页面处于成绩回顾状态。'
                    : '本题已完成判分，可继续作答其它题目。';
                dom.explanationText.textContent = question.explanation || '暂无解析';
                dom.explanationBlock.hidden = false;
            } else {
                dom.answerNote.textContent = state.ruleMode === RULE_MODES.INSTANT
                    ? '当前模式为单题即判，选择答案后点击“提交本题”即可判定对错。'
                    : '当前模式会在交卷后统一显示正确答案和结果。';
                dom.explanationBlock.hidden = true;
            }
        }

        function renderStats() {
            const stats = getExamStats();
            const revealScore = state.isSubmitted || state.ruleMode === RULE_MODES.INSTANT;

            dom.totalQuestions.textContent = stats.total;
            dom.answeredCount.textContent = stats.answered;
            dom.correctCount.textContent = revealScore ? stats.correct : '--';
            dom.incorrectCount.textContent = revealScore ? stats.incorrect : '--';
            dom.remainingCount.textContent = stats.remaining;
            dom.scoreValue.textContent = revealScore ? stats.score : '--';
            dom.progressFill.style.width = stats.progressPercent + '%';
            dom.progressText.textContent = stats.progressPercent + '%';
        }

        function renderTypeProgress() {
            const typeStats = getTypeStats();
            const revealScore = state.isSubmitted || state.ruleMode === RULE_MODES.INSTANT;

            dom.singleProgress.textContent = formatTypeProgress(typeStats[QUESTION_TYPES.SINGLE], revealScore);
            dom.multipleProgress.textContent = formatTypeProgress(typeStats[QUESTION_TYPES.MULTIPLE], revealScore);
            dom.judgeProgress.textContent = formatTypeProgress(typeStats[QUESTION_TYPES.JUDGE], revealScore);
        }

        function renderAnswerSheet() {
            dom.answerSheetGrid.innerHTML = '';

            state.examQuestions.forEach(function (question, index) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'sheet-btn ' + getSheetStatusClass(question);
                if (index === state.currentIndex) {
                    button.classList.add('current');
                }
                button.textContent = String(question.sourceId);
                button.addEventListener('click', function () {
                    state.currentIndex = index;
                    saveProgress();
                    renderAll();
                });
                dom.answerSheetGrid.appendChild(button);
            });

            if (state.ruleMode === RULE_MODES.INSTANT) {
                dom.sheetLegend.textContent = '蓝色表示已选择，绿色正确，红色错误。';
            } else if (state.isSubmitted) {
                dom.sheetLegend.textContent = '交卷后可通过答题卡回顾每题对错，灰色表示未作答。';
            } else {
                dom.sheetLegend.textContent = '蓝色表示已作答，交卷后显示对错。';
            }
        }

        function renderButtons() {
            const question = getCurrentQuestion();
            const hasQuestion = Boolean(question);
            const canSubmitCurrent = hasQuestion && state.ruleMode === RULE_MODES.INSTANT && !state.isSubmitted;

            dom.prevBtn.disabled = !hasQuestion || state.currentIndex === 0;
            dom.nextBtn.disabled = !hasQuestion || state.currentIndex === state.examQuestions.length - 1;

            dom.questionSubmitBtn.hidden = !canSubmitCurrent;
            dom.questionSubmitBtn.disabled = !canSubmitCurrent || question.locked || !question.userAnswer;
            dom.questionSubmitBtn.innerHTML = question && question.locked
                ? '<i class="fas fa-lock"></i> 本题已提交'
                : '<i class="fas fa-check"></i> 提交本题';

            dom.finishExamBtn.disabled = !hasQuestion || state.isSubmitted;
            dom.finishExamBtn.innerHTML = state.isSubmitted
                ? '<i class="fas fa-circle-check"></i> 已交卷'
                : (state.ruleMode === RULE_MODES.INSTANT
                    ? '<i class="fas fa-flag-checkered"></i> 结束本次模拟'
                    : '<i class="fas fa-flag-checkered"></i> 交卷');
        }

        function renderRuleSummary() {
            dom.ruleSummary.textContent = RULE_LABELS[state.ruleMode];
            dom.ruleModeSelect.value = state.ruleMode;

            if (state.ruleMode === RULE_MODES.INSTANT) {
                dom.ruleHint.textContent = '每题选择答案后需要单独点击“提交本题”，题目一旦提交就会锁定并立即显示对错。';
            } else if (state.ruleMode === RULE_MODES.FINAL) {
                dom.ruleHint.textContent = '作答过程中只记录答案，不显示正确答案；点击“交卷”后一次性判分并进入回顾。';
            } else {
                dom.ruleHint.textContent = '规则与统一判分类似，但会启动 120 分钟倒计时，到时自动交卷并立即判分。';
            }
        }

        function renderTimer(remainingOverride) {
            const shouldShowTimer = state.ruleMode === RULE_MODES.TIMER;
            dom.timerPanel.hidden = !shouldShowTimer;

            if (!shouldShowTimer) {
                return;
            }

            if (state.isSubmitted) {
                dom.timerDisplay.textContent = '已交卷';
                return;
            }

            const remaining = typeof remainingOverride === 'number'
                ? remainingOverride
                : Math.max((state.endTime || Date.now()) - Date.now(), 0);

            dom.timerDisplay.textContent = formatDuration(remaining);
        }

        function renderResultBanner() {
            const revealScore = state.isSubmitted || state.ruleMode === RULE_MODES.INSTANT;
            if (!revealScore || !state.examQuestions.length) {
                dom.resultBanner.hidden = true;
                dom.resultBanner.innerHTML = '';
                return;
            }

            const stats = getExamStats();
            const title = state.isSubmitted ? '考试成绩' : '当前得分';
            dom.resultBanner.hidden = false;
            dom.resultBanner.innerHTML = [
                '<div class="result-title">', title, '</div>',
                '<div class="result-main">',
                '<div class="result-score">', stats.score, ' / ', stats.total, '</div>',
                '<div class="result-meta">已作答 ', stats.answered, ' 题，正确 ', stats.correct, ' 题，错误 ', stats.incorrect, ' 题，未作答 ', stats.remaining, ' 题</div>',
                '</div>'
            ].join('');
        }

        function getExamStats() {
            const answered = state.examQuestions.filter(function (question) {
                return Boolean(question.userAnswer);
            }).length;
            const correct = state.examQuestions.filter(function (question) {
                return question.isCorrect === true;
            }).length;
            const incorrect = state.examQuestions.filter(function (question) {
                return question.isCorrect === false;
            }).length;
            const total = state.examQuestions.length;
            const remaining = total - answered;
            const progressPercent = total > 0 ? Math.round((answered / total) * 100) : 0;

            return {
                total: total,
                answered: answered,
                correct: correct,
                incorrect: incorrect,
                remaining: remaining,
                progressPercent: progressPercent,
                score: correct
            };
        }

        function getTypeStats() {
            return state.examQuestions.reduce(function (stats, question) {
                if (!stats[question.type]) {
                    stats[question.type] = {
                        total: 0,
                        answered: 0,
                        correct: 0
                    };
                }

                stats[question.type].total += 1;
                if (question.userAnswer) {
                    stats[question.type].answered += 1;
                }
                if (question.isCorrect === true) {
                    stats[question.type].correct += 1;
                }

                return stats;
            }, {
                [QUESTION_TYPES.SINGLE]: { total: 0, answered: 0, correct: 0 },
                [QUESTION_TYPES.MULTIPLE]: { total: 0, answered: 0, correct: 0 },
                [QUESTION_TYPES.JUDGE]: { total: 0, answered: 0, correct: 0 }
            });
        }

        function formatTypeProgress(stat, revealScore) {
            return '总 ' + stat.total + ' | 已答 ' + stat.answered + ' | 正确 ' + (revealScore ? stat.correct : '--');
        }

        function shouldRevealAnswer(question) {
            return state.isSubmitted || (state.ruleMode === RULE_MODES.INSTANT && question.locked);
        }

        function getSheetStatusClass(question) {
            if (question.status === STATUS.CORRECT) {
                return STATUS.CORRECT;
            }
            if (question.status === STATUS.INCORRECT) {
                return STATUS.INCORRECT;
            }
            if (question.userAnswer) {
                return STATUS.ANSWERING;
            }
            return STATUS.UNANSWERED;
        }

        function getAnswerStatusText(question) {
            if (state.isSubmitted) {
                if (question.status === STATUS.CORRECT) {
                    return { text: '回答正确', className: 'status-correct' };
                }
                if (question.status === STATUS.INCORRECT) {
                    return { text: '回答错误', className: 'status-incorrect' };
                }
                return { text: '未作答', className: 'status-unanswered' };
            }

            if (state.ruleMode === RULE_MODES.INSTANT) {
                if (question.status === STATUS.CORRECT) {
                    return { text: '回答正确', className: 'status-correct' };
                }
                if (question.status === STATUS.INCORRECT) {
                    return { text: '回答错误', className: 'status-incorrect' };
                }
                if (question.userAnswer) {
                    return { text: '已选择，待提交', className: 'status-answering' };
                }
                return { text: '未作答', className: 'status-unanswered' };
            }

            if (question.userAnswer) {
                return { text: '已作答，待交卷', className: 'status-answering' };
            }

            return { text: '未作答', className: 'status-unanswered' };
        }

        function getTypeLabel(type) {
            switch (type) {
                case QUESTION_TYPES.MULTIPLE:
                    return '多选题';
                case QUESTION_TYPES.JUDGE:
                    return '判断题';
                default:
                    return '单选题';
            }
        }

        function formatAnswer(answer, type) {
            if (!answer) {
                return '未作答';
            }

            if (type === QUESTION_TYPES.MULTIPLE) {
                return answer.split('').join('、');
            }

            return answer;
        }

        function formatDuration(milliseconds) {
            const totalSeconds = Math.max(Math.floor(milliseconds / 1000), 0);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            return [hours, minutes, seconds].map(function (value) {
                return String(value).padStart(2, '0');
            }).join(':');
        }

        function clamp(value, min, max) {
            return Math.min(Math.max(value, min), max);
        }

        function showToast(message, type) {
            const toast = document.createElement('div');
            toast.className = 'toast toast-' + (type || 'info');
            toast.textContent = message;
            document.body.appendChild(toast);

            window.setTimeout(function () {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(-8px)';
                window.setTimeout(function () {
                    toast.remove();
                }, 200);
            }, 2400);
        }

        function escapeHtml(text) {
            return String(text)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }
    });
})(typeof window !== 'undefined' ? window : globalThis);
