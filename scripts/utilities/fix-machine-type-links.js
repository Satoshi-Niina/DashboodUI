const { Client } = require('pg');
require('dotenv').config();

const DEFAULT_SCHEMA = process.env.DB_SCHEMA || 'master_data';
const LIMIT = Number(process.env.FIX_MACHINE_TYPE_LIMIT || 10);

function normalizeText(value) {
  if (value == null) return '';
  return String(value).trim().toLowerCase();
}

async function getColumns(client, schema, table) {
  const query = `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name = $2
  `;
  const result = await client.query(query, [schema, table]);
  return new Set(result.rows.map((row) => String(row.column_name || '').trim().toLowerCase()));
}

async function run() {
  const schema = DEFAULT_SCHEMA;
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = new Client({ connectionString });
  await client.connect();

  const machineColumns = await getColumns(client, schema, 'machines');
  const typeColumns = await getColumns(client, schema, 'machine_types');

  if (!machineColumns.has('id') || !machineColumns.has('machine_type_id')) {
    throw new Error(`Missing required columns on ${schema}.machines`);
  }
  if (!typeColumns.has('id')) {
    throw new Error(`Missing required columns on ${schema}.machine_types`);
  }

  const machineNameCandidates = ['machine_type_name', 'type_name', 'model_name', 'machine_type', 'vehicle_type'];
  const typeNameCandidates = ['machine_type_name', 'type_name', 'model_name', 'name'];

  const machineNameColumn = machineNameCandidates.find((col) => machineColumns.has(col)) || null;
  const typeNameColumn = typeNameCandidates.find((col) => typeColumns.has(col)) || null;

  const typeRows = await client.query(`
    SELECT id::text AS id_text,
           ${typeNameColumn ? `${typeNameColumn}::text AS type_name_text` : 'NULL::text AS type_name_text'}
    FROM ${schema}.machine_types
    ORDER BY created_at NULLS LAST, id
  `);

  if (typeRows.rows.length === 0) {
    throw new Error(`No rows found in ${schema}.machine_types`);
  }

  const defaultTypeId = typeRows.rows[0].id_text;
  const typeNameMap = new Map();
  for (const row of typeRows.rows) {
    const key = normalizeText(row.type_name_text);
    if (key && !typeNameMap.has(key)) {
      typeNameMap.set(key, row.id_text);
    }
  }

  const machineRows = await client.query(`
    SELECT
      m.id::text AS machine_id,
      m.machine_number::text AS machine_number,
      m.machine_type_id::text AS machine_type_id,
      ${machineNameColumn ? `m.${machineNameColumn}::text AS machine_type_name_text` : 'NULL::text AS machine_type_name_text'}
    FROM ${schema}.machines m
    LEFT JOIN ${schema}.machine_types mt
      ON m.machine_type_id::text = mt.id::text
    WHERE m.machine_type_id IS NULL
       OR mt.id IS NULL
    ORDER BY m.created_at NULLS LAST, m.id
    LIMIT $1
  `, [LIMIT]);

  const targets = machineRows.rows;
  if (targets.length === 0) {
    console.log('No unlinked machine records found.');
    await client.end();
    return;
  }

  console.log(`Found ${targets.length} unlinked records (limit=${LIMIT}).`);
  console.log(`Name-based mapping column: ${machineNameColumn || 'none'}`);
  console.log(`Type name source column: ${typeNameColumn || 'none'}`);
  console.log(`Default fallback type id: ${defaultTypeId}`);

  const hasUpdatedAt = machineColumns.has('updated_at');
  let fixedCount = 0;

  for (const row of targets) {
    const machineTypeName = normalizeText(row.machine_type_name_text);
    const resolvedTypeId = (machineTypeName && typeNameMap.get(machineTypeName)) || defaultTypeId;

    const updateQuery = hasUpdatedAt
      ? `UPDATE ${schema}.machines SET machine_type_id = $1, updated_at = NOW() WHERE id::text = $2`
      : `UPDATE ${schema}.machines SET machine_type_id = $1 WHERE id::text = $2`;

    await client.query(updateQuery, [resolvedTypeId, row.machine_id]);
    fixedCount += 1;

    console.log(`fixed machine_id=${row.machine_id} machine_number=${row.machine_number || '-'} -> machine_type_id=${resolvedTypeId}`);
  }

  console.log(`Completed: ${fixedCount} rows updated.`);
  await client.end();
}

run().catch((err) => {
  console.error('FIX_MACHINE_TYPE_LINKS_FAILED:', err.code || 'N/A', err.message || String(err));
  process.exit(1);
});
