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
  // skip AnimatedInput and AppTextInput
  if (file.includes('AnimatedInput.tsx') || file.includes('AppTextInput.tsx')) continue;
  
  let content = fs.readFileSync(file, 'utf8');
  
  if (content.includes('<TextInput')) {
    let newContent = content.replace(/<TextInput/g, '<AppTextInput');
    newContent = newContent.replace(/<\/TextInput>/g, '</AppTextInput>');
    
    // Remove TextInput from react-native import
    newContent = newContent.replace(/(import\s+\{[\s\S]*?)TextInput([\s\S]*?\}\s+from\s+['"]react-native['"];?)/g, (match, p1, p2) => {
      let replacement = p1 + p2;
      replacement = replacement.replace(/,\s*,/g, ',');
      replacement = replacement.replace(/\{\s*,/g, '{');
      replacement = replacement.replace(/,\s*\}/g, '}');
      // Fix empty import {}
      replacement = replacement.replace(/import\s+\{\s*\}\s+from\s+['"]react-native['"];?\n?/, '');
      return replacement;
    });

    if (!newContent.includes('AppTextInput')) {
      // Find import path
      let importLine = '';
      if (file.includes(path.join(baseDir, 'app'))) {
        importLine = "import AppTextInput from '@/src/components/AppTextInput';\n";
      } else {
        const dest = path.join(baseDir, 'src', 'components');
        let relPath = path.relative(path.dirname(file), dest).replace(/\\/g, '/');
        if (!relPath.startsWith('.')) relPath = './' + relPath;
        importLine = `import AppTextInput from '${relPath}/AppTextInput';\n`;
      }
      
      const importMatches = [...newContent.matchAll(/^import.*$/gm)];
      if (importMatches.length > 0) {
          const lastMatch = importMatches[importMatches.length - 1];
          const insertIdx = lastMatch.index + lastMatch[0].length;
          newContent = newContent.slice(0, insertIdx) + '\n' + importLine + newContent.slice(insertIdx);
      } else {
          newContent = importLine + newContent;
      }
    }
    
    fs.writeFileSync(file, newContent, 'utf8');
    console.log('Updated', file);
    count++;
  }
}

console.log('Total files updated:', count);
