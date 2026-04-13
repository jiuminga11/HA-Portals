import client from "./client";
import type { Page } from "../types";

export interface PageCreatePayload {
  slug: string;
  title_zh: string;
  title_en?: string;
  meta_description_zh?: string;
  meta_description_en?: string;
  visible?: boolean;
}

export interface PageUpdatePayload {
  slug?: string;
  title_zh?: string;
  title_en?: string;
  meta_description_zh?: string;
  meta_description_en?: string;
  visible?: boolean;
}

export async function getAdminPages(): Promise<Page[]> {
  const res = await client.get<Page[]>("/admin/pages");
  return res.data;
}

export async function createPage(data: PageCreatePayload): Promise<Page> {
  const res = await client.post<Page>("/admin/pages", data);
  return res.data;
}

export async function updatePage(id: number, data: PageUpdatePayload): Promise<Page> {
  const res = await client.put<Page>(`/admin/pages/${id}`, data);
  return res.data;
}

export async function deletePage(id: number): Promise<void> {
  await client.delete(`/admin/pages/${id}`);
}

export async function reorderPages(
  orders: { id: number; sort_order: number }[]
): Promise<Page[]> {
  const res = await client.put<Page[]>("/admin/pages/reorder", { orders });
  return res.data;
}
