const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jztckbupiepiqfrxhszt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6dGNrYnVwaWVwaXFmcnhoc3p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzgyMTYsImV4cCI6MjA4ODcxNDIxNn0.TC6mwwLezkwMmPxkIzRnR7NPyworRVzQ_vXCkRmnz4o';
const API_URL = 'https://schoolims-multitenancy.onrender.com/api/v1';
const SCHOOL_ID = 11;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAdminSchool() {
  const email = 'default2@nexsyrus.com';
  const password = process.argv[2];

  if (!password) {
    console.log('Usage: node check_admin3.js <password>');
    console.log('Attempting without password — will call API with school_id query...\n');
  }

  // Approach 1: Try to sign in and call validate-school-user
  if (password) {
    console.log(`=== Signing in as ${email} ===`);
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      console.log('Sign-in error:', signInError.message);
    } else {
      console.log('Sign-in SUCCESS. User ID:', signInData.user?.id);
      console.log('User metadata:', JSON.stringify(signInData.user?.user_metadata, null, 2));
      console.log('App metadata:', JSON.stringify(signInData.user?.app_metadata, null, 2));

      // Now call validate-school-user
      console.log('\n=== Calling validate-school-user ===');
      try {
        const resp = await fetch(`${API_URL}/auth/validate-school-user?school_id=${SCHOOL_ID}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${signInData.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ school_id: String(SCHOOL_ID) }),
        });

        const body = await resp.json();
        console.log('Status:', resp.status);
        console.log('Response:', JSON.stringify(body, null, 2));

        if (body.data) {
          console.log('\n=== RESULT ===');
          console.log('User schoolId from API:', body.data.schoolId);
          console.log('App SCHOOL_ID:', SCHOOL_ID);
          console.log('Match:', body.data.schoolId === SCHOOL_ID);
          if (body.data.schoolId !== SCHOOL_ID) {
            console.log(`\n❌ MISMATCH! User belongs to school_id=${body.data.schoolId}, but app expects school_id=${SCHOOL_ID}`);
          } else {
            console.log('\n✅ User belongs to the correct school.');
          }
        }
      } catch (fetchErr) {
        console.log('Fetch error:', fetchErr.message);
      }

      await supabase.auth.signOut();
    }
  }

  // Approach 2: Query API for schools list  
  console.log('\n=== Querying schools from backend API ===');
  try {
    const resp = await fetch(`${API_URL}/schools?school_id=${SCHOOL_ID}`);
    const body = await resp.json();
    console.log('Schools response:', JSON.stringify(body, null, 2));
  } catch (e) {
    console.log('Error:', e.message);
  }

  // Approach 3: Query users from backend API
  console.log('\n=== Querying users from backend API ===');
  try {
    const resp = await fetch(`${API_URL}/users?school_id=${SCHOOL_ID}`);
    const body = await resp.json();
    console.log('Status:', resp.status);
    if (Array.isArray(body.data)) {
      const match = body.data.find(u => u.email === email);
      if (match) {
        console.log(`Found user: ${JSON.stringify(match, null, 2)}`);
      } else {
        console.log(`User ${email} NOT found in school_id=${SCHOOL_ID} users list`);
        console.log('Total users:', body.data.length);
      }
    } else {
      console.log('Response:', JSON.stringify(body, null, 2).substring(0, 500));
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
}

checkAdminSchool().catch(console.error);
