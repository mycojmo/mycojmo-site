// File-system helpers for the local post editor. Runs in Node only (inside
// the editor's Vite dev server); nothing here is part of the Astro build.
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const BLOG_DIR = path.join(ROOT, "src/content/blog");
export const PUBLIC_DIR = path.join(ROOT, "public");
// Uploaded images land here and are referenced as /images/blog/<file>.
export const UPLOAD_DIR = path.join(PUBLIC_DIR, "images/blog");
export const UPLOAD_URL_PREFIX = "/images/blog/";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EXTS = ["md", "mdx"];
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "avif", "svg"];
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Keys from the Zod schema in src/content.config.ts, in the order we write them.
const KNOWN_KEYS = ["title", "description", "pubDate", "updatedDate", "heroImage"];

export class HttpError extends Error {
  /** @param {number} status @param {string} message */
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** @param {unknown} slug */
export function assertSlug(slug) {
  if (typeof slug !== "string" || !SLUG_RE.test(slug)) {
    throw new HttpError(400, "Slug must be lowercase letters, numbers and single hyphens (e.g. my-new-post).");
  }
  return slug;
}

/** Parse a stored date string the same way z.coerce.date() does. */
function parseDate(value) {
  if (value instanceof Date) return value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  // A bare YYYY-MM-DD is read by JS as UTC midnight; treat it as a local date
  // so it does not shift a day when formatted.
  const m = typeof value === "string" && value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date -> "YYYY-MM-DD" for <input type="date">. */
function toInputDate(value) {
  const d = parseDate(value);
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD" -> "Sep 5 2025", matching the existing posts. */
function toStoredDate(inputDate) {
  const m = String(inputDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getMonth() !== Number(m[2]) - 1) return null;
  return `${MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;
}

/** @param {string} text */
export function splitPost(text) {
  const m = text.match(FRONTMATTER_RE);
  if (!m) return { data: {}, body: text };
  const data = YAML.parse(m[1]) ?? {};
  return { data: typeof data === "object" && !Array.isArray(data) ? data : {}, body: text.slice(m[0].length) };
}

/** True when a "/path" heroImage points at a real file under public/. */
function heroImageExists(src) {
  if (!src.startsWith("/") || src.startsWith("//")) return false;
  const file = path.resolve(PUBLIC_DIR, "." + decodeURI(src.split(/[?#]/)[0]));
  return file.startsWith(PUBLIC_DIR + path.sep) && existsSync(file);
}

async function findPostFile(slug) {
  for (const ext of EXTS) {
    const file = path.join(BLOG_DIR, `${slug}.${ext}`);
    if (existsSync(file)) return { file, ext };
  }
  return null;
}

export async function listPosts() {
  const names = (await readdir(BLOG_DIR)).filter((n) => /\.mdx?$/.test(n));
  const posts = await Promise.all(
    names.map(async (name) => {
      const { data } = splitPost(await readFile(path.join(BLOG_DIR, name), "utf8"));
      const pub = parseDate(data.pubDate);
      return {
        slug: name.replace(/\.mdx?$/, ""),
        ext: name.endsWith(".mdx") ? "mdx" : "md",
        title: typeof data.title === "string" ? data.title : name,
        pubDate: pub ? pub.toISOString() : null,
      };
    }),
  );
  return posts.sort((a, b) => (b.pubDate ?? "").localeCompare(a.pubDate ?? ""));
}

/** @param {string} slug */
export async function readPost(slug) {
  assertSlug(slug);
  const found = await findPostFile(slug);
  if (!found) throw new HttpError(404, `No post named ${slug}`);
  const { data, body } = splitPost(await readFile(found.file, "utf8"));
  const extra = Object.fromEntries(Object.entries(data).filter(([k]) => !KNOWN_KEYS.includes(k)));
  return {
    slug,
    ext: found.ext,
    title: data.title ?? "",
    description: data.description ?? "",
    pubDate: toInputDate(data.pubDate),
    updatedDate: toInputDate(data.updatedDate),
    heroImage: data.heroImage ?? "",
    extraKeys: Object.keys(extra),
    body,
  };
}

/**
 * Validate the editor payload against the content schema and write the file.
 * @param {any} input
 */
export async function savePost(input) {
  const slug = assertSlug(input?.slug);
  const isNew = input.isNew === true;
  const errors = [];
  const str = (v) => (typeof v === "string" ? v.trim() : "");

  const title = str(input.title);
  const description = str(input.description);
  const heroImage = str(input.heroImage);
  const body = typeof input.body === "string" ? input.body : "";
  if (!title) errors.push("Title is required.");
  if (!description) errors.push("Description is required.");
  const pubDate = toStoredDate(str(input.pubDate));
  if (!pubDate) errors.push("Publish date is required (YYYY-MM-DD).");
  let updatedDate = null;
  if (str(input.updatedDate)) {
    updatedDate = toStoredDate(str(input.updatedDate));
    if (!updatedDate) errors.push("Updated date is not a valid date.");
  }
  // The blog index (src/pages/blog/index.astro) renders every post's heroImage
  // with <Image>, so a post without one, or with a missing file, fails the build.
  if (!heroImage) {
    errors.push("Hero image is required (the blog index shows it as the post thumbnail).");
  } else if (!heroImageExists(heroImage)) {
    errors.push(`Hero image ${heroImage} was not found in public/. Upload it or use an existing /path.`);
  }
  if (errors.length) throw new HttpError(422, errors.join(" "));

  const existing = await findPostFile(slug);
  const ext = existing?.ext ?? (input.ext === "mdx" ? "mdx" : "md");
  let previous = {};
  if (isNew) {
    if (existing) throw new HttpError(409, `A post named ${slug} already exists. Pick another slug.`);
  } else {
    if (!existing) throw new HttpError(404, `No post named ${slug}`);
    previous = splitPost(await readFile(existing.file, "utf8")).data;
  }

  // Keep the original date string when the day did not change (it may carry a
  // time or a different format the author chose by hand).
  const keepIfSameDay = (stored, prev) =>
    prev !== undefined && toStoredDate(toInputDate(prev)) === stored ? prev : stored;

  /** @type {Record<string, unknown>} */
  const data = { title, description, pubDate: keepIfSameDay(pubDate, previous.pubDate) };
  if (updatedDate) data.updatedDate = keepIfSameDay(updatedDate, previous.updatedDate);
  if (heroImage) data.heroImage = heroImage;
  for (const [k, v] of Object.entries(previous)) if (!KNOWN_KEYS.includes(k)) data[k] = v;

  const yaml = new YAML.Document(data).toString({ defaultStringType: "QUOTE_DOUBLE", defaultKeyType: "PLAIN", lineWidth: 0 });
  const text = `---\n${yaml}---\n\n${body.replace(/^\s*\n/, "").replace(/\s*$/, "")}\n`;

  const file = path.join(BLOG_DIR, `${slug}.${ext}`);
  await writeFile(file, text, { encoding: "utf8", flag: isNew ? "wx" : "w" });
  return { slug, ext, file: path.relative(ROOT, file) };
}

/**
 * Store an uploaded image under public/images/blog/ without overwriting.
 * @param {string} originalName @param {Buffer} data
 */
export async function saveUpload(originalName, data) {
  const parsed = path.parse(path.basename(String(originalName || "image")));
  const ext = parsed.ext.slice(1).toLowerCase();
  if (!IMAGE_EXTS.includes(ext)) throw new HttpError(415, `Unsupported image type .${ext || "?"}`);
  if (!data.length) throw new HttpError(400, "Empty upload.");
  const base =
    parsed.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "image";
  await mkdir(UPLOAD_DIR, { recursive: true });
  for (let i = 0; i < 1000; i++) {
    const name = i === 0 ? `${base}.${ext}` : `${base}-${i}.${ext}`;
    try {
      await writeFile(path.join(UPLOAD_DIR, name), data, { flag: "wx" });
      return { url: UPLOAD_URL_PREFIX + name };
    } catch (err) {
      if (/** @type {any} */ (err).code !== "EEXIST") throw err;
    }
  }
  throw new HttpError(409, "Could not find a free file name for the upload.");
}
