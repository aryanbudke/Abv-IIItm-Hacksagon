# 🔐 Environment Variables Documentation

> **⚠️ IMPORTANT:** Never commit your actual `.env` file to version control. This file documents the required environment variables and their purpose. Copy this as a reference to create your own `.env`.

---

## 📋 Table of Contents

- [Clerk Authentication](#-clerk-authentication)
- [Supabase Database](#-supabase-database)
- [SMTP / Email Configuration](#-smtp--email-configuration)
- [ElevenLabs AI Voice](#-elevenlabs-ai-voice)
- [Twilio SMS / Phone](#-twilio-sms--phone)
- [Quick Setup Template](#-quick-setup-template)

---

## 🔑 Clerk Authentication

Clerk handles user authentication, sign-in/sign-up flows, and webhook events.

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Public key for Clerk (safe to expose to browser) | `pk_test_...` |
| `CLERK_SECRET_KEY` | Secret key for Clerk server-side operations | `sk_test_...` |
| `CLERK_WEBHOOK_SECRET` | Webhook secret for verifying Clerk events | `whsec_...` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Route for the sign-in page | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Route for the sign-up page | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Redirect route after successful sign-in | `/dashboard` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Redirect route after successful sign-up | `/dashboard` |

**How to get these:**
1. Go to [clerk.com](https://clerk.com) → Dashboard → Your App
2. Navigate to **API Keys** section
3. For webhook secret: **Webhooks** → Create endpoint → copy the signing secret

---

## 🗄️ Supabase Database

Supabase provides the PostgreSQL database, real-time subscriptions, and storage.

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (public) | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon/public key for client-side queries | `sb_publishable_...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for server-side admin operations | `sb_secret_...` |

> **⚠️ Warning:** `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security. **Never expose this in the browser.** Only use it in server-side API routes.

**How to get these:**
1. Go to [supabase.com](https://supabase.com) → Your Project
2. Navigate to **Settings → API**
3. Copy the **Project URL**, **anon key**, and **service_role key**

---

## 📧 SMTP / Email Configuration

Used for sending transactional emails (queue notifications, reminders, etc.) via Gmail SMTP.

| Variable | Description | Example |
|---|---|---|
| `SMTP_HOST` | Mail server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | Mail server port | `587` |
| `SMTP_SECURE` | Use TLS/SSL (`true` for port 465, `false` for 587) | `false` |
| `SMTP_USER` | Gmail address used to send emails | `yourapp@gmail.com` |
| `SMTP_PASS` | Gmail App Password (not your regular password) | `xxxx xxxx xxxx xxxx` |
| `SMTP_FROM_NAME` | Display name shown in the "From" field | `Queue Management System` |

> **ℹ️ Note:** `SMTP_PASS` must be a **Gmail App Password**, not your regular Gmail password. Regular passwords won't work if 2FA is enabled.

**How to generate a Gmail App Password:**
1. Go to [myaccount.google.com/security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** (required)
3. Search for **App Passwords** → Generate one for "Mail"
4. Use the generated 16-character password (with spaces)

---

## 🎙️ ElevenLabs AI Voice

ElevenLabs powers the AI voice agent for automated phone calls and queue announcements.

| Variable | Description | Example |
|---|---|---|
| `ELEVENLABS_API_KEY` | Your ElevenLabs API key | `sk_...` |
| `ELEVENLABS_AGENT_ID` | ID of the configured conversational AI agent | `agent_...` |
| `ELEVENLABS_PHONE_NUMBER_ID` | Phone number ID provisioned in ElevenLabs | `phnum_...` |
| `ELEVENLABS_WEBHOOK_SECRET` | Secret for verifying ElevenLabs webhook payloads | `wsec_...` |

**How to get these:**
1. Sign up at [elevenlabs.io](https://elevenlabs.io)
2. Navigate to **Conversational AI → Agents** → Create/select your agent
3. Find the Agent ID in the agent settings URL or info panel
4. **Phone Numbers** section → provision a number to get `ELEVENLABS_PHONE_NUMBER_ID`
5. **Webhooks** → create a webhook endpoint → copy the signing secret

---

## 📱 Twilio SMS / Phone

Twilio handles SMS notifications and outbound phone call triggering.

| Variable | Description | Example |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | Twilio account identifier | `AC...` |
| `TWILIO_AUTH_TOKEN` | Twilio auth token for API authentication | `...` |
| `TWILIO_PHONE_NUMBER` | Your provisioned Twilio phone number | `+12602503305` |

**How to get these:**
1. Sign up at [twilio.com/console](https://www.twilio.com/console)
2. Your **Account SID** and **Auth Token** are on the dashboard homepage
3. Go to **Phone Numbers → Manage → Buy a number** to get a Twilio number

---

## 🚀 Quick Setup Template

Copy the block below into your `.env` file and fill in your actual values:

```env
# ─── Clerk Authentication ───────────────────────────────────────────
CLERK_WEBHOOK_SECRET=whsec_REPLACE_ME
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_REPLACE_ME
CLERK_SECRET_KEY=sk_test_REPLACE_ME
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# ─── Supabase Database ───────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=REPLACE_ME
SUPABASE_SERVICE_ROLE_KEY=REPLACE_ME

# ─── SMTP / Email ────────────────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=YOUR_GMAIL@gmail.com
SMTP_PASS=YOUR_APP_PASSWORD
SMTP_FROM_NAME=Queue Management System

# ─── ElevenLabs AI Voice ─────────────────────────────────────────────
ELEVENLABS_API_KEY=sk_REPLACE_ME
ELEVENLABS_AGENT_ID=agent_REPLACE_ME
ELEVENLABS_PHONE_NUMBER_ID=phnum_REPLACE_ME
ELEVENLABS_WEBHOOK_SECRET=wsec_REPLACE_ME

# ─── Twilio SMS / Phone ───────────────────────────────────────────────
TWILIO_ACCOUNT_SID=ACREPLACE_ME
TWILIO_AUTH_TOKEN=REPLACE_ME
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
```

---

## 🛡️ Security Checklist

- [ ] `.env` is listed in `.gitignore`
- [ ] No real secrets are committed to the repository
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is only used in server-side routes (`/api/...`)
- [ ] Production keys are different from development keys
- [ ] Clerk webhook secret is verified on every incoming webhook
- [ ] ElevenLabs & Twilio credentials are stored in a secrets manager for production

---

*Last updated: April 2026*
