import client from "./client";
import type { SiteConfig } from "../types";

export async function getSiteConfig(): Promise<SiteConfig> {
  const res = await client.get<SiteConfig>("/site-config");
  return res.data;
}

export async function updateSiteConfig(data: Record<string, string | null | undefined>): Promise<SiteConfig> {
  const res = await client.put<SiteConfig>("/site-config", data);
  return res.data;
}
