import { z } from 'zod';
import rateLimit from 'express-rate-limit';

const tagSchema = z.string().trim().min(1).max(40);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const recordIdSchema = z.string().min(1).max(150).refine((value) => !value.includes('/'));

export const journalCreateSchema = z.object({
  title: z.string().trim().max(120).default(''),
  body: z.string().trim().min(1).max(10000),
  mood: z.string().max(20).default(''),
  tags: z.array(tagSchema).max(20).default([]),
  date: z.string().datetime({ offset: true }).optional(),
}).strict();

export const journalUpdateSchema = z.object({
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(1).max(10000).optional(),
  mood: z.string().max(20).optional(),
  tags: z.array(tagSchema).max(20).optional(),
  date: z.string().datetime({ offset: true }).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export const moodCreateSchema = z.object({
  mood: z.enum(['great', 'good', 'okay', 'low', 'tough']),
  intensity: z.number().int().min(1).max(5),
  note: z.string().trim().max(500).default(''),
  tags: z.array(tagSchema).max(20).default([]),
}).strict();

export const moodUpdateSchema = z.object({
  mood: z.enum(['great', 'good', 'okay', 'low', 'tough']).optional(),
  intensity: z.number().int().min(1).max(5).optional(),
  note: z.string().trim().max(500).optional(),
  tags: z.array(tagSchema).max(20).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export const habitsUpdateSchema = z.object({
  habits: z.array(z.object({
    label: z.string().trim().min(1).max(100),
    done: z.boolean(),
  }).strict()).max(20),
}).strict();

export const settingsUpdateSchema = z.object({
  remindersEnabled: z.boolean().optional(),
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  displayName: z.string().trim().max(100).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

function parseOrRespond(schema, value, response) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    response.status(400).json({ error: 'Check the submitted data and try again.' });
    return null;
  }
  return parsed.data;
}

function serializeDocument(snapshot) {
  return { ...snapshot.data(), id: snapshot.id };
}

function sendServerError(response) {
  return response.status(500).json({ error: 'Could not complete the data request.' });
}

export function createDataRouter({ express, admin, getAdminApp, verifyUser }) {
  const router = express.Router();
  router.use(rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Please pause briefly before making more data requests.' },
  }));
  const defaultSettings = {
    remindersEnabled: false,
    reminderTime: null,
  };

  router.use((request, response, next) => {
    if (['/health', '/reflect', '/account'].includes(request.path))
      return next();
    if (!getAdminApp())
      return response.status(503).json({ error: 'Firebase Admin is not configured on the server.' });
    return verifyUser(request, response, () => {
      if (!request.user?.uid)
        return response.status(401).json({ error: 'Sign in is required for private data.' });
      return next();
    });
  });

  function userCollection(request, name) {
    return admin.firestore(getAdminApp())
      .collection('users')
      .doc(request.user.uid)
      .collection(name);
  }

  async function listCollection(request, response, name) {
    const requestedLimit = Number(request.query.limit || 50);
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100)
      return response.status(400).json({ error: 'Limit must be between 1 and 100.' });

    const collection = userCollection(request, name);
    let query = collection.orderBy('date', 'desc').limit(requestedLimit + 1);
    if (request.query.cursor) {
      const cursorId = recordIdSchema.safeParse(request.query.cursor);
      if (!cursorId.success)
        return response.status(400).json({ error: 'Invalid page cursor.' });
      const cursor = await collection.doc(cursorId.data).get();
      if (!cursor.exists)
        return response.status(400).json({ error: 'Page cursor was not found.' });
      query = query.startAfter(cursor);
    }
    const snapshot = await query.get();
    const hasMore = snapshot.docs.length > requestedLimit;
    const documents = snapshot.docs.slice(0, requestedLimit);
    return response.json({
      items: documents.map(serializeDocument),
      nextCursor: hasMore ? documents.at(-1).id : null,
    });
  }

  router.get('/journal', async (request, response) => {
    try {
      return await listCollection(request, response, 'entries');
    } catch {
      return sendServerError(response);
    }
  });

  router.post('/journal', async (request, response) => {
    const data = parseOrRespond(journalCreateSchema, request.body, response);
    if (!data) return;
    try {
      const now = new Date().toISOString();
      const record = {
        ...data,
        date: data.date || now,
        userId: request.user.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      const reference = await userCollection(request, 'entries').add(record);
      return response.status(201).json({ item: { ...data, id: reference.id, date: record.date } });
    } catch {
      return sendServerError(response);
    }
  });

  router.patch('/journal/:id', async (request, response) => {
    const id = parseOrRespond(recordIdSchema, request.params.id, response);
    const data = parseOrRespond(journalUpdateSchema, request.body, response);
    if (!id || !data) return;
    try {
      const reference = userCollection(request, 'entries').doc(id);
      const snapshot = await reference.get();
      if (!snapshot.exists)
        return response.status(404).json({ error: 'Journal entry not found.' });
      await reference.update({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return response.json({ item: { ...serializeDocument(snapshot), ...data } });
    } catch {
      return sendServerError(response);
    }
  });

  router.delete('/journal/:id', async (request, response) => {
    const id = parseOrRespond(recordIdSchema, request.params.id, response);
    if (!id) return;
    try {
      const reference = userCollection(request, 'entries').doc(id);
      const snapshot = await reference.get();
      if (!snapshot.exists)
        return response.status(404).json({ error: 'Journal entry not found.' });
      await reference.delete();
      return response.status(204).end();
    } catch {
      return sendServerError(response);
    }
  });

  router.get('/moods', async (request, response) => {
    try {
      return await listCollection(request, response, 'moods');
    } catch {
      return sendServerError(response);
    }
  });

  router.post('/moods', async (request, response) => {
    const data = parseOrRespond(moodCreateSchema, request.body, response);
    if (!data) return;
    try {
      const record = {
        ...data,
        date: new Date().toISOString(),
        userId: request.user.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      const reference = await userCollection(request, 'moods').add(record);
      return response.status(201).json({ item: { ...data, id: reference.id, date: record.date } });
    } catch {
      return sendServerError(response);
    }
  });

  router.patch('/moods/:id', async (request, response) => {
    const id = parseOrRespond(recordIdSchema, request.params.id, response);
    const data = parseOrRespond(moodUpdateSchema, request.body, response);
    if (!id || !data) return;
    try {
      const reference = userCollection(request, 'moods').doc(id);
      const snapshot = await reference.get();
      if (!snapshot.exists)
        return response.status(404).json({ error: 'Mood check-in not found.' });
      await reference.update({ ...data, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      return response.json({ item: { ...serializeDocument(snapshot), ...data } });
    } catch {
      return sendServerError(response);
    }
  });

  router.delete('/moods/:id', async (request, response) => {
    const id = parseOrRespond(recordIdSchema, request.params.id, response);
    if (!id) return;
    try {
      const reference = userCollection(request, 'moods').doc(id);
      const snapshot = await reference.get();
      if (!snapshot.exists)
        return response.status(404).json({ error: 'Mood check-in not found.' });
      await reference.delete();
      return response.status(204).end();
    } catch {
      return sendServerError(response);
    }
  });

  router.get('/habits/:date', async (request, response) => {
    const date = parseOrRespond(dateSchema, request.params.date, response);
    if (!date) return;
    try {
      const snapshot = await userCollection(request, 'habits').doc(date).get();
      return response.json({ item: snapshot.exists ? serializeDocument(snapshot) : { date, habits: [] } });
    } catch {
      return sendServerError(response);
    }
  });

  router.put('/habits/:date', async (request, response) => {
    const date = parseOrRespond(dateSchema, request.params.date, response);
    const data = parseOrRespond(habitsUpdateSchema, request.body, response);
    if (!date || !data) return;
    try {
      await userCollection(request, 'habits').doc(date).set({
        ...data,
        date,
        userId: request.user.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      return response.json({ item: { date, ...data } });
    } catch {
      return sendServerError(response);
    }
  });

  router.get('/settings', async (request, response) => {
    try {
      const snapshot = await admin.firestore(getAdminApp())
        .collection('users').doc(request.user.uid).get();
      return response.json({ settings: { ...defaultSettings, ...(snapshot.data()?.settings || {}) } });
    } catch {
      return sendServerError(response);
    }
  });

  router.put('/settings', async (request, response) => {
    const settings = parseOrRespond(settingsUpdateSchema, request.body, response);
    if (!settings) return;
    try {
      await admin.firestore(getAdminApp())
        .collection('users').doc(request.user.uid)
        .set({ settings, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return response.json({ settings: { ...defaultSettings, ...settings } });
    } catch {
      return sendServerError(response);
    }
  });

  router.get('/analytics', async (request, response) => {
    try {
      const [entries, moods] = await Promise.all([
        userCollection(request, 'entries').orderBy('date', 'desc').limit(1000).get(),
        userCollection(request, 'moods').orderBy('date', 'desc').limit(1000).get(),
      ]);
      const items = moods.docs.map((snapshot) => snapshot.data());
      const moodDistribution = items.reduce((counts, item) => {
        counts[item.mood] = (counts[item.mood] || 0) + 1;
        return counts;
      }, {});
      const tagCounts = items.flatMap((item) => item.tags || []).reduce((counts, tag) => {
        counts[tag] = (counts[tag] || 0) + 1;
        return counts;
      }, {});
      return response.json({
        entriesCount: entries.size,
        moodsCount: moods.size,
        moodDistribution,
        frequentTags: Object.entries(tagCounts).sort((left, right) => right[1] - left[1]).slice(0, 10),
      });
    } catch {
      return sendServerError(response);
    }
  });

  router.get('/export', async (request, response) => {
    try {
      const collections = ['entries', 'moods', 'habits', 'care'];
      const results = await Promise.all(
        collections.map((name) => userCollection(request, name).get()),
      );
      const data = Object.fromEntries(
        collections.map((name, index) => [name, results[index].docs.map(serializeDocument)]),
      );
      return response.json({ exportedAt: new Date().toISOString(), data });
    } catch {
      return sendServerError(response);
    }
  });

  return router;
}