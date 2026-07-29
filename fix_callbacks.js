const fs = require('fs');
let content = fs.readFileSync('app/staff/dashboard.tsx', 'utf8');

// We need to add useCallback for handlers.
// The easiest way without parsing AST is to replace the inline arrows.
// But since there are variables like `item.route` in the map, we should probably refactor the map.
// Actually, MenuCard can just take `route` and `viewAsParams` and do the push inside, OR we can create a handler.

content = content.replace(
  `onPress={() => router.push({ pathname: '/staff/manage-students', params: viewAsParams } as any)}`,
  `onPress={useCallback(() => router.push({ pathname: '/staff/manage-students', params: viewAsParams } as any), [router, viewAsParams])}`
);

content = content.replace(
  `onPress={() => router.push('/staff/leaves' as any)}`,
  `onPress={useCallback(() => router.push('/staff/leaves' as any), [router])}`
);

content = content.replace(
  `onPress={() => router.push({ pathname: item.route, params: viewAsParams } as any)}`,
  `onPress={useCallback(() => router.push({ pathname: item.route, params: viewAsParams } as any), [router, item.route, viewAsParams])}`
);

fs.writeFileSync('app/staff/dashboard.tsx', content);
