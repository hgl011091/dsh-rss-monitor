import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { normalizeConfig } from './protocol.mjs';

/**
 * Durable store for dsh-rss configuration (settings, feeds, email config).
 * Writes are queued, atomic (tmp file + rename), and owner-readable only.
 * SMTP passwords never live here — they are referenced by `passRef` and kept
 * in the Harness credential store.
 */
export class RssConfigStore {
  #path;
  #value = null;
  #queue = Promise.resolve();
  #logger;

  constructor(path, { logger = console } = {}) {
    this.#path = path;
    this.#logger = logger;
  }

  async load() {
    try {
      const normalized = normalizeConfig(JSON.parse(await readFile(this.#path, 'utf8')));
      if (!normalized) throw new Error('dsh-rss-monitor config is invalid');
      this.#value = normalized;
    } catch (error) {
      if (error?.code === 'ENOENT') {
        this.#value = normalizeConfig({});
      } else {
        // A corrupted/unreadable file must not brick the whole plugin: fall
        // back to defaults and let the next save rewrite a fresh file.
        this.#logger?.warn?.(`[dsh-rss-monitor] config unreadable (${error?.message}); starting from defaults`);
        this.#value = normalizeConfig({});
      }
    }
    return this;
  }

  get() {
    return this.#value ? structuredClone(this.#value) : null;
  }

  async save(value) {
    const normalized = normalizeConfig(value);
    if (!normalized) throw new Error('Refusing to persist invalid dsh-rss-monitor configuration');
    const operation = this.#queue.then(async () => {
      await mkdir(dirname(this.#path), { recursive: true, mode: 0o700 });
      const temporary = `${this.#path}.tmp`;
      await writeFile(temporary, `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 });
      await rename(temporary, this.#path);
      this.#value = normalized;
    });
    this.#queue = operation.then(() => undefined, () => undefined);
    await operation;
    return this.get();
  }
}
