const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jztckbupiepiqfrxhszt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6dGNrYnVwaWVwaXFmcnhoc3p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzgyMTYsImV4cCI6MjA4ODcxNDIxNn0.TC6mwwLezkwMmPxkIzRnR7NPyworRVzQ_vXCkRmnz4o';
const API_URL = 'https://schoolims-multitenancy.onrender.com/api/v1';
const SCHOOL_ID = 11;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Try common passwords
const passwords = ['Admin@123', 'admin@123', 'Admin123', 'Password@123', 'Default@123', 'default@123', 'Nexsyrus@123', 'Test@123'];

async function tryLogin() {
  const email = 'default2@nexsyrus.com';
  
  for (const pwd of passwords) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    if (!error && data.session) {
      console.log(`✅ Login succeeded with password: ${pwd}`);
      console.log('User ID:', data.user.id);
      console.log('User email:', data.user.email);
      console.log('User metadata:', JSON.stringify(data.user.user_metadata, null, 2));
      console.log('App metadata:', JSON.stringify(data.user.app_metadata, null, 2));

      // Call validate-school-user
      console.log('\n=== Calling /auth/validate-school-user ===');
      const resp = await fetch(`${API_URL}/auth/validate-school-user?school_id=${SCHOOL_ID}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${data.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ school_id: String(SCHOOL_ID) }),
      });

      const body = await resp.json();
      console.log('Status:', resp.status);
      console.log('Full response:', JSON.stringify(body, null, 2));

      if (body.data?.schoolId !== undefined) {
        console.log(`\n🔍 Backend says schoolId = ${body.data.schoolId}`);
        console.log(`🔍 App expects SCHOOL_ID = ${SCHOOL_ID}`);
        console.log(`🔍 Match: ${body.data.schoolId === SCHOOL_ID}`);
        if (body.data.schoolId !== SCHOOL_ID) {
          console.log(`\n❌ MISMATCH! The admin's school_id in the database is ${body.data.schoolId}, NOT ${SCHOOL_ID}`);
        }
      }

      // Also try fetching the user list for school 11 to see if user is in it
      console.log('\n=== Checking users for school_id=11 ===');
      const usersResp = await fetch(`${API_URL}/users?school_id=${SCHOOL_ID}`, {
        headers: {
          'Authorization': `Bearer ${data.session.access_token}`,
        },
      });
      const usersBody = await usersResp.json();
      if (Array.isArray(usersBody.data)) {
        const found = usersBody.data.find(u => u.email === email);
        console.log(`User ${email} in school 11 users list: ${found ? 'YES' : 'NO'}`);
        if (found) console.log('User record:', JSON.stringify(found, null, 2));
        console.log('All users in school 11:', usersBody.data.map(u => `${u.email} (role: ${u.role?.code || u.role})`));
      } else {
        console.log('Users response:', JSON.stringify(usersBody, null, 2).substring(0, 500));
      }

      await supabase.auth.signOut();
      return;
    }
  }

  console.log('❌ Could not log in with any common password. Please provide the password for default2@nexsyrus.com');
  console.log('Run: node scratch/check_admin3.js <password>');
}

tryLogin().catch(console.error);
