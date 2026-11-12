-- ==============================================================================
-- BALLY JUTE COMPANY LIMITED - S.Q.C. SEED SCRIPT
-- Tested for PostgreSQL 12 / 13 / 14 / 15 / 16 / 17 (pgAdmin 4 compatible)
-- ==============================================================================

-- 1. SEED DEPARTMENTS (All UUIDs are valid hex characters 0-9, a-f)
INSERT INTO departments (id, code, name, hod_name, is_active) VALUES
  ('a0000001-0000-0000-0000-000000000001', 'DEPT-SEL', 'Selection / Raw Jute Assortment', 'S. K. Mukherjee', TRUE),
  ('a0000001-0000-0000-0000-000000000002', 'DEPT-PREP', 'Batching & Preparing (Carding & Drawing)', 'A. K. Banerjee', TRUE),
  ('a0000001-0000-0000-0000-000000000003', 'DEPT-SPG', 'Spinning Department', 'R. N. Ghosh', TRUE),
  ('a0000001-0000-0000-0000-000000000004', 'DEPT-WND', 'Winding Department', 'P. K. Dutta', TRUE),
  ('a0000001-0000-0000-0000-000000000005', 'DEPT-WEAV', 'Weaving Department', 'B. K. Roy', TRUE),
  ('a0000001-0000-0000-0000-000000000006', 'DEPT-FIN', 'Finishing & Sack Sewing', 'M. L. Sharma', TRUE),
  ('a0000001-0000-0000-0000-000000000007', 'DEPT-LAB', 'SQC Central Quality Testing Lab', 'Dr. D. Sen', TRUE)
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name, hod_name = EXCLUDED.hod_name;

-- 2. SEED USERS & ROLES
INSERT INTO users (id, email, display_name, employee_code, role, department_id, is_active) VALUES
  ('b0000001-0000-0000-0000-000000000001', 'superadmin@ballyjute.com', 'Rajesh K. Agarwal', 'EMP-001', 'Super Admin', (SELECT id FROM departments WHERE code = 'DEPT-LAB' LIMIT 1), TRUE),
  ('b0000001-0000-0000-0000-000000000002', 'admin.sqc@ballyjute.com', 'Sunil Mukherjee', 'EMP-002', 'Admin', (SELECT id FROM departments WHERE code = 'DEPT-LAB' LIMIT 1), TRUE),
  ('b0000001-0000-0000-0000-000000000003', 'hod.weaving@ballyjute.com', 'B. K. Roy (HOD Weaving)', 'EMP-005', 'HOD / Approver', (SELECT id FROM departments WHERE code = 'DEPT-WEAV' LIMIT 1), TRUE),
  ('b0000001-0000-0000-0000-000000000004', 'inspector.sqc@ballyjute.com', 'Animesh Das (SQC Tester)', 'EMP-014', 'SQC Inspector / User', (SELECT id FROM departments WHERE code = 'DEPT-LAB' LIMIT 1), TRUE),
  ('b0000001-0000-0000-0000-000000000005', 'auditor.bis@ballyjute.com', 'Subrata Bose (BIS Auditor)', 'EMP-EXT-01', 'Viewer / Auditor', (SELECT id FROM departments WHERE code = 'DEPT-LAB' LIMIT 1), TRUE)
ON CONFLICT (email) DO UPDATE 
SET display_name = EXCLUDED.display_name, role = EXCLUDED.role;

-- 3. SEED JUTE QUALITY MASTERS
INSERT INTO quality_masters (id, code, name, category, nominal_count, standard_mr, warp_count, weft_count) VALUES
  ('c0000001-0000-0000-0000-000000000001', 'QUAL-HES-40', 'Hessian 40 inch 10 oz / 40 inch', 'Hessian', 8.50, 16.00, 8.50, 9.00),
  ('c0000001-0000-0000-0000-000000000002', 'QUAL-SACK-BTWILL', 'Standard B.Twill 2.25 lbs Foodgrain', 'Sacking', 10.25, 20.00, 10.25, 28.00),
  ('c0000001-0000-0000-0000-000000000003', 'QUAL-DW-FLOUR', 'D.W. Flour Bags 90 kg Quality', 'Heavy Goods', 9.50, 18.00, 9.50, 24.00),
  ('c0000001-0000-0000-0000-000000000004', 'QUAL-CARPET-CBC', 'Carpet Backing Cloth (CBC) 5.5 oz', 'Geo-Jute / CBC', 7.50, 14.50, 7.50, 8.00)
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name, nominal_count = EXCLUDED.nominal_count;

