const fs = require('fs');
const path = require('path');

// 忽略目录
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.cache',
  'dist',
  'build',
  
  'Logs',
 
 


]);

// 忽略文件名
const IGNORE_FILES = new Set([
  '.DS_Store',
  'package-lock.json',
   'N_m3u8DL-RE.exe',
  'git命令'
]);

// 忽略后缀
const IGNORE_EXT = new Set([
  '.log',
  '.tmp'
 
]);

// 忽略路径关键字（最狠的过滤）
const IGNORE_PATH_KEYWORDS = [
  'node_modules',
  '.git'
];

function shouldIgnore(fullPath, name) {
  // 1️⃣ 忽略目录名
  if (IGNORE_DIRS.has(name)) return true;

  // 2️⃣ 忽略文件名
  if (IGNORE_FILES.has(name)) return true;

  // 3️⃣ 忽略后缀
  if (IGNORE_EXT.has(path.extname(name))) return true;

  // 4️⃣ 忽略路径包含关键字
  if (IGNORE_PATH_KEYWORDS.some(keyword => fullPath.includes(keyword))) {
    return true;
  }

  return false;
}

function printTree(dir, prefix = '') {
  let files;

  try {
    files = fs.readdirSync(dir);
  } catch (err) {
    console.log(prefix + '⚠️ 无法访问');
    return;
  }

  files = files.filter(name => {
    const fullPath = path.join(dir, name);
    return !shouldIgnore(fullPath, name);
  });

  files.forEach((file, index) => {
    const fullPath = path.join(dir, file);
    const isLast = index === files.length - 1;

    const connector = isLast ? '└── ' : '├── ';
    console.log(prefix + connector + file);

    try {
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        const newPrefix = prefix + (isLast ? '    ' : '│   ');
        printTree(fullPath, newPrefix);
      }
    } catch (err) {
      console.log(prefix + '    ⚠️ 读取失败');
    }
  });
}

// 执行
printTree(process.cwd());