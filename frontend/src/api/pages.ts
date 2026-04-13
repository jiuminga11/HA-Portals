import type { Page, Section } from "../types";
import { basePath } from "../lib/basePath";

export async function getPages(): Promise<Page[]> {
  const res = await fetch(`${basePath}/api/pages`);
  if (!res.ok) throw new Error("Failed to fetch pages");
  return res.json();
}

export async function getPageBySlug(slug: string): Promise<Page> {
  const res = await fetch(`${basePath}/api/pages/${slug}`);
  if (!res.ok) throw new Error(`Page not found: ${slug}`);
  return res.json();
}

export async function getPageSections(slug: string): Promise<Section[]> {
  const res = await fetch(`${basePath}/api/pages/${slug}/sections`);
  if (!res.ok) throw new Error(`Failed to fetch sections for: ${slug}`);
  return res.json();
}
