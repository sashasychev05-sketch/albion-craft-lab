'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createUpdates } = require('../desktop/updates.cjs');
function fixture(packaged = true) {
  const updater = new EventEmitter(), calls = [];
  updater.checkForUpdates = async () => { calls.push('check'); updater.emit('update-available', { version: '1.1.0' }); };
  updater.downloadUpdate = async () => { calls.push('download'); updater.emit('download-progress', { percent: 61.4 }); updater.emit('update-downloaded', { version: '1.1.0' }); };
  updater.quitAndInstall = (...args) => calls.push(['install', ...args]);
  const states = [], updates = createUpdates(updater, { version: '1.0.0', packaged, notify: state => states.push(state) });
  return { updater, updates, calls, states };
}
test('check, download and install each require a separate explicit action', async () => {
  const { updater, updates, calls, states } = fixture();
  assert.equal(updater.autoDownload, false); assert.equal(updater.autoInstallOnAppQuit, false); assert.deepEqual(calls, []);
  assert.equal((await updates.action()).phase, 'available'); assert.deepEqual(calls, ['check']);
  assert.equal((await updates.action()).phase, 'ready'); assert.deepEqual(calls, ['check', 'download']);
  assert.ok(states.some(s => s.phase === 'downloading' && s.percent === 61));
  await updates.action(); assert.deepEqual(calls[2], ['install', false, true]);
  await updates.action(); assert.equal(calls.length, 3);
});
test('concurrent clicks cannot start duplicate downloads', async () => {
  const { updater, updates, calls } = fixture(); await updates.action();
  let complete; updater.downloadUpdate = () => { calls.push('download'); return new Promise(resolve => { complete = resolve; }); };
  const first = updates.action(); await updates.action(); assert.equal(calls.filter(c => c === 'download').length, 1);
  updater.emit('update-downloaded', { version: '1.1.0' }); complete(); await first;
});
test('network failures recover and current version remains usable', async () => {
  const { updater, updates } = fixture(); updater.checkForUpdates = async () => { throw new Error('offline'); };
  assert.equal((await updates.action()).phase, 'error');
  updater.checkForUpdates = async () => updater.emit('update-not-available');
  assert.equal((await updates.action()).phase, 'current');
});
test('development builds never download or install', async () => {
  const { updates, calls } = fixture(false); assert.equal((await updates.action()).phase, 'development'); assert.deepEqual(calls, []);
});
