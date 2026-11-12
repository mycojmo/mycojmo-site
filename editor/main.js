import Editor from "@toast-ui/editor";
import "@toast-ui/editor/dist/toastui-editor.css";
import "./editor.css";

const $ = (sel) => document.querySelector(sel);
const form = /** @type {HTMLFormElement} */ ($("#post-form"));
const field = (name) => /** @type {HTMLInputElement} */ (form.elements.namedItem(name));
const statusEl = $("#status");
const rawEditor = /** @type {HTMLTextAreaElement} */ ($("#raw-editor"));

/** @type {{ isNew: boolean, slug: string | null, ext: string, slugTouched: boolean, dirty: boolean }} */
const state = { isNew: true, slug: null, ext: "md", slugTouched: false, dirty: false };

async function api(path, options = {}) {
  const res = await fetch(path, options);
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || `Request failed (${res.status})`);
  return payload;
}

async function uploadImage(file) {
  return api(`/api/upload?name=${encodeURIComponent(file.name || "image.png")}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: file,
  });
}

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.className = kind;
}

const editor = new Editor({
  el: $("#editor"),
  height: "70vh",
  minHeight: "360px",
  initialEditType: "wysiwyg",
  previewStyle: "vertical",
  usageStatistics: false,
  autofocus: false,
  hooks: {
    async addImageBlobHook(blob, callback) {
      try {
        setStatus("Uploading image…");
        const { url } = await uploadImage(blob);
        callback(url, blob.name ? blob.name.replace(/\.[^.]+$/, "") : "");
        setStatus(`Uploaded ${url}`, "ok");
      } catch (err) {
        setStatus(err.message, "error");
      }
    },
  },
  events: { change: () => markDirty() },
});

function markDirty() {
  state.dirty = true;
}

const isRaw = () => state.ext === "mdx";

function getBody() {
  return isRaw() ? rawEditor.value : editor.getMarkdown();
}

function setBody(markdown) {
  if (isRaw()) {
    rawEditor.value = markdown;
  } else {
    editor.setMarkdown(markdown, false);
  }
}

function applyMode() {
  $("#editor").hidden = isRaw();
  rawEditor.hidden = !isRaw();
}

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function updateHeroPreview() {
  const img = /** @type {HTMLImageElement} */ ($("#hero-preview"));
  const src = field("heroImage").value.trim();
  img.hidden = !src;
  if (src) img.src = src;
}

function updateSlugPreview() {
  $("#slug-preview").textContent = field("slug").value || "…";
}

function confirmDiscard() {
  return !state.dirty || confirm("You have unsaved changes. Discard them?");
}

async function refreshList() {
  const posts = await api("/api/posts");
  const list = $("#post-list");
  list.replaceChildren(
    ...posts.map((post) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = post.slug === state.slug && !state.isNew ? "active" : "";
      btn.innerHTML = `<strong></strong><small></small>`;
      btn.querySelector("strong").textContent = post.title;
      btn.querySelector("small").textContent =
        (post.pubDate ? new Date(post.pubDate).toLocaleDateString("en-US", { dateStyle: "medium" }) : "no date") +
        (post.ext === "mdx" ? " · mdx" : "");
      btn.addEventListener("click", () => openPost(post.slug));
      li.append(btn);
      return li;
    }),
  );
}

function newPost() {
  if (!confirmDiscard()) return;
  Object.assign(state, { isNew: true, slug: null, ext: "md", slugTouched: false });
  form.reset();
  field("pubDate").value = today();
  field("slug").readOnly = false;
  field("ext").disabled = false;
  field("ext").value = "md";
  $("#form-heading").textContent = "New post";
  $("#extra-keys").hidden = true;
  applyMode();
  setBody("");
  rawEditor.value = "";
  updateHeroPreview();
  updateSlugPreview();
  history.replaceState(null, "", "#new");
  state.dirty = false;
  setStatus("");
  refreshList();
  field("title").focus();
}

async function openPost(slug) {
  if (!confirmDiscard()) return;
  try {
    const post = await api(`/api/posts/${encodeURIComponent(slug)}`);
    Object.assign(state, { isNew: false, slug: post.slug, ext: post.ext, slugTouched: true });
    field("title").value = post.title;
    field("slug").value = post.slug;
    field("slug").readOnly = true;
    field("ext").value = post.ext;
    field("ext").disabled = true;
    field("description").value = post.description;
    field("pubDate").value = post.pubDate;
    field("updatedDate").value = today();
    field("heroImage").value = post.heroImage;
    const extra = $("#extra-keys");
    extra.hidden = post.extraKeys.length === 0;
    extra.textContent = `Other frontmatter kept as-is: ${post.extraKeys.join(", ")}`;
    $("#form-heading").textContent = `Editing ${post.slug}.${post.ext}`;
    applyMode();
    setBody(post.body);
    updateHeroPreview();
    updateSlugPreview();
    history.replaceState(null, "", `#${post.slug}`);
    state.dirty = false;
    setStatus(post.ext === "mdx" ? "MDX opens in raw mode so JSX is kept exactly." : "");
    refreshList();
  } catch (err) {
    setStatus(err.message, "error");
  }
}

