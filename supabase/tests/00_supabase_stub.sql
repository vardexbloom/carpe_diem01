-- TEST ONLY: imitates the parts of Supabase that the migration depends on.
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create role authenticator login password 'pw' noinherit; grant anon, authenticated, service_role to authenticator;
create schema auth; grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid $$;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
