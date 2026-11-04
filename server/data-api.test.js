import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {
  createDataRouter,
  habitsUpdateSchema,
  journalCreateSchema,
  journalUpdateSchema,
  moodCreateSchema,
  settingsUpdateSchema,
} from './data-api.js';

const validJournalEntry = {
  title: 'A small pause',
  body: 'I stepped outside for a few minutes.',
  mood: 'good',
  tags: ['rest'],
};

test('journal and mood schemas validate client fields without accepting user IDs', () => {
  assert.equal(journalCreateSchema.safeParse(validJournalEntry).success, true);
  assert.equal(journalCreateSchema.safeParse({ ...validJournalEntry, userId: 'other-user' }).success, false);
  assert.equal(journalUpdateSchema.safeParse({}).success, false);
  assert.equal(moodCreateSchema.safeParse({ mood: 'good', intensity: 4, note: '', tags: [] }).success, true);
  assert.equal(moodCreateSchema.safeParse({ mood: 'good', intensity: 6 }).success, false);
});

test('habit and settings payloads are bounded and strictly shaped', () => {
  assert.equal(habitsUpdateSchema.safeParse({ habits: [{ label: 'Take a break', done: true }] }).success, true);
  assert.equal(habitsUpdateSchema.safeParse({ habits: [{ label: 'Take a break', done: true, userId: 'other-user' }] }).success, false);
  assert.equal(settingsUpdateSchema.safeParse({ remindersEnabled: true, reminderTime: '20:30' }).success, true);
  assert.equal(settingsUpdateSchema.safeParse({ reminderTime: '8pm' }).success, false);
});

test('private data endpoints fail closed without Firebase Admin configuration', async (context) => {
  const app = express();
  app.use(express.json());
  app.use('/api', createDataRouter({
    express,
    admin: {},
    getAdminApp: () => null,
    verifyUser: (_request, _response, next) => next(),
  }));
  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));
  app.post('/api/reflect', (_request, response) => response.json({ reflection: 'ok' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/journal`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: 'Firebase Admin is not configured on the server.',
  });
  const healthResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
  assert.equal(healthResponse.status, 200);
  const reflectionResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/reflect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(reflectionResponse.status, 200);
});

test('journal writes derive ownership from the verified token', async (context) => {
  let savedRecord;
  let savedUid;
  const firestore = {
    collection(name) {
      assert.equal(name, 'users');
      return {
        doc(uid) {
          savedUid = uid;
          return {
            collection(name) {
              assert.equal(name, 'entries');
              return {
                add: async (record) => {
                  savedRecord = record;
                  return { id: 'entry-1' };
                },
              };
            },
          };
        },
      };
    },
  };
  const fakeFirestore = () => firestore;
  fakeFirestore.FieldValue = { serverTimestamp: () => 'server-time' };
  const fakeAdmin = { firestore: fakeFirestore };
  const app = express();
  app.use(express.json());
  app.use('/api', createDataRouter({
    express,
    admin: fakeAdmin,
    getAdminApp: () => ({}),
    verifyUser: (request, _response, next) => {
      request.user = { uid: 'verified-user' };
      next();
    },
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/journal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validJournalEntry),
  });
  assert.equal(response.status, 201);
  assert.equal(savedUid, 'verified-user');
  assert.equal(savedRecord.userId, 'verified-user');
});