# ElevenLabs Setup Guide — MediQueue Appointment Booking

Complete step-by-step guide to configure ElevenLabs for AI phone call appointment booking.

> **How it works (important to understand):** The server code sends the full system prompt and first message to ElevenLabs via `conversation_config_override` on every call. This means the **real doctor names and hospital data are baked into the prompt at call time** — nothing is guessed or hallucinated. The ElevenLabs dashboard holds only placeholder/fallback values.

---

## Step 1 — Create a Conversational AI Agent

1. Go to [elevenlabs.io](https://elevenlabs.io) and log in
2. In the left sidebar, click **Agents**
3. Click **+ Create agent**
4. Choose **Blank template**
5. Give it a name: `MediQueue Appointment Bot`
6. Click **Create**

---

## Step 2 — Agent Tab: System Prompt (Placeholder)

> The real system prompt is injected by the server code. This is just a fallback so the agent has something if the override fails.

1. Click the **Agent** tab
2. Find the **System Prompt** field
3. Paste this placeholder:

```
You are a medical appointment booking assistant for MediQueue. You are calling a patient to help them book an appointment. Follow the booking flow: ask reason for visit, select hospital via keypad, select doctor via keypad, confirm date and time, then confirm the booking and say goodbye.
```

---

## Step 3 — Agent Tab: First Message (Placeholder)

> The real first message is also injected by the server code with the patient's actual name.

1. Still on the **Agent** tab, find the **First message** field
2. Paste this placeholder:

```
Hi, this is MediQueue calling. I'm here to help you book a medical appointment. Is now a good time?
```

---

## Step 4 — Agent Tab: Dynamic Variables

The server code overrides the system prompt and first message on every call via `conversation_config_override`, so the real patient name, hospital list, doctor list, and slots are all baked in as plain text — no variable substitution is used at runtime. The Variables panel values below are **fallback test values only** (used when you test the agent inside the ElevenLabs dashboard, not during real calls).

1. Still on the **Agent** tab, scroll down to find the **Dynamic variables** section
2. Add all of the following:

| Identifier | Type | Test value (for dashboard testing only) |
|---|---|---|
| `patient_name` | String | `Test Patient` |
| `hospital_options` | String | `press 1 for City Care, press 2 for Fortis, press 3 for Apollo` |
| `hospital_doctors` | String | `Hospital 1 (City Care): press 1 for Dr. Aryan (Cardiology), press 2 for Dr. SOURAV BUDKE (Neurology)` |
| `available_slots` | String | `09:00 AM, 10:00 AM, 11:00 AM, 02:00 PM, 03:00 PM` |
| `facility_name` | String | *(leave blank)* |
| `doctor_name` | String | *(leave blank)* |

> **Why all 6?** Even though real calls use `conversation_config_override`, ElevenLabs requires all variables referenced anywhere in the agent config to be declared here. If a variable is missing from this panel, ElevenLabs may reject calls or leave placeholders un-substituted as a fallback. Declare all of them to be safe.

---

## Step 5 — Agent Tab: Voice

1. Still on the **Agent** tab, find the **Voice** section
2. Choose any clear English voice (recommended: **Rachel** or **Adam**)
3. Set **Stability** to `0.5` and **Similarity** to `0.75`

---

## Step 6 — Agent Tab: LLM

1. Find the **LLM** section on the Agent tab
2. Set model to **GPT-4o** or **GPT-4o mini**

---

## Step 7 — Advanced Tab: Enable DTMF Input

DTMF allows the patient to press keypad numbers to select hospitals and doctors.

1. Click the **Advanced** tab on the agent
2. Find **Enable DTMF input** (may be labelled "Alpha")
3. Toggle it **ON**

---

## Step 8 — Security Tab: Enable Overrides

**This is critical.** Without this, the server code cannot inject the real system prompt and first message.

1. Click the **Security** tab
2. Under **Overrides**, toggle ON:
   - ✅ **First message**
   - ✅ **System prompt**
3. Make sure **Text only** is toggled **OFF**
4. Leave everything else as-is

---

## Step 9 — Analysis Tab: Data Collection (DCR Fields)

These fields capture what the patient says during the call so the webhook can create the appointment.

1. Click the **Analysis** tab
2. Under **Data collection**, click **+ Add data point** for each of the following:

| Field name | Type | Description |
|---|---|---|
| `appointment_reason` | String | What the patient said their reason for visit is |
| `selected_hospital` | String | The keypad digit pressed to select a hospital e.g. "1" |
| `selected_doctor` | String | The keypad digit pressed to select a doctor e.g. "1" |
| `confirmed_date` | String | The date the patient chose e.g. "2026-04-10" |
| `confirmed_time` | String | The time the patient chose e.g. "10:00 AM" |
| `patient_confirmed` | Boolean | True if the patient said yes to the final confirmation |
| `call_outcome` | String | One of: confirmed, declined, no_answer |

> **Important:** Field names must be spelled exactly as shown (lowercase, underscores).

---

## Step 10 — Connect a Phone Number (Twilio)

### 10a — Get a Twilio number (if you don't have one)
1. Go to [twilio.com](https://twilio.com) and log in
2. Go to **Phone Numbers → Manage → Buy a number**
3. Buy a number with **Voice** capability

### 10b — Connect Twilio to ElevenLabs
1. In ElevenLabs, go to **Deploy → Phone Numbers** in the left sidebar
2. Click **+ Add phone number**
3. Select **Twilio**
4. Enter your **Twilio Account SID** and **Auth Token** (from twilio.com → Console Dashboard)
5. Enter your **Twilio phone number** (e.g. `+12602503305`)
6. Click **Connect**
7. Copy the **Phone Number ID** that appears

---

## Step 11 — Set Post-Call Webhook (Workspace Settings)

The post-call webhook fires when a call ends and sends the transcript + DCR fields to your server so the appointment can be created.

> **Configure this at workspace level, not inside the agent.** The code also passes `post_call_webhook_url` per-call as a backup.

1. Click your **profile icon** (bottom-left in ElevenLabs)
2. Go to **Settings** (workspace settings, not agent settings)
3. Find the **Webhooks** section
4. Click **+ Add webhook** or **Create webhook**
5. Set the URL to:
   ```
   https://hackarena.aryanbudke.in/api/patient-call/webhook
   ```
6. Select event type: **Post-call** (or "Conversation ended")
7. Save
8. If a **Webhook Secret** is shown, copy it and add to your `.env`:
   ```env
   ELEVENLABS_WEBHOOK_SECRET=wsec_your_secret_here
   ```

---

## Step 12 — Get API Keys

### ElevenLabs API Key
1. Click your profile icon (bottom-left)
2. Go to **API Keys**
3. Click **+ Create API Key**, name it `MediQueue`
4. Copy the key — shown only once

### Agent ID
1. Go to **Agents** in the sidebar → click your agent
2. Look at the URL: `elevenlabs.io/app/agents/agents/agent_XXXXXXXX`
3. Copy the `agent_XXXXXXXX` part

### Phone Number ID
- Copied in Step 10b above

---

## Step 13 — Update `.env` File

```env
ELEVENLABS_API_KEY=sk_your_api_key_here
ELEVENLABS_AGENT_ID=agent_your_agent_id_here
ELEVENLABS_PHONE_NUMBER_ID=phnum_your_phone_number_id_here
```

---

## Step 14 — Publish the Agent

1. Click the **Publish** button (top-right, black button)
2. Confirm the publish
3. Status should show **Live**

---

## Step 15 — Verify Everything

- [ ] Security tab: First message = ON, System prompt = ON, Text only = OFF
- [ ] Advanced tab: DTMF input = ON
- [ ] Analysis tab: all 7 DCR fields added with exact names
- [ ] Phone number connected in Deploy → Phone Numbers
- [ ] Post-call webhook set in workspace Settings → Webhooks
- [ ] `.env` has API key, Agent ID, Phone Number ID
- [ ] Agent is Published (not Draft)

---

## Step 16 — Test the Call

1. Go to `https://hackarena.aryanbudke.in`
2. Navigate to **Book Appointment**
3. Click **Book via Call**
4. Answer the call — the agent will greet you by name
5. Complete the booking flow:
   - Say your reason for visit
   - Press a number to select a hospital
   - Press a number to select a doctor (only doctors for that hospital are listed)
   - Say a date and time
   - Say "yes" to confirm
6. Check your dashboard — the appointment should appear
7. Check your email — a confirmation email should arrive

---

## How the System Prompt Works (Technical Detail)

The server (`src/app/api/patient-call/request/route.ts`) builds a full system prompt at call time with real data embedded:

```
AVAILABLE DOCTORS:
Hospital 1 (City Care): press 1 for Dr. Aryan (Cardiology), press 2 for Dr. SOURAV BUDKE (Neurology)
Hospital 5 (fortis): press 1 for Dr. Manjunath (Neurology), press 2 for Dr. Srujan Hariwal (Gynecology)
```

This is sent via `conversation_config_override.agent.prompt.prompt` in the ElevenLabs API call. The LLM receives the actual names as plain text — no variable substitution, no guessing.

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| "Override for field 'first_message' is not allowed" | Security overrides not enabled | Security tab → toggle ON First message + System prompt → Publish |
| Agent shows fake doctor names (Dr. Smith etc.) | Old code deployed or Security overrides OFF | Check Vercel deployment is latest commit; check Security tab overrides are ON |
| Agent doesn't speak at all | Text only mode is ON | Security tab → toggle OFF Text only → Publish |
| Call connects but wrong greeting | First message override not enabled | Security tab → toggle ON First message → Publish |
| Appointment not created after call | Webhook not configured or DCR fields missing | Add webhook in Settings → Webhooks; check all 7 DCR fields exist in Analysis tab |
| Agent skips doctor selection | DTMF not enabled | Advanced tab → Enable DTMF input → Publish |
| `patient_name` shows as empty | Patient has no name in Supabase profile | Ask patient to complete their profile |
| Call fails immediately | ElevenLabs env vars missing | Check `.env` has all 3 ElevenLabs values |
