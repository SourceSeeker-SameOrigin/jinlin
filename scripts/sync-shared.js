const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', 'cloudfunctions');
const source = path.join(root, '_shared');
let count = 0;

for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
  const functionDir = path.join(root, entry.name);
  if (!fs.existsSync(path.join(functionDir, 'package.json'))) continue;
  const lib = path.join(functionDir, 'lib');
  const target = path.join(lib, 'shared');
  for (const directory of [lib, target]) {
    if (fs.existsSync(directory) && fs.lstatSync(directory).isSymbolicLink()) {
      throw new Error('拒绝向符号链接同步共享代码：' + directory);
    }
  }
  // 仅清理由此脚本生成的副本，确保已删除的源文件不会残留。
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(source, target, {
    recursive: true,
    filter: (file) => !path.relative(source, file).split(path.sep).includes('__tests__')
  });
  count += 1;
}

console.log('共享代码已同步到 ' + count + ' 个云函数');
