-- ======================================================
-- COMMON_DB BACKUP OF DELETED/UNUSED TABLES
-- Generated on: 2026-07-14T11:27:05.910Z
-- ======================================================

-- Table: "public"."users"
-- Columns: id, username, display_name, password_hash, is_active, created_at, role
-- Row count: 3
INSERT INTO "public"."users" (id, username, display_name, password_hash, is_active, created_at, role) VALUES ('50d8181f-d1b6-4ba5-abdf-1625d02e0770', 'admin', 'admin', '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW', true, '2026-07-05T05:19:45.543Z', 'admin');
INSERT INTO "public"."users" (id, username, display_name, password_hash, is_active, created_at, role) VALUES ('c9e44b07-5795-47dc-bf57-6f303acc8627', 'niina', 'niina', '$2a$10$AG22Dvo8Ayu10yxV4VD95ubYHqXUOQwlUHdDnH7wbH23L2vL8r.2C', true, '2026-07-05T05:19:45.543Z', 'admin');
INSERT INTO "public"."users" (id, username, display_name, password_hash, is_active, created_at, role) VALUES ('bf82a565-5292-4dca-ad16-b1a1c68d25be', 'testuser', 'testuser', '$2a$10$N9qo8uLOickgx2ZMRZoMye7I7.5Kt7MHV7Zz6L0t5c3qgGgKqk9qm', true, '2026-07-05T05:19:45.543Z', 'operator');

-- Table: "public"."roles"
-- Columns: id, code, name
-- Row count: 3
INSERT INTO "public"."roles" (id, code, name) VALUES ('f2e32441-9dd8-419f-8662-2c4ac7532206', 'admin', '管理者');
INSERT INTO "public"."roles" (id, code, name) VALUES ('89f9019d-19d4-4418-b096-046bfd1b1f1a', 'manager', '責任者');
INSERT INTO "public"."roles" (id, code, name) VALUES ('ba9c10ad-c393-42ae-bb87-b02587bac507', 'operator', '一般');

-- Table: "public"."permissions"
-- Columns: id, code, description
-- Row count: 4
INSERT INTO "public"."permissions" (id, code, description) VALUES ('5cbfa878-67c4-476f-b35d-d380cbfc56d0', 'read', '閲覧');
INSERT INTO "public"."permissions" (id, code, description) VALUES ('d0fbeb92-6264-4c5a-b685-d56af5a30c8d', 'ops.records.write', '点検記録更新');
INSERT INTO "public"."permissions" (id, code, description) VALUES ('be78c8a5-de3b-4daa-a322-0733c6eb7d78', 'ops.vehicles.write', '車両台帳更新');
INSERT INTO "public"."permissions" (id, code, description) VALUES ('2ad55c17-d25f-4d29-8512-bd842b1971c8', 'ops.admin', '運用管理');

-- Table: "public"."role_permissions"
-- Columns: role_id, permission_id
-- Row count: 8
INSERT INTO "public"."role_permissions" (role_id, permission_id) VALUES ('f2e32441-9dd8-419f-8662-2c4ac7532206', '5cbfa878-67c4-476f-b35d-d380cbfc56d0');
INSERT INTO "public"."role_permissions" (role_id, permission_id) VALUES ('f2e32441-9dd8-419f-8662-2c4ac7532206', 'd0fbeb92-6264-4c5a-b685-d56af5a30c8d');
INSERT INTO "public"."role_permissions" (role_id, permission_id) VALUES ('f2e32441-9dd8-419f-8662-2c4ac7532206', 'be78c8a5-de3b-4daa-a322-0733c6eb7d78');
INSERT INTO "public"."role_permissions" (role_id, permission_id) VALUES ('f2e32441-9dd8-419f-8662-2c4ac7532206', '2ad55c17-d25f-4d29-8512-bd842b1971c8');
INSERT INTO "public"."role_permissions" (role_id, permission_id) VALUES ('89f9019d-19d4-4418-b096-046bfd1b1f1a', '5cbfa878-67c4-476f-b35d-d380cbfc56d0');
INSERT INTO "public"."role_permissions" (role_id, permission_id) VALUES ('89f9019d-19d4-4418-b096-046bfd1b1f1a', 'd0fbeb92-6264-4c5a-b685-d56af5a30c8d');
INSERT INTO "public"."role_permissions" (role_id, permission_id) VALUES ('89f9019d-19d4-4418-b096-046bfd1b1f1a', 'be78c8a5-de3b-4daa-a322-0733c6eb7d78');
INSERT INTO "public"."role_permissions" (role_id, permission_id) VALUES ('ba9c10ad-c393-42ae-bb87-b02587bac507', '5cbfa878-67c4-476f-b35d-d380cbfc56d0');

