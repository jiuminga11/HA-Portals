import client from "./client";
import type { UploadResponse, FileResponse } from "../types";

export async function uploadFile(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await client.post<UploadResponse>("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  });
  return res.data;
}

export async function getFiles(type: "image" | "video" | "all" = "all"): Promise<FileResponse[]> {
  const res = await client.get<FileResponse[]>("/files", { params: { type } });
  return res.data;
}

export async function deleteFile(id: number): Promise<void> {
  await client.delete(`/files/${id}`);
}
