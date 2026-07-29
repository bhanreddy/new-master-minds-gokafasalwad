const fs = require('fs');
let content = fs.readFileSync('app/staff/dashboard.tsx', 'utf8');

// Memoize AttendanceHero onPress
content = content.replace(
  `onPress={() => router.push({ pathname: '/staff/manage-students', params: viewAsParams } as any)}`,
  `onPress={useCallback(() => router.push({ pathname: '/staff/manage-students', params: viewAsParams } as any), [router, viewAsParams])}`
);

// Memoize menuItems array
const searchMenuItems = `  const menuItems = [
    { title: 'Diary', subtitle: 'Daily logs & notes', configKey: 'diary', route: '/staff/diary' },
    { title: 'Timetable', subtitle: 'Class schedule', configKey: 'timetable', route: '/staff/timetable' },
    { title: 'My Attendance', subtitle: 'History & reports', configKey: 'attendance', route: '/staff/attendance' },
    { title: 'Leaves', subtitle: 'Review approvals', configKey: 'leaves', route: '/staff/leaves', badge: data?.pendingLeaves ? \`\${data.pendingLeaves}\` : undefined },
    { title: 'Results', subtitle: 'Enter & view marks', configKey: 'results', route: '/staff/results' },
    { title: 'Complaints', subtitle: 'Student issues', configKey: 'complaints', route: '/staff/complaints' },
    { title: 'LMS', subtitle: 'Upload resources', configKey: 'lms', route: '/staff/lms-upload' },
    ...(payslipsEnabled ? [{ title: 'Payslips', subtitle: 'Salary & docs', configKey: 'payslips', route: '/staff/payslip' }] : []),
  ];`;

const replaceMenuItems = `  const menuItems = useMemo(() => [
    { title: 'Diary', subtitle: 'Daily logs & notes', configKey: 'diary', route: '/staff/diary' },
    { title: 'Timetable', subtitle: 'Class schedule', configKey: 'timetable', route: '/staff/timetable' },
    { title: 'My Attendance', subtitle: 'History & reports', configKey: 'attendance', route: '/staff/attendance' },
    { title: 'Leaves', subtitle: 'Review approvals', configKey: 'leaves', route: '/staff/leaves', badge: data?.pendingLeaves ? \`\${data.pendingLeaves}\` : undefined },
    { title: 'Results', subtitle: 'Enter & view marks', configKey: 'results', route: '/staff/results' },
    { title: 'Complaints', subtitle: 'Student issues', configKey: 'complaints', route: '/staff/complaints' },
    { title: 'LMS', subtitle: 'Upload resources', configKey: 'lms', route: '/staff/lms-upload' },
    ...(payslipsEnabled ? [{ title: 'Payslips', subtitle: 'Salary & docs', configKey: 'payslips', route: '/staff/payslip' }] : []),
  ], [data?.pendingLeaves, payslipsEnabled]);`;

content = content.replace(searchMenuItems, replaceMenuItems);

fs.writeFileSync('app/staff/dashboard.tsx', content);
