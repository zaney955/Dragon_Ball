import test from 'node:test';
import assert from 'node:assert/strict';
import { createApplication } from '../../src/app/application.js';
import { createRuntime } from '../../src/app/runtime.js';

test('runtime state is isolated per application', () => {
  const first = createRuntime();
  const second = createRuntime();
  first.match.game = { screen: 'fight' };
  assert.equal(second.match.game, undefined);
  assert.notEqual(first.combat, second.combat);
});

test('registers every interface before initializing in order, then boots once', () => {
  const calls = [];
  const application = createApplication({
    plan: [
      {
        id: 'consumer',
        register: ({ app, combat }) => {
          calls.push('register consumer');
          app.boot = () => calls.push('boot');
          return () => {
            calls.push('initialize consumer');
            combat.dependency();
          };
        },
      },
      {
        id: 'provider',
        register: ({ combat }) => {
          calls.push('register provider');
          combat.dependency = () => calls.push('dependency');
          return () => calls.push('initialize provider');
        },
      },
    ],
  });
  assert.deepEqual(calls, []);
  application.start();
  assert.deepEqual(calls, [
    'register consumer',
    'register provider',
    'initialize consumer',
    'dependency',
    'initialize provider',
    'boot',
  ]);
  assert.throws(() => application.start(), /already started/);
});

test('test-only modules are omitted from normal startup', () => {
  const calls = [];
  const application = createApplication({
    plan: [
      {
        id: 'app',
        register: ({ app }) => {
          app.boot = () => calls.push('boot');
          return () => {};
        },
      },
      { id: 'testing', test: true },
    ],
  });
  application.start();
  assert.deepEqual(calls, ['boot']);
});

test('reports the failing initializer and prevents boot', () => {
  let booted = false;
  const failure = new Error('broken dependency');
  const application = createApplication({
    plan: [
      {
        id: 'broken',
        register: ({ app }) => {
          app.boot = () => {
            booted = true;
          };
          return () => {
            throw failure;
          };
        },
      },
    ],
  });
  assert.throws(
    () => application.start(),
    (error) => error.message.includes('broken') && error.cause === failure,
  );
  assert.equal(booted, false);
});

test('rejects duplicate or missing modules before any initialization', () => {
  assert.throws(() => createApplication({ plan: [{ id: 'missing' }] }), /Missing module/);
  const entry = { id: 'duplicate', register: () => () => {} };
  assert.throws(() => createApplication({ plan: [entry, entry] }), /Duplicate module/);
});
