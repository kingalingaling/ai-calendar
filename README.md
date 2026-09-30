# ⚡ AI Calendar — Smart Scheduling & Agenda

A mobile-first, context-aware AI calendar scheduling application powered by Google Calendar API v3 and Google Gemini Function Calling (`@google/genai` SDK), localized by default to **Africa/Lagos (WAT, UTC+1)**.

---

## 🌟 Key Features

1. **Zero-Timestamp Brain Dump Scheduling**:
   - Dictate or type free-form tasks without specifying times (e.g., *"Finish Q3 financial deck, 45m workout, call electrician, draft architecture doc"*).
   - Gemini automatically matches tasks to optimal energy windows (morning deep focus, afternoon calls/syncs, twilight workouts) and open calendar slots.
2. **Automatic Multi-Day Spillover**:
   - If today is congested or tasks exceed daily working hours (default 08:30 – 18:00 WAT), the AI automatically allots remaining tasks to **Tomorrow** with zero manual friction.
3. **Automated Task Rollover**:
   - Missed or uncompleted tasks from earlier today or yesterday are automatically detected and scheduled into upcoming open slots with a 1-tap rollover action.
4. **Two-Phase Commit Preview Modal**:
   - Review proposed events, inspect AI reasoning, adjust titles or times, and exclude events before writing anything to Google Calendar.
5. **Web Speech API Voice Capture**:
   - Real-time animated pulsing microphone with live speech-to-text transcript appending.
6. **Africa/Lagos (WAT, UTC+1) Timezone Engine**:
   - Native Luxon calculations prevent UTC drift and guarantee exact `+01:00` RFC3339 offset handling.
7. **Instant Demo Mode**:
   - Runs out of the box in interactive Demo Mode even before configuring Google Cloud credentials!

---

## 🏗️ Architecture & Tech Stack

- **Backend**: Node.js (ESM), Express.js, `@google/genai` (Gemini 3.8 Flash), `googleapis` (Calendar API v3), `luxon`, `express-session`, `zod`.
- **Frontend**: Vite, React 19, Tailwind CSS v4, Lucide Icons.

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
# From repository root
npm install
npm install --prefix backend
npm install --prefix frontend
```

### 2. Configure Environment Variables
Copy `backend/.env.example` to `backend/.env`:
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your API credentials:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
SESSION_SECRET=your_random_session_secret

# Gemini API Key (from Google AI Studio: https://aistudio.google.com/)
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-3.8-flash

# Google Cloud OAuth 2.0 (from GCP Console)
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback

# Timezone
DEFAULT_TIMEZONE=Africa/Lagos
```

> **Note on Demo Mode:** If `GEMINI_API_KEY` or `GOOGLE_CLIENT_ID` are left empty, the application will automatically run with the built-in intelligent heuristic scheduler and in-memory demo calendar, allowing full testing of the UI, voice input, preview modal, and rollover logic immediately.

### 3. Run Development Servers
```bash
# Starts backend (port 5000) and frontend (port 5173) concurrently
npm run dev
```

Visit **http://localhost:5173** on your mobile browser or desktop browser to test!

---

## 🔒 Google Cloud Console OAuth Setup (For Live Calendar Sync)

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project.
2. Navigate to **APIs & Services** > **Library** and enable **Google Calendar API**.
3. Under **OAuth consent screen**:
   - Select **External** (in Testing mode).
   - Add your Google account email to the **Test Users** list.
   - Add scopes:
     - `https://www.googleapis.com/auth/calendar.events`
     - `https://www.googleapis.com/auth/calendar.readonly`
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`
4. Under **Credentials** > **Create Credentials** > **OAuth client ID**:
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:5173`
   - Authorized redirect URIs: `http://localhost:5000/api/auth/google/callback`
5. Copy your Client ID and Client Secret into `backend/.env`.

---

## 📡 API Reference

- `GET /api/health` — Health check, returns operating timezone and configuration status.
- `GET /api/auth/google/url` — Generates Google OAuth 2.0 consent URL.
- `GET /api/auth/google/callback` — Handles OAuth code exchange and sets session cookie.
- `GET /api/auth/me` — Returns current login session.
- `POST /api/schedule/parse` — Analyzes natural language brain dump, checks existing calendar, invokes Gemini tool call, and returns non-overlapping schedule proposal.
- `POST /api/schedule/commit` — Commits confirmed schedule to Google Calendar.
- `POST /api/schedule/rollover` — Scans for uncompleted past tasks and generates an auto-allotment plan into open upcoming slots.
- `GET /api/agenda?date=YYYY-MM-DD` — Fetches real-time agenda.
- `DELETE /api/agenda/events/:id` — Removes an event from calendar.
