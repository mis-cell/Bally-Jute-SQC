-- =======================================================================
-- BALLY JUTE SQC - LOCAL POSTGRESQL TABLE SETUP
-- Run this script in pgAdmin 4 (Database: SQC) to create the `inspections` table.
-- =======================================================================

CREATE TABLE IF NOT EXISTS inspections (
    id SERIAL PRIMARY KEY,
    inspection_no VARCHAR(100) UNIQUE NOT NULL,
    form_id VARCHAR(50) NOT NULL,
    form_code VARCHAR(30) NOT NULL,
    form_title VARCHAR(255) NOT NULL,
    department_id VARCHAR(100),
    shift_id VARCHAR(50),
    shift_name VARCHAR(100),
    inspector_id VARCHAR(100),
    inspector_name VARCHAR(150),
    inspection_date VARCHAR(30),
    status VARCHAR(50) DEFAULT 'Draft',
    result VARCHAR(30) DEFAULT 'PASS',
    form_data JSONB DEFAULT '{}'::jsonb,
    reading_rows JSONB DEFAULT '[]'::jsonb,
    summary_metrics JSONB DEFAULT '{}'::jsonb,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for rapid lookup by inspection number, form, and date
CREATE INDEX IF NOT EXISTS idx_inspections_no ON inspections (inspection_no);
CREATE INDEX IF NOT EXISTS idx_inspections_form ON inspections (form_code);
CREATE INDEX IF NOT EXISTS idx_inspections_date ON inspections (inspection_date);
