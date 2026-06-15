/**
 * Diagnostic v3: Sign in as admin first, then query with elevated session.
 * Also check auth.users email directly via Supabase auth.
 * 
 * Usage: node scratch/check_accounts_email3.js <admin_email> <admin_password>
 * Example: node scratch/check_accounts_email3.js admin@samskruthe.com Password123
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jztckbupiepiqfrxhszt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6dGNrYnVwaWVwaXFmcnhoc3p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzgyMTYsImV4cCI6MjA4ODcxNDIxNn0.TC6mwwLezkwMmPxkIzRnR7NPyworRVzQ_vXCkRmnz4o';
const API_URL = 'https://supabasebackend-551435597195.europe-west1.run.app/api/v1';
const SCHOOL_ID = 13;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diagnose() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.log('Usage: node scratch/check_accounts_email3.js <admin_email> <admin_password>');
    console.log('\nAttempting direct Supabase login with accounts@samskruthe.com ...');

    // Try the transformed email to see if it exists
    const transformed = 'accounts+school-13-b6f7dc299f2215d3@samskruthe.com';
    console.log('\n=== Trying login with TRANSFORMED email ===');
    console.log('Email:', transformed);
    const { data: d1, error: e1 } = await supabase.auth.signInWithPassword({
      email: transformed,
      password: 'Test@123'  // common test password
    });
    console.log('Result:', e1 ? `Error: ${e1.message}` : `Success! User: ${d1?.user?.email}`);
    if (d1?.session) await supabase.auth.signOut();

    // Try the original email
    const original = 'accounts@samskruthe.com';
    console.log('\n=== Trying login with ORIGINAL email ===');
    console.log('Email:', original);
    const { data: d2, error: e2 } = await supabase.auth.signInWithPassword({
      email: original,
      password: 'Test@123'
    });
    console.log('Result:', e2 ? `Error: ${e2.message}` : `Success! User: ${d2?.user?.email}`);
    if (d2?.session) await supabase.auth.signOut();

    return;
  }

  // Sign in as admin
  console.log(`=== Signing in as ${email} ===`);
  const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
  
  if (signInErr) {
    console.log('Login failed:', signInErr.message);
    return;
  }

  console.log('✅ Logged in as:', signIn.user.email);
  console.log('User ID:', signIn.user.id);
  console.log('Auth email in Supabase:', signIn.user.email);
  console.log('User metadata:', JSON.stringify(signIn.user.user_metadata, null, 2));

  // Now query with authenticated session
  console.log('\n=== Users for school_id=' + SCHOOL_ID + ' (authenticated) ===');
  const { data: users, error: e1 } = await supabase
    .from('users')
    .select('*')
    .eq('school_id', SCHOOL_ID);
  
  if (e1) console.log('Error:', e1.message);
  else {
    console.log('Total users:', users?.length || 0);
    if (users?.length) {
      console.log('Columns:', Object.keys(users[0]).join(', '));
      users.forEach(u => console.log('  Row:', JSON.stringify(u).substring(0, 400)));
    }
  }

  // Check user_roles
  console.log('\n=== User Roles for school_id=' + SCHOOL_ID + ' ===');
  const { data: ur, error: e2 } = await supabase
    .from('user_roles')
    .select('*, roles(code, name)')
    .eq('school_id', SCHOOL_ID);
  if (e2) console.log('Error:', e2.message);
  else {
    console.log('Total roles:', ur?.length || 0);
    (ur || []).forEach(r => console.log(`  user_id=${r.user_id}, role=${r.roles?.code || '?'}`));
  }

  // Check staff
  console.log('\n=== Staff for school_id=' + SCHOOL_ID + ' ===');
  const { data: staff, error: e3 } = await supabase
    .from('staff')
    .select('*, persons(first_name, last_name, display_name)')
    .eq('school_id', SCHOOL_ID);
  if (e3) console.log('Error:', e3.message);
  else {
    console.log('Total staff:', staff?.length || 0);
    (staff || []).forEach(s => console.log(`  id=${s.id}, code=${s.staff_code}, name=${s.persons?.display_name}`));
  }

  // Now use the backend API with token to check staff
  console.log('\n=== Backend API: GET /staff ===');
  try {
    const resp = await fetch(`${API_URL}/staff?school_id=${SCHOOL_ID}`, {
      headers: { 'Authorization': `Bearer ${signIn.session.access_token}` }
    });
    const body = await resp.json();
    console.log('Status:', resp.status);
    const rows = body.data || body;
    if (Array.isArray(rows)) {
      rows.forEach(s => console.log(`  ${s.first_name} ${s.last_name}: email=${s.email}, staff_code=${s.staff_code}`));
    } else {
      console.log(JSON.stringify(body).substring(0, 500));
    }
  } catch (e) {
    console.log('Error:', e.message);
  }

  // Call validate-school-user to see what the backend returns for THIS user
  console.log('\n=== Backend: validate-school-user ===');
  try {
    const resp = await fetch(`${API_URL}/auth/validate-school-user?school_id=${SCHOOL_ID}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${signIn.session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ school_id: String(SCHOOL_ID) })
    });
    const body = await resp.json();
    console.log('Status:', resp.status);
    console.log('Response:', JSON.stringify(body, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }

  await supabase.auth.signOut();
  console.log('\n✅ Done. Signed out.');
}

diagnose().catch(console.error);
