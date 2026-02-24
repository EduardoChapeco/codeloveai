-- ═══════════════════════════════════════════════════════════
-- Orchestrator Sprint 3
-- pg_cron / pg_net setup + Agent Skills seed + cron job
-- ═══════════════════════════════════════════════════════════

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- ─── Seed Agent Skills ────────────────────────────────────
-- Reusable prompt templates for the orchestrator engine.
-- These are injected automatically based on project signals.
INSERT INTO agent_skills (name, intent, chat_only, prompt_template, tags) VALUES

-- Security
('setup-rls-all', 'security_fix_v2', false,
 'Enable Row Level Security on ALL tables that do not have it enabled yet. For each table, create appropriate RLS policies: SELECT for authenticated users viewing their own data (using auth.uid()), INSERT/UPDATE/DELETE restricted to owners. Add service_role bypass policies where needed. Check that no table is left unprotected.',
 ARRAY['security', 'rls', 'database', 'supabase']),

-- SEO
('seo-full-audit', NULL, false,
 'Perform a complete SEO audit and fix all issues found: add proper <title> and <meta description> tags to all pages, ensure each page has a single <h1>, add og:title og:description og:image meta tags, fix any broken links, ensure images have alt attributes, add structured data (JSON-LD) for the main content type, and ensure proper canonical URLs.',
 ARRAY['seo', 'performance', 'meta', 'accessibility']),

-- Auth
('setup-auth-complete', NULL, false,
 'Implement a complete authentication flow using Supabase Auth: create a Login page with email/password login and Google OAuth, a Register page with email confirmation, password reset flow, protected route wrapper (PrivateRoute component), user session management with useAuth hook, and proper redirect logic.',
 ARRAY['auth', 'supabase', 'login', 'security']),

-- Error handling
('error-boundaries', NULL, false,
 'Add comprehensive error handling throughout the application: React Error Boundaries for route-level error catching, toast notifications (using sonner) for all async operations, loading states for all data fetching, empty state components for lists with no data, and proper TypeScript types for all API responses to prevent runtime errors.',
 ARRAY['ux', 'errors', 'frontend', 'typescript']),

-- Performance
('performance-cwv', NULL, false,
 'Optimize Core Web Vitals: implement React.lazy() and Suspense for all route components, add loading skeletons for data-heavy sections, optimize images with proper sizing and lazy loading, reduce bundle size by removing unused dependencies, add proper caching headers and memoization (useMemo, useCallback) for expensive computations.',
 ARRAY['performance', 'cwv', 'lazy-loading', 'optimization']),

-- Database setup
('database-schema', 'db_migration', false,
 'Create a complete database schema with Supabase migrations: define all necessary tables with proper column types and constraints, add foreign key relationships, create indexes for frequently queried columns, enable RLS on all tables, add updated_at triggers, and seed initial data if needed.',
 ARRAY['database', 'migration', 'supabase', 'schema']),

-- UX improvements
('ux-mobile-responsive', 'ux_improvement', false,
 'Make the entire application fully mobile responsive: replace fixed widths with responsive Tailwind classes, add proper spacing for touch targets (min 44px), implement mobile navigation (hamburger menu or bottom tabs), ensure forms are usable on mobile with proper input types, and test the layout at all breakpoints (sm md lg xl).',
 ARRAY['ux', 'mobile', 'responsive', 'ui'])

ON CONFLICT (name) DO UPDATE SET
  prompt_template = EXCLUDED.prompt_template,
  tags = EXCLUDED.tags;

-- ─── pg_cron: Orchestrator tick every 30 seconds ─────────
-- NOTE: pg_cron on Supabase runs in the cron schema.
-- The tick calls orchestrator-tick edge function via pg_net.
-- This must be run after SUPABASE_URL and SERVICE_ROLE are set as
-- app settings (ALTER SYSTEM SET app.supabase_url = '...')

-- Unschedule if exists, then reschedule
SELECT cron.unschedule('orchestrator-tick-30s') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'orchestrator-tick-30s'
);

-- Schedule tick every minute (pg_cron minimum unit is 1 minute on most Supabase plans)
-- For sub-minute resolution, the tick function self-reschedules via next_tick_at
SELECT cron.schedule(
  'orchestrator-tick-30s',
  '* * * * *', -- every minute
  $$
  SELECT net.http_post(
    url    := current_setting('app.supabase_url', true) || '/functions/v1/orchestrator-tick',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body   := '{}'::jsonb
  ) AS request_id;
  $$
);
