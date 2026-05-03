const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://jztckbupiepiqfrxhszt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6dGNrYnVwaWVwaXFmcnhoc3p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzgyMTYsImV4cCI6MjA4ODcxNDIxNn0.TC6mwwLezkwMmPxkIzRnR7NPyworRVzQ_vXCkRmnz4o'
);

async function checkSchema() {
  // List all schools
  console.log('=== All Schools ===');
  const { data: schools, error: schoolErr } = await supabase
    .from('schools')
    .select('*');
  
  if (schoolErr) console.log('Schools error:', schoolErr.message);
  else {
    console.log('Total schools:', schools.length);
    schools.forEach(s => {
      console.log(`  id=${s.id}, name=${s.name}`, JSON.stringify(s).substring(0, 200));
    });
  }

  // Check users table structure
  console.log('\n=== Users Table (first 5) ===');
  const { data: users, error: userErr } = await supabase
    .from('users')
    .select('*')
    .limit(5);
  
  if (userErr) console.log('Users error:', userErr.message);
  else {
    console.log('Users columns:', users.length > 0 ? Object.keys(users[0]) : 'no users');
    users.forEach(u => console.log(' ', JSON.stringify(u).substring(0, 300)));
  }

  // Search for the email in users table using a broader approach
  console.log('\n=== Search for default2@nexsyrus.com in users ===');
  const { data: matchUsers, error: matchErr } = await supabase
    .from('users')
    .select('*')
    .ilike('user_email', '%default2%');
  
  if (matchErr) {
    console.log('Match error with user_email:', matchErr.message);
    // Try other column names
    const { data: m2, error: e2 } = await supabase.from('users').select('*').textSearch('*', 'default2');
    if (e2) console.log('Text search error:', e2.message);
    else console.log('Text search results:', m2);
  } else {
    console.log('Matched users:', matchUsers.length);
    matchUsers.forEach(u => console.log(' ', JSON.stringify(u)));
  }

  // Check profiles table
  console.log('\n=== Profiles Table ===');
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('*')
    .limit(5);
  
  if (profErr) console.log('Profiles error:', profErr.message);
  else {
    console.log('Profiles columns:', profiles.length > 0 ? Object.keys(profiles[0]) : 'no profiles');
    profiles.forEach(p => console.log(' ', JSON.stringify(p).substring(0, 300)));
  }

  // Check staff table
  console.log('\n=== Staff Table ===');
  const { data: staff, error: staffErr } = await supabase
    .from('staff')
    .select('*')
    .limit(5);
  
  if (staffErr) console.log('Staff error:', staffErr.message);
  else {
    console.log('Staff columns:', staff.length > 0 ? Object.keys(staff[0]) : 'no staff');
    staff.forEach(s => console.log(' ', JSON.stringify(s).substring(0, 300)));
  }
}

checkSchema().catch(console.error);
