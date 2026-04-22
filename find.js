import fs from 'fs';
const text = fs.readFileSync('c:/Users/reddy/Desktop/Native SupabaseBackend/testapp/app/accounts/addStaff.tsx', 'utf8');
const lines = text.split('\n');
lines.forEach((line, i) => {
  if (line.includes('toUpperCase')) {
    console.log(`Line ${i + 1}: ${line}`);
  }
});
