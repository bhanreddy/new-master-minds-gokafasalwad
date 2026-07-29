const fs = require('fs');
let content = fs.readFileSync('app/staff/dashboard.tsx', 'utf8');

// Replace the bad useCallback in map
content = content.replace(
  `onPress={useCallback(() => router.push({ pathname: item.route, params: viewAsParams } as any), [router, item.route, viewAsParams])}`,
  `onPress={() => router.push({ pathname: item.route, params: viewAsParams } as any)}`
);

fs.writeFileSync('app/staff/dashboard.tsx', content);
