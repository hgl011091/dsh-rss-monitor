async function gh(method, path, body) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN env var is required. Set it to a fine-grained token with `contents: write` on the target repo.');
  }
  const r = await fetch("https://api.github.com" + path, {
    method,
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch {}
  return { status: r.status, body: parsed ?? text };
}
const notes = [
  "# dsh-rss-monitor v0.2.6",
  "",
  "## Fixes (v0.2.5 -> v0.2.6)",
  "",
  "- **Hardcoded version bug in the client bundle.** The settings header",
  "  always showed `v0.2.0`, even when the package was 0.2.5. Root cause:",
  "  `plugin-src/client/build.mjs` only rewrote the literal `'0.1.0'`; after",
  "  the source was bumped to `'0.2.0'` (and then `'0.2.5'`) the regex",
  "  stopped matching and the old string stayed baked into `lib/client.js`.",
  "  The build script now matches any semver string literal, so any future",
  "  default in `plugin-src/client/index.js` or `RssSettingsTab`'s signature",
  "  is always replaced from `package.json`.",
  "- **`package.json` description corruption.** An earlier `Set-Content` call",
  "  re-escaped the `.` in `0.2.5` as `\\.`, making the manifest unparseable",
  "  (esbuild and node would both reject the JSON). Re-encoded as plain text.",
  "- **JSX/CRLF preservation in `app.js`.** A wholesale line-ending rewrite",
  "  was producing a 1075-line deletion / 1075-line insertion in `git diff`",
  "  with no actual content change. Discarded; only the real `build.mjs` /",
  "  `index.js` / `package.json` / `lib/*.js` updates land in this release.",
  "",
  "## Why 0.2.6 instead of overwriting 0.2.5",
  "",
  "NPM's `npm publish` does not let a `granular access token` overwrite a",
  "previously published version: 0.2.5 stays in the registry as the broken",
  "build. Bumping to 0.2.6 is the only path that makes DSH's plugin store",
  "redownload the corrected `lib/client.js` for users on 0.2.5.",
  "",
  "## Install",
  "",
  "```",
  "dsh plugin --profile desktop add -wE dsh-rss-monitor@0.2.6",
  "```",
  "",
  "## Quality",
  "",
  "- 58/58 unit tests passing",
  "- `lib/client.js` 71.3 KB (React 18 + jsdom 25)",
  "- `lib/index.js` 29.7 KB ESM (rss-parser + nodemailer as real deps)",
  "- Verified: dshmarket install dry-run resolves, dynamic import returns the",
  "  expected `apply` / `name` / `inject` surface.",
].join("\n");
const r = await gh("POST", "/repos/hgl011091/dsh-rss-monitor/releases", {
  tag_name: "v0.2.6",
  name: "v0.2.6 - fix hardcoded version 0.2.0 in client bundle",
  body: notes,
  draft: false,
  prerelease: false,
});
console.log("status:", r.status);
if (r.status === 201) {
  console.log("release url:", r.body.html_url);
} else {
  console.log("error:", typeof r.body === "string" ? r.body.substring(0, 500) : JSON.stringify(r.body).substring(0, 500));
}
