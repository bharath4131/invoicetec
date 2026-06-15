-- ============================================================
-- supabase_reset.sql — Database Utilities & Reset Queries
-- Run these in your Supabase SQL Editor (https://supabase.com)
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- UTILITY: ENABLE PERMANENT ACCOUNT DELETION FROM CLIENT-SIDE
-- ────────────────────────────────────────────────────────────
-- Execute this SQL block ONCE in your Supabase SQL editor to create
-- the security-definer function. This allows authenticated users to
-- permanently delete their own account and sync data safely.

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- 1. Delete user's row in public sync data table
  DELETE FROM public.user_sync WHERE id = auth.uid();
  
  -- 2. Delete user's account from auth.users
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;


-- ────────────────────────────────────────────────────────────
-- DANGER ZONE: ADMIN DATABASE PURGE
-- ────────────────────────────────────────────────────────────
-- WARNING: Running this block will permanently delete ALL user accounts 
-- and ALL synchronized records from the database. Cannot be undone.

/*
-- 1. Clear all synchronized user data (invoices, customers, settings)
TRUNCATE TABLE public.user_sync;

-- 2. Clear all user authentication accounts (email, passwords, profiles)
DELETE FROM auth.users;
*/
