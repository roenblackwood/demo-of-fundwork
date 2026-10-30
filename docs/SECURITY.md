# Fundwork keys

Fundwork does not hold a key that can move anyone's money. No key held by Fundwork can move anyone's money.

## What keys exist

Two secrets.

The Supabase service role key. The env name is SUPABASE_SERVICE_ROLE_KEY. scripts/seed-supabase.mjs and the server-only module src/lib/supabase/admin.ts read it.

The xAI key. The env name is XAI_API_KEY. The server reads it in src/lib/guide-model.ts when a guide rewrite runs. FUNDWORK_AI_MODEL picks the model. It is not a secret.

FUNDWORK_DOMAIN is not a secret. The intended value on Vercel is fundwork.app. If it is missing, a wallet check does not start.

The anon key is public by design. The env name is NEXT_PUBLIC_SUPABASE_ANON_KEY. It cannot move money.

## Where they live

The service role key and the xAI key live in the Vercel environment only. They are not in git. .env.local stays gitignored.

They are not NEXT_PUBLIC names, so they are not in the browser bundle.

## Who can read them

A person who can open that Vercel project's environment settings can read them.

## How to rotate each one

Do each rotation in one sitting. Each one takes under 30 minutes.

Supabase service role. Open the Supabase project. Go to Project Settings, then API. Roll the service_role key. Paste the new value into Vercel as SUPABASE_SERVICE_ROLE_KEY. Redeploy.

xAI key. Open the xAI console. Create a new key. Replace XAI_API_KEY in Vercel. Redeploy. Revoke the old key.

## What an attacker could and could not do

With the service role key, an attacker could read and write database rows. They could mark a wallet checked. They could write payment rows. They could not sign a Bitcoin transaction or a Base transaction. They could not move anyone's money.

With the xAI key, an attacker could call the model and spend quota. They could rewrite guide prose. They could not read the database. They could not move anyone's money.

No key held by Fundwork can move anyone's money.

## Identity checks

When identity checks come, use a licensed provider. Store only a checked flag and a date. Never store documents.
