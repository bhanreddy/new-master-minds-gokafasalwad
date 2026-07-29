const fs = require('fs');
let content = fs.readFileSync('app/staff/dashboard.tsx', 'utf8');

// 1. Remove useCallback from LeaveAlert
content = content.replace(
  `onPress={useCallback(() => router.push('/staff/leaves' as any), [router])}`,
  `onPress={handleLeavesPress}`
);

// 2. Remove useCallback from AttendanceHero
content = content.replace(
  `onPress={useCallback(() => router.push({ pathname: '/staff/manage-students', params: viewAsParams } as any), [router, viewAsParams])}`,
  `onPress={handleManageStudentsPress}`
);

// 3. Add the callbacks to the top level of StaffDashboard
const searchString = `  const firstName = (isViewingAsAdmin ? viewAsName : user?.displayName)?.split(' ')[0] || 'Teacher';`;
const replaceString = `  const handleLeavesPress = useCallback(() => {
    router.push('/staff/leaves' as any);
  }, [router]);

  const handleManageStudentsPress = useCallback(() => {
    router.push({ pathname: '/staff/manage-students', params: viewAsParams } as any);
  }, [router, viewAsParams]);

  const firstName = (isViewingAsAdmin ? viewAsName : user?.displayName)?.split(' ')[0] || 'Teacher';`;

content = content.replace(searchString, replaceString);

fs.writeFileSync('app/staff/dashboard.tsx', content);
