/**
 * Pure functions for evaluating the optional "time window" schedule on the
 * RSS monitor. Kept side-effect-free and dependency-free so unit tests can
 * exercise every branch with a fixed clock and a fixed timezone.
 *
 * A schedule is what lives in `settings.schedule`. The schema is defined in
 * `protocol.normalizeSchedule`; this module only consumes the already-normalized
 * shape and never re-validates it.
 */

const MS_PER_MINUTE = 60_000;

/** Parse a "HH:MM" string into [hour, minute]. Returns null when malformed. */
export function parseHHMM(value) {
  if (typeof value !== 'string') return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

/** Return the day-of-week (0 = Sunday ... 6 = Saturday) for `date` in `tz`. */
export function dayOfWeekInZone(date, tz) {
  let tag;
  try {
    tag = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
    }).format(date);
  } catch {
    return null;
  }
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const result = map[tag];
  return typeof result === 'number' ? result : null;
}

/** Return the local "HH:MM" in `tz` for `date`. */
export function hhmmInZone(date, tz) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  let hour;
  let minute;
  for (const part of parts) {
    if (part.type === 'hour') hour = part.value;
    else if (part.type === 'minute') minute = part.value;
  }
  if (!hour || !minute) return null;
  return `${hour}:${minute}`;
}

function resolveTimezone(schedule) {
  if (schedule.timezone === 'system' || !schedule.timezone) {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }
  return schedule.timezone;
}

/**
 * Returns true when `now` falls inside the configured time window. The
 * `schedule.enabled` flag is the master switch: when it is false we always
 * return true so legacy behavior (run whenever `settings.enabled` is true) is
 * preserved bit-for-bit.
 */
export function inScheduleWindow(schedule, now = new Date()) {
  if (!schedule?.enabled) return true;
  const start = parseHHMM(schedule.startTime);
  const end = parseHHMM(schedule.endTime);
  if (!start || !end) return true; // invalid schedule must not silently disable
  const tz = resolveTimezone(schedule);
  const days = Array.isArray(schedule.days) ? schedule.days : [];
  if (days.length > 0) {
    const dow = dayOfWeekInZone(now, tz);
    if (dow === null) return true;
    if (!days.includes(dow)) return false;
  }
  const current = hhmmInZone(now, tz);
  if (current === null) return true;
  const [sh, sm] = start;
  const [eh, em] = end;
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const nowMin = (() => {
    const [h, m] = current.split(':').map(Number);
    return h * 60 + m;
  })();
  if (startMin === endMin) return true; // 24h window
  if (startMin < endMin) {
    return nowMin >= startMin && nowMin < endMin;
  }
  // Cross-midnight window (e.g. 22:00-06:00): in if >= start OR < end.
  return nowMin >= startMin || nowMin < endMin;
}
