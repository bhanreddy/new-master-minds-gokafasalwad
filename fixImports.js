const fs = require('fs');
const path = require('path');

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.expo' && file !== '.git') {
        walk(path.join(dir, file), fileList);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      fileList.push(path.join(dir, file));
    }
  }
  return fileList;
}

const baseDir = __dirname;
const files = walk(baseDir);

let count = 0;

for (const file of files) {
  if (file.includes('AnimatedInput.tsx') || file.includes('AppTextInput.tsx')) continue;
  
  let content = fs.readFileSync(file, 'utf8');
  
  if (content.includes('AppTextInput') && !content.includes('import AppTextInput')) {
    let importLine = '';
    
    // Determine the import trajectory
    if (file.includes(path.join(baseDir, 'app'))) {
      importLine = "import AppTextInput from '@/src/components/AppTextInput';\n";
    } else {
      const dest = path.join(baseDir, 'src', 'components');
      let relPath = path.relative(path.dirname(file), dest).replace(/\\/g, '/');
      if (!relPath.startsWith('.')) relPath = './' + relPath;
      importLine = `import AppTextInput from '${relPath}/AppTextInput';\n`;
    }
    
    // Insert just below the first open import react line if possible, otherwise at the top
    const regex = /import React([\s\S]*?)from\s+['"]react['"];?/g;
    const match = regex.exec(content);
    if (match) {
        content = content.replace(match[0], match[0] + '\n' + importLine);
    } else {
        content = importLine + content;
    }
    
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed import in', file);
    count++;
  }
}

console.log('Total fixed:', count);
