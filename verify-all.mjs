async function tryFetch(url, timeout = 8000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeout);
  try {
    const r = await fetch(url, { cache: "no-store", signal: c.signal });
    clearTimeout(t);
    return r;
  } catch (e) {
    clearTimeout(t);
    return null;
  }
}

console.log("=== 1. GitHub ===");
const repo = await tryFetch("https://api.github.com/repos/hgl011091/dsh-rss-monitor", 5000);
if (repo && repo.ok) {
  const j = await repo.json();
  console.log("  default branch:", j.default_branch);
  console.log("  size:", j.size, "KB");
}
const tags = await tryFetch("https://api.github.com/repos/hgl011091/dsh-rss-monitor/tags", 5000);
const tagsJ = tags ? await tags.json() : [];
console.log("  tags:", tagsJ.map((t) => t.name).join(", "));
const releases = await tryFetch("https://api.github.com/repos/hgl011091/dsh-rss-monitor/releases", 5000);
const releasesJ = releases ? await releases.json() : [];
console.log("  latest release:", releasesJ[0]?.tag_name, "-", releasesJ[0]?.name);

console.log("");
console.log("=== 2. NPM ===");
const npmLatest = await tryFetch("https://registry.npmjs.org/dsh-rss-monitor", 5000);
const npmJ = npmLatest ? await npmLatest.json() : null;
console.log("  dist-tags.latest:", npmJ?.["dist-tags"]?.latest);
console.log("  versions:", Object.keys(npmJ?.versions || {}).join(", "));
const npm026 = npmJ?.versions?.["0.2.6"];
if (npm026) {
  console.log("  0.2.6 size:", npm026.dist?.unpackedSize, "bytes");
  console.log("  0.2.6 dependencies:", JSON.stringify(npm026.dependencies));
}

console.log("");
console.log("=== 3. DSH 端 ===");
const fs = await import("node:fs");
const installedPath = "C:/Users/hgl01/.dsh/profiles/desktop/node_modules/dsh-rss-monitor/package.json";
if (fs.existsSync(installedPath)) {
  const pkg = JSON.parse(fs.readFileSync(installedPath, "utf8"));
  console.log("  installed version:", pkg.version);
} else {
  console.log("  dsh-rss-monitor NOT installed in DSH profile");
}
const cachePath = "C:/Users/hgl01/.dsh/profiles/desktop/.dsh-market/discovery-compatibility-v1.json";
if (fs.existsSync(cachePath)) {
  const cache = JSON.parse(fs.readFileSync(cachePath, "utf8"));
  const rss = cache.entries?.["dsh-rss-monitor"];
  console.log("  dshmarket cache version:", rss?.facts?.version);
}
const dshLog = "C:/Users/hgl01/AppData/Roaming/DSH Desktop/logs/dsh-2026-09-04.log";
if (fs.existsSync(dshLog)) {
  const lines = fs.readFileSync(dshLog, "utf8").split("\n").filter((l) => l.includes("dsh-rss-monitor")).slice(-5);
  console.log("  latest dsh log entries:");
  for (const l of lines) console.log("    " + l.substring(0, 200));
}
