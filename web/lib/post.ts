import { readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";

export type Post = { title: string; description: string; date: string; html: string };

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Read a markdown post with a simple `key: "value"` front matter block. Runs at build time. */
export async function loadPost(name: string): Promise<Post> {
  const source = await readFile(path.join(process.cwd(), "content", `${name}.md`), "utf8");
  const [, front, body] = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/) ?? [];
  const meta = Object.fromEntries(
    front.split("\n").map((line) => {
      const [key, ...rest] = line.split(":");
      return [key.trim(), rest.join(":").trim().replace(/^"|"$/g, "")];
    }),
  );
  // Root-relative image links need the base path when the site is served under a sub-path.
  const html = (await marked.parse(body)).replaceAll('src="/', `src="${basePath}/`);
  return { title: meta.title, description: meta.description, date: meta.date, html };
}
