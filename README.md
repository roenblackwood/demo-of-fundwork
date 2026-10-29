# Fundwork

A mobile-first demo of a two-sided marketplace. Investors deploy Bitcoin capital. Workers are paid in a stable unit they can spend, and projects sit on the ground: places to stay, farms and food, power, water, internet, schools, and clinics. Jamaica is the deep demo, with all 14 parishes. Underneath, Fundwork keeps a simple ownership record in the same spirit as LaunchLine Equity Units.

This is a demo. No Bitcoin moves, no stable unit is issued, no ID is checked, and nothing is written to LaunchLine. The product name is Fundwork. This repository is the demo of Fundwork. It is not inside the LaunchLine repository.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 on a phone, or use a narrow browser window. The layout stays a single column.

```bash
npm run check:seed
npm run build
```

## Run it live

Demo mode needs none of this. With no Supabase keys, the app stays on this phone.

To use real accounts and a shared database:

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`. Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
3. In Supabase, add your site URL, and add `http://localhost:3000/auth/callback` to the redirect list. Add the Vercel URL the same way when you deploy.
4. Run the migration with `supabase db push`, or paste `supabase/migrations/0001_init.sql` into the SQL editor.
5. Run `npm run seed:live`. That upserts the sample projects only. It does not create users.
6. Add the same three variables in Vercel.

The service role key stays in the seed script. Do not put it in a `NEXT_PUBLIC_` variable. Do not commit `.env.local`.

## How to walk through it

The home screen is a world map. Tap a region. The map zooms to that region's countries. Tap a country, then choose invest or work.

The regions are the Caribbean, Latin America, Africa, the Middle East, Eastern Europe, South Asia, and Southeast Asia. Each region has two or three countries. Jamaica opens into parishes and towns. Other countries open into one or two cities. The map is Natural Earth, drawn with react-simple-maps from `src/lib/maps/countries-50m.json`. It is not a live GIS service.

**Jamaica, then I want to invest.** Pick a parish, a town, and either places to stay or farms and food. Open a project, then commit one of the amounts. The commit step says you deploy Bitcoin capital and workers receive a stable unit. Your commitments show under You.

**Another region.** Kenya, Ghana, Indonesia, Colombia, Bangladesh, Jordan, and Moldova each have a sample project. A city with no project points you at the country in that region that has one.

**Jamaica, then I want to work.** Pick a parish, a town, and the work you do. Add a photo if you want, then open a match and log a day, a few days, or a week. Outside Jamaica, the work list leads with the skill that project needs.

The header name opens You. **See an example person** loads a sample record:

| Person | What you will see |
| --- | --- |
| Marcia Bennett | Verified investor with two commitments |
| Andre Lewis | Verified investor with one commitment |
| Keisha Palmer | Verified builder with ownership units |
| Omar Grant | Verified farmer with ownership units |
| Amina Diallo | Verified investor in Kisumu |
| Kwesi Mensah | Verified water worker in Tamale |

**Start this demo over** clears this phone's saved demo data.

Try a town with no open project, such as Brown's Town, to see the "look at the rest of the parish" step. Junction Greenhouse Greens already has the money it asked for, so the commit step stays closed and work can still be logged.

## What is mocked

**Auth.** There is no password. The app remembers a person in `localStorage` under `fundwork-demo-v1`. Choosing an example person only switches which seed records are shown.

**AI.** There is no chatbot. Short notes come from `src/lib/ai.ts`:

- a plain-language project summary
- a one-sentence reason a project fits the work you picked
- a photo tip for the skill you picked
- a short explanation of a tourist licence, farm papers, a parish letter, a health check, an engineer visit, or a community letter, and only on projects that have that check

Those functions return `{ title, body }`. The words are fixtures in the seed and in that file, not a live model call. To connect a model later, replace the body of those functions with a **server-side** call. Keep the key off the browser:

- `XAI_API_KEY`
- `POST https://api.x.ai/v1/chat/completions`
- model id from the current docs at https://docs.x.ai

