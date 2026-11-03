create or replace function public.prevent_profile_privilege_changes()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null and auth.uid() = old.id then
    if new.account_type is distinct from old.account_type then
      raise exception 'account_type cannot be changed by the account owner';
    end if;
    if new.verification_status is distinct from old.verification_status then
      raise exception 'verification_status can only be changed by an administrator';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_privilege_changes
before update on public.profiles
for each row execute function public.prevent_profile_privilege_changes();

create or replace function public.create_profile_for_new_user()
returns trigger
security definer set search_path = public
language plpgsql
as $$
begin
  insert into public.profiles (id, account_type, full_name, business_name, email, phone)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'account_type')::public.account_type, 'retailer'),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data ->> 'business_name', ''), split_part(new.email, '@', 1)),
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data ->> 'phone', ''), '+10000000000')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.business_details enable row level security;
alter table public.manufacturer_details enable row level security;
alter table public.stockist_details enable row level security;
alter table public.retailer_details enable row level security;
alter table public.verification_logs enable row level security;

create policy profiles_owner_select on public.profiles for select to authenticated using (auth.uid() = id);
create policy profiles_owner_update on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy business_details_owner_all on public.business_details for all to authenticated
using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy manufacturer_details_owner_all on public.manufacturer_details for all to authenticated
using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy stockist_details_owner_all on public.stockist_details for all to authenticated
using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy retailer_details_owner_all on public.retailer_details for all to authenticated
using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy verification_logs_owner_select on public.verification_logs for select to authenticated
using (auth.uid() = profile_id);

create or replace view public.verified_directory
with (security_invoker = false)
as
select business_name, account_type, bd.city, bd.state
from public.profiles p
left join public.business_details bd on bd.profile_id = p.id
where p.verification_status = 'verified'
  and p.account_type in ('manufacturer', 'stockist')
  and exists (
    select 1 from public.profiles viewer
    where viewer.id = auth.uid()
      and viewer.verification_status = 'verified'
      and viewer.account_type in ('stockist', 'retailer')
  );

grant select on public.verified_directory to authenticated;

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy documents_owner_insert on storage.objects for insert to authenticated
with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy documents_owner_select on storage.objects for select to authenticated
using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy documents_owner_update on storage.objects for update to authenticated
using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy documents_owner_delete on storage.objects for delete to authenticated
using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
