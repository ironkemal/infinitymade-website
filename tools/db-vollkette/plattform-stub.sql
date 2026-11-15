-- TEST STUB of what upstream Supabase init + GoTrue + Storage + Realtime provide BEFORE 0000_baseline.
-- Synthetic, disposable DB only. Not the real services; no GoTrue/Storage behaviour.
\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN NOINHERIT;
CREATE ROLE authenticated NOLOGIN NOINHERIT;
CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
CREATE ROLE supabase_admin SUPERUSER;
CREATE ROLE authenticator NOINHERIT LOGIN;
GRANT anon, authenticated, service_role TO authenticator;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
GRANT USAGE ON SCHEMA public, extensions TO anon, authenticated, service_role;
-- auth (GoTrue owns this in reality)
CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE TABLE auth.users (
  instance_id uuid, id uuid PRIMARY KEY, aud varchar(255), role varchar(255), email varchar(255),
  encrypted_password varchar(255), email_confirmed_at timestamptz, last_sign_in_at timestamptz,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb, is_super_admin boolean, created_at timestamptz DEFAULT now(),
  updated_at timestamptz, phone text, banned_until timestamptz, deleted_at timestamptz, is_anonymous boolean DEFAULT false);
CREATE TABLE auth.sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, created_at timestamptz DEFAULT now());
CREATE TABLE auth.refresh_tokens (id bigserial PRIMARY KEY, token varchar(255), user_id varchar(255), session_id uuid REFERENCES auth.sessions(id) ON DELETE CASCADE, revoked boolean, created_at timestamptz DEFAULT now());
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
CREATE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $$ SELECT auth.jwt() ->> 'email' $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;
-- storage (storage-api owns this in reality)
CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text NOT NULL, owner uuid, public boolean DEFAULT false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets(id),
  name text, owner uuid, metadata jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
GRANT ALL ON storage.objects, storage.buckets TO anon, authenticated, service_role;
-- Same body as Supabase storage.foldername
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE _parts text[]; BEGIN SELECT string_to_array(name, '/') INTO _parts; RETURN _parts[1:array_length(_parts,1)-1]; END $$;
CREATE FUNCTION storage.filename(name text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE _parts text[]; BEGIN SELECT string_to_array(name, '/') INTO _parts; RETURN _parts[array_length(_parts,1)]; END $$;
CREATE FUNCTION storage.extension(name text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE _parts text[]; _filename text; BEGIN SELECT string_to_array(name, '/') INTO _parts; SELECT _parts[array_length(_parts,1)] INTO _filename;
RETURN reverse(split_part(reverse(_filename), '.', 1)); END $$;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA storage TO anon, authenticated, service_role;
-- vault (supabase_vault in reality; NO encryption here)
CREATE SCHEMA vault;
CREATE TABLE vault.secrets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text UNIQUE, description text, secret text NOT NULL,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE VIEW vault.decrypted_secrets AS SELECT id, name, description, secret, secret AS decrypted_secret, created_at, updated_at FROM vault.secrets;
CREATE FUNCTION vault.create_secret(new_secret text, new_name text DEFAULT NULL, new_description text DEFAULT '', new_key_id uuid DEFAULT NULL)
  RETURNS uuid LANGUAGE sql AS $$ INSERT INTO vault.secrets(secret,name,description) VALUES (new_secret,new_name,new_description) RETURNING id $$;
-- realtime
CREATE PUBLICATION supabase_realtime;
