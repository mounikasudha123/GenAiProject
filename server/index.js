import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import admin from 'firebase-admin';
import { z } from 'zod';
import { crisisReflection, safetyPattern } from './safety.js';
import { createDataRouter } from './data-api.js';

const app = express();
dotenv.config({ path: 'server/.env' });
dotenv.config();
const port = Number(process.env.PORT || 3001);
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
let adminApp = null;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    adminApp = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    adminApp = admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
} catch {
  console.error('Firebase Admin configuration could not be initialized.');
}

app.disable('x-powered-by');
app.use(cors({ origin: allowedOrigin, methods: ['POST', 'GET', 'PATCH', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '12kb' }));
app.use((request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Cache-Control', 'no-store');
  next();
});
const reflectLimiter = rateLimit({ windowMs: 60_000, limit: 6, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Please pause for a moment before requesting another reflection.' } });
const requestSchema = z.object({ journalEntry: z.string().trim().min(1).max(5000), consent: z.literal(true) }).strict();
const reflectionSchema = z.object({
  reflection: z.string().min(1).max(500),
  possibleEmotions: z.array(z.string().max(80)).max(4),
  summary: z.string().max(400),
  followUpQuestion: z.string().max(240),
  suggestedActions: z.array(z.string().max(180)).max(3),
  gratitudePrompt: z.string().max(180).nullable(),
  supportReminder: z.string().max(400).nullable()
}).strict();

async function verifyUser(request, response, next) {
  const authorization = request.get('authorization') || '';
  if (authorization.startsWith('Bearer ') && adminApp) {
    try {
      request.user = await admin.auth(adminApp).verifyIdToken(authorization.slice(7));
      return next();
    } catch {
      return response.status(401).json({ error: 'Please sign in again to continue.' });
    }
  }
  if (isProduction) return response.status(401).json({ error: 'Sign in is required for private AI reflections.' });
  const origin = request.get('origin') || '';
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return response.status(401).json({ error: 'Local demo requests must come from this device.' });
  return next();
}

app.use('/api', createDataRouter({
  express,
  admin,
  getAdminApp: () => adminApp,
  verifyUser,
}));

function parseModelJson(content) {
  const text = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return reflectionSchema.parse(JSON.parse(text));
}

app.get('/api/health', (_request, response) => response.json({ status: 'ok', aiConfigured: Boolean(process.env.LLM_BASE_URL), firebaseConfigured: Boolean(adminApp) }));
app.delete('/api/account', verifyUser, async (request, response) => {
  if (!adminApp || !request.user?.uid) return response.status(503).json({ error: 'Account deletion requires Firebase Admin configuration.' });
  try {
    const firestore = admin.firestore(adminApp);
    const userDocument = firestore.collection('users').doc(request.user.uid);
    await firestore.recursiveDelete(userDocument);
    await admin.auth(adminApp).deleteUser(request.user.uid);
    return response.json({ deleted: true });
  } catch {
    return response.status(502).json({ error: 'Account deletion could not be completed. Contact support before trying again.' });
  }
});
app.post('/api/reflect', reflectLimiter, verifyUser, async (request, response) => {
  const parsed = requestSchema.safeParse(request.body);
  if (!parsed.success) return response.status(400).json({ error: 'Please provide an entry under 5,000 characters and confirm AI consent.' });
  const { journalEntry } = parsed.data;
  if (safetyPattern.test(journalEntry)) return response.json({ reflection: crisisReflection() });
  if (!process.env.LLM_BASE_URL) return response.status(503).json({ error: 'AI reflection is not configured. You can still save your journal entry without AI.' });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const modelResponse = await fetch(process.env.LLM_BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(process.env.LLM_API_KEY ? { Authorization: `Bearer ${process.env.LLM_API_KEY}` } : {}) },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.LLM_MODEL || 'llama3.2:3b',
        temperature: 0.4,
        max_tokens: 700,
        messages: [
          { role: 'system', content: 'You are a brief, warm, non-clinical journaling reflection tool. Return only valid JSON with keys: reflection (string), possibleEmotions (array of tentative themes), summary (string), followUpQuestion (string), suggestedActions (array, at most 3), gratitudePrompt (string or null), supportReminder (string or null). Never diagnose, prescribe, claim certainty, or suggest harmful actions. Encourage human support when appropriate. Keep language respectful and concise.' },
          { role: 'user', content: `Reflect on this journal entry without quoting more than necessary:\n${journalEntry}` }
        ]
      })
    });
    if (!modelResponse.ok) return response.status(502).json({ error: 'The reflection service could not respond. Your entry was not changed.' });
    const modelPayload = await modelResponse.json();
    const result = parseModelJson(modelPayload.choices?.[0]?.message?.content || '');
    return response.json({ reflection: result });
  } catch (error) {
    const message = error?.name === 'AbortError' ? 'The reflection took too long. Your entry is still saved.' : 'The reflection service returned an unreadable response. Your entry is still saved.';
    return response.status(error?.name === 'ZodError' ? 502 : 503).json({ error: message });
  } finally {
    clearTimeout(timeout);
  }
});

app.use((error, _request, response, _next) => {
  if (error?.type === 'entity.too.large') return response.status(413).json({ error: 'That request is too large.' });
  response.status(500).json({ error: 'Something went wrong. Please try again.' });
});

if (process.env.NODE_ENV !== 'test' && process.argv[1]?.replaceAll('\\', '/').endsWith('/server/index.js')) {
  app.listen(port, () => console.log(`MindMate API listening on http://localhost:${port}`));
}
export { app, reflectionSchema, requestSchema, parseModelJson };