function validate() {
  const problems = [];
  if (!field("title").value.trim()) problems.push("title");
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(field("slug").value)) problems.push("slug");
  if (!field("description").value.trim()) problems.push("description");
  if (!field("pubDate").value) problems.push("publish date");
  if (!field("heroImage").value.trim()) problems.push("hero image");
  const labels = { pubDate: "publish date", heroImage: "hero image" };
  for (const name of ["title", "slug", "description", "pubDate", "heroImage"]) {
    field(name).classList.toggle("invalid", problems.includes(labels[name] ?? name));
  }
  return problems;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const problems = validate();
  if (problems.length) {
    setStatus(`Fix before saving: ${problems.join(", ")}`, "error");
    return;
  }
  const payload = {
    isNew: state.isNew,
    slug: field("slug").value,
    ext: field("ext").value,
    title: field("title").value,
    description: field("description").value,
    pubDate: field("pubDate").value,
    updatedDate: field("updatedDate").value,
    heroImage: field("heroImage").value,
    body: getBody(),
  };
  try {
    setStatus("Saving…");
    const saved = await api("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    state.dirty = false;
    setStatus(`Saved ${saved.file}`, "ok");
    if (state.isNew) await openPost(saved.slug);
    else await refreshList();
    setStatus(`Saved ${saved.file}`, "ok");
  } catch (err) {
    setStatus(err.message, "error");
  }
});

field("title").addEventListener("input", () => {
  if (state.isNew && !state.slugTouched) {
    field("slug").value = slugify(field("title").value);
    updateSlugPreview();
  }
});
field("slug").addEventListener("input", () => {
  state.slugTouched = true;
  updateSlugPreview();
});
field("ext").addEventListener("change", () => {
  const body = getBody();
  state.ext = field("ext").value;
  applyMode();
  setBody(body);
});
field("heroImage").addEventListener("change", updateHeroPreview);
form.addEventListener("input", markDirty);
rawEditor.addEventListener("input", markDirty);

$("#hero-upload").addEventListener("change", async (event) => {
  const input = /** @type {HTMLInputElement} */ (event.target);
  const file = input.files?.[0];
  if (!file) return;
  try {
    setStatus("Uploading image…");
    const { url } = await uploadImage(file);
    field("heroImage").value = url;
    updateHeroPreview();
    markDirty();
    setStatus(`Uploaded ${url}`, "ok");
  } catch (err) {
    setStatus(err.message, "error");
  } finally {
    input.value = "";
  }
});

$("#new-post").addEventListener("click", newPost);
window.addEventListener("beforeunload", (event) => {
  if (state.dirty) event.preventDefault();
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "s") {
    event.preventDefault();
    form.requestSubmit();
  }
});

function openFromHash() {
  const target = decodeURIComponent(location.hash.slice(1));
  if (target && target !== "new") {
    if (state.isNew || target !== state.slug) openPost(target);
  } else if (!state.isNew || state.slug === null) {
    newPost();
  }
}
window.addEventListener("hashchange", openFromHash);
openFromHash();