-- Table: "public"."user_role_assignments"
-- Columns: user_id, org_id, system_key, role_id, created_at
-- Row count: 3
INSERT INTO "public"."user_role_assignments" (user_id, org_id, system_key, role_id, created_at) VALUES ('50d8181f-d1b6-4ba5-abdf-1625d02e0770', 'd68ff660-e574-47a9-8b89-2699003e8866', 'ops', 'f2e32441-9dd8-419f-8662-2c4ac7532206', '2026-07-14T09:55:26.301Z');
INSERT INTO "public"."user_role_assignments" (user_id, org_id, system_key, role_id, created_at) VALUES ('c9e44b07-5795-47dc-bf57-6f303acc8627', 'd68ff660-e574-47a9-8b89-2699003e8866', 'ops', 'f2e32441-9dd8-419f-8662-2c4ac7532206', '2026-07-14T09:55:26.301Z');
INSERT INTO "public"."user_role_assignments" (user_id, org_id, system_key, role_id, created_at) VALUES ('bf82a565-5292-4dca-ad16-b1a1c68d25be', 'd68ff660-e574-47a9-8b89-2699003e8866', 'ops', 'ba9c10ad-c393-42ae-bb87-b02587bac507', '2026-07-14T09:55:26.301Z');

-- Table: "public"."user_org_memberships"
-- Columns: id, user_id, org_id, site_id, title, created_at
-- Row count: 3
INSERT INTO "public"."user_org_memberships" (id, user_id, org_id, site_id, title, created_at) VALUES ('237c3e2a-66a7-4702-a3ea-23bb0a4af8fb', '50d8181f-d1b6-4ba5-abdf-1625d02e0770', 'd68ff660-e574-47a9-8b89-2699003e8866', 'df6a38a9-eade-42b2-bbfb-1de39e8116ae', '管理者', '2026-07-14T09:55:26.301Z');
INSERT INTO "public"."user_org_memberships" (id, user_id, org_id, site_id, title, created_at) VALUES ('63c917b0-2a4d-4c14-97b0-3ea171981601', 'c9e44b07-5795-47dc-bf57-6f303acc8627', 'd68ff660-e574-47a9-8b89-2699003e8866', 'df6a38a9-eade-42b2-bbfb-1de39e8116ae', '管理者', '2026-07-14T09:55:26.301Z');
INSERT INTO "public"."user_org_memberships" (id, user_id, org_id, site_id, title, created_at) VALUES ('3bf8401e-bbc0-4c1c-aca0-c849d79abe9c', 'bf82a565-5292-4dca-ad16-b1a1c68d25be', 'd68ff660-e574-47a9-8b89-2699003e8866', 'df6a38a9-eade-42b2-bbfb-1de39e8116ae', 'オペレーター', '2026-07-14T09:55:26.301Z');

-- Table: "public"."sites"
-- Columns: id, org_id, code, name, created_at
-- Row count: 1
INSERT INTO "public"."sites" (id, org_id, code, name, created_at) VALUES ('df6a38a9-eade-42b2-bbfb-1de39e8116ae', 'd68ff660-e574-47a9-8b89-2699003e8866', 'HQ', '本社', '2026-07-14T09:55:26.301Z');

-- Table: "master_data"."users"
-- Columns: id, username, display_name, role, office_id, email, phone_number, employee_number, is_active, created_at, updated_at, auth_user_id
-- Row count: 3
INSERT INTO "master_data"."users" (id, username, display_name, role, office_id, email, phone_number, employee_number, is_active, created_at, updated_at, auth_user_id) VALUES ('1', 'admin', '管理者', '責任者', NULL, 'admin@local.test', NULL, NULL, true, '2026-07-14T09:55:26.301Z', '2026-07-14T09:55:26.301Z', '50d8181f-d1b6-4ba5-abdf-1625d02e0770');
INSERT INTO "master_data"."users" (id, username, display_name, role, office_id, email, phone_number, employee_number, is_active, created_at, updated_at, auth_user_id) VALUES ('2', 'niina', '新名', '責任者', NULL, 'niina@local.test', NULL, NULL, true, '2026-07-14T09:55:26.301Z', '2026-07-14T09:55:26.301Z', 'c9e44b07-5795-47dc-bf57-6f303acc8627');
INSERT INTO "master_data"."users" (id, username, display_name, role, office_id, email, phone_number, employee_number, is_active, created_at, updated_at, auth_user_id) VALUES ('3', 'testuser', 'テストユーザー', '点検者', NULL, 'testuser@local.test', NULL, NULL, true, '2026-07-14T09:55:26.301Z', '2026-07-14T09:55:26.301Z', 'bf82a565-5292-4dca-ad16-b1a1c68d25be');

