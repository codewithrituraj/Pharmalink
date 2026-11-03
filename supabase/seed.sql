-- Demo-only seed for a local Supabase project. All credentials below are fake.
-- The administrator is identified by SUPABASE_ADMIN_EMAILS, not account_type.
do $$
declare
  admin_id uuid := '00000000-0000-0000-0000-000000000001';
  manufacturer_id uuid := '00000000-0000-0000-0000-000000000002';
  stockist_id uuid := '00000000-0000-0000-0000-000000000003';
  retailer_id uuid := '00000000-0000-0000-0000-000000000004';
  password_hash text := crypt('password@123', gen_salt('bf'));
begin
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    (admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@pharmalink.com', password_hash, now(), '{"provider":"email","providers":["email"]}', '{"account_type":"retailer","full_name":"PharmaLink Admin","business_name":"PharmaLink Platform","phone":"+919000000001"}', now(), now()),
    (manufacturer_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manufacturer@example.com', password_hash, now(), '{"provider":"email","providers":["email"]}', '{"account_type":"manufacturer","full_name":"Asha Mehta","business_name":"Apex Pharma","phone":"+919000000002"}', now(), now()),
    (stockist_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'stockist@example.com', password_hash, now(), '{"provider":"email","providers":["email"]}', '{"account_type":"stockist","full_name":"Rohan Shah","business_name":"City Med Distributors","phone":"+919000000003"}', now(), now()),
    (retailer_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'retailer@example.com', password_hash, now(), '{"provider":"email","providers":["email"]}', '{"account_type":"retailer","full_name":"Neha Rao","business_name":"CarePoint Pharmacy","phone":"+919000000004"}', now(), now())
  on conflict (id) do nothing;

  insert into public.business_details (profile_id, gst_no, drug_license_no, drug_license_type, drug_license_expiry, city, state, pincode)
  values
    (admin_id, '27ABCDE1234F1Z5', 'ADMIN-DL-001', 'retail', current_date + 365, 'Pune', 'Maharashtra', '411001'),
    (manufacturer_id, '29FGHIJ5678K1Z2', 'MFR-DL-002', 'manufacturing', current_date + 365, 'Bengaluru', 'Karnataka', '560001'),
    (stockist_id, '07KLMNO9012P1Z8', 'STK-DL-003', 'wholesale', current_date + 365, 'New Delhi', 'Delhi', '110001'),
    (retailer_id, '24QRSTU3456V1Z6', 'RTL-DL-004', 'retail', current_date + 365, 'Ahmedabad', 'Gujarat', '380001')
  on conflict (profile_id) do nothing;

  insert into public.manufacturer_details (profile_id, manufacturing_license_no, product_categories)
  values (manufacturer_id, 'MFR-DL-002', array['tablets','capsules'])
  on conflict (profile_id) do nothing;
  insert into public.stockist_details (profile_id, warehouse_address, serviceable_pincodes)
  values (stockist_id, 'Industrial Area, New Delhi', array['110001','110002'])
  on conflict (profile_id) do nothing;
  insert into public.retailer_details (profile_id, store_name, pharmacist_name, pharmacist_registration_no, store_type)
  values (retailer_id, 'CarePoint Pharmacy', 'Neha Rao', 'PH-REG-004', 'pharmacy'),
         (admin_id, 'PharmaLink Platform', 'PharmaLink Admin', 'ADMIN-REG-001', 'pharmacy')
  on conflict (profile_id) do nothing;
end $$;
