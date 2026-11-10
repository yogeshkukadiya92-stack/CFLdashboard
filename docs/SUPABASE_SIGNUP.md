# Personal signup with Supabase

New email accounts authenticate through Supabase Auth and receive a separate CallFlow tenant. Existing local and CFL company accounts keep their existing login path. Supabase-linked users never receive a local password hash or a local password fallback.

Set runtime variables CALLFLOW_AUTH_PROVIDER=supabase, CALLFLOW_SUPABASE_URL (HTTPS Kong origin), and CALLFLOW_SUPABASE_ANON_KEY. Do not use a service-role key. Startup applies additive migrations before serving requests. Keep the existing DATABASE_URL and signing secrets unchanged.

Android supports immediate login when Supabase auto-confirms email, and a confirmation screen otherwise. Enabling email auto-confirm means email ownership is not verified; the owner explicitly approved this configuration on 2026-11-10.

Validation: production Next.js build, full TypeScript check, six backend tests including real PostgreSQL tenant isolation, duplicate rollback, session rotation and linked-account password fallback prevention; Android auth unit tests pass. Live deployment and live signup still require verification.

Personal accounts start with no company-assigned leads. Existing app restrictions on manual lead creation remain in place; phone calls and account backup use the personal identity. Company introduction sessions are unavailable for personal accounts.
