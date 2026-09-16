-- ==============================================================================
-- BALLY JUTE COMPANY LIMITED - S.Q.C. QUALITY CONTROL SYSTEM
-- Production-Ready PostgreSQL Schema (DDL, Indexes, Triggers, & Constraints)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES
DO $$ BEGIN
  CREATE TYPE user_role_enum AS ENUM (
    'Super Admin',
    'Admin',
    'HOD / Approver',
    'SQC Inspector / User',
    'Viewer / Auditor'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE inspection_status_enum AS ENUM (
    'Draft',
    'Submitted',
    'Under Review',
    'Approved',
    'Rejected',
    'Returned'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE inspection_result_enum AS ENUM (
    'PASS',
    'WARNING',
    'FAIL'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE audit_action_enum AS ENUM (
    'LOGIN',
    'LOGOUT',
    'CREATE',
    'UPDATE',
    'SUBMIT',
    'APPROVE',
    'REJECT',
    'RETURN',
    'DELETE',
    'EXPORT',
    'SETTINGS'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. CORE MASTER TABLES

-- 3.1 Departments
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  hod_name VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR(100) DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(100) DEFAULT 'system',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.2 Sections
CREATE TABLE IF NOT EXISTS sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR(100) DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(100) DEFAULT 'system',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.3 Users & Personnel
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT, -- For local auth / bcrypt
  display_name VARCHAR(100) NOT NULL,
  employee_code VARCHAR(50) UNIQUE,
  phone VARCHAR(30),
  role user_role_enum NOT NULL DEFAULT 'SQC Inspector / User',
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.4 Machines & Rated Speeds
CREATE TABLE IF NOT EXISTS machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
  machine_type VARCHAR(100) NOT NULL,
  speed_standard NUMERIC(10, 2),
  speed_unit VARCHAR(30) DEFAULT 'RPM',
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR(100) DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(100) DEFAULT 'system',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.5 Looms Master
CREATE TABLE IF NOT EXISTS looms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  loom_type VARCHAR(50) NOT NULL CHECK (loom_type IN ('Broad Loom', 'Narrow Loom', 'Circular', 'STB', 'Ordinary')),
  shed VARCHAR(50),
  standard_rpm NUMERIC(10, 2) DEFAULT 140,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR(100) DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(100) DEFAULT 'system',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.6 Qualities & Count Master
CREATE TABLE IF NOT EXISTS quality_masters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(100),
  nominal_count NUMERIC(10, 2),
  standard_mr NUMERIC(5, 2) DEFAULT 16.00,
  warp_count NUMERIC(10, 2),
  weft_count NUMERIC(10, 2),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR(100) DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(100) DEFAULT 'system',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.7 Finished Product Specifications
CREATE TABLE IF NOT EXISTS product_specifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quality_id UUID NOT NULL REFERENCES quality_masters(id) ON DELETE RESTRICT,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  specified_length_cm NUMERIC(10, 2),
  specified_width_cm NUMERIC(10, 2),
  specified_weight_gms NUMERIC(10, 2),
  specified_picks NUMERIC(8, 2),
  specified_ends NUMERIC(8, 2),
  nominal_bale_weight_kg NUMERIC(10, 2),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR(100) DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(100) DEFAULT 'system',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.8 SQC Standards & Quality Tolerances
CREATE TABLE IF NOT EXISTS standard_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_code VARCHAR(50) UNIQUE NOT NULL,
  form_code VARCHAR(30) NOT NULL, -- e.g. FORM-01 to FORM-36
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  quality_id UUID REFERENCES quality_masters(id) ON DELETE SET NULL,
  name VARCHAR(150) NOT NULL,
  parameter VARCHAR(100) NOT NULL,
  nominal_value NUMERIC(12, 4) NOT NULL,
  lower_limit NUMERIC(12, 4) NOT NULL,
  upper_limit NUMERIC(12, 4) NOT NULL,
  tolerance VARCHAR(100) NOT NULL,
  unit VARCHAR(30) NOT NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  revision_number INT NOT NULL DEFAULT 1,
  approved_by VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR(100) DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(100) DEFAULT 'system',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. CORE INSPECTIONS REPOSITORY

CREATE TABLE IF NOT EXISTS inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_no VARCHAR(100) UNIQUE NOT NULL,
  form_id VARCHAR(50) NOT NULL,
  form_code VARCHAR(30) NOT NULL,   -- e.g. FORM-01 .. FORM-36
  form_title VARCHAR(200) NOT NULL,
  
  -- Structural References
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
  shift_id VARCHAR(20) NOT NULL,    -- 'A', 'B', 'C', 'General'
  shift_name VARCHAR(50) NOT NULL,
  
  -- Quality & Machinery References
  quality_id UUID REFERENCES quality_masters(id) ON DELETE SET NULL,
  product_spec_id UUID REFERENCES product_specifications(id) ON DELETE SET NULL,
  machine_id UUID REFERENCES machines(id) ON DELETE SET NULL,
  loom_id UUID REFERENCES looms(id) ON DELETE SET NULL,
  godown_id VARCHAR(100),
  
  -- Inspector & Date
  inspector_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  inspector_name VARCHAR(100) NOT NULL,
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  inspection_time TIME NOT NULL DEFAULT CURRENT_TIME,
  
  -- Workflow & QC Evaluation
  status inspection_status_enum NOT NULL DEFAULT 'Draft',
  result inspection_result_enum NOT NULL DEFAULT 'PASS',
  standard_version_id UUID REFERENCES standard_definitions(id) ON DELETE SET NULL,
  
  -- Flexible Form Payloads (Digitized 36 Forms)
  form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  reading_rows JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Remarks & Review Cycle
  remarks TEXT,
  correction_remarks TEXT,
  approval_remarks TEXT,
  version INT NOT NULL DEFAULT 1,
  
  -- Sign-off Trail
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(100) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_by VARCHAR(100),
  submitted_at TIMESTAMPTZ,
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMPTZ,
  approved_by VARCHAR(100),
  approved_at TIMESTAMPTZ,
  rejected_by VARCHAR(100),
  rejected_at TIMESTAMPTZ
);

-- 5. AUDIT LOG & COMPLIANCE TRAIL (IMMUTABLE)

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id VARCHAR(100) NOT NULL,
  user_email VARCHAR(150) NOT NULL,
  user_role VARCHAR(50) NOT NULL,
  action audit_action_enum NOT NULL,
  module VARCHAR(100) NOT NULL,
  record_id VARCHAR(100),
  details TEXT NOT NULL,
  previous_state JSONB,
  new_state JSONB
);

-- 6. NOTIFICATIONS & ALERTS

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  link_url VARCHAR(255),
  recipient_role user_role_enum,
  recipient_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. APPLICATION SETTINGS

CREATE TABLE IF NOT EXISTS app_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Single-row configuration pattern
  company_name VARCHAR(150) NOT NULL DEFAULT 'BALLY JUTE COMPANY LIMITED',
  company_subtitle VARCHAR(150) NOT NULL DEFAULT 'Statistical Quality Control (S.Q.C.) Department',
  address TEXT NOT NULL DEFAULT 'P.O. Bally, Dist. Howrah, West Bengal, PIN - 711201',
  inspection_prefix VARCHAR(50) NOT NULL DEFAULT 'SQC/2026-27/',
  financial_year VARCHAR(30) NOT NULL DEFAULT '2026-2027',
  enable_offline_cache BOOLEAN NOT NULL DEFAULT TRUE,
  require_dual_approval BOOLEAN NOT NULL DEFAULT FALSE,
  auto_approve_pass BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by VARCHAR(100) DEFAULT 'Super Admin'
);

-- 8. INDEXES FOR HIGH-PERFORMANCE MILL FLOOR LOOKUPS
CREATE INDEX IF NOT EXISTS idx_inspections_form_code ON inspections(form_code);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);
CREATE INDEX IF NOT EXISTS idx_inspections_result ON inspections(result);
CREATE INDEX IF NOT EXISTS idx_inspections_date ON inspections(inspection_date DESC);
CREATE INDEX IF NOT EXISTS idx_inspections_department ON inspections(department_id);
CREATE INDEX IF NOT EXISTS idx_inspections_quality ON inspections(quality_id);
CREATE INDEX IF NOT EXISTS idx_inspections_form_data_gin ON inspections USING GIN (form_data);
CREATE INDEX IF NOT EXISTS idx_inspections_summary_gin ON inspections USING GIN (summary_metrics);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- 9. AUTO-UPDATE TIMESTAMP FUNCTION & TRIGGERS
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_departments_updated_at ON departments;
CREATE TRIGGER trg_departments_updated_at
BEFORE UPDATE ON departments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_sections_updated_at ON sections;
CREATE TRIGGER trg_sections_updated_at
BEFORE UPDATE ON sections
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_machines_updated_at ON machines;
CREATE TRIGGER trg_machines_updated_at
BEFORE UPDATE ON machines
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_looms_updated_at ON looms;
CREATE TRIGGER trg_looms_updated_at
BEFORE UPDATE ON looms
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_quality_masters_updated_at ON quality_masters;
CREATE TRIGGER trg_quality_masters_updated_at
BEFORE UPDATE ON quality_masters
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_product_specifications_updated_at ON product_specifications;
CREATE TRIGGER trg_product_specifications_updated_at
BEFORE UPDATE ON product_specifications
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_standard_definitions_updated_at ON standard_definitions;
CREATE TRIGGER trg_standard_definitions_updated_at
BEFORE UPDATE ON standard_definitions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_inspections_updated_at ON inspections;
CREATE TRIGGER trg_inspections_updated_at
BEFORE UPDATE ON inspections
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 10. SEED INITIAL BASELINE CONFIGURATION
INSERT INTO app_settings (id, company_name, company_subtitle, address, inspection_prefix, financial_year)
VALUES (1, 'BALLY JUTE COMPANY LIMITED', 'Statistical Quality Control (S.Q.C.) Department', 'P.O. Bally, Dist. Howrah, West Bengal, PIN - 711201', 'SQC/2026-27/', '2026-2027')
ON CONFLICT (id) DO NOTHING;
