const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jztckbupiepiqfrxhszt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6dGNrYnVwaWVwaXFmcnhoc3p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzgyMTYsImV4cCI6MjA4ODcxNDIxNn0.TC6mwwLezkwMmPxkIzRnR7NPyworRVzQ_vXCkRmnz4o'
);

async function checkAdmin() {
  // 1. Check auth users - find user by email
  console.log('=== Checking default2@nexsyrus.com ===\n');

  // 2. Check admins table
  console.log('--- Admins Table ---');
  const { data: admins, error: adminErr } = await supabase
    .from('admins')
    .select('*')
    .eq('email', 'default2@nexsyrus.com');
  
  if (adminErr) console.log('Admin query error:', adminErr.message);
  else {
    console.log('Admins found:', admins.length);
    admins.forEach(a => {
      console.log(`  id=${a.id}, school_id=${a.school_id}, email=${a.email}, role=${a.role}`);
    });
  }

  // 3. Check users table
  console.log('\n--- Users Table ---');
  const { data: users, error: userErr } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'default2@nexsyrus.com');
  
  if (userErr) console.log('Users query error:', userErr.message);
  else {
    console.log('Users found:', users.length);
    users.forEach(u => {
      console.log(`  id=${u.id}, school_id=${u.school_id}, email=${u.email}, role=${u.role}`);
    });
  }

  // 4. Check school_admins or similar join table
  console.log('\n--- School Admins Table ---');
  const { data: schoolAdmins, error: saErr } = await supabase
    .from('school_admins')
    .select('*')
    .eq('email', 'default2@nexsyrus.com');
  
  if (saErr) console.log('School admins query error:', saErr.message);
  else {
    console.log('School admins found:', schoolAdmins.length);
    schoolAdmins.forEach(sa => {
      console.log(`  id=${sa.id}, school_id=${sa.school_id}, email=${sa.email}`);
    });
  }

  // 5. Check what school_id=11 is
  console.log('\n--- School ID 11 ---');
  const { data: school, error: schoolErr } = await supabase
    .from('schools')
    .select('*')
    .eq('id', 11);
  
  if (schoolErr) console.log('School query error:', schoolErr.message);
  else {
    console.log('School found:', school.length);
    school.forEach(s => {
      console.log(`  id=${s.id}, name=${s.name}, code=${s.code || s.school_code}`);
    });
  }

  // 6. Also check all admins for school_id=11
  console.log('\n--- All Admins for school_id=11 ---');
  const { data: schoolAdminsList, error: salErr } = await supabase
    .from('admins')
    .select('*')
    .eq('school_id', 11);
  
  if (salErr) console.log('Query error:', salErr.message);
  else {
    console.log('Admins for school 11:', schoolAdminsList.length);
    schoolAdminsList.forEach(a => {
      console.log(`  id=${a.id}, email=${a.email}, role=${a.role}, school_id=${a.school_id}`);
    });
  }
}

checkAdmin().catch(console.error);
