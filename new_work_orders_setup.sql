-- Run this once in the Supabase SQL Editor before using New Work Orders.
CREATE TABLE IF NOT EXISTS new_work_orders (LIKE pending_orders INCLUDING ALL);

ALTER TABLE new_work_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all new work orders" ON new_work_orders;
CREATE POLICY "Allow all new work orders"
ON new_work_orders
FOR ALL
USING (true)
WITH CHECK (true);
