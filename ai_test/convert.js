const fs = require('fs');
const path = require('path');

// 读取TXT文件
const txtPath = path.join(__dirname, '试题库_1432题.txt');
const content = fs.readFileSync(txtPath, 'utf8');

// 转义字符串（处理反斜杠、换行符、引号等）
const escaped = content
  .replace(/\\/g, '\\\\')  // 转义反斜杠
  .replace(/`/g, '\\`')    // 转义反引号
  .replace(/\$/g, '\\$');  // 转义美元符号（用于模板字符串）

// 生成JS文件 - 使用全局变量
const jsContent = `// 题库数据 - 自动生成
window.FULL_TXT_CONTENT = \`${escaped}\`;
`;

// 写入文件
fs.writeFileSync(path.join(__dirname, 'question-data.js'), jsContent, 'utf8');
console.log('已生成 question-data.js，大小:', jsContent.length, '字符');