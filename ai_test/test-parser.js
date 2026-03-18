// 测试解析器
const fs = require('fs');
const path = require('path');

// 复制parseTxtContent函数（从script.js中提取）
function parseTxtContent(txtContent) {
    const QUESTIONS = [];
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
                finalizeQuestion(currentQuestion, optionLines, QUESTIONS);
            }
            
            // 开始新题目
            currentQuestion = {
                id: parseInt(questionMatch[1]),
                type: 'single', // 默认为单选题
                question: questionMatch[2],
                options: [],
                answer: '',
                explanation: '',
                userAnswer: null,
                status: 'unanswered',
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
        
        // 检测答案行
        const answerMatch = line.match(/^答案:\s*(.+)$/);
        if (answerMatch && currentQuestion) {
            currentQuestion.answer = answerMatch[1].trim();
            // 根据答案判断题型
            if (currentQuestion.answer === '正确' || currentQuestion.answer === '错误') {
                currentQuestion.type = 'judge';
            } else if (currentQuestion.answer.length > 1 && /^[A-D]+$/.test(currentQuestion.answer)) {
                currentQuestion.type = 'multiple';
            } else {
                currentQuestion.type = 'single';
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
    }
    
    // 处理最后一个题目
    if (currentQuestion) {
        finalizeQuestion(currentQuestion, optionLines, QUESTIONS);
    }
    
    return QUESTIONS;
}

function finalizeQuestion(question, optionLines, questions) {
    // 处理选项
    if (optionLines.length > 0) {
        question.options = optionLines.map(line => {
            const match = line.match(/^\s*([A-D])\.\s+(.+)$/);
            return match ? { letter: match[1], text: match[2] } : null;
        }).filter(opt => opt !== null);
    }
    
    questions.push(question);
}

// 读取TXT文件
const txtPath = path.join(__dirname, '试题库_1432题.txt');
const content = fs.readFileSync(txtPath, 'utf8');

console.log('开始解析题库文件...');
console.log('文件大小:', content.length, '字符');
console.log('行数:', content.split('\n').length);

const questions = parseTxtContent(content);
console.log('解析完成，题目数量:', questions.length);

// 检查题型分布
const typeCount = {};
const answerLengths = {};
questions.forEach(q => {
    typeCount[q.type] = (typeCount[q.type] || 0) + 1;
    const len = q.answer.length;
    answerLengths[len] = (answerLengths[len] || 0) + 1;
});

console.log('题型分布:', typeCount);
console.log('答案长度分布:', answerLengths);

// 显示前5题
console.log('\n前5题示例:');
questions.slice(0, 5).forEach((q, idx) => {
    console.log(`${idx + 1}. ID: ${q.id}, 题型: ${q.type}, 答案: ${q.answer}, 选项数: ${q.options.length}`);
    if (q.explanation) {
        console.log(`   解析: ${q.explanation.substring(0, 50)}...`);
    }
});

// 检查是否有解析失败的题目
const noAnswer = questions.filter(q => !q.answer);
console.log('\n没有答案的题目:', noAnswer.length);
if (noAnswer.length > 0) {
    console.log('IDs:', noAnswer.map(q => q.id));
}

// 检查判断题
const judgeQuestions = questions.filter(q => q.type === 'judge');
console.log('\n判断题数量:', judgeQuestions.length);
if (judgeQuestions.length > 0) {
    console.log('第一道判断题:', judgeQuestions[0].id, '-', judgeQuestions[0].question.substring(0, 50));
}

console.log('\n测试完成！');