# No-Ban Rules

Rules the agent must never violate. Checked every 30 minutes automatically.
If any rule is breached — agent pauses itself and alerts Sami.

## Hard limits (zero tolerance)

- **No proactive first messages** — agent never opens a fresh conversation
- **No duplicate messages** — same text sent to 3+ different people = bulk pattern
- **No ban-related errors** — if WhatsApp returns spam/blocked/rate errors, stop immediately

## Volume limits (per hour)

- Max **20 messages sent** in any 60-minute window
- Max **5 messages** in any 5-minute window (burst check)

## What triggers a pause + alert

1. Proactive outreach detected in logs (`[proactive] Initiating`)
2. More than 20 replies sent in the last hour
3. More than 5 messages in any 5-minute window
4. Same message body sent to 3 or more different leads
5. Any error containing: spam / banned / blocked / rate limit

## Recovery

1. Sami reviews what triggered the alert
2. Fixes the root cause if needed
3. Turns agent back ON from the dashboard (or: `AGENT_PAUSED=0` in .env)
