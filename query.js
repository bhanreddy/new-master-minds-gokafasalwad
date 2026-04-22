import pkg from 'pg';
const { Client } = pkg;
const client = new Client({
  connectionString: 'postgresql://postgres.jztckbupiepiqfrxhszt:Dengeyr@p00ka@aws-1-ap-south-1.pooler.supabase.com:5432/postgres'
});
async function main() {
  await client.connect();
  const res = await client.query('SELECT * FROM staff_designations;');
  console.log(JSON.stringify(res.rows, null, 2));
  await client.end();
}
main();
