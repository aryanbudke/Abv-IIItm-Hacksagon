# ElevenLabs Setup Guide — MediQueue Appointment Booking

Complete step-by-step guide to configure a new ElevenLabs account for AI phone call appointment booking.

---

## Step 1 — Create a Conversational AI Agent

1. Go to [elevenlabs.io](https://elevenlabs.io) and log in to your new account
2. In the left sidebar, click **Agents**
3. Click **+ Create agent**
4. Choose **Blank template**
5. Give it a name: `MediQueue Appointment Bot`
6. Click **Create**

---

## Step 2 — Agent Tab: System Prompt

1. Click the **Agent** tab at the top
2. Find the **System Prompt** field
3. Delete any default text and paste **exactly** this:

```
You are a medical appointment booking assistant for MediQueue. You are calling {{patient_name}}.

CRITICAL RULES:
- You already know the patient's name: {{patient_name}}. NEVER ask for their name.
- You ARE able to book appointments. That is your ONLY job.
- NEVER say you cannot book appointments or that you are a generic AI.
- After the patient says YES to confirm, say goodbye and END THE CALL immediately.
- Keep ALL responses SHORT. This is a phone call, not a chat.
- Speak naturally and clearly.

BOOKING FLOW — follow these steps in order:

STEP 1 — REASON FOR VISIT:
Ask: "What is the reason for your visit today?"
Listen and remember the answer. This is the appointment_reason.

STEP 2 — HOSPITAL SELECTION:
Say: "To choose your hospital, please press a number on your keypad. {{hospital_options}}."
Wait for the patient to press a number. Acknowledge their choice.
Record the digit they pressed as selected_hospital (e.g. "1", "2", "3").

STEP 3 — DOCTOR SELECTION:
After the patient selects a hospital, look up the doctors for that hospital from {{hospital_doctors}}.
Say: "Now please select your doctor. For Hospital [their number]: [list the doctors for that hospital only]."
Wait for the patient to press a number. Acknowledge their choice.
Record the digit they pressed as selected_doctor (e.g. "1", "2", "3").

Example: If patient pressed "1" for Hospital 1, say the doctor options listed under "Hospital 1 (name): press 1 for Dr. X, press 2 for Dr. Y" from {{hospital_doctors}}.

STEP 4 — DATE AND TIME:
Say: "What date and time works for you? We have slots available: {{available_slots}}."
If they say a day name like "Thursday", confirm: "This coming Thursday?"
If they say "3 PM", confirm: "3 in the afternoon, correct?"
Record as confirmed_date and confirmed_time.

STEP 5 — CONFIRM ALL DETAILS:
Read back everything: "Let me confirm: [their reason] with [doctor name] at [hospital name] on [date] at [time]. Is that correct?"

If they say YES:
  Say exactly: "Perfect! Your appointment is confirmed and a confirmation email will be sent to you shortly. Thank you {{patient_name}}, have a great day! Goodbye!"
  END THE CALL immediately. Do not say anything else.

If they say NO or want to change something:
  Go back to the relevant step.

HANDLING EDGE CASES:
- If no response for 5 seconds: say "Hello, can you hear me?" Once more, then end call.
- If they decline: "No problem, feel free to book online. Goodbye!"
- If they ask a medical question: "I can only help with scheduling — please discuss that with your doctor."

DATA TO RECORD — collect ALL fields before ending:
- appointment_reason: what the patient said (string)
- selected_hospital: the keypad digit pressed e.g. "1", "2" (string)
- selected_doctor: the keypad digit pressed for doctor e.g. "1", "2" (string)
- confirmed_date: chosen date e.g. "2026-04-10" (string)
- confirmed_time: chosen time e.g. "10:00 AM" (string)
- patient_confirmed: true if patient said yes, false otherwise (boolean)
- call_outcome: "confirmed", "declined", or "no_answer" (string)
```

---

## Step 3 — Agent Tab: First Message

1. Still on the **Agent** tab, find the **First message** field
2. Paste this:

```
Hi {{patient_name}}, this is MediQueue calling. I'm here to help you book a medical appointment. Is now a good time?
```

---

## Step 4 — Agent Tab: Voice

1. Still on the **Agent** tab, find the **Voice** section
2. Choose any clear English voice (recommended: **Rachel** or **Adam**)
3. Set **Stability** to `0.5` and **Similarity** to `0.75`

---

## Step 5 — Agent Tab: LLM

1. Find the **LLM** section on the Agent tab
2. Set model to **GPT-4o** or **GPT-4o mini** (either works, 4o mini is faster)

---

## Step 6 — Security Tab: Enable Overrides

1. Click the **Security** tab
2. Under **Overrides**, toggle ON:
   - ✅ **First message**
   - ✅ **System prompt**
3. Make sure **Text only** is toggled **OFF**
4. Leave everything else as-is

---

## Step 7 — Analysis Tab: Data Collection (DCR Fields)

These fields capture what the patient says during the call so the webhook can create the appointment.

1. Click the **Analysis** tab
2. Under **Data collection**, click **+ Add data point** for each of the following:

| Field name | Type | Description |
|---|---|---|
| `appointment_reason` | String | What the patient said their symptoms or reason for visit is |
| `selected_hospital` | String | The keypad number the patient pressed to select a hospital e.g. "1" |
| `selected_doctor` | String | The keypad number the patient pressed to select a doctor e.g. "1" |
| `confirmed_date` | String | The date the patient chose for their appointment e.g. "2026-04-10" |
| `confirmed_time` | String | The time the patient chose e.g. "10:00 AM" or "3 PM" |
| `patient_confirmed` | Boolean | True if the patient said yes to the final confirmation |
| `call_outcome` | String | One of: confirmed, declined, no_answer |

> **Important:** The field names must be spelled exactly as shown above (lowercase, underscores). They must match what the webhook code expects.

---

## Step 8 — Connect a Phone Number (Twilio)

ElevenLabs uses Twilio to make outbound calls. You need a Twilio phone number connected.

### 8a — Get a Twilio number (if you don't have one)
1. Go to [twilio.com](https://twilio.com) and log in
2. Go to **Phone Numbers → Manage → Buy a number**
3. Buy a number with **Voice** capability

### 8b — Connect Twilio to ElevenLabs
1. In ElevenLabs, go to **Deploy → Phone Numbers** in the left sidebar
2. Click **+ Add phone number**
3. Select **Twilio**
4. Enter your **Twilio Account SID** and **Auth Token**
   - Find these at: twilio.com → Console Dashboard
5. Enter your **Twilio phone number** (e.g. `+12602503305`)
6. Click **Connect**
7. Copy the **Phone Number ID** that appears (you'll need it for `.env`)

---

## Step 9 — Get API Keys

### ElevenLabs API Key
1. Click your profile icon (bottom left in ElevenLabs)
2. Go to **API Keys**
3. Click **+ Create API Key**
4. Give it a name: `MediQueue`
5. Copy the key — you'll only see it once

### Agent ID
1. Go to **Agents** in the sidebar
2. Click your agent
3. Look at the URL: `elevenlabs.io/app/agents/agents/agent_XXXXXXXX`
4. The `agent_XXXXXXXX` part is your Agent ID

### Phone Number ID
- You copied this in Step 8b above

---

## Step 10 — Update `.env` File

Open `/Users/aryan/Desktop/hackarean/Hackarena/.env` and update these values:

```env
ELEVENLABS_API_KEY=sk_your_new_api_key_here
ELEVENLABS_AGENT_ID=agent_your_new_agent_id_here
ELEVENLABS_PHONE_NUMBER_ID=phnum_your_phone_number_id_here
```

---

## Step 11 — Set Post-Call Webhook

This tells ElevenLabs where to send the conversation results after each call ends.

1. Go to your agent → **Analysis** tab
2. Scroll down to find **Post-call webhook** (it may be below the data collection section)
3. Set the URL to:
   ```
   https://hackarena.aryanbudke.in/api/patient-call/webhook
   ```
4. If you see a **Secret** field, copy the secret and add it to `.env`:
   ```env
   ELEVENLABS_WEBHOOK_SECRET=wsec_your_secret_here
   ```

> **Note:** If you don't see a Post-call webhook field in the Analysis tab, it may be under the **Advanced** tab or configured automatically via the API call's `post_call_webhook_url` parameter (which is already in the code).

---

## Step 12 — Publish the Agent

1. Click the **Publish** button (top right, black button)
2. Confirm the publish
3. The agent status should show **Live**

---

## Step 13 — Verify Everything Works

After publishing, check:

- [ ] Agent tab has system prompt with `{{patient_name}}` etc.
- [ ] Agent tab has first message with `{{patient_name}}`
- [ ] Security tab: First message = ON, System prompt = ON, Text only = OFF
- [ ] Analysis tab: all 6 data collection fields added
- [ ] Phone number connected and showing in Deploy → Phone Numbers
- [ ] `.env` updated with new API key, agent ID, phone number ID
- [ ] Agent is Published (not Draft)

---

## Step 14 — Test the Call

1. Go to your app at `https://hackarena.aryanbudke.in`
2. Navigate to Book Appointment
3. Click **Book via Call**
4. Answer the call
5. Go through the booking flow:
   - State your reason for visit
   - Press a number to select a hospital
   - Say a date and time
   - Confirm with "yes"
6. After the call ends, check your dashboard — the appointment should appear
7. Check your email — a confirmation email should arrive

---

## Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| "Override for field 'first_message' is not allowed" | Security overrides not enabled | Security tab → toggle ON First message + System prompt → Publish |
| Agent says "I can't book appointments" | Wrong/old system prompt in dashboard | Agent tab → replace system prompt with the one in Step 2 → Publish |
| Agent doesn't speak at all | Text only mode is ON | Security tab → toggle OFF Text only → Publish |
| Call connects but agent says "Hello, how can I help" | First message not set | Agent tab → set First message (Step 3) → Publish |
| Appointment not created after call | Webhook blocked by auth | Already fixed in middleware.ts — ensure latest code is deployed |
| Appointment not created — call shows "failed" | DCR fields not configured | Analysis tab → add all 6 data collection fields (Step 7) |
| `patient_name` shows as empty | Dynamic variable not passed | Check code is deployed and patient has name in their profile |
