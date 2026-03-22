// 题库训练系统 - 主逻辑
document.addEventListener('DOMContentLoaded', function() {
    // ==================== 全局状态 ====================
    const state = {
        questions: [],           // 所有题目数组
        currentIndex: 0,         // 当前题目索引（0-based）
        filter: 'all',           // 当前筛选条件（答题状态）
        categoryFilter: 'all',   // 当前知识点分类筛选
        currentPage: 1,          // 答题卡当前页码
        pageSize: 100,           // 每页显示题数（10x10网格）
        isLoading: false         // 加载状态
    };

    // ==================== 常量与配置 ====================
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

    const STORAGE_KEY = 'question_bank_progress';

    // ==================== DOM 元素 ====================
    const dom = {
        // 题目显示
        questionText: document.getElementById('questionText'),
        questionType: document.getElementById('questionType'),
        questionNumber: document.getElementById('questionNumber'),
        optionsContainer: document.getElementById('optionsContainer'),
        judgmentContainer: document.getElementById('judgmentContainer'),
        
        // 答案显示
        userAnswerText: document.getElementById('userAnswerText'),
        correctAnswerText: document.getElementById('correctAnswerText'),
        answerStatus: document.getElementById('answerStatus'),
        explanationText: document.getElementById('explanationText'),
        toggleExplanation: document.getElementById('toggleExplanation'),
        
        // 错题集
        toggleWrongBook: document.getElementById('toggleWrongBook'),
        removeWrongBook: document.getElementById('removeWrongBook'),
        wrongBookHint: document.getElementById('wrongBookHint'),
        
        // 导航按钮
        prevBtn: document.getElementById('prevBtn'),
        nextBtn: document.getElementById('nextBtn'),
        
        // 统计
        totalQuestions: document.getElementById('totalQuestions'),
        answeredCount: document.getElementById('answeredCount'),
        correctCount: document.getElementById('correctCount'),
        incorrectCount: document.getElementById('incorrectCount'),
        wrongBookCount: document.getElementById('wrongBookCount'),
        progressFill: document.getElementById('progressFill'),
        progressText: document.getElementById('progressText'),
        totalCount: document.getElementById('totalCount'),
        
        // 筛选
        filterRadios: document.querySelectorAll('input[name="filter"]'),
        categorySelect: document.getElementById('categorySelect'),
        
        // 题型统计
        singleCount: document.getElementById('singleCount'),
        multipleCount: document.getElementById('multipleCount'),
        judgeCount: document.getElementById('judgeCount'),
        
        // 分类状态统计
        categoryUnansweredCount: document.getElementById('categoryUnansweredCount'),
        categoryCorrectCount: document.getElementById('categoryCorrectCount'),
        categoryIncorrectCount: document.getElementById('categoryIncorrectCount'),
        categoryWrongBookCount: document.getElementById('categoryWrongBookCount'),
        
        // 摘要统计（导航按钮上方）
        summarySingleCount: document.getElementById('summarySingleCount'),
        summaryMultipleCount: document.getElementById('summaryMultipleCount'),
        summaryJudgeCount: document.getElementById('summaryJudgeCount'),
        summaryUnansweredCount: document.getElementById('summaryUnansweredCount'),
        summaryCorrectCount: document.getElementById('summaryCorrectCount'),
        summaryIncorrectCount: document.getElementById('summaryIncorrectCount'),
        summaryWrongBookCount: document.getElementById('summaryWrongBookCount'),
        
        // 答题卡
        answerSheetGrid: document.getElementById('answerSheetGrid'),
        prevPage: document.getElementById('prevPage'),
        nextPage: document.getElementById('nextPage'),
        pageInfo: document.getElementById('pageInfo'),
        
        // 文件操作
        loadFileBtn: document.getElementById('loadFile'),
        fileInput: document.getElementById('fileInput'),
        exportBtn: document.getElementById('exportBtn'),
        importBtn: document.getElementById('importBtn'),
        importFile: document.getElementById('importFile'),
        resetBtn: document.getElementById('resetBtn'),
        
        // 加载遮罩
        loadingOverlay: document.getElementById('loadingOverlay')
    };

    // ==================== 题目解析器 ====================
    function parseTxtContent(txtContent) {
        console.log('开始解析题库文本...');
        const questions = [];
        const lines = txtContent.split('\n');
        let currentQuestion = null;
        let optionLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // 检测题目开始（数字. 开头）
            const questionMatch = line.match(/^(\d+)\.\s+(.+)$/);
            if (questionMatch) {
                // 保存上一个题目
                if (currentQuestion) {
                    finalizeQuestion(currentQuestion, optionLines, questions);
                }
                
                // 开始新题目
                currentQuestion = {
                    id: parseInt(questionMatch[1]),
                    type: QUESTION_TYPES.SINGLE, // 默认为单选题
                    question: questionMatch[2],
                    options: [],
                    answer: '',
                    explanation: '',
                    userAnswer: null,
                    status: STATUS.UNANSWERED,
                    isWrongBook: false
                };
                optionLines = [];
                continue;
            }
            
            // 检测选项行（以A. B. C. D. 开头）
            const optionMatch = line.match(/^\s*([A-D])\.\s+(.+)$/);
            if (optionMatch && currentQuestion) {
                optionLines.push(line);
                continue;
            }
            
            // 检测多选题选项（以A. B. C. D. 开头，可能有多个字母答案）
            // 预留支持
            
            // 检测答案行
            const answerMatch = line.match(/^答案:\s*(.+)$/);
            if (answerMatch && currentQuestion) {
                currentQuestion.answer = answerMatch[1].trim();
                // 根据答案判断题型
                if (currentQuestion.answer === '正确' || currentQuestion.answer === '错误') {
                    currentQuestion.type = QUESTION_TYPES.JUDGE;
                } else if (currentQuestion.answer.length > 1 && /^[A-D]+$/.test(currentQuestion.answer)) {
                    currentQuestion.type = QUESTION_TYPES.MULTIPLE;
                } else {
                    currentQuestion.type = QUESTION_TYPES.SINGLE;
                }
                continue;
            }
            
            // 检测解析行
            const explanationMatch = line.match(/^解析:\s*(.+)$/);
            if (explanationMatch && currentQuestion) {
                currentQuestion.explanation = explanationMatch[1];
                // 解析可能有多行，继续读取直到空行或下一个题目
                let j = i + 1;
                while (j < lines.length && lines[j].trim() && !lines[j].match(/^\d+\./) && !lines[j].match(/^答案:/)) {
                    currentQuestion.explanation += ' ' + lines[j].trim();
                    j++;
                }
                i = j - 1;
                continue;
            }
            
            // 如果没有匹配任何模式，可能是选项的续行或解析的续行
            if (currentQuestion && currentQuestion.explanation && !currentQuestion.answer) {
                // 可能是解析的续行（答案还没找到）
                // 这种情况暂时忽略
            }
        }
        
        // 处理最后一个题目
        if (currentQuestion) {
            finalizeQuestion(currentQuestion, optionLines, questions);
        }
        
        console.log(`解析完成，共 ${questions.length} 道题目`);
        return questions;
    }
    
    function finalizeQuestion(question, optionLines, questions) {
        // 处理选项
        if (optionLines.length > 0) {
            question.options = optionLines.map(line => {
                const match = line.match(/^\s*([A-D])\.\s+(.+)$/);
                return match ? { letter: match[1], text: match[2] } : null;
            }).filter(opt => opt !== null);
        }
        
        // 如果没有选项且不是判断题，可能是格式问题
        if (question.options.length === 0 && question.type !== QUESTION_TYPES.JUDGE) {
            console.warn(`题目 ${question.id} 没有找到选项`);
        }
        
        questions.push(question);
    }

    // ==================== 状态管理 ====================
    function saveProgress() {
        try {
            const progress = {
                questions: state.questions.map(q => ({
                    id: q.id,
                    userAnswer: q.userAnswer,
                    status: q.status,
                    isWrongBook: q.isWrongBook
                })),
                currentIndex: state.currentIndex,
                filter: state.filter,
                categoryFilter: state.categoryFilter,
                currentPage: state.currentPage,
                lastSaveTime: new Date().toISOString()
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
            console.log('进度已保存到本地存储');
        } catch (error) {
            console.error('保存进度失败:', error);
        }
    }
    
    function loadProgress() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return false;
            
            const progress = JSON.parse(saved);
            
            // 将进度应用到题目
            progress.questions.forEach(savedQ => {
                const question = state.questions.find(q => q.id === savedQ.id);
                if (question) {
                    question.userAnswer = savedQ.userAnswer;
                    question.status = savedQ.status;
                    question.isWrongBook = savedQ.isWrongBook || false;
                }
            });
            
            state.currentIndex = progress.currentIndex || 0;
            state.filter = progress.filter || 'all';
            state.categoryFilter = progress.categoryFilter || 'all';
            state.currentPage = progress.currentPage || 1;
            
            // 更新分类选择框的值
            if (dom.categorySelect) {
                dom.categorySelect.value = state.categoryFilter;
            }
            
            console.log('进度已从本地存储加载');
            return true;
        } catch (error) {
            console.error('加载进度失败:', error);
            return false;
        }
    }
    
    function resetProgress() {
        if (confirm('确定要重置所有答题进度吗？此操作不可撤销。')) {
            state.questions.forEach(q => {
                q.userAnswer = null;
                q.status = STATUS.UNANSWERED;
                q.isWrongBook = false;
            });
            state.currentIndex = 0;
            state.filter = 'all';
            state.categoryFilter = 'all';
            state.currentPage = 1;
            
            localStorage.removeItem(STORAGE_KEY);
            renderQuestion();
            updateStats();
            renderAnswerSheet();
            showToast('进度已重置');
        }
    }
    
    function exportProgress() {
        try {
            const progress = {
                questions: state.questions.map(q => ({
                    id: q.id,
                    userAnswer: q.userAnswer,
                    status: q.status,
                    isWrongBook: q.isWrongBook
                })),
                metadata: {
                    exportTime: new Date().toISOString(),
                    totalQuestions: state.questions.length,
                    version: '1.0'
                }
            };
            
            const blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `题库进度_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showToast('进度导出成功');
        } catch (error) {
            console.error('导出进度失败:', error);
            showToast('导出失败，请重试', 'error');
        }
    }
    
    function importProgress(file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const progress = JSON.parse(e.target.result);
                
                // 验证导入数据格式
                if (!progress.questions || !Array.isArray(progress.questions)) {
                    throw new Error('无效的进度文件格式');
                }
                
                // 应用导入的进度
                progress.questions.forEach(savedQ => {
                    const question = state.questions.find(q => q.id === savedQ.id);
                    if (question) {
                        question.userAnswer = savedQ.userAnswer;
                        question.status = savedQ.status || STATUS.UNANSWERED;
                        question.isWrongBook = savedQ.isWrongBook || false;
                    }
                });
                
                saveProgress();
                renderQuestion();
                updateStats();
                renderAnswerSheet();
                showToast('进度导入成功');
            } catch (error) {
                console.error('导入进度失败:', error);
                showToast('导入失败，文件格式不正确', 'error');
            }
        };
        reader.readAsText(file);
    }

    // ==================== 题目渲染 ====================
    function renderQuestion() {
        if (state.questions.length === 0) return;
        
        const question = state.questions[state.currentIndex];
        const filteredQuestions = getFilteredQuestions();
        
        // 计算当前题目在筛选列表中的位置
        let filteredIndex = -1;
        if (filteredQuestions.length > 0) {
            filteredIndex = filteredQuestions.findIndex(q => q.id === question.id);
        }
        
        // 如果当前题目不在筛选列表中，但筛选列表不为空，跳转到第一题
        if (filteredIndex === -1 && filteredQuestions.length > 0) {
            const firstQuestion = filteredQuestions[0];
            state.currentIndex = firstQuestion.id - 1;
            renderQuestion(); // 重新渲染
            return;
        }
        
        // 更新题目信息
        dom.questionText.textContent = `${question.id}. ${question.question}`;
        
        // 显示筛选后的题目计数
        const currentPosition = filteredIndex >= 0 ? filteredIndex + 1 : 0;
        const totalFiltered = filteredQuestions.length;
        dom.questionNumber.textContent = `第 ${currentPosition} 题 / 共 ${totalFiltered} 题`;
        
        // 更新题型显示
        let typeText = '单选题';
        if (question.type === QUESTION_TYPES.JUDGE) typeText = '判断题';
        else if (question.type === QUESTION_TYPES.MULTIPLE) typeText = '多选题';
        dom.questionType.textContent = typeText;
        
        // 渲染选项
        renderOptions(question);
        
        // 更新答案显示
        updateAnswerDisplay(question);
        
        // 更新错题集按钮
        updateWrongBookButtons(question);
        
        // 更新答题卡当前题目高亮
        updateAnswerSheetCurrent();
    }
    
    function renderOptions(question) {
        // 清空容器
        dom.optionsContainer.innerHTML = '';
        dom.judgmentContainer.style.display = 'none';
        
        if (question.type === QUESTION_TYPES.JUDGE) {
            // 判断题
            dom.judgmentContainer.style.display = 'flex';
            
            const correctBtn = dom.judgmentContainer.querySelector('.correct-btn');
            const wrongBtn = dom.judgmentContainer.querySelector('.wrong-btn');
            
            correctBtn.classList.toggle('selected', question.userAnswer === '正确');
            wrongBtn.classList.toggle('selected', question.userAnswer === '错误');
            
            // 移除旧的事件监听器
            const newCorrectBtn = correctBtn.cloneNode(true);
            const newWrongBtn = wrongBtn.cloneNode(true);
            correctBtn.parentNode.replaceChild(newCorrectBtn, correctBtn);
            wrongBtn.parentNode.replaceChild(newWrongBtn, wrongBtn);
            
            // 添加新的事件监听器
            newCorrectBtn.addEventListener('click', () => selectAnswer('正确'));
            newWrongBtn.addEventListener('click', () => selectAnswer('错误'));
            
        } else {
            // 单选题或多选题
            question.options.forEach(option => {
                const optionElement = document.createElement('div');
                optionElement.className = 'option';
                
                // 添加选中状态
                if (question.userAnswer && question.userAnswer.includes(option.letter)) {
                    optionElement.classList.add('selected');
                }
                
                // 如果已经提交，显示正确/错误状态
                if (question.status === STATUS.CORRECT || question.status === STATUS.INCORRECT) {
                    const isCorrect = question.answer.includes(option.letter);
                    const isUserSelected = question.userAnswer && question.userAnswer.includes(option.letter);
                    
                    if (isCorrect && isUserSelected) {
                        optionElement.classList.add('correct');
                    } else if (!isCorrect && isUserSelected) {
                        optionElement.classList.add('incorrect');
                    } else if (isCorrect && !isUserSelected) {
                        optionElement.classList.add('correct');
                        optionElement.style.opacity = '0.7';
                    }
                }
                
                optionElement.innerHTML = `
                    <div class="option-letter">${option.letter}</div>
                    <div class="option-text">${option.text}</div>
                `;
                
                optionElement.addEventListener('click', () => selectAnswer(option.letter));
                dom.optionsContainer.appendChild(optionElement);
            });
        }
    }
    
    function updateAnswerDisplay(question) {
        // 用户答案
        if (question.userAnswer) {
            dom.userAnswerText.textContent = question.userAnswer;
            dom.userAnswerText.style.color = getStatusColor(question.status);
        } else {
            dom.userAnswerText.textContent = '未作答';
            dom.userAnswerText.style.color = '';
        }
        
        // 答案状态
        dom.answerStatus.textContent = getStatusText(question.status);
        dom.answerStatus.className = `status-${question.status}`;
        
        // 正确答案
        dom.correctAnswerText.textContent = question.answer;
        dom.correctAnswerText.style.color = getStatusColor(STATUS.CORRECT);
        
        // 解析
        const explanationContent = dom.explanationText.querySelector('p');
        explanationContent.textContent = question.explanation || '暂无解析';
        
        // 解析显示状态
        const isExplanationVisible = dom.explanationText.style.display !== 'none';
        dom.toggleExplanation.textContent = isExplanationVisible ? '隐藏解析' : '显示解析';
    }
    
    function updateWrongBookButtons(question) {
        if (question.isWrongBook) {
            dom.toggleWrongBook.style.display = 'none';
            dom.removeWrongBook.style.display = 'inline-flex';
            dom.wrongBookHint.textContent = '此题已在错题集中';
            dom.wrongBookHint.style.color = 'var(--warning-color)';
        } else {
            dom.toggleWrongBook.style.display = 'inline-flex';
            dom.removeWrongBook.style.display = 'none';
            dom.wrongBookHint.textContent = '';
        }
    }

    // ==================== 答题逻辑 ====================
    function selectAnswer(answer) {
        const question = state.questions[state.currentIndex];
        
        if (question.status === STATUS.CORRECT || question.status === STATUS.INCORRECT) {
            // 如果已经提交过，允许重新选择
            question.status = STATUS.ANSWERING;
        }
        
        // 更新用户答案
        if (question.type === QUESTION_TYPES.MULTIPLE) {
            // 多选题：切换选择
            if (!question.userAnswer) question.userAnswer = '';
            if (question.userAnswer.includes(answer)) {
                // 取消选择
                question.userAnswer = question.userAnswer.replace(answer, '');
                if (question.userAnswer === '') question.userAnswer = null;
            } else {
                // 添加选择
                question.userAnswer = (question.userAnswer || '') + answer;
                // 按字母顺序排序
                question.userAnswer = question.userAnswer.split('').sort().join('');
            }
        } else {
            // 单选题或判断题
            question.userAnswer = answer;
        }
        
        // 更新状态
        if (question.userAnswer) {
            question.status = STATUS.ANSWERING;
        } else {
            question.status = STATUS.UNANSWERED;
        }
        
        // 重新渲染
        renderOptions(question);
        updateAnswerDisplay(question);
        
        // 更新统计信息
        updateStats();
        
        // 自动保存
        saveProgress();
    }
    
    function submitAnswer() {
        const question = state.questions[state.currentIndex];
        
        if (!question.userAnswer) {
            showToast('请先选择答案', 'warning');
            return;
        }
        
        // 比对答案
        let isCorrect = false;
        if (question.type === QUESTION_TYPES.MULTIPLE) {
            // 多选题：必须完全匹配（顺序无关）
            const userAnswerSorted = question.userAnswer.split('').sort().join('');
            const correctAnswerSorted = question.answer.split('').sort().join('');
            isCorrect = userAnswerSorted === correctAnswerSorted;
        } else {
            // 单选题或判断题
            isCorrect = question.userAnswer === question.answer;
        }
        
        // 更新状态
        question.status = isCorrect ? STATUS.CORRECT : STATUS.INCORRECT;
        
        // 如果答错，自动加入错题集
        if (!isCorrect) {
            question.isWrongBook = true;
        }
        
        // 重新渲染
        renderOptions(question);
        updateAnswerDisplay(question);
        updateWrongBookButtons(question);
        updateStats();
        renderAnswerSheet();
        
        // 保存进度
        saveProgress();
        
        // 显示结果提示
        if (isCorrect) {
            showToast('回答正确！', 'success');
        } else {
            showToast('回答错误，已加入错题集', 'error');
        }
    }
    
    function toggleWrongBook() {
        const question = state.questions[state.currentIndex];
        question.isWrongBook = !question.isWrongBook;
        
        updateWrongBookButtons(question);
        updateStats();
        renderAnswerSheet();
        saveProgress();
        
        if (question.isWrongBook) {
            showToast('已加入错题集');
        } else {
            showToast('已移出错题集');
        }
    }
    
    function navigateToQuestion(index) {
        if (index < 0 || index >= state.questions.length) return;
        
        // 提交当前题目的答案（如果正在答题中）
        const currentQuestion = state.questions[state.currentIndex];
        if (currentQuestion.status === STATUS.ANSWERING) {
            submitAnswer();
        }
        
        state.currentIndex = index;
        renderQuestion();
        updateAnswerSheetCurrent();
        
        // 更新答题卡页码
        const page = Math.floor(index / state.pageSize) + 1;
        if (page !== state.currentPage) {
            state.currentPage = page;
            renderAnswerSheet();
        }
    }
    
    function navigateToPrev() {
        const filteredQuestions = getFilteredQuestions();
        if (filteredQuestions.length === 0) return;
        
        // 找到当前题目在筛选列表中的位置
        const currentQuestion = state.questions[state.currentIndex];
        const currentFilteredIndex = filteredQuestions.findIndex(q => q.id === currentQuestion.id);
        
        if (currentFilteredIndex > 0) {
            // 上一个筛选题目
            const prevQuestion = filteredQuestions[currentFilteredIndex - 1];
            navigateToQuestion(prevQuestion.id - 1); // 题目ID从1开始，索引从0开始
        } else if (currentFilteredIndex === -1 && filteredQuestions.length > 0) {
            // 当前题目不在筛选列表中，跳转到筛选列表的最后一题
            const lastQuestion = filteredQuestions[filteredQuestions.length - 1];
            navigateToQuestion(lastQuestion.id - 1);
        }
    }
    
    function navigateToNext() {
        // 如果当前题目正在答题中，先提交
        const currentQuestion = state.questions[state.currentIndex];
        if (currentQuestion.status === STATUS.ANSWERING) {
            submitAnswer();
        }
        
        const filteredQuestions = getFilteredQuestions();
        if (filteredQuestions.length === 0) return;
        
        // 找到当前题目在筛选列表中的位置
        const currentFilteredIndex = filteredQuestions.findIndex(q => q.id === currentQuestion.id);
        
        if (currentFilteredIndex >= 0 && currentFilteredIndex < filteredQuestions.length - 1) {
            // 下一个筛选题目
            const nextQuestion = filteredQuestions[currentFilteredIndex + 1];
            navigateToQuestion(nextQuestion.id - 1);
        } else if (currentFilteredIndex === -1 && filteredQuestions.length > 0) {
            // 当前题目不在筛选列表中，跳转到筛选列表的第一题
            const firstQuestion = filteredQuestions[0];
            navigateToQuestion(firstQuestion.id - 1);
        } else if (currentFilteredIndex === filteredQuestions.length - 1) {
            showToast('已经是筛选列表的最后一题了', 'info');
        }
    }

    // ==================== 答题卡 ====================
    function renderAnswerSheet() {
        dom.answerSheetGrid.innerHTML = '';
        
        // 计算当前页的题目范围
        const startIndex = (state.currentPage - 1) * state.pageSize;
        const endIndex = Math.min(startIndex + state.pageSize, state.questions.length);
        
        // 根据筛选条件过滤题目
        const filteredQuestions = getFilteredQuestions();
        
        // 生成按钮
        for (let i = startIndex; i < endIndex; i++) {
            if (i >= state.questions.length) break;
            
            const question = state.questions[i];
            const button = document.createElement('button');
            button.className = 'sheet-btn';
            button.textContent = question.id;
            
            // 添加状态类
            if (i === state.currentIndex) {
                button.classList.add('current');
            } else {
                button.classList.add(question.status);
                if (question.isWrongBook) {
                    button.classList.add('wrongbook');
                }
            }
            
            // 如果题目被筛选隐藏，添加特殊样式
            if (!filteredQuestions.includes(question)) {
                button.style.opacity = '0.3';
                button.style.pointerEvents = 'none';
            }
            
            button.addEventListener('click', () => {
                if (!filteredQuestions.includes(question)) {
                    return; // 题目被筛选隐藏，不导航
                }
                navigateToQuestion(i);
            });
            dom.answerSheetGrid.appendChild(button);
        }
        
        // 更新页码信息
        const totalPages = Math.ceil(state.questions.length / state.pageSize);
        dom.pageInfo.textContent = `第 ${state.currentPage} 页 / 共 ${totalPages} 页`;
        
        // 更新翻页按钮状态
        dom.prevPage.disabled = state.currentPage <= 1;
        dom.nextPage.disabled = state.currentPage >= totalPages;
    }
    
    function updateAnswerSheetCurrent() {
        // 更新所有按钮的current类
        const buttons = dom.answerSheetGrid.querySelectorAll('.sheet-btn');
        buttons.forEach((btn, index) => {
            const questionIndex = (state.currentPage - 1) * state.pageSize + index;
            btn.classList.toggle('current', questionIndex === state.currentIndex);
        });
    }
    
    function changePage(delta) {
        const totalPages = Math.ceil(state.questions.length / state.pageSize);
        const newPage = state.currentPage + delta;
        
        if (newPage >= 1 && newPage <= totalPages) {
            state.currentPage = newPage;
            renderAnswerSheet();
        }
    }

    // ==================== 统计与筛选 ====================
    function updateStats() {
        const total = state.questions.length;
        const answered = state.questions.filter(q => q.status !== STATUS.UNANSWERED).length;
        const correct = state.questions.filter(q => q.status === STATUS.CORRECT).length;
        const incorrect = state.questions.filter(q => q.status === STATUS.INCORRECT).length;
        const wrongBook = state.questions.filter(q => q.isWrongBook).length;
        const progressPercent = total > 0 ? Math.round((answered / total) * 100) : 0;
        
        dom.totalQuestions.textContent = total;
        dom.answeredCount.textContent = answered;
        dom.correctCount.textContent = correct;
        dom.incorrectCount.textContent = incorrect;
        dom.wrongBookCount.textContent = wrongBook;
        dom.totalCount.textContent = total;
        
        dom.progressFill.style.width = `${progressPercent}%`;
        dom.progressText.textContent = `${progressPercent}% 完成`;
        
        // 同时更新题型统计和分类状态统计
        updateQuestionTypeStats();
        updateCategoryStats();
    }
    
    function updateQuestionTypeStats() {
        const filteredQuestions = getFilteredQuestions();
        
        // 初始化统计
        const stats = {
            [QUESTION_TYPES.SINGLE]: { total: 0, answered: 0 },
            [QUESTION_TYPES.MULTIPLE]: { total: 0, answered: 0 },
            [QUESTION_TYPES.JUDGE]: { total: 0, answered: 0 }
        };
        
        // 统计筛选后的题目
        filteredQuestions.forEach(q => {
            if (stats[q.type]) {
                stats[q.type].total++;
                if (q.status !== STATUS.UNANSWERED) {
                    stats[q.type].answered++;
                }
            }
        });
        
        // 更新DOM显示
        if (dom.singleCount) {
            const single = stats[QUESTION_TYPES.SINGLE];
            dom.singleCount.textContent = `${single.total}/${single.answered}/${single.total - single.answered}`;
        }
        
        if (dom.multipleCount) {
            const multiple = stats[QUESTION_TYPES.MULTIPLE];
            dom.multipleCount.textContent = `${multiple.total}/${multiple.answered}/${multiple.total - multiple.answered}`;
        }
        
        if (dom.judgeCount) {
            const judge = stats[QUESTION_TYPES.JUDGE];
            dom.judgeCount.textContent = `${judge.total}/${judge.answered}/${judge.total - judge.answered}`;
        }
        
        // 同时更新摘要区域的题型统计
        if (dom.summarySingleCount) {
            const single = stats[QUESTION_TYPES.SINGLE];
            dom.summarySingleCount.textContent = `${single.total}/${single.answered}/${single.total - single.answered}`;
        }
        
        if (dom.summaryMultipleCount) {
            const multiple = stats[QUESTION_TYPES.MULTIPLE];
            dom.summaryMultipleCount.textContent = `${multiple.total}/${multiple.answered}/${multiple.total - multiple.answered}`;
        }
        
        if (dom.summaryJudgeCount) {
            const judge = stats[QUESTION_TYPES.JUDGE];
            dom.summaryJudgeCount.textContent = `${judge.total}/${judge.answered}/${judge.total - judge.answered}`;
        }
    }
    
    function updateCategoryStats() {
        const filteredQuestions = getFilteredQuestions();
        
        // 初始化统计
        const stats = {
            unanswered: 0,
            correct: 0,
            incorrect: 0,
            wrongbook: 0
        };
        
        // 统计筛选后的题目
        filteredQuestions.forEach(q => {
            if (q.status === STATUS.UNANSWERED) {
                stats.unanswered++;
            } else if (q.status === STATUS.CORRECT) {
                stats.correct++;
            } else if (q.status === STATUS.INCORRECT) {
                stats.incorrect++;
            }
            
            if (q.isWrongBook) {
                stats.wrongbook++;
            }
        });
        
        // 更新DOM显示
        if (dom.categoryUnansweredCount) {
            dom.categoryUnansweredCount.textContent = stats.unanswered;
        }
        
        if (dom.categoryCorrectCount) {
            dom.categoryCorrectCount.textContent = stats.correct;
        }
        
        if (dom.categoryIncorrectCount) {
            dom.categoryIncorrectCount.textContent = stats.incorrect;
        }
        
        if (dom.categoryWrongBookCount) {
            dom.categoryWrongBookCount.textContent = stats.wrongbook;
        }
        
        // 同时更新摘要区域的状态统计
        if (dom.summaryUnansweredCount) {
            dom.summaryUnansweredCount.textContent = stats.unanswered;
        }
        
        if (dom.summaryCorrectCount) {
            dom.summaryCorrectCount.textContent = stats.correct;
        }
        
        if (dom.summaryIncorrectCount) {
            dom.summaryIncorrectCount.textContent = stats.incorrect;
        }
        
        if (dom.summaryWrongBookCount) {
            dom.summaryWrongBookCount.textContent = stats.wrongbook;
        }
    }
    
    function getFilteredQuestions() {
        let filtered = state.questions;
        
        // 1. 应用答题状态筛选
        if (state.filter !== 'all') {
            filtered = filtered.filter(q => {
                if (state.filter === 'wrongbook') return q.isWrongBook;
                return q.status === state.filter;
            });
        }
        
        // 2. 应用知识点分类筛选
        if (state.categoryFilter !== 'all' && window.CATEGORY_MAPPING) {
            const categoryQuestionNumbers = window.CATEGORY_MAPPING[state.categoryFilter];
            if (categoryQuestionNumbers && Array.isArray(categoryQuestionNumbers)) {
                // 创建题号集合以提高查找性能
                const numberSet = new Set(categoryQuestionNumbers);
                filtered = filtered.filter(q => numberSet.has(q.id));
            }
        }
        
        return filtered;
    }
    
    function applyFilter(filterValue) {
        state.filter = filterValue;
        state.currentPage = 1; // 回到第一页
        
        // 检查当前题目是否在筛选列表中
        const filteredQuestions = getFilteredQuestions();
        const currentQuestion = state.questions[state.currentIndex];
        if (filteredQuestions.length > 0 && !filteredQuestions.includes(currentQuestion)) {
            // 当前题目被筛选隐藏，跳转到筛选列表的第一题
            const firstQuestion = filteredQuestions[0];
            state.currentIndex = firstQuestion.id - 1;
        }
        
        renderAnswerSheet();
        renderQuestion(); // 更新显示的题目
        updateStats(); // 更新统计信息（包括题型统计）
        saveProgress();
    }
    
    function applyCategoryFilter(categoryValue) {
        state.categoryFilter = categoryValue;
        state.currentPage = 1; // 回到第一页
        
        // 检查当前题目是否在筛选列表中
        const filteredQuestions = getFilteredQuestions();
        const currentQuestion = state.questions[state.currentIndex];
        if (filteredQuestions.length > 0 && !filteredQuestions.includes(currentQuestion)) {
            // 当前题目被筛选隐藏，跳转到筛选列表的第一题
            const firstQuestion = filteredQuestions[0];
            state.currentIndex = firstQuestion.id - 1;
        }
        
        renderAnswerSheet();
        renderQuestion(); // 更新显示的题目
        updateStats(); // 更新统计信息（包括题型统计）
        saveProgress();
    }

    // ==================== 工具函数 ====================
    function getStatusText(status) {
        switch (status) {
            case STATUS.UNANSWERED: return '未作答';
            case STATUS.ANSWERING: return '答题中';
            case STATUS.CORRECT: return '正确';
            case STATUS.INCORRECT: return '错误';
            default: return '未知';
        }
    }
    
    function getStatusColor(status) {
        switch (status) {
            case STATUS.UNANSWERED: return 'var(--gray-color)';
            case STATUS.ANSWERING: return 'var(--primary-color)';
            case STATUS.CORRECT: return 'var(--success-color)';
            case STATUS.INCORRECT: return 'var(--danger-color)';
            default: return '#000';
        }
    }
    
    function showToast(message, type = 'info') {
        // 移除现有的toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) existingToast.remove();
        
        // 创建新的toast
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // 添加样式
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background-color: ${type === 'error' ? 'var(--danger-color)' : 
                              type === 'success' ? 'var(--success-color)' : 
                              type === 'warning' ? 'var(--warning-color)' : 
                              'var(--primary-color)'};
            color: white;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        // 3秒后消失
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    // 添加CSS动画
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        .toast { font-size: 14px; }
    `;
    document.head.appendChild(style);

    // ==================== 文件操作 ====================
    function loadTxtFile(file) {
        showLoading(true);
        
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const questions = parseTxtContent(e.target.result);
                if (questions.length === 0) {
                    throw new Error('未解析到任何题目，请检查文件格式');
                }
                
                // 替换题库
                state.questions = questions;
                
                // 加载之前的进度
                loadProgress();
                
                // 更新UI
                updateStats();
                renderQuestion();
                renderAnswerSheet();
                
                showToast(`成功加载 ${questions.length} 道题目`);
            } catch (error) {
                console.error('解析文件失败:', error);
                showToast(`加载失败: ${error.message}`, 'error');
            } finally {
                showLoading(false);
            }
        };
        
        reader.onerror = function() {
            showLoading(false);
            showToast('读取文件失败，请重试', 'error');
        };
        
        reader.readAsText(file, 'UTF-8');
    }
    
    function loadDefaultQuestions() {
        showLoading(true);
        
        // 使用默认的TXT内容
        try {
            let txtContent = '';
            if (window.FULL_TXT_CONTENT) {
                txtContent = window.FULL_TXT_CONTENT;
                console.log('使用内置题库数据，大小:', txtContent.length);
            } else {
                // 如果没有内置数据，使用一个最小的示例
                console.warn('未找到内置题库数据，使用示例数据');
                txtContent = `1. 若想缩短流程执行时的等待时间与业务处理时间，可采用的原则是（）。
\t A. 并行
\t B. 结果导向
\t C. 面向客户
\t D. 循序渐进
答案: A
解析: 并行原则是指为了缩短流程执行过程中的等待时间和业务处理时间，可以将平行开展的流程进行并行处理

2. ETL 数据整合工具是一种硬件，用于把数据从源系统中提取出来，经过转换后加载到目标系统。
答案: 错误
解析: ETL数据整合工具是用于将数据从源系统提取、转换和加载到目标系统中的软件。`;
            }
            
            const questions = parseTxtContent(txtContent);
            if (questions.length === 0) {
                throw new Error('未解析到任何题目，请检查文件格式');
            }
            
            state.questions = questions;
            loadProgress();
            updateStats();
            renderQuestion();
            renderAnswerSheet();
            
            showToast(`已加载题库，共 ${questions.length} 道题目`);
        } catch (error) {
            console.error('加载题库失败:', error);
            showToast(`加载失败: ${error.message}`, 'error');
            
            // 如果失败，显示错误并允许用户手动加载
            dom.questionText.textContent = '题库加载失败，请点击右上角"加载题库文件"按钮手动加载试题库_1432题.txt文件';
        } finally {
            showLoading(false);
        }
    }
    
    function showLoading(show) {
        state.isLoading = show;
        dom.loadingOverlay.style.display = show ? 'flex' : 'none';
    }

    // ==================== 事件监听器 ====================
    function initEventListeners() {
        // 导航按钮
        dom.prevBtn.addEventListener('click', navigateToPrev);
        dom.nextBtn.addEventListener('click', navigateToNext);
        
        // 提交答案（点击下一题时会自动提交）
        dom.nextBtn.addEventListener('click', () => {
            // 在navigateToNext中已经处理了提交逻辑
        });
        
        // 错题集按钮
        dom.toggleWrongBook.addEventListener('click', toggleWrongBook);
        dom.removeWrongBook.addEventListener('click', toggleWrongBook);
        
        // 解析显示/隐藏
        dom.toggleExplanation.addEventListener('click', () => {
            const isVisible = dom.explanationText.style.display !== 'none';
            dom.explanationText.style.display = isVisible ? 'none' : 'block';
            dom.toggleExplanation.textContent = isVisible ? '显示解析' : '隐藏解析';
        });
        
        // 筛选
        dom.filterRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    applyFilter(e.target.value);
                }
            });
        });
        
        // 知识点分类筛选
        console.log('初始化知识点分类筛选器，dom.categorySelect:', dom.categorySelect);
        if (dom.categorySelect) {
            console.log('找到categorySelect元素，开始初始化选项');
            // 清空现有选项
            dom.categorySelect.innerHTML = '';
            
            // 添加"全部知识点"选项
            const defaultOption = document.createElement('option');
            defaultOption.value = 'all';
            defaultOption.textContent = '全部知识点';
            dom.categorySelect.appendChild(defaultOption);
            
            // 如果CATEGORY_LIST存在，添加分类选项
            console.log('检查CATEGORY_LIST:', window.CATEGORY_LIST, 'CATEGORY_MAPPING:', window.CATEGORY_MAPPING);
            if (window.CATEGORY_LIST && Array.isArray(window.CATEGORY_LIST)) {
                // 跳过第一个"全部知识点"选项（因为我们已经添加了）
                window.CATEGORY_LIST.slice(1).forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.id;
                    option.textContent = category.name;
                    dom.categorySelect.appendChild(option);
                });
            } else if (window.CATEGORY_MAPPING) {
                // 使用CATEGORY_MAPPING生成选项
                Object.keys(window.CATEGORY_MAPPING).sort().forEach(key => {
                    const [main, sub] = key.split('/', 2);
                    const option = document.createElement('option');
                    option.value = key;
                    option.textContent = `${main} - ${sub}`;
                    dom.categorySelect.appendChild(option);
                });
            }
            
            // 添加事件监听器
            dom.categorySelect.addEventListener('change', (e) => {
                applyCategoryFilter(e.target.value);
            });
            
            // 设置初始值
            dom.categorySelect.value = state.categoryFilter;
            console.log('知识点分类筛选器初始化完成，选项数量:', dom.categorySelect.options.length);
        } else {
            console.error('未找到categorySelect元素！请检查HTML中是否有id="categorySelect"的元素');
        }
        
        // 答题卡翻页
        dom.prevPage.addEventListener('click', () => changePage(-1));
        dom.nextPage.addEventListener('click', () => changePage(1));
        
        // 文件操作
        dom.loadFileBtn.addEventListener('click', () => dom.fileInput.click());
        dom.fileInput.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                loadTxtFile(e.target.files[0]);
                e.target.value = ''; // 重置input
            }
        });
        
        dom.exportBtn.addEventListener('click', exportProgress);
        
        dom.importBtn.addEventListener('click', () => dom.importFile.click());
        dom.importFile.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                importProgress(e.target.files[0]);
                e.target.value = '';
            }
        });
        
        dom.resetBtn.addEventListener('click', resetProgress);
        
        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (state.isLoading) return;
            
            switch (e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    navigateToPrev();
                    break;
                case 'ArrowRight':
                case 'Enter':
                    e.preventDefault();
                    navigateToNext();
                    break;
                case '1':
                case '2':
                case '3':
                case '4':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        const index = parseInt(e.key) - 1;
                        if (index < state.questions.length) {
                            navigateToQuestion(index);
                        }
                    }
                    break;
            }
        });
    }

    // ==================== 初始化 ====================
    function init() {
        console.log('题库训练系统初始化...');
        
        // 初始化事件监听器
        initEventListeners();
        
        // 加载默认题库
        loadDefaultQuestions();
        
        console.log('初始化完成');
    }

    // 启动应用
    init();
});