Ask for the same short shape. Do not add a global chat box.

## Starter guides

`data/guides.json` is the checked list. It has one entry for each country and sector we have looked up. Jamaica is filled in for places to stay, farms, power, water, internet, schools, and clinics. Other countries have no entry.

`src/lib/ai.ts` writes the card from that list with a template. The demo uses the template. It does not call a model, and it does not put fees or processing times in the list. Amounts on the card, when they show, come from projects already on Fundwork.

If `XAI_API_KEY`, `FUNDWORK_AI_MODEL`, and `NEXT_PUBLIC_FUNDWORK_AI=on` are all set, the browser asks `POST /api/guide` to rewrite the summary and a few lines in plainer words. The key stays on the server. The model cannot add checks, offices, steps, skills, or numbers. If the rewrite is late, empty, or adds a fact, the template stays.

**Money and files.** Commitments and logged work are saved on this phone. A photo under 800KB is kept as a preview. A larger photo keeps the file name only. Jamaica amounts stay in Jamaican dollars. Other countries use their own currency prefix, still as a plain amount. The screen calls the worker payout a stable unit. No Bitcoin is priced, held, or sent.

## Capital and the stable unit

Two layers, kept in plain language on the screen:

- Bitcoin is the capital. Investors deploy it.
- A stable unit is what workers receive and spend. The intended asset is a stablecoin backed by a Bitcoin treasury. The demo does not name a coin.

The home screen says: "Funded with Bitcoin capital. Workers paid in a stable unit." The commit step says: "You deploy Bitcoin capital. Workers receive a stable unit." How the money works sits under How it works on the project page. There is no chat box.

## Ownership, and the later LaunchLine connection

Each project in this demo has a fixed pool of 10,000 ownership units:

- 1,000 set aside for Fundwork
- 5,500 set aside for people who fund it
- 3,500 set aside for people who do the work

That split is a display rule so the screen can stay simple. It is not LaunchLine's ownership cap, and the screen does not say "shares" or "stock". On a project, the three-part bar is one tap away under How it works. The project page says "Your work turns into ownership units." for someone who came to work.

Funder units are your part of the project's money goal, out of the 5,500. A day of work is 8 units, a few days is 24, and a full week is 40, out of the 3,500. Units count as yours only after the organizer accepts them. Until then the status is **Capital waiting on the organizer** or **Work waiting on the organizer**.

The math lives in `src/lib/ownership.ts`. The UI says "ownership units". Equity Units is the LaunchLine name for the same idea, and it stays in this README on purpose.

| Fundwork demo | LaunchLine later |
| --- | --- |
| Commitment still waiting | Not on the ledger yet |
| Accepted commitment | Investor tranche on `euLedgerTranches` |
| Logged work, not accepted yet | No `euClaims` row yet |
| Accepted work | An `euClaims` row, then a worker tranche |
| Fundwork's set-aside | Not an earned user balance. Decide the platform tranche separately |
| Vested and unvested | Not simulated here. LaunchLine already splits those on the ledger |

`euClaims` is LaunchLine's per-task log. `euLedgerTranches` is the ownership balance. A later connection should send accepted commitments and accepted contributions into that ledger, and let LaunchLine decide the balances. This demo never calls LaunchLine.

## Seed data

`data/seed.json` holds:

- Jamaica's 14 parishes, each with 3 to 5 towns
- 20 more countries, each with 1 or 2 cities
- 15 projects across lodging, farms, power, water, internet, schools, and clinics
- 6 sample people
- their commitments and contributions

`npm run check:seed` checks the parish count, the countries, and that every project points at a real place. Jamaica tourist and farm checks stay on Jamaica projects.

## Stack

Next.js App Router, TypeScript, Tailwind CSS, and shadcn/ui. Buttons, inputs, badges, and progress are sized for thumbs and for a 18px base on a phone. State that changes during the demo stays in the browser. The seed file is the database.
