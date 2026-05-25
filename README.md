# AIFORX

AIFORX is an applied AI education platform for non-technical working professionals in India and the Middle East.

The first flagship offer is **AI for Operators**: a Hyderabad-first, 2-day in-person workshop for founder-operators running Rs 1Cr-25Cr businesses.

## Current App

- `app/page.tsx` - AIforX homepage and program selector
- `app/programs/[slug]/page.tsx` - dynamic program pages
- `app/data/programs.ts` - shared program data for homepage, hero rotation, and program routes
- `styles.css` - shared site styling imported by `app/globals.css`
- `AIFORX_CONTEXT.md` - durable project positioning context
- `docs/offer/offer-brief.md` - full cohort 1 offer definition
- `docs/curriculum/workshop-agenda.md` - 2-day workshop agenda
- `docs/sales/application-form.md` - application form questions and scoring
- `docs/sales/sales-call-script.md` - qualification and close script
- `docs/delivery/90-day-support-plan.md` - post-workshop support rhythm
- `docs/launch/launch-checklist.md` - launch operations checklist

## Positioning

Not an AI tools workshop. Not an AI engineering bootcamp.

AIFORX teaches founder-operators how to use AI inside real business workflows: ops, sales, hiring, reporting, delegation, and owner bandwidth.

## Cohort 1 Defaults

- Offer: AI for Operators
- Location: Hyderabad
- Format: 2 days in person, Saturday-Sunday
- Price: Rs 60,000 full pay only
- Cohort: 25-35 founder-operators
- Support: 90 days, WhatsApp group, 6 biweekly clinics
- Tools: ChatGPT/Claude/Gemini, Google Sheets, Docs, Forms

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Production check:

```bash
npm run build
```
