/**
 * Diagnostic script v2: Find where email is stored and check for scoped emails
 * Run: node scratch/check_accounts_email2.js
 */
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jztckbupiepiqfrxhszt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6dGNrYnVwaWVwaXFmcnhoc3p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzgyMTYsImV4cCI6MjA4ODcxNDIxNn0.TC6mwwLezkwMmPxkIzRnR7NPyworRVzQ_vXCkRmnz4o';
const SCHOOL_ID = 13;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function diagnose() {
  // 1. Check users table schema
  console.log('=== Users Table (first 3 rows for school_id=' + SCHOOL_ID + ') ===');
  const { data: users, error: e1 } = await supabase
    .from('users')
    .select('*')
    .eq('school_id', SCHOOL_ID)
    .limit(3);
  if (e1) console.log('Error:', e1.message);
  else if (users?.length) {
    console.log('Columns:', Object.keys(users[0]).join(', '));
    users.forEach(u => console.log('  Row:', JSON.stringify(u).substring(0, 300)));
  } else {
    console.log('No users found');
  }

  // 2. Check contacts table for "+school-"
  console.log('\n=== Contacts with "+school-" (school 13 users) ===');
  const { data: contacts, error: e2 } = await supabase
    .from('contacts')
    .select('*')
    .like('contact_value', '%+school-%')
    .limit(10);
  if (e2) console.log('Error:', e2.message);
  else {
    console.log('Scoped contacts:', contacts?.length || 0);
    (contacts || []).forEach(c => console.log('  ', JSON.stringify(c).substring(0, 300)));
  }

  // 3. Check persons table for "+school-" in any field
  console.log('\n=== Persons Table (first 3 rows for reference) ===');
  const { data: persons, error: e3 } = await supabase
    .from('persons')
    .select('*')
    .limit(3);
  if (e3) console.log('Error:', e3.message);
  else if (persons?.length) {
    console.log('Columns:', Object.keys(persons[0]).join(', '));
    persons.forEach(p => console.log('  Row:', JSON.stringify(p).substring(0, 300)));
  }

  // 4. Check user_roles to understand role assignment
  console.log('\n=== User Roles for school_id=' + SCHOOL_ID + ' ===');
  const { data: ur, error: e4 } = await supabase
    .from('user_roles')
    .select('*, roles(code, name)')
    .eq('school_id', SCHOOL_ID);
  if (e4) console.log('Error:', e4.message);
  else {
    console.log('Total user_roles:', ur?.length || 0);
    (ur || []).forEach(r => {
      console.log(`  user_id=${r.user_id}, role=${JSON.stringify(r.roles)}`);
    });
  }

  // 5. Check roles table
  console.log('\n=== Roles Table ===');
  const { data: roles, error: e5 } = await supabase
    .from('roles')
    .select('*');
  if (e5) console.log('Error:', e5.message);
  else (roles || []).forEach(r => console.log(`  id=${r.id}, code="${r.code}", name="${r.name}"`));

  // 6. Check staff table for school 13
  console.log('\n=== Staff for school_id=' + SCHOOL_ID + ' ===');
  const { data: staff, error: e6 } = await supabase
    .from('staff')
    .select('*, persons(first_name, last_name, display_name)')
    .eq('school_id', SCHOOL_ID);
  if (e6) console.log('Error:', e6.message);
  else {
    console.log('Total staff:', staff?.length || 0);
    (staff || []).forEach(s => {
      console.log(`  id=${s.id}, staff_code=${s.staff_code}, name=${s.persons?.display_name || s.persons?.first_name}`);
    });
  }

  // 7. Check if there's a direct email on users by querying with contacts join
  console.log('\n=== Users with contacts for school_id=' + SCHOOL_ID + ' ===');
  const { data: usersWithContacts, error: e7 } = await supabase
    .from('users')
    .select('id, school_id, person_id, supabase_uid, persons(display_name), contacts!contacts_person_id_fkey(contact_type, contact_value)')
    .eq('school_id', SCHOOL_ID);
  if (e7) {
    console.log('Error (trying alt join):', e7.message);
    // Try without join
    const { data: u2, error: e7b } = await supabase
      .from('users')
      .select('*')
      .eq('school_id', SCHOOL_ID);
    if (e7b) console.log('Still error:', e7b.message);
    else {
      console.log('Users (raw):', u2?.length || 0);
      (u2 || []).forEach(u => console.log('  ', JSON.stringify(u).substring(0, 300)));
    }
  } else {
    (usersWithContacts || []).forEach(u => {
      const emails = (u.contacts || []).filter(c => c.contact_type === 'email');
      console.log(`  user_id=${u.id}, name=${u.persons?.display_name}, emails=${emails.map(e => e.contact_value).join(', ')}`);
    });
  }
}

diagnose().catch(console.error);
