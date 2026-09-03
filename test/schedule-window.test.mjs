import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  dayOfWeekInZone,
  hhmmInZone,
  inScheduleWindow,
  parseHHMM,
} from '../src/schedule-window.mjs';

const ENABLED = { enabled: true, days: [], startTime: '00:00', endTime: '23:59', timezone: 'UTC' };

// 2026-09-14 is a Monday. The fixed instants below let us assert
// day-of-week without depending on the test runner's clock.
const MON_UTC_10_00 = new Date('2026-09-14T10:00:00Z');
const MON_UTC_22_00 = new Date('2026-09-14T22:00:00Z');
const TUE_UTC_03_00 = new Date('2026-09-15T03:00:00Z');
const SAT_UTC_10_00 = new Date('2026-09-19T10:00:00Z');
const SUN_UTC_10_00 = new Date('2026-09-20T10:00:00Z');

test('parseHHMM accepts the canonical format and rejects everything else', () => {
  assert.deepEqual(parseHHMM('00:00'), [0, 0]);
  assert.deepEqual(parseHHMM('23:59'), [23, 59]);
  assert.deepEqual(parseHHMM('09:30'), [9, 30]);
  assert.equal(parseHHMM('24:00'), null);
  assert.equal(parseHHMM('9:00'), null);
  assert.equal(parseHHMM('09:60'), null);
  assert.equal(parseHHMM(' 09:00'), null);
  assert.equal(parseHHMM(null), null);
  assert.equal(parseHHMM(900), null);
});

test('dayOfWeekInZone maps weekday names to 0..6', () => {
  assert.equal(dayOfWeekInZone(MON_UTC_10_00, 'UTC'), 1);
  assert.equal(dayOfWeekInZone(SAT_UTC_10_00, 'UTC'), 6);
  assert.equal(dayOfWeekInZone(SUN_UTC_10_00, 'UTC'), 0);
  // Asia/Shanghai is UTC+8, so 22:00 UTC Monday = 06:00 Tuesday Shanghai.
  assert.equal(dayOfWeekInZone(MON_UTC_22_00, 'Asia/Shanghai'), 2);
  assert.equal(dayOfWeekInZone(MON_UTC_10_00, 'Not/AZone'), null);
});

test('hhmmInZone returns the local 24h clock', () => {
  assert.equal(hhmmInZone(MON_UTC_10_00, 'UTC'), '10:00');
  assert.equal(hhmmInZone(MON_UTC_22_00, 'Asia/Shanghai'), '06:00');
  assert.equal(hhmmInZone(TUE_UTC_03_00, 'UTC'), '03:00');
});

test('inScheduleWindow returns true when the feature is disabled', () => {
  assert.equal(inScheduleWindow(null, MON_UTC_10_00), true);
  assert.equal(inScheduleWindow(undefined, MON_UTC_10_00), true);
  assert.equal(inScheduleWindow({ enabled: false, days: [1], startTime: '00:00', endTime: '23:59' }, MON_UTC_10_00), true);
});

test('inScheduleWindow honors a same-day window', () => {
  const win = { ...ENABLED, startTime: '09:00', endTime: '18:00' };
  assert.equal(inScheduleWindow(win, MON_UTC_10_00), true);
  // 18:00:00 sharp is excluded by the half-open interval.
  assert.equal(inScheduleWindow(win, new Date('2026-09-14T18:00:00Z')), false);
  assert.equal(inScheduleWindow(win, new Date('2026-09-14T08:59:00Z')), false);
  assert.equal(inScheduleWindow(win, new Date('2026-09-14T17:59:00Z')), true);
});

test('inScheduleWindow honors a cross-midnight window', () => {
  const win = { ...ENABLED, startTime: '22:00', endTime: '06:00' };
  assert.equal(inScheduleWindow(win, MON_UTC_22_00), true);   // start boundary inclusive
  assert.equal(inScheduleWindow(win, new Date('2026-09-14T23:59:00Z')), true);
  assert.equal(inScheduleWindow(win, TUE_UTC_03_00), true);   // early-morning side
  assert.equal(inScheduleWindow(win, new Date('2026-09-15T06:00:00Z')), false); // end exclusive
  assert.equal(inScheduleWindow(win, new Date('2026-09-15T12:00:00Z')), false);
});

test('inScheduleWindow treats start==end as a 24h window', () => {
  const allDay = { ...ENABLED, startTime: '00:00', endTime: '00:00' };
  assert.equal(inScheduleWindow(allDay, MON_UTC_10_00), true);
  assert.equal(inScheduleWindow(allDay, new Date('2026-09-14T23:59:00Z')), true);
});

test('inScheduleWindow respects the day filter', () => {
  const weekdays = { ...ENABLED, days: [1, 2, 3, 4, 5] };
  assert.equal(inScheduleWindow(weekdays, MON_UTC_10_00), true);
  assert.equal(inScheduleWindow(weekdays, SAT_UTC_10_00), false);
  assert.equal(inScheduleWindow(weekdays, SUN_UTC_10_00), false);
  // Empty days list must not block — the same payload without `days` is
  // the legacy "every day" semantics, so we accept that explicitly.
  const everyday = { ...ENABLED, days: [] };
  assert.equal(inScheduleWindow(everyday, SAT_UTC_10_00), true);
  assert.equal(inScheduleWindow(everyday, SUN_UTC_10_00), true);
});

test('inScheduleWindow interprets the timezone field', () => {
  // 10:00 UTC = 18:00 in Asia/Shanghai. A 09:00-18:00 Shanghai window uses
  // a half-open interval, so 10:00 UTC (= 18:00 sharp Shanghai) is excluded
  // by the end boundary. Use 18:01 to assert the same window accepts
  // 10:00 UTC, and 17:59 to assert a tight window rejects it.
  const sh = { ...ENABLED, timezone: 'Asia/Shanghai', startTime: '09:00', endTime: '18:01' };
  assert.equal(inScheduleWindow(sh, MON_UTC_10_00), true);
  const shTight = { ...sh, endTime: '17:59' };
  assert.equal(inScheduleWindow(shTight, MON_UTC_10_00), false);
});

test('inScheduleWindow never silently disables on bad input', () => {
  // A bad schedule must default to "let it run" so a typo in the settings
  // page can never silently turn the monitor off.
  assert.equal(inScheduleWindow({ enabled: true, startTime: 'bad', endTime: '18:00' }, MON_UTC_10_00), true);
  assert.equal(inScheduleWindow({ enabled: true, startTime: '09:00', endTime: 'late' }, MON_UTC_10_00), true);
});
