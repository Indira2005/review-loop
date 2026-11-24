require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const source = process.argv[2] || path.join(__dirname, "..", "data", "businesses.json");
  if (!fs.existsSync(source)) throw new Error(`Legacy JSON file not found: ${source}`);
  const legacy = JSON.parse(fs.readFileSync(source, "utf8"));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true } });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query("SELECT COUNT(*)::int AS count FROM users");
    if (existing.rows[0].count > 0) {
      throw new Error("The target database already contains users. Refusing to import to avoid duplicates.");
    }
    for (const user of legacy.users || []) {
      await client.query(
        `INSERT INTO users (id, email, password_hash, password_salt, password_algo, created_at)
         VALUES ($1, $2, $3, $4, 'pbkdf2', $5) ON CONFLICT (id) DO NOTHING`,
        [user.id, user.email, user.hash, user.salt, user.createdAt || new Date().toISOString()]
      );
    }
    for (const business of legacy.businesses || []) {
      await client.query(
        `INSERT INTO businesses (id, owner_id, name, slug, google_url, questions, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`,
        [
          business.id, business.ownerId, business.name, business.slug,
          business.googleUrl, business.questions || {}, business.createdAt || new Date().toISOString(),
          business.updatedAt || business.createdAt || new Date().toISOString()
        ]
      );
    }
    for (const event of legacy.events || []) {
      await client.query(
        `INSERT INTO events (business_id, type, session_key, created_at)
         SELECT $1, $2, $3, $4
         WHERE EXISTS (SELECT 1 FROM businesses WHERE id = $1)`,
        [event.businessId, event.type, event.session || null, event.at || new Date().toISOString()]
      );
    }
    await client.query("COMMIT");
    console.log(`Imported ${(legacy.users || []).length} users, ${(legacy.businesses || []).length} businesses, ${(legacy.events || []).length} events.`);
    console.log("Legacy PBKDF2 accounts are upgraded to bcrypt automatically on their next successful login.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(error => {
  console.error("Import failed:", error.message);
  process.exit(1);
});
