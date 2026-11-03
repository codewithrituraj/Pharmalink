# Supabase schema

The paste-ready SQL for Step 3 is in
[`migrations/20261103000000_profiles_and_account_details.sql`](./migrations/20261103000000_profiles_and_account_details.sql).

Run that file in the Supabase SQL Editor, or apply it with the Supabase CLI.
It creates the account and verification enums, profile/detail tables, indexes,
and `updated_at` triggers. Row-level security, auth signup automation, storage
policies, and API/profile wiring are intentionally deferred to Step 4 onward.
