import type { Metadata } from "next";
import Link from "next/link";
import { loadPost } from "@/lib/post";

export async function generateMetadata(): Promise<Metadata> {
  const post = await loadPost("blog");
  return { title: `${post.title} · Statistical Twin`, description: post.description };
}

export default async function BlogPage() {
  const post = await loadPost("blog");
  const date = new Date(`${post.date}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <main className="wrap">
      <nav className="top">
        <Link className="wordmark" href="/">
          statistical twin
        </Link>
        <Link className="cta quiet" href="/">
          Open the app <span className="arrow">→</span>
        </Link>
      </nav>
      <article className="post">
        <header>
          <span className="ov">Write-up · {date}</span>
          <h1>{post.title}</h1>
          <p className="lede">{post.description}</p>
        </header>
        <div className="prose" dangerouslySetInnerHTML={{ __html: post.html }} />
      </article>
    </main>
  );
}
