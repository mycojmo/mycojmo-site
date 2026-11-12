taking over from here, ty

## Writing posts with the local editor

```sh
npm run editor
```

This opens a local-only editor at http://127.0.0.1:4322 (it lives in `editor/`, outside `src/`, so it is never built or deployed). From there you can:

- Pick an existing post from the sidebar, or click **+ New post** (the slug is filled in from the title and can be changed before the first save).
- Fill in the frontmatter fields. New posts get today's publish date, and opening an existing post sets **Updated date** to today (clear it to leave it out).
- Write the body in the WYSIWYG editor, or switch to the **Markdown** tab at the bottom. `.mdx` posts always open as raw source so JSX is kept exactly.
- Upload images with **Upload...** (hero image) or by pasting or using the image button in the editor. Files go to `public/images/blog/`.
- **Save** (or Cmd/Ctrl+S) writes `src/content/blog/<slug>.md`. Saving is blocked until the required fields are filled in, including a hero image that exists in `public/`, because the blog index shows it as each post's thumbnail.

The editor never commits, pushes, or deploys. To publish, review the post with `npm run dev`, run `npm run check`, then commit the post (and any new images in `public/images/blog/`) and open a PR.

## Astro Credit

This theme is based off of the lovely [Bear Blog](https://github.com/HermanMartinus/bearblog/).
