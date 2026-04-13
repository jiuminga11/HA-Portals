import client from "./client";
import type { Section, SectionType } from "../types";

export async function getSections(): Promise<Section[]> {
  const res = await client.get<Section[]>("/sections");
  return res.data;
}

export interface SectionCreatePayload {
  page_id: number;
  title_zh: string;
  title_en: string;
  type: SectionType;
  visible?: boolean;
  content?: Record<string, unknown>;
}

export interface SectionUpdatePayload {
  title_zh?: string;
  title_en?: string;
  visible?: boolean;
  content?: Record<string, unknown>;
}

export async function createSection(data: SectionCreatePayload): Promise<Section> {
  const res = await client.post<Section>("/sections", data);
  return res.data;
}

export async function updateSection(id: number, data: SectionUpdatePayload): Promise<Section> {
  const res = await client.put<Section>(`/sections/${id}`, data);
  return res.data;
}

export async function deleteSection(id: number): Promise<void> {
  await client.delete(`/sections/${id}`);
}

export async function reorderSections(orders: { id: number; sort_order: number }[]): Promise<Section[]> {
  const res = await client.put<Section[]>("/sections/reorder", { orders });
  return res.data;
}
