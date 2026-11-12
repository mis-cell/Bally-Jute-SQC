-- ==============================================================================
-- SQC - STATISTICAL QUALITY CONTROL SYSTEM
-- Target Server: BJCL
-- Target Database: "IT SQC"
-- ==============================================================================
-- To create and connect to the database in PostgreSQL psql terminal:
--   CREATE DATABASE "IT SQC";
--   \c "IT SQC"
-- ==============================================================================

-- 1. USERS & AUTHENTICATION TABLE
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(100) PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    employee_code VARCHAR(50),
    display_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'Inspector',
    department_id VARCHAR(100),
    department_name VARCHAR(150),
    phone VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ensure columns exist for seamless schema upgrades
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_code VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'Inspector';
ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS department_name VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_emp_code ON users (employee_code);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);

-- 2. USER FORM PERMISSIONS TABLE (Granular Per-Form Access: FORM-01 to FORM-37)
CREATE TABLE IF NOT EXISTS user_form_permissions (
    user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    form_code VARCHAR(50) NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    granted_by VARCHAR(100),
    PRIMARY KEY (user_id, form_code)
);

CREATE INDEX IF NOT EXISTS idx_user_perms_uid ON user_form_permissions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_perms_form ON user_form_permissions (form_code);

-- 3. DEPARTMENTS TABLE
CREATE TABLE IF NOT EXISTS departments (
    id VARCHAR(100) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    hod_name VARCHAR(150),
    order_index INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'Active',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE departments ADD COLUMN IF NOT EXISTS code VARCHAR(50);
ALTER TABLE departments ADD COLUMN IF NOT EXISTS name VARCHAR(150);
ALTER TABLE departments ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS hod_name VARCHAR(150);
ALTER TABLE departments ADD COLUMN IF NOT EXISTS order_index INT DEFAULT 0;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active';
ALTER TABLE departments ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE departments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_departments_code ON departments (code);

-- 4. SECTIONS TABLE
CREATE TABLE IF NOT EXISTS sections (
    id VARCHAR(100) PRIMARY KEY,
    department_id VARCHAR(100),
    department_code VARCHAR(50),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE sections ADD COLUMN IF NOT EXISTS department_id VARCHAR(100);
ALTER TABLE sections ADD COLUMN IF NOT EXISTS department_code VARCHAR(50);
ALTER TABLE sections ADD COLUMN IF NOT EXISTS code VARCHAR(50);
ALTER TABLE sections ADD COLUMN IF NOT EXISTS name VARCHAR(150);
ALTER TABLE sections ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE sections ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE sections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_sections_code ON sections (code);
CREATE INDEX IF NOT EXISTS idx_sections_dept ON sections (department_id);

-- 5. MACHINES TABLE
CREATE TABLE IF NOT EXISTS machines (
    id VARCHAR(100) PRIMARY KEY,
    department_id VARCHAR(100),
    department_code VARCHAR(50),
    section_id VARCHAR(100),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(100),
    machine_type VARCHAR(100),
    capacity VARCHAR(100),
    speed_standard NUMERIC DEFAULT 0,
    speed_unit VARCHAR(30) DEFAULT 'rpm',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE machines ADD COLUMN IF NOT EXISTS department_id VARCHAR(100);
ALTER TABLE machines ADD COLUMN IF NOT EXISTS department_code VARCHAR(50);
ALTER TABLE machines ADD COLUMN IF NOT EXISTS section_id VARCHAR(100);
ALTER TABLE machines ADD COLUMN IF NOT EXISTS code VARCHAR(50);
ALTER TABLE machines ADD COLUMN IF NOT EXISTS name VARCHAR(150);
ALTER TABLE machines ADD COLUMN IF NOT EXISTS type VARCHAR(100);
ALTER TABLE machines ADD COLUMN IF NOT EXISTS machine_type VARCHAR(100);
ALTER TABLE machines ADD COLUMN IF NOT EXISTS capacity VARCHAR(100);
ALTER TABLE machines ADD COLUMN IF NOT EXISTS speed_standard NUMERIC DEFAULT 0;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS speed_unit VARCHAR(30) DEFAULT 'rpm';
ALTER TABLE machines ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE machines ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_machines_code ON machines (code);
CREATE INDEX IF NOT EXISTS idx_machines_dept ON machines (department_id);

-- 6. LOOMS TABLE
CREATE TABLE IF NOT EXISTS looms (
    id VARCHAR(100) PRIMARY KEY,
    loom_no VARCHAR(50),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    shed VARCHAR(50),
    shed_type VARCHAR(50),
    loom_type VARCHAR(50),
    reed_space VARCHAR(50),
    rpm INT DEFAULT 140,
    standard_rpm INT DEFAULT 140,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE looms ADD COLUMN IF NOT EXISTS loom_no VARCHAR(50);
ALTER TABLE looms ADD COLUMN IF NOT EXISTS code VARCHAR(50);
ALTER TABLE looms ADD COLUMN IF NOT EXISTS name VARCHAR(150);
ALTER TABLE looms ADD COLUMN IF NOT EXISTS shed VARCHAR(50);
ALTER TABLE looms ADD COLUMN IF NOT EXISTS shed_type VARCHAR(50);
ALTER TABLE looms ADD COLUMN IF NOT EXISTS loom_type VARCHAR(50);
ALTER TABLE looms ADD COLUMN IF NOT EXISTS reed_space VARCHAR(50);
ALTER TABLE looms ADD COLUMN IF NOT EXISTS rpm INT DEFAULT 140;
ALTER TABLE looms ADD COLUMN IF NOT EXISTS standard_rpm INT DEFAULT 140;
ALTER TABLE looms ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE looms ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_looms_code ON looms (code);
CREATE INDEX IF NOT EXISTS idx_looms_loom_no ON looms (loom_no);

-- 7. QUALITIES TABLE
CREATE TABLE IF NOT EXISTS qualities (
    id VARCHAR(100) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50),
    nominal_count NUMERIC(10,2),
    standard_mr NUMERIC(10,2),
    warp_count NUMERIC(10,2),
    weft_count NUMERIC(10,2),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE qualities ADD COLUMN IF NOT EXISTS code VARCHAR(50);
ALTER TABLE qualities ADD COLUMN IF NOT EXISTS name VARCHAR(150);
ALTER TABLE qualities ADD COLUMN IF NOT EXISTS category VARCHAR(50);
ALTER TABLE qualities ADD COLUMN IF NOT EXISTS nominal_count NUMERIC(10,2);
ALTER TABLE qualities ADD COLUMN IF NOT EXISTS standard_mr NUMERIC(10,2);
ALTER TABLE qualities ADD COLUMN IF NOT EXISTS warp_count NUMERIC(10,2);
ALTER TABLE qualities ADD COLUMN IF NOT EXISTS weft_count NUMERIC(10,2);
ALTER TABLE qualities ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE qualities ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE qualities ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_qualities_code ON qualities (code);

-- 8. QUALITY STANDARDS TABLE
CREATE TABLE IF NOT EXISTS quality_standards (
    id VARCHAR(100) PRIMARY KEY,
    standard_code VARCHAR(50),
    form_code VARCHAR(50) NOT NULL,
    department_id VARCHAR(100),
    quality_id VARCHAR(100),
    parameter_name VARCHAR(150),
    parameter VARCHAR(150),
    nominal_value NUMERIC(10,4),
    lower_limit NUMERIC(10,4),
    upper_limit NUMERIC(10,4),
    standard_value NUMERIC(10,4),
    max_value NUMERIC(10,4),
    min_value NUMERIC(10,4),
    tolerance VARCHAR(50),
    tolerance_percentage NUMERIC(6,2),
    unit VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS standard_code VARCHAR(50);
ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS form_code VARCHAR(50);
ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS department_id VARCHAR(100);
ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS quality_id VARCHAR(100);
ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS parameter_name VARCHAR(150);
ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS parameter VARCHAR(150);
ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS nominal_value NUMERIC(10,4);
ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS lower_limit NUMERIC(10,4);
ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS upper_limit NUMERIC(10,4);
ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS standard_value NUMERIC(10,4);
ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS tolerance VARCHAR(50);
ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS unit VARCHAR(50);
ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE quality_standards ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_standards_form ON quality_standards (form_code);
CREATE INDEX IF NOT EXISTS idx_standards_quality ON quality_standards (quality_id);

-- 9. INSPECTIONS MASTER & TRANSACTION TABLE (FORM-01 to FORM-37)
CREATE TABLE IF NOT EXISTS inspections (
    id VARCHAR(100) PRIMARY KEY,
    inspection_no VARCHAR(100) UNIQUE NOT NULL,
    form_id VARCHAR(50) NOT NULL,
    form_code VARCHAR(30) NOT NULL,
    form_title VARCHAR(255) NOT NULL,
    department_id VARCHAR(100),
    department_name VARCHAR(150),
    section_id VARCHAR(100),
    shift_id VARCHAR(50),
    shift_name VARCHAR(100),
    quality_id VARCHAR(100),
    quality_name VARCHAR(150),
    product_spec_id VARCHAR(100),
    product_spec_name VARCHAR(150),
    machine_id VARCHAR(100),
    machine_no VARCHAR(100),
    loom_id VARCHAR(100),
    loom_no VARCHAR(100),
    godown_id VARCHAR(100),
    godown_name VARCHAR(150),
    inspector_id VARCHAR(100),
    inspector_name VARCHAR(150),
    inspection_date VARCHAR(30),
    inspection_time VARCHAR(30),
    status VARCHAR(50) DEFAULT 'Draft',
    result VARCHAR(30) DEFAULT 'PASS',
    form_data JSONB DEFAULT '{}'::jsonb,
    reading_rows JSONB DEFAULT '[]'::jsonb,
    summary_metrics JSONB DEFAULT '{}'::jsonb,
    remarks TEXT,
    correction_remarks TEXT,
    approval_remarks TEXT,
    approved_by VARCHAR(150),
    approved_at TIMESTAMP WITH TIME ZONE,
    version INT DEFAULT 1,
    created_by VARCHAR(150),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(150),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE inspections ADD COLUMN IF NOT EXISTS form_id VARCHAR(50);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS form_code VARCHAR(30);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS form_title VARCHAR(255);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS department_id VARCHAR(100);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS department_name VARCHAR(150);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS section_id VARCHAR(100);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS shift_id VARCHAR(50);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS shift_name VARCHAR(100);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS quality_id VARCHAR(100);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS quality_name VARCHAR(150);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS product_spec_id VARCHAR(100);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS product_spec_name VARCHAR(150);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS machine_id VARCHAR(100);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS machine_no VARCHAR(100);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS loom_id VARCHAR(100);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS loom_no VARCHAR(100);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS godown_id VARCHAR(100);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS godown_name VARCHAR(150);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS inspector_id VARCHAR(100);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS inspector_name VARCHAR(150);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS inspection_date VARCHAR(30);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS inspection_time VARCHAR(30);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Draft';
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS result VARCHAR(30) DEFAULT 'PASS';
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS form_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS reading_rows JSONB DEFAULT '[]'::jsonb;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS summary_metrics JSONB DEFAULT '{}'::jsonb;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS correction_remarks TEXT;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS approval_remarks TEXT;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS approved_by VARCHAR(150);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS created_by VARCHAR(150);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS updated_by VARCHAR(150);
ALTER TABLE inspections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_inspections_no ON inspections (inspection_no);
CREATE INDEX IF NOT EXISTS idx_inspections_form ON inspections (form_code);
CREATE INDEX IF NOT EXISTS idx_inspections_date ON inspections (inspection_date);
CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections (status);
CREATE INDEX IF NOT EXISTS idx_inspections_result ON inspections (result);
CREATE INDEX IF NOT EXISTS idx_inspections_inspector ON inspections (inspector_id);

-- 10. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(100) PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    performed_by_id VARCHAR(100),
    performed_by_name VARCHAR(150),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    details JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp);

-- 11. DEFAULT ADMINISTRATOR SEED
-- Default username: admin
-- Default password: Admin@123456
-- Salted SHA-256 hash: salt:hash
INSERT INTO users (id, username, password_hash, employee_code, display_name, email, role, department_name, is_active)
VALUES (
    'usr-superadmin-01',
    'admin',
    'bjcl_sqc_salt_2026:5d5a621bd54309c980763fcb42e09fd15c0ad7b82994b1ff985b30475b42c2fc',
    'EMP-001',
    'System Administrator',
    'admin@ballyjute.com',
    'SuperAdmin',
    'Administration',
    TRUE
)
ON CONFLICT (username) DO NOTHING;

-- Grant all 38 forms to default administrator
INSERT INTO user_form_permissions (user_id, form_code, granted_by)
SELECT 'usr-superadmin-01', f.code, 'SYSTEM'
FROM (
    VALUES
    ('FORM-01'), ('FORM-02'), ('FORM-03'), ('FORM-04'), ('FORM-05'),
    ('FORM-06'), ('FORM-07'), ('FORM-08'), ('FORM-09'), ('FORM-09 A'),
    ('FORM-09 B'), ('FORM-10'), ('FORM-11'), ('FORM-12'), ('FORM-13'),
    ('FORM-14'), ('FORM-15'), ('FORM-16'), ('FORM-17'), ('FORM-18'),
    ('FORM-19'), ('FORM-20'), ('FORM-21'), ('FORM-22'), ('FORM-23'),
    ('FORM-24'), ('FORM-25'), ('FORM-26'), ('FORM-27'), ('FORM-28'),
    ('FORM-29'), ('FORM-30'), ('FORM-31'), ('FORM-32'), ('FORM-33'),
    ('FORM-34'), ('FORM-35'), ('FORM-36'), ('FORM-37')
) AS f(code)
ON CONFLICT DO NOTHING;
