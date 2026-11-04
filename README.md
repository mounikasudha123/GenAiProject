# MindMate

MindMate is a private-first journaling and self-reflection demo. It offers mood check-ins, personal journal notes, simple summaries of self-reported data, and optional AI-generated reflection. It is not a medical app, therapist, diagnostic tool, or emergency service.

## Run locally

Requirements: Node.js 20+ and npm. For AI reflection, install [Ollama](https://ollama.com/download) or use another OpenAI-compatible chat-completions endpoint.

```powershell
npm install
Copy-Item .env.example .env
Copy-Item server/.env.example server/.env
npm run dev
```

Open the Vite URL printed in the terminal (normally `http://localhost:5173`). In a second terminal, start the API:

```powershell
npm run server
```

Firebase configuration is required to use MindMate. Visitors are sent to the sign-in page until they authenticate; journal, mood, gratitude, and habit data are stored under the signed-in user's UID in Firestore.

## Local language model

Install Ollama, then download a small model (the 3B model is a reasonable laptop starting point; storage and RAM needs vary):

```powershell
ollama pull llama3.2:3b
ollama serve
```

Keep the Ollama process running. The backend template points to its OpenAI-compatible endpoint. Set `LLM_BASE_URL`, `LLM_MODEL`, and, if required by your provider, `LLM_API_KEY` in `server/.env`. Ollama commonly needs no API key. Never put an AI key in a `VITE_` variable or browser code.

AI is optional. In a journal entry, tick the consent checkbox before pressing **Reflect**. Only the entry text needed for that request is sent. The endpoint does not log prompts or model responses. A local keyword safety check runs before the external model call; it is not a risk assessment and can miss or misread context. For immediate danger, contact local emergency services or a trusted person. In the U.S. and Canada, call or text 988.

## Firebase setup

1. Create a Firebase project and register a web app.
2. In Authentication, click **Get started**, enable **Email/Password**, and create a Firestore database. Make sure the Firebase Console project matches `VITE_FIREBASE_PROJECT_ID`; an uninitialized Authentication service can return `auth/configuration-not-found`.
3. Copy `.env.example` to `.env` and set `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID` from Firebase web app settings.
4. Install Firebase CLI if needed, sign in with `firebase login`, then publish the checked-in UID-scoped rules with `firebase deploy --only firestore:rules`. The project alias is in `.firebaserc`.
5. To offer Google sign-in, enable the Google provider in Firebase Authentication and set `VITE_FIREBASE_GOOGLE_AUTH_ENABLED=true`.
6. For production API authentication and account deletion, configure Firebase Admin credentials server-side using `FIREBASE_SERVICE_ACCOUNT_JSON` (JSON text) or `GOOGLE_APPLICATION_CREDENTIALS` (path on the server). Never commit service account credentials.

The existing Firebase project has its default Firestore database in `nam5 (United States)`. Firestore database locations cannot be changed after creation; do not create a duplicate default database to change regions. The UID-scoped rules are published for this project. For a different Firebase project, run the deployment command above before using authenticated browser reads and writes.

The app supports email/password registration and login, verification email, password reset, optional Google sign-in, protected routes, and UID-scoped journal, mood, gratitude, and habit data. Existing accounts created before this change can continue to sign in.

## API

`POST /api/reflect` requires `{ "journalEntry": "...", "consent": true }`, limits input to 5,000 characters, is rate-limited, and returns a schema-validated `reflection` object. Production requests require a Firebase ID token in `Authorization: Bearer ...`. Local development allows same-device-origin requests when Firebase Admin is not configured. `GET /api/health` reports whether AI and Firebase Admin are configured.

Private data endpoints use the verified Firebase UID from the bearer token; they never accept a client-supplied owner ID. With Firebase Admin configured, the API provides `GET/POST /api/journal`, `PATCH/DELETE /api/journal/:id`, `GET/POST /api/moods`, `PATCH/DELETE /api/moods/:id`, `GET/PUT /api/habits/:date`, `GET/PUT /api/settings`, `GET /api/analytics`, and `GET /api/export`. Journal and mood lists accept a `limit` (1-100) and document-ID `cursor`. The web app continues to use the Firebase client SDK for these same UID-scoped records, protected by Firestore Rules, so local journaling does not require exposing Admin credentials to the browser. The server endpoints return `503` until Firebase Admin is configured in `server/.env`.

The API applies request limits and timeouts and avoids recording journal content in logs. The safety phrase matcher is an additional conservative pathway, not a substitute for clinical risk screening or human support. Before deployment, run the tests and conduct a broader safety review including false-positive/false-negative cases.

## Commands

```powershell
npm run dev       # frontend
npm run server    # API
npm run build     # production frontend build
npm test          # API and safety tests
```

## Deployment notes

Deploy the static frontend to Vercel or Firebase Hosting and deploy `server/` as a Node service (for example Render). Set `CLIENT_ORIGIN` to the exact HTTPS frontend origin and set `NODE_ENV=production` on the API. Configure Firebase web settings as frontend environment variables and Firebase Admin/LLM credentials only as backend secrets. Set the frontend's `VITE_API_URL` to the deployed API base path. Use HTTPS, restrictive Firebase rules, access-controlled provider credentials, and tested backup/deletion procedures.

### GitHub Pages

The repository includes `.github/workflows/static.yml`. Enable Pages with **GitHub Actions** as the build source, add the four `VITE_FIREBASE_*` web config values as repository Actions secrets, and set `VITE_API_URL` as a repository variable to the deployed API URL. For optional Google auth, set `VITE_FIREBASE_GOOGLE_AUTH_ENABLED` as a variable after enabling Google in Firebase. Add `mounikasudha123.github.io` to Firebase Authentication's authorized domains. The workflow builds with the `/GenAiProject/` base path and includes an SPA fallback for route refreshes.

## Data and limitations

- MindMate clears legacy journal, gratitude, and habit browser storage on sign-out. Firebase records are associated with the authenticated UID and protected by the included Firestore rules.
- Deleting all entries removes journal and mood documents; deleting an account requires the Firebase Admin-backed account deletion API to remove the account and its records.
- Export downloads journal and mood data as JSON. It does not include Firebase account credentials.
- Mood charts only visualize what the user logged. They do not imply causation or diagnose a condition.
- This project is a college demonstration baseline, not a security or clinical certification. Review privacy, retention, legal, accessibility, and crisis-resource obligations for the deployment region before collecting real sensitive data.
