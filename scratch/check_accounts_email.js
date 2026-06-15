/**
 * Diagnostic script: Check accounts user email in Supabase auth.users
 * 
 * This queries the Supabase `users` table (application-level) to see how
 * the email was stored for accounts staff with school_id=13.
 * 
 * Run: node scratch/check_accounts_email.js
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jztckbupiepiqfrxhszt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6dGNrYnVwaWVwaXFmcnhoc3p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzgyMTYsImV4cCI6MjA4ODcxNDIxNn0.TC6mwwLezkwMmPxkIzRnR7NPyworRVzQ_vXCkRmnz4o';
const API_URL = 'https://supabasebackend-551435597195.europe-west1.run.app/api/v1';
const SCHOOL_ID = 13;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAccountsEmails() {
  console.log('=== Checking Accounts Users for school_id=' + SCHOOL_ID + ' ===\n');

  // 1. Check the `users` table for any user with "+school-" in the email
  console.log('--- Users with "+school-" in email (school_id=' + SCHOOL_ID + ') ---');
  const { data: scopedUsers, error: err1 } = await supabase
    .from('users')
    .select('id, email, school_id, person_id')
    .eq('school_id', SCHOOL_ID)
    .like('email', '%+school-%');

  if (err1) {
    console.log('Error querying users:', err1.message);
  } else {
    console.log('Users with scoped emails:', scopedUsers?.length || 0);
    (scopedUsers || []).forEach(u => {
      console.log(`  id=${u.id}, email=${u.email}, school_id=${u.school_id}`);
    });
  }

  // 2. Check user_roles for accountant role
  console.log('\n--- User Roles (role_code containing "account") ---');
  const { data: roles, error: err2 } = await supabase
    .from('user_roles')
    .select('*, roles!inner(code, name)')
    .eq('school_id', SCHOOL_ID);

  if (err2) {
    console.log('Error querying user_roles:', err2.message);
  } else {
    const accountRoles = (roles || []).filter(r => {
      const code = r.roles?.code || '';
      return code.includes('account') || code.includes('Account');
    });
    console.log('Accountant user_roles found:', accountRoles.length);
    accountRoles.forEach(r => {
      console.log(`  user_id=${r.user_id}, role=${r.roles?.code} (${r.roles?.name}), school_id=${r.school_id}`);
    });
  }

  // 3. List ALL users for school 13 to see the full picture
  console.log('\n--- All Users for school_id=' + SCHOOL_ID + ' ---');
  const { data: allUsers, error: err3 } = await supabase
    .from('users')
    .select('id, email, school_id, person_id')
    .eq('school_id', SCHOOL_ID);

  if (err3) {
    console.log('Error:', err3.message);
  } else {
    console.log('Total users:', allUsers?.length || 0);
    (allUsers || []).forEach(u => {
      const hasScope = u.email?.includes('+school-');
      console.log(`  ${hasScope ? '⚠️ ' : '✅ '}email=${u.email}, id=${u.id}`);
    });
  }

  // 4. Check the roles table to see what role codes exist
  console.log('\n--- Available Roles ---');
  const { data: allRoles, error: err4 } = await supabase
    .from('roles')
    .select('id, code, name');
  
  if (err4) {
    console.log('Error:', err4.message);
  } else {
    (allRoles || []).forEach(r => {
      console.log(`  id=${r.id}, code="${r.code}", name="${r.name}"`);
    });
  }

  // 5. Try to hit the backend API to see the staff endpoint response
  console.log('\n--- Checking backend staff list ---');
  try {
    const resp = await fetch(`${API_URL}/staff?school_id=${SCHOOL_ID}`);
    const body = await resp.json();
    console.log('Status:', resp.status);
    if (body.data && Array.isArray(body.data)) {
      console.log('Staff count:', body.data.length);
      body.data.forEach(s => {
        console.log(`  name=${s.first_name} ${s.last_name}, email=${s.email}, staff_code=${s.staff_code}`);
      });
    } else if (Array.isArray(body)) {
      body.forEach(s => {
        console.log(`  name=${s.first_name} ${s.last_name}, email=${s.email}`);
      });
    } else {
      console.log('Response:', JSON.stringify(body).substring(0, 500));
    }
  } catch (e) {
    console.log('Fetch error:', e.message);
  }
}

checkAccountsEmails().catch(console.error);
