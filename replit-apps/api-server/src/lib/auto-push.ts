import fs from "fs";
import path from "path";
import { logger } from "./logger";

const WORKSPACE = "/home/runner/workspace";
const OWNER = "savinalexandru2002-prog";
const REPO = "Alexandru-";
const PUSH_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".cache", ".replit-artifact", "cloned-repo"]);
const ALLOWED_EXTS = new Set([".ts", ".js", ".tsx", ".jsx", ".json", ".yaml", ".yml", ".html", ".css", ".md", ".txt"]);

export let lastPushTime: Date | null = null;
export let lastPushResults: { file: string; status: string }[] = [];
export let autoPushEnabled = false;

function walkDir(dir: string, base: string, results: { path: string; content: string }[]) {
  if (!fs.existsSync(dir)) return;
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.join(base, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, rel, results);
    } else {
      if (!ALLOWED_EXTS.has(path.extname(entry.name))) continue;
      try {
        const content = fs.readFileSync(full, "utf8");
        if (content.trim().length > 0) results.push({ path: rel, content });
      } catch { /* skip binary */ }
    }
  }
}

function collectFiles(): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];

  // Original cloned repo files
  const rootFiles = [
    { src: "cloned-repo/index.html", dest: "index.html" },
    { src: "cloned-repo/Termux MP3 player", dest: "Termux MP3 player" },
  ];
  for (const c of rootFiles) {
    const full = path.join(WORKSPACE, c.src);
    if (!fs.existsSync(full)) continue;
    try {
      const content = fs.readFileSync(full, "utf8");
      if (content.trim().length > 0) files.push({ path: c.dest, content });
    } catch { /* skip */ }
  }

  // All artifacts (one folder per app)
  const artifactsDir = path.join(WORKSPACE, "artifacts");
  if (fs.existsSync(artifactsDir)) {
    const artifacts = fs.readdirSync(artifactsDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);

    for (const artifact of artifacts) {
      const srcDir = path.join(artifactsDir, artifact, "src");
      const indexHtml = path.join(artifactsDir, artifact, "index.html");

      // Push src/ folder under replit-apps/<artifact>/
      walkDir(srcDir, `replit-apps/${artifact}/src`, files);

      // Push index.html if exists
      if (fs.existsSync(indexHtml)) {
        try {
          const content = fs.readFileSync(indexHtml, "utf8");
          if (content.trim().length > 0) files.push({ path: `replit-apps/${artifact}/index.html`, content });
        } catch { /* skip */ }
      }
    }
  }

  // API server source
  walkDir(path.join(WORKSPACE, "artifacts/api-server/src"), "replit-apps/api-server/src", files);

  return files;
}

async function pushFilesToGitHub(token: string): Promise<{ file: string; status: string }[]> {
  const files = collectFiles();
  const results: { file: string; status: string }[] = [];

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  for (const file of files) {
    const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(file.path)}`;
    const encoded = Buffer.from(file.content, "utf8").toString("base64");

    const tryPush = async (retries = 2): Promise<{ file: string; status: string }> => {
      try {
        let sha: string | undefined;
        const existing = await fetch(apiUrl, { headers });
        if (existing.ok) {
          const data = await existing.json() as { sha: string };
          sha = data.sha;
        }

        const body: Record<string, string> = {
          message: `Auto-push: update ${file.path}`,
          content: encoded,
        };
        if (sha) body.sha = sha;

        const put = await fetch(apiUrl, { method: "PUT", headers, body: JSON.stringify(body) });

        if (put.status === 409 && retries > 0) {
          // Stale SHA — wait briefly and retry with fresh SHA
          await new Promise(r => setTimeout(r, 300));
          return tryPush(retries - 1);
        }

        return { file: file.path, status: put.ok ? "pushed" : `failed (${put.status})` };
      } catch {
        return { file: file.path, status: "error" };
      }
    };

    results.push(await tryPush());
  }

  return results;
}

export async function triggerPush(): Promise<{ file: string; status: string }[]> {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!token) {
    logger.warn("Auto-push skipped: GITHUB_PERSONAL_ACCESS_TOKEN not set");
    return [];
  }
  logger.info("Auto-push: starting push to GitHub");
  const results = await pushFilesToGitHub(token);
  lastPushTime = new Date();
  lastPushResults = results;
  const pushed = results.filter(r => r.status === "pushed").length;
  logger.info({ pushed, total: results.length }, "Auto-push: complete");
  return results;
}

export function startAutoPush() {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!token) {
    logger.warn("Auto-push disabled: GITHUB_PERSONAL_ACCESS_TOKEN not set");
    return;
  }

  autoPushEnabled = true;
  logger.info({ intervalMs: PUSH_INTERVAL_MS }, "Auto-push: enabled");

  // Push immediately on startup
  triggerPush().catch(e => logger.error({ err: e }, "Auto-push: startup push failed"));

  // Then push on interval
  setInterval(() => {
    triggerPush().catch(e => logger.error({ err: e }, "Auto-push: scheduled push failed"));
  }, PUSH_INTERVAL_MS);
}
