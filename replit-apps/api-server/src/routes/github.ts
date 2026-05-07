import { Router, type IRouter } from "express";
import fs from "fs";
import path from "path";
import { lastPushTime, lastPushResults, autoPushEnabled, triggerPush } from "../lib/auto-push";

const router: IRouter = Router();

const WORKSPACE = "/home/runner/workspace";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".cache"]);
const ALLOWED_EXTS = new Set([".ts", ".js", ".tsx", ".jsx", ".json", ".yaml", ".yml", ".html", ".css", ".md", ".txt", ".env.example"]);

function walkDir(dir: string, base: string, results: { path: string; content: string }[]) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.join(base, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, rel, results);
    } else {
      const ext = path.extname(entry.name);
      if (!ALLOWED_EXTS.has(ext)) continue;
      try {
        const content = fs.readFileSync(full, "utf8");
        if (content.trim().length > 0) {
          results.push({ path: rel, content });
        }
      } catch {
        // skip binary files
      }
    }
  }
}

function getFilesToPush(): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];

  // Original cloned repo files at root level
  const rootFiles = [
    { src: "cloned-repo/index.html", dest: "index.html" },
    { src: "cloned-repo/Termux MP3 player", dest: "Termux MP3 player" },
    { src: "cloned-repo/MP3 player nou și inbunstatit", dest: "MP3 player nou și inbunstatit" },
  ];
  for (const c of rootFiles) {
    const full = path.join(WORKSPACE, c.src);
    if (fs.existsSync(full)) {
      try {
        const content = fs.readFileSync(full, "utf8");
        if (content.trim().length > 0) files.push({ path: c.dest, content });
      } catch { /* skip */ }
    }
  }

  // Replit app: GitHub connect page
  const connectPage = path.join(WORKSPACE, "artifacts/mp3-player/index.html");
  if (fs.existsSync(connectPage)) {
    try {
      const content = fs.readFileSync(connectPage, "utf8");
      if (content.trim().length > 0) files.push({ path: "replit-app/index.html", content });
    } catch { /* skip */ }
  }

  // Replit API server source files
  walkDir(path.join(WORKSPACE, "artifacts/api-server/src"), "replit-app/api-server", files);

  // Lib files
  walkDir(path.join(WORKSPACE, "lib/api-spec"), "replit-app/lib/api-spec", files);

  return files;
}

router.get("/github/status", (_req, res): void => {
  res.json({
    enabled: autoPushEnabled,
    isPushing,
    lastPushTime: lastPushTime?.toISOString() ?? null,
    lastPushResults,
  });
});

router.post("/github/trigger", (_req, res): void => {
  // Fire and forget — respond immediately, push runs in background
  triggerPush().catch(e => console.error("Manual trigger push failed", e));
  res.json({ started: true });
});

router.post("/github/verify", async (req, res): Promise<void> => {
  const { token } = req.body as { token?: string };
  if (!token) {
    res.status(400).json({ error: "Token is required" });
    return;
  }

  const resp = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!resp.ok) {
    res.status(401).json({ error: "Invalid token. Make sure it has repo access." });
    return;
  }

  const user = await resp.json() as { login: string; name: string; avatar_url: string };
  res.json({ login: user.login, name: user.name, avatar_url: user.avatar_url });
});

router.post("/github/push", async (req, res): Promise<void> => {
  const { token, owner, repo } = req.body as { token?: string; owner?: string; repo?: string };

  if (!token || !owner || !repo) {
    res.status(400).json({ error: "token, owner, and repo are required" });
    return;
  }

  const files = getFilesToPush();
  if (files.length === 0) {
    res.status(400).json({ error: "No files found to push" });
    return;
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };

  const results: { file: string; status: string }[] = [];

  for (const file of files) {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(file.path)}`;

    let sha: string | undefined;
    const existing = await fetch(apiUrl, { headers });
    if (existing.ok) {
      const data = await existing.json() as { sha: string };
      sha = data.sha;
    }

    const encoded = Buffer.from(file.content, "utf8").toString("base64");

    const body: Record<string, string> = {
      message: `Update ${file.path} from Replit`,
      content: encoded,
    };
    if (sha) body.sha = sha;

    const put = await fetch(apiUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });

    results.push({
      file: file.path,
      status: put.ok ? "pushed" : `failed (${put.status})`,
    });
  }

  res.json({ results });
});

export default router;
