# Fundwork

A mobile-first demo of a two-sided marketplace for Jamaica. Investors deploy Bitcoin capital. Workers are paid in a stable unit they can spend, and real projects sit on the ground (places to stay, and farms and food). Underneath, Fundwork keeps a simple ownership record in the same spirit as LaunchLine Equity Units.

This is a demo. No Bitcoin moves, no stable unit is issued, no ID is checked, and nothing is written to LaunchLine. The product name is Fundwork. The project folder is still `parishline`.

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

## How to walk through it

The home screen is a world map. Tap a region first.

The five regions are the Caribbean, Latin America, Africa, South Asia, and Southeast Asia. Only the Caribbean is open in this demo. The others say so, and offer a way back to the Caribbean. The map is a lightweight SVG in `src/components/region-map.tsx`. It is not a GIS library.

**Caribbean, then I want to invest.** Pick a Jamaica parish, a town, and either places to stay or farms and food. Open a project, then commit one of the amounts. The commit step says you deploy Bitcoin capital and workers receive a stable unit. Your commitments show under You.

**Caribbean, then I want to work.** Pick a parish, a town, and the work you do. Add a photo if you want, then open a match and log a day, a few days, or a week.

The header name opens You. **See an example person** loads a sample record:

| Person | What you will see |
| --- | --- |
| Marcia Bennett | Verified investor with two commitments |
| Andre Lewis | Verified investor with one commitment |
| Keisha Palmer | Verified builder with ownership units |
| Omar Grant | Verified farmer with ownership units |

**Start this demo over** clears this phone's saved demo data.

Try a town with no open project, such as Brown's Town, to see the "look at the rest of the parish" step. Junction Greenhouse Greens already has the money it asked for, so the commit step stays closed and work can still be logged.

## What is mocked

**Auth.** There is no password. The app remembers a person in `localStorage` under `fundwork-demo-v1`. Choosing an example person only switches which seed records are shown.

**AI.** There is no chatbot. Short notes come from `src/lib/ai.ts`:

- a plain-language project summary
- a one-sentence reason a project fits the work you picked
- a photo tip for the skill you picked
- a short explanation of a tourist licence, farm papers, a parish letter, or a health check, and only on projects that have that check

Those functions return `{ title, body }`. The words are fixtures in the seed and in that file, not a live model call. To connect a model later, replace the body of those functions with a **server-side** call. Keep the key off the browser:

- `XAI_API_KEY`
- `POST https://api.x.ai/v1/chat/completions`
- model id from the current docs at https://docs.x.ai

Ask for the same short shape. Do not add a global chat box.

**Money and files.** Commitments and logged work are saved on this phone. A photo under 800KB is kept as a preview. A larger photo keeps the file name only. Project goals stay in Jamaican dollars so the amounts are easy to read. No Bitcoin is priced, held, or sent.

## Capital and the stable unit

Two layers, kept in plain language on the screen:

- Bitcoin is the capital. Investors deploy it.
- A stable unit is what workers receive and spend. The intended asset is a stablecoin backed by a Bitcoin treasury. The demo does not name a coin.

The line on project cards and project pages is: "Funded with Bitcoin capital. Workers paid in a stable unit." The commit step uses: "You deploy Bitcoin capital. Workers receive a stable unit." A short note under "How the money works" is one tap away. There is no chat box.

## Ownership, and the later LaunchLine connection

Each project in this demo has a fixed pool of 10,000 ownership units:

- 1,000 set aside for Fundwork
- 5,500 set aside for people who fund it
- 3,500 set aside for people who do the work

That split is a display rule so the screen can stay simple. It is not LaunchLine's ownership cap, and the screen does not say "shares" or "stock". On a project or a contribution, the three-part bar is one tap away under "Who this belongs to". The sentence on the work path is "Your work turns into ownership units."

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

- Jamaica's 14 parishes, each with 3 to 5 towns, reached from the Caribbean region
- 8 projects in lodging and agriculture inside that region
- 4 sample people
- their commitments and contributions

`npm run check:seed` checks the parish count, town counts, and that every project points at a real town.

## Stack

Next.js App Router, TypeScript, Tailwind CSS, and shadcn/ui. Buttons, inputs, badges, and progress are sized for thumbs and for a 18px base on a phone. State that changes during the demo stays in the browser. The seed file is the database.
