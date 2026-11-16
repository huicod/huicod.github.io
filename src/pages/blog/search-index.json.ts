import { getCollection } from "astro:content";
import createSlug from "../../lib/createSlug";
import { getPaperFacets } from "../../data/paper-taxonomy";

export async function GET() {
  const posts = (await getCollection("blog"))
    .filter((post) => !post.data.draft)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  return new Response(JSON.stringify(posts.map((post) => ({
    title: post.data.title,
    description: post.data.description,
    tags: post.data.tags ?? [],
    badge: post.data.badge ?? "",
    facets: getPaperFacets(post.slug),
    url: "/blog/" + createSlug(post.data.title, post.slug) + "/",
  }))), { headers: { "Content-Type": "application/json; charset=utf-8" } });
}
