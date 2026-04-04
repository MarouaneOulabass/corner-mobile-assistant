-- Corner Mobile — Seed Data

-- Stores
INSERT INTO stores (id, name, location) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Corner Mobile M1', 'Centre Commercial Aït Baha, Rabat'),
  ('a0000000-0000-0000-0000-000000000002', 'Corner Mobile M2', 'Centre Commercial Oued Dahab, Rabat')
ON CONFLICT DO NOTHING;

-- Users (password: "corner2024" hashed with bcrypt)
-- Using a placeholder hash — will be replaced with proper bcrypt hash via API
INSERT INTO users (id, email, name, role, store_id, password_hash) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'admin@cornermobile.ma', 'Admin Corner', 'superadmin', 'a0000000-0000-0000-0000-000000000001', '$2b$10$placeholder_hash_admin'),
  ('b0000000-0000-0000-0000-000000000002', 'manager.m1@cornermobile.ma', 'Youssef Manager', 'manager', 'a0000000-0000-0000-0000-000000000001', '$2b$10$placeholder_hash_mgr1'),
  ('b0000000-0000-0000-0000-000000000003', 'manager.m2@cornermobile.ma', 'Karim Manager', 'manager', 'a0000000-0000-0000-0000-000000000002', '$2b$10$placeholder_hash_mgr2'),
  ('b0000000-0000-0000-0000-000000000004', 'seller.m1@cornermobile.ma', 'Ahmed Vendeur', 'seller', 'a0000000-0000-0000-0000-000000000001', '$2b$10$placeholder_hash_sel1'),
  ('b0000000-0000-0000-0000-000000000005', 'seller.m2@cornermobile.ma', 'Omar Vendeur', 'seller', 'a0000000-0000-0000-0000-000000000002', '$2b$10$placeholder_hash_sel2')
ON CONFLICT DO NOTHING;
