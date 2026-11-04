import test from 'node:test';
import assert from 'node:assert/strict';
import { parseModelJson, reflectionSchema, requestSchema } from './index.js';

const validReflection = {
  reflection: 'It sounds like there was a lot to hold today.',
  possibleEmotions: ['uncertainty'],
  summary: 'A busy day with several competing demands.',
  followUpQuestion: 'What feels most important to make room for tomorrow?',
  suggestedActions: ['Choose one small task and set a ten-minute timer.'],
  gratitudePrompt: null,
  supportReminder: null
};

test('AI reflection schema accepts a complete response', () => {
  assert.deepEqual(reflectionSchema.parse(validReflection), validReflection);
});

test('AI reflection parser rejects malformed or oversized responses', () => {
  assert.throws(() => parseModelJson('{not json}'));
  assert.throws(() => parseModelJson(JSON.stringify({ ...validReflection, suggestedActions: ['a', 'b', 'c', 'd'] })));
});

test('request requires explicit consent and limits entry size', () => {
  assert.equal(requestSchema.safeParse({ journalEntry: 'A note', consent: true }).success, true);
  assert.equal(requestSchema.safeParse({ journalEntry: 'A note', consent: false }).success, false);
  assert.equal(requestSchema.safeParse({ journalEntry: 'x'.repeat(5001), consent: true }).success, false);
});
