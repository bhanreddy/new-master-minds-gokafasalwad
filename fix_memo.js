const fs = require('fs');
let content = fs.readFileSync('app/staff/dashboard.tsx', 'utf8');

const components = [
  'ClayGraphic',
  'AttendanceArc',
  'StatCard',
  'AttendanceHero',
  'HeroBanner',
  'SectionLabel',
  'CardPattern',
  'MenuCard'
];

components.forEach(comp => {
  // Find "const CompName = React.memo(function CompName("
  const startRegex = new RegExp(`const ${comp} = React\\.memo\\(function ${comp}\\([\\s\\S]*?\\{`);
  const match = content.match(startRegex);
  if (match) {
    let startIndex = match.index + match[0].length;
    let openBraces = 1;
    let i = startIndex;
    while (i < content.length && openBraces > 0) {
      if (content[i] === '{') openBraces++;
      if (content[i] === '}') openBraces--;
      i++;
    }
    if (openBraces === 0) {
      // The last brace is at i - 1
      if (content.substring(i - 1, i + 2) !== '});') {
        content = content.substring(0, i) + ');' + content.substring(i);
      }
    }
  }
});

fs.writeFileSync('app/staff/dashboard.tsx', content);
