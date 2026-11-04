import test from 'node:test';
import assert from 'node:assert/strict';
import { crisisReflection, safetyPattern } from './safety.js';

test('safety wording matcher catches direct crisis language', () => {
  assert.equal(safetyPattern.test('I want to end my life'), true);
  assert.equal(safetyPattern.test('I had a hard day at work'), false);
});

test('crisis response points to human help and does not diagnose', () => {
  const response = crisisReflection();
  assert.match(response.supportReminder, /not an emergency service/i);
  assert.doesNotMatch(JSON.stringify(response), /diagnos|disorder|medication/i);
});
