# AIforSaudi

AIforSaudi is a Saudi-focused applied AI education site for founders, operators, engineers, doctors, businesses, and institutions.

The app is built with Next.js App Router and deployed on Vercel.

## Current App

- `app/page.tsx` - AIforSaudi landing page
- `app/api/applications/route.ts` - application form receiver
- `app/thank-you/page.tsx` - post-application thank-you page
- `app/programs/[slug]/page.tsx` - role-track program pages
- `app/data/programs.ts` - shared program data
- `styles.css` - shared site styling imported by `app/globals.css`
- `public/brand/` - AIforSaudi brand assets

## Application Backend

The application form posts to:

```text
/api/applications/
```

The route validates the required form fields and redirects successful submissions to:

```text
/thank-you?status=received
```

Optional delivery integrations can be configured with Vercel environment variables:

- `APPLICATION_WEBHOOK_URL` - forwards submissions to a webhook as JSON
- `RESEND_API_KEY` and `APPLICATION_TO_EMAIL` - emails submissions through Resend
- `APPLICATION_FROM_EMAIL` - optional sender override for Resend

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
