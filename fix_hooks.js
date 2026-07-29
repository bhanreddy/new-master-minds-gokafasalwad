const fs = require('fs');
let content = fs.readFileSync('app/staff/dashboard.tsx', 'utf8');

// Revert the bad useCallback in map
content = content.replace(
  `onPress={useCallback(() => router.push({ pathname: item.route, params: viewAsParams } as any), [router, item.route, viewAsParams])}`,
  `onPress={() => handleMenuPress(item.route)}`
);

// Add handleMenuPress in StaffDashboard
if (!content.includes('const handleMenuPress = useCallback')) {
  content = content.replace(
    'const menuItems = [',
    'const handleMenuPress = useCallback((route: string) => {\n    router.push({ pathname: route, params: viewAsParams } as any);\n  }, [router, viewAsParams]);\n\n  const menuItems = ['
  );
}

// Update MenuCard to accept route? Wait, if we do `() => handleMenuPress(item.route)`, we still create a new function every render!
// The correct way is to make MenuCard accept `route` and pass it back to onPress(route), or just handle routing inside MenuCard.
// Let's modify MenuCard to handle routing if we want, but actually `router.push` is already available.
