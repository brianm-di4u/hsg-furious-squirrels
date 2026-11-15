// Council wave 3, batch C, rules that need no browser: S3-06 (the special nuts), S3-13 (the second thrower's bonus), P-N02 (Story stars over rounds).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { NUTS, NUT_ORDER, NUT_BEST } from '../src/js/sim/const.js';

const targets = JSON.parse(fs.readFileSync(new URL('../tools/balance-targets.json', import.meta.url), 'utf8'));
const balance = fs.readFileSync(new URL('../tools/balance.mjs', import.meta.url), 'utf8');

test('S3-06 the four weakest specials hit harder, and each special has a best-for line', () => {
  assert.equal(NUTS.pecan.direct, 56);
  assert.equal(NUTS.chinquapin.direct, 22);
  assert.equal(NUTS.sweetgum.direct, 50);
  assert.equal(NUTS.hedgeapple.direct, 50);
  for (const k of NUT_ORDER.filter((n) => n !== 'acorn')) assert.match(NUT_BEST[k], /^Best for: [^.]{12,60}\.$/, k);
});

test('S3-06 the balance tool checks that no special falls far short of the acorn', () => {
  assert.equal(targets.specialFloor, 0.85);
  assert.ok(balance.includes('weakest special / acorn'));
  assert.ok(balance.includes('T.specialFloor'));
});
