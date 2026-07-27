-- Run this SQL in your Supabase SQL Editor to create the table

CREATE TABLE field_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Main Info
  status_crew TEXT,
  date_assign DATE,
  for_check BOOLEAN DEFAULT false,
  date_executed DATE,
  type_of_meter TEXT,
  job_description TEXT,
  crew_name TEXT,
  location TEXT,
  service_number TEXT,
  field_order_no TEXT,

  -- Remove Meter
  remove_meter TEXT,
  r_serial_number TEXT,
  demand_seal_aerolock TEXT,
  removed_seal TEXT,
  cabinet_seal_remove TEXT,
  reading_kwh TEXT,

  -- New Installed Meter
  ins_meter TEXT,
  ins_serial_number TEXT,
  demand_seal_installed TEXT,
  installed_seal TEXT,
  cabinet_seal_installed TEXT,
  tln_tag TEXT,
  pole_tag TEXT,
  booba_number TEXT,
  mdltr_no TEXT,
  aging INTEGER,
  witness_date DATE,

  -- Remarks & Batch
  remarks TEXT,
  mflt_checklist BOOLEAN DEFAULT false,
  fo_type TEXT,
  billed_amount DECIMAL(10,2),
  for_batch TEXT,
  date_returned DATE,
  crew_payrol DECIMAL(10,2),
  percentage TEXT,
  pluscode TEXT,
  archived_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE field_orders ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (adjust as needed for your auth setup)
CREATE POLICY "Allow all" ON field_orders FOR ALL USING (true) WITH CHECK (true);

-- For existing installations, run this once in the Supabase SQL Editor:
-- ALTER TABLE field_orders ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;
