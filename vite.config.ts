import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";

const PUBLIC_DIR = "public";

function filesUnder(dir: string, base = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(full, base);
    return [`/${full.slice(base.length + 1).split(/[\\/]/).join("/")}`];
  });
}

/**
 * Emits a service worker that precaches the whole app.
 *
 * Notes live on the writer's own disk, so the only thing standing between them
 * and their diary on a train is this file. Written by hand rather than with a
 * plugin: the whole strategy is fifteen lines, and there is nothing here worth
 * a dependency.
 */
function serviceWorker(): Plugin {
  return {
    name: "typer:service-worker",
    apply: "build",
    generateBundle(_options, bundle) {
      const precache = [
        "/",
        ...Object.keys(bundle).map((file) => `/${file}`),
        ...filesUnder(PUBLIC_DIR),
      ].sort();

      // Any change to the asset list or their hashed names retires the old cache.
      const version = createHash("sha256").update(precache.join("\n")).digest("hex").slice(0, 12);

      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: `const CACHE = "typer-${version}";
const PRECACHE = ${JSON.stringify(precache, null, 2)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  // The document is fetched fresh when there is a network, so a deploy is
  // picked up on the next load; the cache is what makes it work without one.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/index.html").then((r) => r || caches.match("/"))));
    return;
  }

  // Everything else is content-hashed or static: cache first.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
`,
      });
    },
  };
}

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

/**
 * The second half of the version: which commit this was built from, and when.
 *
 * `deploy.sh` builds the working tree rather than a commit, so a bare hash can
 * lie — it names a commit that is missing whatever was still uncommitted. The
 * `+` is what keeps it honest. Empty when there is no git at all: someone
 * building from a downloaded archive gets a version without a build, not a
 * failed build.
 */
function buildStamp(): string {
  let commit: string;
  try {
    commit = git("rev-parse", "--short", "HEAD") + (git("status", "--porcelain") ? "+" : "");
  } catch {
    return "";
  }

  // Deliberately ISO rather than localized: the notes on disk are named
  // 2026-09-04.md, and the version speaks the same dates the files do.
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return `${commit} · ${date} ${time}`;
}

const { version } = JSON.parse(readFileSync("package.json", "utf8")) as { version: string };

export default defineConfig({
  plugins: [serviceWorker()],
  define: {
    __VERSION__: JSON.stringify(version),
    __BUILD__: JSON.stringify(buildStamp()),
  },
});
