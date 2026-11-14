#!/usr/bin/env node
// ==============================================================================
// SQC - PostgreSQL Database Setup & Migration Script
// Target Server: BJCL
// Target Database: "SQC"
// ==============================================================================

const fs = require('fs');
const path = require('path');
const { Client, Pool } = require('pg');
require('dotenv').config();

const DB_HOST = process.env.PGHOST || process.env.LOCAL_DB_HOST || process.env.DB_HOST || '127.0.0.1';
const DB_PORT = parseInt(process.env.PGPORT || process.env.LOCAL_DB_PORT || process.env.DB_PORT || '5432', 10);
const DB_USER = process.env.PGUSER || process.env.LOCAL_DB_USER || process.env.DB_USER || 'postgres';
const DB_PASSWORD = process.env.PGPASSWORD || process.env.LOCAL_DB_PASSWORD || process.env.DB_PASSWORD || 'postgres';
const DB_NAME = process.env.PGDATABASE || process.env.LOCAL_DB_NAME || process.env.DB_NAME || 'SQC';

console.log('==================================================================');
console.log('🏭 SQC - Statistical Quality Control Database Setup');
console.log(`🖥️  Host Server : ${DB_HOST}:${DB_PORT}`);
console.log(`📦 Database    : "${DB_NAME}"`);
console.log(`👤 User        : ${DB_USER}`);
console.log('==================================================================\n');

async function runSetup() {
  // Step 1: Connect to default 'postgres' database to check/create target DB
  console.log('1️⃣  Connecting to PostgreSQL server to verify database existence...');
  const rootClient = new Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: 'postgres',
  });

  try {
    await rootClient.connect();
    console.log('   Connected to PostgreSQL engine successfully.');

    const dbCheck = await rootClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [DB_NAME]
    );

    if (dbCheck.rows.length === 0) {
      console.log(`   Database "${DB_NAME}" not found. Creating database...`);
      await rootClient.query(`CREATE DATABASE "${DB_NAME}" ENCODING 'UTF8';`);
      console.log(`   ✅ Database "${DB_NAME}" created successfully.`);
    } else {
      console.log(`   ℹ️  Database "${DB_NAME}" already exists.`);
    }
  } catch (err) {
    console.warn(`   ⚠️ Root connection notice: ${err.message}`);
    console.log('   Will attempt direct connection to target database...');
  } finally {
    try {
      await rootClient.end();
    } catch (_) {}
  }

  // Step 2: Connect directly to target DB and apply schema
  console.log(`\n2️⃣  Connecting to target database "${DB_NAME}"...`);
  const targetPool = new Pool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });

  try {
    const client = await targetPool.connect();
    console.log(`   Connected to "${DB_NAME}" successfully.`);

    // Prefer db/schema.sql first, then schema.sql
    const schemaPaths = [
      path.join(__dirname, 'db', 'schema.sql'),
      path.join(__dirname, 'schema.sql'),
      path.join(__dirname, '..', 'db', 'schema.sql'),
    ];

    let schemaSql = '';
    for (const p of schemaPaths) {
      if (fs.existsSync(p)) {
        schemaSql = fs.readFileSync(p, 'utf8');
        console.log(`   Loaded schema definition from: ${p}`);
        break;
      }
    }

    if (!schemaSql) {
      throw new Error('schema.sql file not found in db/ or current directory.');
    }

    console.log('3️⃣  Executing schema initialization and column checks...');
    await client.query(schemaSql);
    console.log('   ✅ All tables, constraints, and indexes created / updated.');

    // Step 3: Verify core tables
    console.log('\n4️⃣  Verifying core & form tables:');
    const coreTables = [
      'users',
      'user_form_permissions',
      'departments',
      'sections',
      'machines',
      'looms',
      'qualities',
      'quality_standards',
      'inspections',
      'audit_logs',
      'system_settings',
    ];
    for (const t of coreTables) {
      try {
        const countRes = await client.query(`SELECT COUNT(*) FROM "${t}"`);
        console.log(`   - Core table "${t}": ${countRes.rows[0].count} records`);
      } catch (e) {
        console.log(`   - Core table "${t}": verification error (${e.message})`);
      }
    }

    const formTablesRes = await client.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'form_%' ORDER BY tablename`
    );
    console.log(`\n   ✅ Individual Form Tables verified: ${formTablesRes.rows.length} / 38 tables present.`);

    const totalTablesRes = await client.query(
      `SELECT COUNT(*) AS total FROM pg_tables WHERE schemaname = 'public'`
    );
    console.log(`   📊 Total Public Tables in "${DB_NAME}": ${totalTablesRes.rows[0].total}`);

    // Step 4: Check default admin
    const adminRes = await client.query(`SELECT username, display_name, role FROM users WHERE username = 'admin'`);
    if (adminRes.rows.length > 0) {
      console.log(`\n✅ Default Administrator verified:`);
      console.log(`   Username : ${adminRes.rows[0].username}`);
      console.log(`   Name     : ${adminRes.rows[0].display_name}`);
      console.log(`   Role     : ${adminRes.rows[0].role}`);
      console.log(`   Password : Admin@123456 (or Admin@1234)`);
    }

    client.release();
    await targetPool.end();

    console.log('\n==================================================================');
    console.log('🎉 SQC Database Setup Completed Successfully!');
    console.log('You can now start the application server using:');
    console.log('   node server.cjs');
    console.log('==================================================================\n');
  } catch (err) {
    console.error('\n❌ Database Setup Error:', err.message);
    process.exit(1);
  }
}

runSetup();
