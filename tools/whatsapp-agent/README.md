# WhatsApp Agent

Local inbound-only WhatsApp assistant for AI for Founders leads.

## Setup

```bash
cd tools/whatsapp-agent
npm install
cp .env.example .env
npm run dry-run
```

Scan the QR code with WhatsApp on your phone:

```text
WhatsApp > Linked devices > Link a device
```

`dry-run` logs suggested replies without sending. When ready:

```bash
npm run live
```

## Safety Rules

- Replies only to inbound direct chats.
- Ignores groups by default.
- If you manually reply in a chat from your phone, the agent pauses that chat.
- Payment details are not sent unless configured in `.env`.
- Unknown, medical, legal, personal, or sensitive messages are escalated in the console.

## Useful Commands

```bash
npm run inbox
```

Shows saved lead statuses from `data/state.json`.
