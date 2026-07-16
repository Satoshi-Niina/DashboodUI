-- Remove obsolete master_data business tables after public migration.
-- Keep master_data.app_config, app_config_history, and AI/RAG tables.
-- CASCADE removes only dependent constraints/objects; it does not drop public tables.

BEGIN;

DROP TABLE IF EXISTS master_data.inspection_schedules CASCADE;
DROP TABLE IF EXISTS master_data.inspection_types CASCADE;
DROP TABLE IF EXISTS master_data.machines CASCADE;
DROP TABLE IF EXISTS master_data.machine_types CASCADE;
DROP TABLE IF EXISTS master_data.bases CASCADE;
DROP TABLE IF EXISTS master_data.managements_offices CASCADE;
DROP TABLE IF EXISTS master_data.users CASCADE;

COMMIT;
