#!/usr/bin/env node

// simple migration runner using pg client
// usage: DATABASE_URL=... node scripts/runMigration.js path/to/sqlfile.sql

import fs from 'fs';
import { Client } from 'pg';

async function main() {
  const sqlPath = process.argv[2];
  if (!sqlPath) {
    console.error('Usage: node runMigration.js <sql-file>');
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    console.log('Connected to database, executing migration...');
    await client.query(sql);
    console.log('Migration executed successfully');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
