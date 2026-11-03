create extension if not exists pgcrypto;

create type public.account_type as enum ('manufacturer', 'stockist', 'retailer');
create type public.verification_status as enum ('pending', 'under_review', 'verified', 'rejected');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  account_type public.account_type not null,
  full_name text not null,
  business_name text not null,
  email text unique not null,
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  avatar_url text,
  verification_status public.verification_status not null default 'pending',
  rejection_reason text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.business_details (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique not null references public.profiles(id) on delete cascade,
  gst_no text unique not null check (gst_no ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  drug_license_no text unique not null,
  drug_license_no_secondary text,
  drug_license_type text,
  drug_license_expiry date not null,
  pan_no text,
  fssai_no text,
  license_document_url text,
  gst_certificate_url text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  pincode text check (pincode is null or pincode ~ '^[0-9]{6}$'),
  country text not null default 'India',
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.manufacturer_details (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  manufacturing_license_no text not null,
  who_gmp_certified boolean not null default false,
  plant_address text,
  product_categories text[] not null default '{}',
  annual_capacity text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.stockist_details (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  warehouse_address text,
  storage_capacity text,
  cold_chain_available boolean not null default false,
  serviceable_pincodes text[] not null default '{}',
  authorized_manufacturers uuid[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.retailer_details (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  store_name text not null,
  pharmacist_name text not null,
  pharmacist_registration_no text not null,
  store_type text not null check (store_type in ('pharmacy', 'hospital', 'clinic')),
  preferred_stockist_ids uuid[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.verification_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (action in ('approved', 'rejected', 'submitted', 'under_review')),
  performed_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default timezone('utc', now())
);

create index profiles_account_type_idx on public.profiles(account_type);
create index profiles_verification_status_idx on public.profiles(verification_status);
create index business_details_gst_no_idx on public.business_details(gst_no);
create index business_details_drug_license_no_idx on public.business_details(drug_license_no);
create index verification_logs_profile_id_idx on public.verification_logs(profile_id);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger business_details_set_updated_at
before update on public.business_details
for each row execute function public.set_updated_at();

create trigger manufacturer_details_set_updated_at
before update on public.manufacturer_details
for each row execute function public.set_updated_at();

create trigger stockist_details_set_updated_at
before update on public.stockist_details
for each row execute function public.set_updated_at();

create trigger retailer_details_set_updated_at
before update on public.retailer_details
for each row execute function public.set_updated_at();
