-- Seed the currencies table. accounts.currency defaults to 'USD' and is a
-- foreign key into this table, so without this row account creation fails.
INSERT INTO currencies (code, minor_unit_scale, name) VALUES
  ('USD', 2, 'United States Dollar')
ON CONFLICT (code) DO NOTHING;
