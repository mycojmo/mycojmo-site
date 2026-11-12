// Local-only blog post editor. Started with `npm run editor`; it lives outside
// src/ so Astro never builds it and it is never deployed with the Worker.
import { defineConfig } from "vite";
import { HttpError, listPosts, PUBLIC_DIR, readPost, savePost, saveUpload } from "./posts.mjs";

const HOST = "127.0.0.1";
const PORT = 4322;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/** @param {import("node:http").IncomingMessage} req @param {number} limit */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new HttpError(413, "Upload is too large (15 MB max)."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const LOCAL_HOSTS = [`${HOST}:${PORT}`, `localhost:${PORT}`];

/** Refuse requests addressed to another host name (DNS rebinding). */
function assertLocalHost(req) {
  if (!LOCAL_HOSTS.includes(req.headers.host ?? "")) throw new HttpError(403, "Unexpected Host header.");
}

/** Reject writes that do not come from the editor page itself. */
function assertSameOrigin(req) {
  const origin = req.headers.origin ?? "";
  if (!LOCAL_HOSTS.some((h) => origin === `http://${h}`)) throw new HttpError(403, "Cross-origin request refused.");
}

function editorApi() {
  return {
    name: "mycojmo-editor-api",
    /** @param {import("vite").ViteDevServer} server */
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", `http://${HOST}`);
        if (!url.pathname.startsWith("/api/")) return next();
        const send = (status, payload) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(payload));
        };
        try {
          assertLocalHost(req);
          const method = req.method ?? "GET";
          if (method !== "GET") assertSameOrigin(req);
          const postMatch = url.pathname.match(/^\/api\/posts\/([^/]+)$/);
          if (method === "GET" && url.pathname === "/api/posts") return send(200, await listPosts());
          if (method === "GET" && postMatch) return send(200, await readPost(decodeURIComponent(postMatch[1])));
          if (method === "POST" && url.pathname === "/api/posts") {
            const payload = JSON.parse((await readBody(req, MAX_UPLOAD_BYTES)).toString("utf8"));
            return send(200, await savePost(payload));
          }
          if (method === "POST" && url.pathname === "/api/upload") {
            const data = await readBody(req, MAX_UPLOAD_BYTES);
            return send(200, await saveUpload(url.searchParams.get("name") ?? "", data));
          }
          send(404, { error: "Not found" });
        } catch (err) {
          const status = err instanceof HttpError ? err.status : err instanceof SyntaxError ? 400 : 500;
          if (status === 500) server.config.logger.error(String(err?.stack ?? err));
          send(status, { error: err instanceof Error ? err.message : String(err) });
        }
      });
    },
  };
}

export default defineConfig({
  root: import.meta.dirname,
  // Serve the site's public/ so existing and uploaded images preview correctly.
  publicDir: PUBLIC_DIR,
  plugins: [editorApi()],
  server: { host: HOST, port: PORT, strictPort: true, open: true },
  logLevel: "info",
});
