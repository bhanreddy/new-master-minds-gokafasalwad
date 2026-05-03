const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jztckbupiepiqfrxhszt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp6dGNrYnVwaWVwaXFmcnhoc3p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMzgyMTYsImV4cCI6MjA4ODcxNDIxNn0.TC6mwwLezkwMmPxkIzRnR7NPyworRVzQ_vXCkRmnz4o';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAllTables() {
  // Try common table names to find where user/school data lives
  const tablesToCheck = [
    'schools', 'school', 'users', 'user', 'staff', 'admins', 'admin',
    'school_users', 'school_admins', 'user_schools', 'user_roles',
    'roles', 'school_staff', 'app_users', 'members', 'accounts',
    'school_members', 'tenants', 'tenant_users', 'school_settings',
    'admin_users', 'school_config'
  ];

  for (const table of tablesToCheck) {
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: false })
      .limit(3);
    
    if (error) {
      if (error.message.includes('schema cache')) {
        // Table doesn't exist
        continue;
      }
      console.log(`${table}: ERROR - ${error.message}`);
    } else {
      console.log(`\n=== TABLE: ${table} (${count || data?.length} rows) ===`);
      if (data && data.length > 0) {
        console.log('Columns:', Object.keys(data[0]).join(', '));
        data.forEach((row, i) => console.log(`  Row ${i}:`, JSON.stringify(row).substring(0, 300)));
      }
    }
  }
}

checkAllTables().catch(console.error);
