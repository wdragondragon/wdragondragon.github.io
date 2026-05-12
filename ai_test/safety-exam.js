(function (global) {
    const QUESTION_TYPES = {
        SINGLE: 'single',
        MULTIPLE: 'multiple',
        JUDGE: 'judge'
    };

    const STATUS = {
        UNANSWERED: 'unanswered',
        ANSWERING: 'answering',
        CORRECT: 'correct',
        INCORRECT: 'incorrect'
    };

    const MODES = {
        PRACTICE: 'practice',
        RANDOM: 'random',
        EXAM: 'exam',
        WRONG: 'wrong'
    };

    const EXAM_STAGES = {
        LIFE: 'life',
        NORMAL: 'normal',
        REVIEW: 'review'
    };

    const TYPE_LABELS = {
        [QUESTION_TYPES.SINGLE]: '单选题',
        [QUESTION_TYPES.MULTIPLE]: '多选题',
        [QUESTION_TYPES.JUDGE]: '判断题'
    };

    const MODE_LABELS = {
        [MODES.PRACTICE]: '顺序练习',
        [MODES.RANDOM]: '随机刷题',
        [MODES.EXAM]: '正式考试',
        [MODES.WRONG]: '错题复习'
    };

    const PAGE_VIEWS = {
        ALL: 'all',
        PRACTICE: 'practice',
        EXAM: 'exam'
    };

    const STATUS_LABELS = {
        [STATUS.UNANSWERED]: '未作答',
        [STATUS.ANSWERING]: '已作答',
        [STATUS.CORRECT]: '正确',
        [STATUS.INCORRECT]: '错误'
    };

    const PRACTICE_STORAGE_KEY = 'safety_exam_practice_progress_v1';
    const EXAM_STORAGE_KEY = 'safety_exam_session_v1';

    const EXAM_CONFIG = {
        durationMinutes: 60,
        maxLifeAttempts: 3,
        lifePassScore: 20,
        normalPassScore: 70,
        totalPassScore: 90,
        scores: {
            [QUESTION_TYPES.SINGLE]: 2,
            [QUESTION_TYPES.MULTIPLE]: 3,
            [QUESTION_TYPES.JUDGE]: 1
        },
        lifeDistribution: {
            [QUESTION_TYPES.SINGLE]: 6,
            [QUESTION_TYPES.MULTIPLE]: 2,
            [QUESTION_TYPES.JUDGE]: 2
        },
        normalDistribution: {
            [QUESTION_TYPES.SINGLE]: 19,
            [QUESTION_TYPES.MULTIPLE]: 8,
            [QUESTION_TYPES.JUDGE]: 18
        }
    };

    function normalizeAnswer(rawAnswer, type) {
        const value = String(rawAnswer || '').trim();
        if (!value) {
            return '';
        }

        if (type === QUESTION_TYPES.JUDGE || value === '正确' || value === '错误') {
            return value;
        }

        const letters = value.toUpperCase().match(/[A-I]/g);
        return letters ? Array.from(new Set(letters)).sort().join('') : value;
    }

    function isAnswerCorrect(question) {
        const userAnswer = normalizeAnswer(question.userAnswer, question.type);
        const answer = normalizeAnswer(question.answer, question.type);
        return Boolean(userAnswer) && userAnswer === answer;
    }

    function getQuestionScore(question) {
        return EXAM_CONFIG.scores[question.type] || 0;
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

    function cloneSourceQuestion(question) {
        return {
            id: question.id,
            seq: question.seq,
            type: question.type,
            sourceSheet: question.sourceSheet,
            sourceNo: question.sourceNo,
            caseNo: question.caseNo,
            caseStem: question.caseStem || '',
            question: question.question,
            options: (question.options || []).map(function (option) {
                return {
                    letter: option.letter,
                    text: option.text
                };
            }),
            answer: question.answer,
            explanation: question.explanation || '',
            difficulty: question.difficulty || '',
            category: question.category || '',
            keywords: question.keywords || '',
            specialty: question.specialty || '',
            isLifeSaving: Boolean(question.isLifeSaving),
            userAnswer: null,
            status: STATUS.UNANSWERED,
            isWrongBook: false
        };
    }

    function cloneExamQuestion(question, stage, examNo) {
        return {
            id: question.id,
            originalId: question.id,
            examNo: examNo,
            stage: stage,
            type: question.type,
            sourceSheet: question.sourceSheet,
            sourceNo: question.sourceNo,
            caseNo: question.caseNo,
            caseStem: question.caseStem || '',
            question: question.question,
            options: (question.options || []).map(function (option) {
                return {
                    letter: option.letter,
                    text: option.text
                };
            }),
            answer: question.answer,
            explanation: question.explanation || '',
            difficulty: question.difficulty || '',
            category: question.category || '',
            keywords: question.keywords || '',
            specialty: question.specialty || '',
            isLifeSaving: Boolean(question.isLifeSaving),
            userAnswer: null,
            status: STATUS.UNANSWERED,
            locked: false,
            isCorrect: null,
            earnedScore: 0
        };
    }

    function pickByDistribution(questions, distribution, lifeSaving) {
        const picked = [];
        Object.keys(distribution).forEach(function (type) {
            const pool = questions.filter(function (question) {
                return question.type === type && question.isLifeSaving === lifeSaving;
            });
            const count = distribution[type];
            if (pool.length < count) {
                throw new Error(TYPE_LABELS[type] + '题量不足，无法生成正式考试。');
            }
            picked.push.apply(picked, shuffle(pool).slice(0, count));
        });
        return shuffle(picked);
    }

    function buildExamPaper(questions) {
        const lifeQuestions = pickByDistribution(questions, EXAM_CONFIG.lifeDistribution, true)
            .map(function (question, index) {
                return cloneExamQuestion(question, EXAM_STAGES.LIFE, index + 1);
            });
        const normalQuestions = pickByDistribution(questions, EXAM_CONFIG.normalDistribution, false)
            .map(function (question, index) {
                return cloneExamQuestion(question, EXAM_STAGES.NORMAL, index + 1);
            });

        return {
            active: true,
            submitted: false,
            stage: EXAM_STAGES.LIFE,
            lifeAttempt: 1,
            lifeScore: null,
            normalScore: null,
            totalScore: null,
            passed: false,
            failReason: '',
            endTime: Date.now() + EXAM_CONFIG.durationMinutes * 60 * 1000,
            currentLifeIndex: 0,
            currentNormalIndex: 0,
            currentReviewIndex: 0,
            lifeHistory: [],
            lifeQuestions: lifeQuestions,
            normalQuestions: normalQuestions
        };
    }

    function scoreQuestions(questions) {
        return questions.reduce(function (total, question) {
            return total + (isAnswerCorrect(question) ? getQuestionScore(question) : 0);
        }, 0);
    }

    function markQuestionResults(questions) {
        questions.forEach(function (question) {
            question.isCorrect = isAnswerCorrect(question);
            question.earnedScore = question.isCorrect ? getQuestionScore(question) : 0;
            question.status = question.isCorrect ? STATUS.CORRECT : STATUS.INCORRECT;
            question.locked = true;
        });
    }

    const SafetyExamUtils = {
        QUESTION_TYPES: QUESTION_TYPES,
        STATUS: STATUS,
        MODES: MODES,
        EXAM_CONFIG: EXAM_CONFIG,
        normalizeAnswer: normalizeAnswer,
        isAnswerCorrect: isAnswerCorrect,
        scoreQuestions: scoreQuestions,
        countByType: countByType,
        buildExamPaper: buildExamPaper
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SafetyExamUtils;
    }

    global.SafetyExamUtils = SafetyExamUtils;

    if (typeof document === 'undefined') {
        return;
    }

    document.addEventListener('DOMContentLoaded', function () {
        const pageView = getPageView();
        const dom = {
            pageTitle: document.getElementById('pageTitle'),
            headerDescription: document.getElementById('headerDescription'),
            modeStrip: document.getElementById('modeStrip'),
            modeButtons: Array.from(document.querySelectorAll('.mode-btn')),
            questionText: document.getElementById('questionText'),
            questionType: document.getElementById('questionType'),
            questionNumber: document.getElementById('questionNumber'),
            stageChip: document.getElementById('stageChip'),
            resultBanner: document.getElementById('resultBanner'),
            caseBlock: document.getElementById('caseBlock'),
            caseText: document.getElementById('caseText'),
            questionTags: document.getElementById('questionTags'),
            optionsContainer: document.getElementById('optionsContainer'),
            judgmentContainer: document.getElementById('judgmentContainer'),
            judgmentButtons: Array.from(document.querySelectorAll('#judgmentContainer .judgment-btn')),
            emptyState: document.getElementById('emptyState'),
            prevBtn: document.getElementById('prevBtn'),
            nextBtn: document.getElementById('nextBtn'),
            questionSubmitBtn: document.getElementById('questionSubmitBtn'),
            stageSubmitBtn: document.getElementById('stageSubmitBtn'),
            wrongBookBtn: document.getElementById('wrongBookBtn'),
            startExamBtn: document.getElementById('startExamBtn'),
            resetPageBtn: document.getElementById('resetPageBtn'),
            backToPracticeBtn: document.getElementById('backToPracticeBtn'),
            timerDisplay: document.getElementById('timerDisplay'),
            ruleHint: document.getElementById('ruleHint'),
            userAnswerText: document.getElementById('userAnswerText'),
            correctAnswerText: document.getElementById('correctAnswerText'),
            answerStatus: document.getElementById('answerStatus'),
            answerNote: document.getElementById('answerNote'),
            explanationBlock: document.getElementById('explanationBlock'),
            explanationText: document.getElementById('explanationText'),
            explanationTag: document.getElementById('explanationTag'),
            scoreValue: document.getElementById('scoreValue'),
            totalQuestions: document.getElementById('totalQuestions'),
            answeredCount: document.getElementById('answeredCount'),
            correctCount: document.getElementById('correctCount'),
            incorrectCount: document.getElementById('incorrectCount'),
            wrongCount: document.getElementById('wrongCount'),
            progressText: document.getElementById('progressText'),
            progressFill: document.getElementById('progressFill'),
            singleProgress: document.getElementById('singleProgress'),
            multipleProgress: document.getElementById('multipleProgress'),
            judgeProgress: document.getElementById('judgeProgress'),
            sheetLegend: document.getElementById('sheetLegend'),
            answerSheetGrid: document.getElementById('answerSheetGrid')
        };

        const sourceData = global.SAFETY_EXAM_DATA || { questions: [] };
        const state = {
            sourceQuestions: (sourceData.questions || []).map(cloneSourceQuestion),
            sourceById: new Map(),
            mode: MODES.PRACTICE,
            modeIndexes: {
                [MODES.PRACTICE]: 0,
                [MODES.RANDOM]: 0,
                [MODES.WRONG]: 0,
                [MODES.EXAM]: 0
            },
            randomOrder: [],
            currentQuestions: [],
            currentIndex: 0,
            exam: null,
            timerId: null
        };

        state.sourceQuestions.forEach(function (question) {
            state.sourceById.set(question.id, question);
        });

        function getPageView() {
            const params = new URLSearchParams(global.location ? global.location.search : '');
            const view = params.get('view') || params.get('mode') || '';
            if (view === PAGE_VIEWS.EXAM) {
                return PAGE_VIEWS.EXAM;
            }
            if (view === PAGE_VIEWS.PRACTICE || view === MODES.RANDOM || view === MODES.WRONG) {
                return PAGE_VIEWS.PRACTICE;
            }
            return PAGE_VIEWS.ALL;
        }

        function applyPageView() {
            if (pageView === PAGE_VIEWS.EXAM) {
                document.title = '安规正式考试';
                dom.pageTitle.innerHTML = '<i class="fas fa-file-signature"></i> 安规正式考试';
                dom.headerDescription.textContent = '按真实规则抽取保命题和非保命题，全流程 60 分钟，交卷后即时发布成绩。';
                dom.modeStrip.hidden = true;
                dom.startExamBtn.hidden = false;
                return;
            }

            if (pageView === PAGE_VIEWS.PRACTICE) {
                document.title = '安规练习';
                dom.pageTitle.innerHTML = '<i class="fas fa-shield-halved"></i> 安规练习';
                dom.headerDescription.textContent = '使用信息网络安规 Excel 题库，支持顺序练习、随机刷题和错题复习。';
                dom.startExamBtn.hidden = true;
                dom.modeButtons.forEach(function (button) {
                    button.hidden = button.dataset.mode === MODES.EXAM;
                });
            }
        }

        function canUseMode(mode) {
            if (pageView === PAGE_VIEWS.EXAM) {
                return mode === MODES.EXAM;
            }
            if (pageView === PAGE_VIEWS.PRACTICE) {
                return mode !== MODES.EXAM;
            }
            return true;
        }

        function hasExam() {
            return Boolean(state.exam && state.exam.active);
        }

        function getExamReviewQuestions() {
            if (!state.exam) {
                return [];
            }
            if (state.exam.normalQuestions.length === 0 || state.exam.failReason === 'life') {
                return state.exam.lifeQuestions;
            }
            return state.exam.lifeQuestions.concat(state.exam.normalQuestions);
        }

        function getExamStageQuestions() {
            if (!state.exam) {
                return [];
            }
            if (state.exam.submitted || state.exam.stage === EXAM_STAGES.REVIEW) {
                return getExamReviewQuestions();
            }
            return state.exam.stage === EXAM_STAGES.LIFE ? state.exam.lifeQuestions : state.exam.normalQuestions;
        }

        function getCurrentQuestion() {
            return state.currentQuestions[state.currentIndex] || null;
        }

        function savePracticeProgress() {
            const payload = {
                mode: state.mode === MODES.EXAM ? MODES.PRACTICE : state.mode,
                modeIndexes: state.modeIndexes,
                randomOrder: state.randomOrder,
                questions: state.sourceQuestions
                    .filter(function (question) {
                        return question.userAnswer || question.status !== STATUS.UNANSWERED || question.isWrongBook;
                    })
                    .map(function (question) {
                        return {
                            id: question.id,
                            userAnswer: question.userAnswer,
                            status: question.status,
                            isWrongBook: question.isWrongBook
                        };
                    })
            };
            localStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(payload));
        }

        function loadPracticeProgress() {
            try {
                const saved = JSON.parse(localStorage.getItem(PRACTICE_STORAGE_KEY) || 'null');
                if (!saved) {
                    return;
                }

                if (saved.mode && saved.mode !== MODES.EXAM) {
                    state.mode = saved.mode;
                }
                if (saved.modeIndexes) {
                    state.modeIndexes = Object.assign(state.modeIndexes, saved.modeIndexes);
                }
                if (Array.isArray(saved.randomOrder)) {
                    state.randomOrder = saved.randomOrder.filter(function (id) {
                        return state.sourceById.has(id);
                    });
                }
                if (Array.isArray(saved.questions)) {
                    saved.questions.forEach(function (progress) {
                        const question = state.sourceById.get(progress.id);
                        if (!question) {
                            return;
                        }
                        question.userAnswer = progress.userAnswer || null;
                        question.status = progress.status || STATUS.UNANSWERED;
                        question.isWrongBook = Boolean(progress.isWrongBook);
                    });
                }
            } catch (error) {
                console.error('加载安规练习进度失败:', error);
            }
        }

        function serializeExamQuestion(question) {
            return {
                id: question.originalId,
                userAnswer: question.userAnswer,
                status: question.status,
                locked: question.locked,
                isCorrect: question.isCorrect,
                earnedScore: question.earnedScore
            };
        }

        function saveExamSession() {
            if (!state.exam) {
                localStorage.removeItem(EXAM_STORAGE_KEY);
                return;
            }

            const payload = {
                active: state.exam.active,
                submitted: state.exam.submitted,
                stage: state.exam.stage,
                lifeAttempt: state.exam.lifeAttempt,
                lifeScore: state.exam.lifeScore,
                normalScore: state.exam.normalScore,
                totalScore: state.exam.totalScore,
                passed: state.exam.passed,
                failReason: state.exam.failReason,
                endTime: state.exam.endTime,
                currentLifeIndex: state.exam.currentLifeIndex,
                currentNormalIndex: state.exam.currentNormalIndex,
                currentReviewIndex: state.exam.currentReviewIndex,
                lifeHistory: state.exam.lifeHistory,
                lifeQuestions: state.exam.lifeQuestions.map(serializeExamQuestion),
                normalQuestions: state.exam.normalQuestions.map(serializeExamQuestion)
            };
            localStorage.setItem(EXAM_STORAGE_KEY, JSON.stringify(payload));
        }

        function restoreExamQuestion(progress, stage, index) {
            const source = state.sourceById.get(progress.id);
            if (!source) {
                return null;
            }

            const question = cloneExamQuestion(source, stage, index + 1);
            question.userAnswer = progress.userAnswer || null;
            question.status = progress.status || STATUS.UNANSWERED;
            question.locked = Boolean(progress.locked);
            question.isCorrect = progress.isCorrect;
            question.earnedScore = progress.earnedScore || 0;
            return question;
        }

        function loadExamSession() {
            try {
                const saved = JSON.parse(localStorage.getItem(EXAM_STORAGE_KEY) || 'null');
                if (!saved || !Array.isArray(saved.lifeQuestions) || !Array.isArray(saved.normalQuestions)) {
                    return;
                }

                const lifeQuestions = saved.lifeQuestions
                    .map(function (question, index) {
                        return restoreExamQuestion(question, EXAM_STAGES.LIFE, index);
                    })
                    .filter(Boolean);
                const normalQuestions = saved.normalQuestions
                    .map(function (question, index) {
                        return restoreExamQuestion(question, EXAM_STAGES.NORMAL, index);
                    })
                    .filter(Boolean);

                if (lifeQuestions.length !== 10 || normalQuestions.length !== 45) {
                    return;
                }

                state.exam = {
                    active: Boolean(saved.active),
                    submitted: Boolean(saved.submitted),
                    stage: saved.stage || EXAM_STAGES.LIFE,
                    lifeAttempt: saved.lifeAttempt || 1,
                    lifeScore: saved.lifeScore,
                    normalScore: saved.normalScore,
                    totalScore: saved.totalScore,
                    passed: Boolean(saved.passed),
                    failReason: saved.failReason || '',
                    endTime: saved.endTime || null,
                    currentLifeIndex: saved.currentLifeIndex || 0,
                    currentNormalIndex: saved.currentNormalIndex || 0,
                    currentReviewIndex: saved.currentReviewIndex || 0,
                    lifeHistory: Array.isArray(saved.lifeHistory) ? saved.lifeHistory : [],
                    lifeQuestions: lifeQuestions,
                    normalQuestions: normalQuestions
                };
            } catch (error) {
                console.error('加载安规考试会话失败:', error);
            }
        }

        function ensureRandomOrder() {
            if (state.randomOrder.length !== state.sourceQuestions.length) {
                state.randomOrder = shuffle(state.sourceQuestions.map(function (question) {
                    return question.id;
                }));
            }
        }

        function syncCurrentQuestions() {
            if (state.mode === MODES.PRACTICE) {
                state.currentQuestions = state.sourceQuestions;
                state.currentIndex = clamp(state.modeIndexes[MODES.PRACTICE], 0, state.currentQuestions.length - 1);
                return;
            }

            if (state.mode === MODES.RANDOM) {
                ensureRandomOrder();
                state.currentQuestions = state.randomOrder
                    .map(function (id) {
                        return state.sourceById.get(id);
                    })
                    .filter(Boolean);
                state.currentIndex = clamp(state.modeIndexes[MODES.RANDOM], 0, state.currentQuestions.length - 1);
                return;
            }

            if (state.mode === MODES.WRONG) {
                state.currentQuestions = state.sourceQuestions.filter(function (question) {
                    return question.isWrongBook;
                });
                state.currentIndex = clamp(state.modeIndexes[MODES.WRONG], 0, state.currentQuestions.length - 1);
                return;
            }

            if (state.mode === MODES.EXAM) {
                state.currentQuestions = getExamStageQuestions();
                if (!state.exam) {
                    state.currentIndex = 0;
                } else if (state.exam.submitted || state.exam.stage === EXAM_STAGES.REVIEW) {
                    state.currentIndex = clamp(state.exam.currentReviewIndex, 0, state.currentQuestions.length - 1);
                } else if (state.exam.stage === EXAM_STAGES.LIFE) {
                    state.currentIndex = clamp(state.exam.currentLifeIndex, 0, state.currentQuestions.length - 1);
                } else {
                    state.currentIndex = clamp(state.exam.currentNormalIndex, 0, state.currentQuestions.length - 1);
                }
            }
        }

        function clamp(value, min, max) {
            if (max < min) {
                return 0;
            }
            return Math.min(Math.max(Number(value) || 0, min), max);
        }

        function saveCurrentIndex() {
            if (state.mode === MODES.EXAM && state.exam) {
                if (state.exam.submitted || state.exam.stage === EXAM_STAGES.REVIEW) {
                    state.exam.currentReviewIndex = state.currentIndex;
                } else if (state.exam.stage === EXAM_STAGES.LIFE) {
                    state.exam.currentLifeIndex = state.currentIndex;
                } else {
                    state.exam.currentNormalIndex = state.currentIndex;
                }
                saveExamSession();
                return;
            }
            state.modeIndexes[state.mode] = state.currentIndex;
            savePracticeProgress();
        }

        function switchMode(mode) {
            if (!MODE_LABELS[mode] || !canUseMode(mode)) {
                return;
            }
            saveCurrentIndex();
            state.mode = mode;
            if (mode === MODES.EXAM && state.exam && state.exam.active) {
                startTimer();
            }
            syncCurrentQuestions();
            render();
            savePracticeProgress();
        }

        function selectAnswer(answer) {
            const question = getCurrentQuestion();
            if (!question || isSelectionLocked(question)) {
                return;
            }

            if (question.type === QUESTION_TYPES.MULTIPLE) {
                const current = question.userAnswer || '';
                if (current.includes(answer)) {
                    question.userAnswer = current.replace(answer, '') || null;
                } else {
                    question.userAnswer = (current + answer).split('').sort().join('');
                }
            } else {
                question.userAnswer = answer;
            }

            question.status = question.userAnswer ? STATUS.ANSWERING : STATUS.UNANSWERED;
            if (state.mode === MODES.EXAM) {
                saveExamSession();
            } else {
                savePracticeProgress();
            }
            renderQuestion();
            renderStats();
            renderAnswerSheet();
        }

        function isSelectionLocked(question) {
            if (state.mode === MODES.EXAM) {
                return !state.exam || state.exam.submitted || question.locked;
            }
            return question.status === STATUS.CORRECT || question.status === STATUS.INCORRECT;
        }

        function submitCurrentQuestion() {
            const question = getCurrentQuestion();
            if (!question) {
                showToast('当前没有可提交的题目', 'warning');
                return;
            }
            if (!question.userAnswer) {
                showToast('请先选择答案', 'warning');
                return;
            }

            if (state.mode === MODES.EXAM) {
                if (!state.exam || state.exam.submitted) {
                    return;
                }
                question.locked = true;
                question.status = STATUS.ANSWERING;
                saveExamSession();
                render();
                showToast('本题答案已提交，阶段结束前不会显示答案', 'info');
                return;
            }

            const correct = isAnswerCorrect(question);
            question.status = correct ? STATUS.CORRECT : STATUS.INCORRECT;
            if (!correct) {
                question.isWrongBook = true;
            }
            savePracticeProgress();
            render();
            showToast(correct ? '回答正确' : '回答错误，已加入错题集', correct ? 'success' : 'error');
        }

        function submitExamStage() {
            if (!state.exam || state.exam.submitted) {
                return;
            }

            if (isTimeExpired()) {
                finishByTimeout();
                return;
            }

            if (state.exam.stage === EXAM_STAGES.LIFE) {
                submitLifeStage();
                return;
            }

            submitNormalStage(false);
        }

        function submitLifeStage() {
            const unanswered = state.exam.lifeQuestions.filter(function (question) {
                return !question.userAnswer;
            }).length;
            const message = unanswered > 0
                ? '保命题还有 ' + unanswered + ' 道未作答，确定提交本次机会吗？'
                : '确定提交保命题第 ' + state.exam.lifeAttempt + ' 次作答吗？';
            if (!confirm(message)) {
                return;
            }

            const score = scoreQuestions(state.exam.lifeQuestions);
            state.exam.lifeHistory.push({
                attempt: state.exam.lifeAttempt,
                score: score,
                submittedAt: new Date().toISOString()
            });
            state.exam.lifeScore = score;

            if (score === EXAM_CONFIG.lifePassScore) {
                markQuestionResults(state.exam.lifeQuestions);
                state.exam.stage = EXAM_STAGES.NORMAL;
                state.exam.currentNormalIndex = 0;
                showToast('保命题满分通过，进入非保命题阶段', 'success');
            } else if (state.exam.lifeAttempt < EXAM_CONFIG.maxLifeAttempts) {
                state.exam.lifeAttempt += 1;
                state.exam.lifeQuestions.forEach(function (question) {
                    question.userAnswer = null;
                    question.status = STATUS.UNANSWERED;
                    question.locked = false;
                    question.isCorrect = null;
                    question.earnedScore = 0;
                });
                state.exam.currentLifeIndex = 0;
                showToast('本次保命题得分 ' + score + ' 分，已重置同卷进入第 ' + state.exam.lifeAttempt + ' 次机会', 'warning');
            } else {
                markQuestionResults(state.exam.lifeQuestions);
                state.exam.submitted = true;
                state.exam.stage = EXAM_STAGES.REVIEW;
                state.exam.failReason = 'life';
                state.exam.totalScore = score;
                state.exam.passed = false;
                addExamMissesToWrongBook(state.exam.lifeQuestions);
                stopTimer();
                showToast('保命题 3 次未满分，本次考试不通过', 'error');
            }

            savePracticeProgress();
            saveExamSession();
            syncCurrentQuestions();
            render();
        }

        function submitNormalStage(isAutomatic) {
            const unanswered = state.exam.normalQuestions.filter(function (question) {
                return !question.userAnswer;
            }).length;
            if (!isAutomatic) {
                const message = unanswered > 0
                    ? '非保命题还有 ' + unanswered + ' 道未作答，确定交卷吗？'
                    : '确定交卷并发布成绩吗？';
                if (!confirm(message)) {
                    return;
                }
            }

            markQuestionResults(state.exam.normalQuestions);
            state.exam.normalScore = scoreQuestions(state.exam.normalQuestions);
            state.exam.totalScore = (state.exam.lifeScore || 0) + state.exam.normalScore;
            state.exam.passed = state.exam.normalScore >= EXAM_CONFIG.normalPassScore &&
                state.exam.totalScore >= EXAM_CONFIG.totalPassScore;
            state.exam.submitted = true;
            state.exam.stage = EXAM_STAGES.REVIEW;
            state.exam.failReason = state.exam.passed ? '' : 'normal';
            state.exam.currentReviewIndex = 0;
            addExamMissesToWrongBook(state.exam.lifeQuestions.concat(state.exam.normalQuestions));
            stopTimer();
            savePracticeProgress();
            saveExamSession();
            syncCurrentQuestions();
            render();
            showToast(state.exam.passed ? '考试通过，成绩已发布' : '考试未通过，成绩已发布', state.exam.passed ? 'success' : 'error');
        }

        function addExamMissesToWrongBook(questions) {
            questions.forEach(function (question) {
                if (!question.userAnswer || !isAnswerCorrect(question)) {
                    const source = state.sourceById.get(question.originalId);
                    if (source) {
                        source.isWrongBook = true;
                    }
                }
            });
        }

        function startNewExam() {
            if (state.exam && state.exam.active && !state.exam.submitted) {
                const confirmed = confirm('当前正式考试尚未结束，重新开始会丢弃本次考试记录。确定继续吗？');
                if (!confirmed) {
                    return;
                }
            }

            try {
                state.exam = buildExamPaper(state.sourceQuestions);
                state.mode = MODES.EXAM;
                state.currentIndex = 0;
                startTimer();
                saveExamSession();
                syncCurrentQuestions();
                render();
                showToast('正式考试已开始，计时 60 分钟', 'info');
            } catch (error) {
                console.error(error);
                showToast(error.message, 'error');
            }
        }

        function startTimer() {
            stopTimer();
            updateTimer();
            state.timerId = setInterval(function () {
                updateTimer();
            }, 1000);
        }

        function stopTimer() {
            if (state.timerId) {
                clearInterval(state.timerId);
                state.timerId = null;
            }
        }

        function isTimeExpired() {
            return Boolean(state.exam && !state.exam.submitted && state.exam.endTime && Date.now() >= state.exam.endTime);
        }

        function updateTimer() {
            if (!state.exam || state.exam.submitted || !state.exam.endTime) {
                dom.timerDisplay.textContent = '60:00';
                return;
            }

            const remaining = Math.max(0, state.exam.endTime - Date.now());
            const totalSeconds = Math.ceil(remaining / 1000);
            const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
            const seconds = String(totalSeconds % 60).padStart(2, '0');
            dom.timerDisplay.textContent = minutes + ':' + seconds;

            if (remaining <= 0) {
                finishByTimeout();
            }
        }

        function finishByTimeout() {
            if (!state.exam || state.exam.submitted) {
                return;
            }

            if (state.exam.stage === EXAM_STAGES.LIFE) {
                markQuestionResults(state.exam.lifeQuestions);
                const score = scoreQuestions(state.exam.lifeQuestions);
                state.exam.lifeScore = score;
                state.exam.totalScore = score;
                state.exam.submitted = true;
                state.exam.stage = EXAM_STAGES.REVIEW;
                state.exam.failReason = 'timeout';
                state.exam.passed = false;
                addExamMissesToWrongBook(state.exam.lifeQuestions);
            } else {
                submitNormalStage(true);
                return;
            }

            stopTimer();
            savePracticeProgress();
            saveExamSession();
            syncCurrentQuestions();
            render();
            showToast('考试时间已到，系统已自动交卷', 'warning');
        }

        function navigate(delta) {
            if (!state.currentQuestions.length) {
                return;
            }
            state.currentIndex = clamp(state.currentIndex + delta, 0, state.currentQuestions.length - 1);
            saveCurrentIndex();
            render();
        }

        function navigateTo(index) {
            state.currentIndex = clamp(index, 0, state.currentQuestions.length - 1);
            saveCurrentIndex();
            render();
        }

        function toggleWrongBook() {
            const question = getCurrentQuestion();
            if (!question) {
                return;
            }
            const sourceId = question.originalId || question.id;
            const source = state.sourceById.get(sourceId);
            if (!source) {
                return;
            }

            source.isWrongBook = !source.isWrongBook;
            if (state.mode !== MODES.EXAM) {
                question.isWrongBook = source.isWrongBook;
            }
            if (state.mode === MODES.WRONG && !source.isWrongBook) {
                syncCurrentQuestions();
            }
            savePracticeProgress();
            render();
        }

        function resetPageProgress() {
            if (!confirm('确定清空安规练习与正式考试进度吗？')) {
                return;
            }
            stopTimer();
            localStorage.removeItem(PRACTICE_STORAGE_KEY);
            localStorage.removeItem(EXAM_STORAGE_KEY);
            state.sourceQuestions.forEach(function (question) {
                question.userAnswer = null;
                question.status = STATUS.UNANSWERED;
                question.isWrongBook = false;
            });
            state.mode = MODES.PRACTICE;
            state.modeIndexes = {
                [MODES.PRACTICE]: 0,
                [MODES.RANDOM]: 0,
                [MODES.WRONG]: 0,
                [MODES.EXAM]: 0
            };
            state.randomOrder = [];
            state.exam = null;
            syncCurrentQuestions();
            render();
            showToast('安规页面进度已重置', 'info');
        }

        function shouldRevealAnswer(question) {
            if (!question) {
                return false;
            }
            if (state.mode === MODES.EXAM) {
                return Boolean(state.exam && state.exam.submitted);
            }
            return question.status === STATUS.CORRECT || question.status === STATUS.INCORRECT;
        }

        function render() {
            updateModeButtons();
            renderQuestion();
            renderStats();
            renderAnswerSheet();
            renderExamControls();
        }

        function updateModeButtons() {
            dom.modeButtons.forEach(function (button) {
                button.classList.toggle('active', button.dataset.mode === state.mode);
            });
        }

        function renderQuestion() {
            const question = getCurrentQuestion();
            const hasQuestion = Boolean(question);

            dom.emptyState.hidden = hasQuestion;
            dom.optionsContainer.innerHTML = '';
            dom.judgmentContainer.hidden = true;
            dom.questionTags.innerHTML = '';

            if (!hasQuestion) {
                dom.questionText.textContent = state.mode === MODES.EXAM
                    ? '点击“开始正式考试”生成本次安规试卷。'
                    : '当前模式下暂无题目。';
                dom.questionType.textContent = '-';
                dom.questionNumber.textContent = '第 0 题 / 共 0 题';
                dom.stageChip.textContent = MODE_LABELS[state.mode];
                dom.caseBlock.hidden = true;
                dom.emptyState.textContent = state.mode === MODES.WRONG
                    ? '错题集为空。练习或考试中的错题会自动进入这里。'
                    : '暂无可显示的题目。';
                renderAnswerDisplay(null);
                return;
            }

            dom.questionType.textContent = TYPE_LABELS[question.type] || '题目';
            dom.questionNumber.textContent = getQuestionNumberText(question);
            dom.stageChip.textContent = getStageText();
            dom.questionText.textContent = question.question;

            if (question.caseStem) {
                dom.caseBlock.hidden = false;
                dom.caseText.textContent = question.caseStem;
            } else {
                dom.caseBlock.hidden = true;
                dom.caseText.textContent = '';
            }

            renderQuestionTags(question);
            renderOptions(question);
            renderAnswerDisplay(question);
        }

        function getQuestionNumberText(question) {
            if (state.mode === MODES.EXAM && state.exam) {
                if (state.exam.submitted) {
                    return '题库第 ' + question.id + ' 题 · 复盘第 ' + (state.currentIndex + 1) + ' 题 / 共 ' + state.currentQuestions.length + ' 题';
                }
                const stageLabel = state.exam.stage === EXAM_STAGES.LIFE ? '保命题' : '非保命题';
                return stageLabel + '第 ' + (state.currentIndex + 1) + ' 题 / 共 ' + state.currentQuestions.length + ' 题';
            }
            return '题库第 ' + question.id + ' 题 · 第 ' + (state.currentIndex + 1) + ' 题 / 共 ' + state.currentQuestions.length + ' 题';
        }

        function getStageText() {
            if (state.mode !== MODES.EXAM || !state.exam) {
                return MODE_LABELS[state.mode];
            }
            if (state.exam.submitted) {
                return state.exam.passed ? '考试通过' : '考试未通过';
            }
            if (state.exam.stage === EXAM_STAGES.LIFE) {
                return '保命题第 ' + state.exam.lifeAttempt + ' 次';
            }
            return '非保命题';
        }

        function renderQuestionTags(question) {
            const tags = [
                question.difficulty,
                question.category,
                question.keywords ? '关键词：' + question.keywords : '',
                question.sourceSheet + ' ' + question.sourceNo
            ].filter(Boolean);
            if (question.isLifeSaving) {
                tags.unshift('保命题');
            }

            tags.forEach(function (tagText) {
                const tag = document.createElement('span');
                tag.className = 'tag' + (tagText === '保命题' ? ' life' : '');
                tag.textContent = tagText;
                dom.questionTags.appendChild(tag);
            });
        }

        function renderOptions(question) {
            const reveal = shouldRevealAnswer(question);
            const locked = isSelectionLocked(question);

            if (question.type === QUESTION_TYPES.JUDGE) {
                dom.judgmentContainer.hidden = false;
                dom.judgmentButtons.forEach(function (button) {
                    const value = button.dataset.value;
                    button.classList.toggle('selected', question.userAnswer === value);
                    button.classList.toggle('correct', reveal && question.answer === value);
                    button.classList.toggle('incorrect', reveal && question.userAnswer === value && question.answer !== value);
                    button.disabled = locked;
                    button.onclick = function () {
                        selectAnswer(value);
                    };
                });
                return;
            }

            question.options.forEach(function (option) {
                const optionElement = document.createElement('button');
                optionElement.type = 'button';
                optionElement.className = 'option';
                const selected = question.userAnswer && question.userAnswer.includes(option.letter);
                const correct = question.answer && question.answer.includes(option.letter);
                optionElement.classList.toggle('selected', Boolean(selected));
                optionElement.classList.toggle('correct', reveal && correct);
                optionElement.classList.toggle('incorrect', reveal && selected && !correct);
                optionElement.classList.toggle('disabled', locked);
                optionElement.disabled = locked;
                optionElement.innerHTML = [
                    '<span class="option-letter">' + escapeHtml(option.letter) + '</span>',
                    '<span class="option-text">' + escapeHtml(option.text) + '</span>'
                ].join('');
                optionElement.addEventListener('click', function () {
                    selectAnswer(option.letter);
                });
                dom.optionsContainer.appendChild(optionElement);
            });
        }

        function renderAnswerDisplay(question) {
            const reveal = shouldRevealAnswer(question);
            const userAnswer = question && question.userAnswer ? question.userAnswer : '未作答';
            dom.userAnswerText.textContent = userAnswer;
            dom.correctAnswerText.textContent = question && reveal ? question.answer : getHiddenAnswerText();
            dom.correctAnswerText.classList.toggle('muted-value', !reveal);

            if (!question) {
                dom.answerStatus.textContent = '未作答';
                dom.answerStatus.className = 'answer-value status-text status-unanswered';
                dom.explanationBlock.hidden = true;
                dom.answerNote.textContent = '暂无题目。';
                dom.wrongBookBtn.disabled = true;
                return;
            }

            dom.answerStatus.textContent = getStatusText(question);
            dom.answerStatus.className = 'answer-value status-text status-' + getStatusClass(question);
            dom.answerNote.textContent = getAnswerNote(question);
            dom.wrongBookBtn.disabled = state.mode === MODES.EXAM && !state.exam.submitted;
            updateWrongBookButton(question);

            if (reveal && question.explanation) {
                dom.explanationBlock.hidden = false;
                dom.explanationText.textContent = question.explanation;
                dom.explanationTag.textContent = question.sourceSheet;
            } else {
                dom.explanationBlock.hidden = true;
                dom.explanationText.textContent = '';
            }
        }

        function getHiddenAnswerText() {
            if (state.mode === MODES.EXAM) {
                return '考试结束后显示';
            }
            return '提交后显示';
        }

        function getStatusText(question) {
            if (state.mode === MODES.EXAM && state.exam && !state.exam.submitted) {
                if (question.locked) {
                    return '已提交';
                }
                return question.userAnswer ? '已作答' : '未作答';
            }
            return STATUS_LABELS[question.status] || '未作答';
        }

        function getStatusClass(question) {
            if (state.mode === MODES.EXAM && state.exam && !state.exam.submitted) {
                return question.userAnswer ? STATUS.ANSWERING : STATUS.UNANSWERED;
            }
            return question.status || STATUS.UNANSWERED;
        }

        function getAnswerNote(question) {
            if (state.mode === MODES.EXAM && state.exam) {
                if (state.exam.submitted) {
                    return '考试已结束，可查看答案、解析与错题。';
                }
                if (state.exam.stage === EXAM_STAGES.LIFE) {
                    return '保命题共有 3 次机会，第 ' + state.exam.lifeAttempt + ' 次作答中；提交阶段前不会显示正确答案。';
                }
                return '非保命题只有 1 次机会，交卷后统一发布成绩和解析。';
            }
            if (question.status === STATUS.CORRECT || question.status === STATUS.INCORRECT) {
                return '本题已提交，可查看答案与解析。';
            }
            return '选择答案后点击“提交答案”判定本题。';
        }

        function updateWrongBookButton(question) {
            const source = state.sourceById.get(question.originalId || question.id);
            const isWrong = Boolean(source && source.isWrongBook);
            dom.wrongBookBtn.innerHTML = isWrong
                ? '<i class="fas fa-bookmark"></i> 移出错题'
                : '<i class="fas fa-bookmark"></i> 加入错题';
        }

        function renderStats() {
            const questions = state.currentQuestions;
            const revealScores = state.mode !== MODES.EXAM || (state.exam && state.exam.submitted);
            const answered = questions.filter(function (question) {
                return Boolean(question.userAnswer);
            }).length;
            const correct = revealScores ? questions.filter(isAnswerCorrect).length : 0;
            const incorrect = revealScores ? questions.filter(function (question) {
                return question.userAnswer && !isAnswerCorrect(question);
            }).length : 0;
            const progress = questions.length ? Math.round((answered / questions.length) * 100) : 0;

            dom.totalQuestions.textContent = questions.length;
            dom.answeredCount.textContent = answered;
            dom.correctCount.textContent = revealScores ? correct : '--';
            dom.incorrectCount.textContent = revealScores ? incorrect : '--';
            dom.wrongCount.textContent = state.sourceQuestions.filter(function (question) {
                return question.isWrongBook;
            }).length;
            dom.progressText.textContent = progress + '%';
            dom.progressFill.style.width = progress + '%';
            dom.scoreValue.textContent = getScoreText();

            renderTypeProgress(questions, revealScores);
            renderResultBanner();
        }

        function getScoreText() {
            if (state.mode === MODES.EXAM && state.exam) {
                if (state.exam.submitted) {
                    return state.exam.totalScore == null ? 0 : state.exam.totalScore;
                }
                if (state.exam.lifeScore != null && state.exam.stage === EXAM_STAGES.NORMAL) {
                    return state.exam.lifeScore;
                }
                return 0;
            }

            return state.currentQuestions.filter(function (question) {
                return question.status === STATUS.CORRECT;
            }).length;
        }

        function renderTypeProgress(questions, revealScores) {
            const targets = {
                [QUESTION_TYPES.SINGLE]: dom.singleProgress,
                [QUESTION_TYPES.MULTIPLE]: dom.multipleProgress,
                [QUESTION_TYPES.JUDGE]: dom.judgeProgress
            };

            Object.keys(targets).forEach(function (type) {
                const typeQuestions = questions.filter(function (question) {
                    return question.type === type;
                });
                const answered = typeQuestions.filter(function (question) {
                    return Boolean(question.userAnswer);
                }).length;
                const correct = revealScores
                    ? typeQuestions.filter(isAnswerCorrect).length
                    : '--';
                targets[type].textContent = '总 ' + typeQuestions.length + ' | 已答 ' + answered + ' | 正确 ' + correct;
            });
        }

        function renderResultBanner() {
            if (!(state.mode === MODES.EXAM && state.exam)) {
                dom.resultBanner.hidden = true;
                dom.resultBanner.innerHTML = '';
                return;
            }

            if (!state.exam.submitted && state.exam.lifeHistory.length === 0 && state.exam.lifeScore == null) {
                dom.resultBanner.hidden = true;
                dom.resultBanner.innerHTML = '';
                return;
            }

            dom.resultBanner.hidden = false;
            if (state.exam.submitted) {
                const title = state.exam.passed ? '考试结果：通过' : '考试结果：未通过';
                const meta = getFinalResultMeta();
                dom.resultBanner.innerHTML = [
                    '<div class="result-title">' + escapeHtml(title) + '</div>',
                    '<div class="result-main">',
                    '<span class="result-score">' + escapeHtml(String(state.exam.totalScore || 0)) + '</span>',
                    '<span class="result-meta">' + escapeHtml(meta) + '</span>',
                    '</div>'
                ].join('');
                return;
            }

            if (state.exam.stage === EXAM_STAGES.NORMAL) {
                dom.resultBanner.innerHTML = [
                    '<div class="result-title">保命题已通过</div>',
                    '<div class="result-main">',
                    '<span class="result-score">' + escapeHtml(String(state.exam.lifeScore || 0)) + '</span>',
                    '<span class="result-meta">进入非保命题阶段，非保命题需达到 70 分，总分需达到 90 分。</span>',
                    '</div>'
                ].join('');
                return;
            }

            const lastAttempt = state.exam.lifeHistory[state.exam.lifeHistory.length - 1];
            if (lastAttempt) {
                dom.resultBanner.innerHTML = [
                    '<div class="result-title">保命题第 ' + escapeHtml(String(lastAttempt.attempt)) + ' 次结果</div>',
                    '<div class="result-main">',
                    '<span class="result-score">' + escapeHtml(String(lastAttempt.score)) + '</span>',
                    '<span class="result-meta">未满 20 分，当前为第 ' + escapeHtml(String(state.exam.lifeAttempt)) + ' 次机会。</span>',
                    '</div>'
                ].join('');
            }
        }

        function getFinalResultMeta() {
            if (state.exam.failReason === 'life') {
                return '保命题未满分，未进入非保命题阶段。';
            }
            if (state.exam.failReason === 'timeout') {
                return '考试时间已到，系统自动交卷。';
            }
            return '保命题 ' + (state.exam.lifeScore || 0) + ' 分，非保命题 ' + (state.exam.normalScore || 0) + ' 分。';
        }

        function renderAnswerSheet() {
            dom.answerSheetGrid.innerHTML = '';
            state.currentQuestions.forEach(function (question, index) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'sheet-btn ' + getSheetStatus(question);
                button.classList.toggle('current', index === state.currentIndex);
                button.textContent = String(index + 1);
                button.title = '第 ' + (index + 1) + ' 题';
                button.addEventListener('click', function () {
                    navigateTo(index);
                });
                dom.answerSheetGrid.appendChild(button);
            });
            dom.sheetLegend.textContent = state.mode === MODES.EXAM && state.exam && !state.exam.submitted
                ? '蓝色表示已作答，交卷后显示对错。'
                : '绿色正确，红色错误，蓝色为当前题。';
        }

        function getSheetStatus(question) {
            if (state.mode === MODES.EXAM && state.exam && !state.exam.submitted) {
                return question.userAnswer ? STATUS.ANSWERING : STATUS.UNANSWERED;
            }
            if (question.status === STATUS.CORRECT || question.status === STATUS.INCORRECT) {
                return question.status;
            }
            return question.userAnswer ? STATUS.ANSWERING : STATUS.UNANSWERED;
        }

        function renderExamControls() {
            const isExam = state.mode === MODES.EXAM;
            const hasActiveExam = isExam && state.exam && state.exam.active;
            dom.stageSubmitBtn.hidden = !hasActiveExam || state.exam.submitted;
            dom.questionSubmitBtn.textContent = isExam ? '提交本题' : '提交答案';
            dom.questionSubmitBtn.innerHTML = isExam
                ? '<i class="fas fa-check"></i> 提交本题'
                : '<i class="fas fa-check"></i> 提交答案';
            dom.stageSubmitBtn.innerHTML = getStageSubmitHtml();
            dom.startExamBtn.innerHTML = hasActiveExam && !state.exam.submitted
                ? '<i class="fas fa-rotate-right"></i> 重新开始考试'
                : '<i class="fas fa-play"></i> 开始正式考试';

            if (hasActiveExam && !state.exam.submitted) {
                dom.ruleHint.textContent = state.exam.stage === EXAM_STAGES.LIFE
                    ? '保命题第 ' + state.exam.lifeAttempt + ' 次作答中，必须满 20 分才能进入非保命题。'
                    : '非保命题作答中，交卷后发布成绩并同步错题。';
            } else {
                dom.ruleHint.textContent = '正式考试全流程 60 分钟，保命题通过后进入非保命题，总分达到 90 分为通过。';
            }

            dom.prevBtn.disabled = !state.currentQuestions.length || state.currentIndex === 0;
            dom.nextBtn.disabled = !state.currentQuestions.length || state.currentIndex >= state.currentQuestions.length - 1;
            dom.questionSubmitBtn.disabled = !state.currentQuestions.length || (state.mode === MODES.EXAM && (!state.exam || state.exam.submitted));
        }

        function getStageSubmitHtml() {
            if (!(state.mode === MODES.EXAM && state.exam)) {
                return '<i class="fas fa-flag-checkered"></i> 提交阶段';
            }
            if (state.exam.stage === EXAM_STAGES.LIFE) {
                return '<i class="fas fa-shield-halved"></i> 提交保命题';
            }
            return '<i class="fas fa-flag-checkered"></i> 交卷';
        }

        function showToast(message, type) {
            const toast = document.createElement('div');
            toast.className = 'toast toast-' + (type || 'info');
            toast.textContent = message;
            document.body.appendChild(toast);
            setTimeout(function () {
                toast.remove();
            }, 2600);
        }

        function escapeHtml(value) {
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function initEventListeners() {
            dom.modeButtons.forEach(function (button) {
                button.addEventListener('click', function () {
                    switchMode(button.dataset.mode);
                });
            });
            dom.prevBtn.addEventListener('click', function () {
                navigate(-1);
            });
            dom.nextBtn.addEventListener('click', function () {
                navigate(1);
            });
            dom.questionSubmitBtn.addEventListener('click', submitCurrentQuestion);
            dom.stageSubmitBtn.addEventListener('click', submitExamStage);
            dom.wrongBookBtn.addEventListener('click', toggleWrongBook);
            dom.startExamBtn.addEventListener('click', startNewExam);
            dom.resetPageBtn.addEventListener('click', resetPageProgress);
            dom.backToPracticeBtn.addEventListener('click', function () {
                window.location.href = 'portal.html';
            });

            document.addEventListener('keydown', function (event) {
                const targetTag = event.target && event.target.tagName;
                const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(targetTag) || (event.target && event.target.isContentEditable);
                if (isTyping) {
                    return;
                }
                if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    navigate(-1);
                } else if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    navigate(1);
                } else if (/^[A-Ia-i]$/.test(event.key)) {
                    const question = getCurrentQuestion();
                    if (!question || question.type === QUESTION_TYPES.JUDGE) {
                        return;
                    }
                    const option = question.options.find(function (item) {
                        return item.letter === event.key.toUpperCase();
                    });
                    if (option) {
                        selectAnswer(option.letter);
                    }
                }
            });
        }

        function init() {
            applyPageView();
            loadPracticeProgress();
            loadExamSession();
            if (pageView === PAGE_VIEWS.EXAM) {
                state.mode = MODES.EXAM;
            } else if (pageView === PAGE_VIEWS.PRACTICE && state.mode === MODES.EXAM) {
                state.mode = MODES.PRACTICE;
            } else if (state.exam && state.exam.active && !state.exam.submitted) {
                state.mode = MODES.EXAM;
            }
            initEventListeners();
            syncCurrentQuestions();
            if (state.exam && state.exam.active && !state.exam.submitted) {
                startTimer();
            }
            render();
        }

        init();
    });
})(typeof window !== 'undefined' ? window : globalThis);
