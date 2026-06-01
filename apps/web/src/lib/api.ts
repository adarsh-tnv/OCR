import axios from "axios";
import { getAuthToken, notifyUnauthorized } from "@/lib/auth-token";
import type {
  CertificateRecord,
  DashboardCharts,
  DashboardStatistics,
  FileChatResult,
  Paginated,
  PredefinedExtractionResult,
  PredefinedField,
  UploadedFile
} from "@/types/api";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api",
  timeout: 120_000
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      notifyUnauthorized();
    }
    return Promise.reject(error);
  }
);

export const getDashboardStatistics = async () =>
  (await api.get<DashboardStatistics>("/dashboard/statistics")).data;

export const getDashboardCharts = async () => (await api.get<DashboardCharts>("/dashboard/charts")).data;

export const listFiles = async (params?: Record<string, string | number>) =>
  (await api.get<Paginated<UploadedFile>>("/files", { params })).data;

export const getFile = async (fileId: string) => (await api.get<UploadedFile>(`/files/${fileId}`)).data;

export const uploadFiles = async (
  files: File[],
  onUploadProgress?: (progress: number) => void
) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  const response = await api.post<{ items: UploadedFile[] }>("/files/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (!event.total) return;
      onUploadProgress?.(Math.round((event.loaded / event.total) * 100));
    }
  });
  return response.data;
};

export const getPreview = async (fileId: string) =>
  (await api.get<{ url: string; expiresAt: string }>(`/files/${fileId}/preview`)).data;

export const getDefaultExtractionFields = async () =>
  (await api.get<{ items: PredefinedField[] }>("/files/extraction-fields/defaults")).data;

export const extractPredefinedFields = async (
  fileId: string,
  fields?: Array<string | PredefinedField>
) =>
  (
    await api.post<PredefinedExtractionResult>(`/files/${fileId}/extract-fields`, {
      ...(fields?.length ? { fields } : {})
    })
  ).data;

export const chatWithFile = async (fileId: string, message: string) =>
  (await api.post<FileChatResult>(`/files/${fileId}/chat`, { message })).data;

export const retryOcr = async (fileId: string) =>
  (await api.post<{ fileId: string; processingJobId: string; queueJobId: string }>(`/ocr/${fileId}/retry`)).data;

export const getOcrResult = async (fileId: string) => (await api.get(`/ocr/${fileId}`)).data;

export const listCertificates = async (params?: Record<string, string | number>) =>
  (await api.get<Paginated<CertificateRecord>>("/certificates", { params })).data;

export const getCertificate = async (id: string) =>
  (await api.get<CertificateRecord>(`/certificates/${id}`)).data;

export const updateCertificate = async (id: string, payload: Record<string, unknown>) =>
  (await api.patch<CertificateRecord>(`/certificates/${id}`, payload)).data;

export const getReviewQueue = async () =>
  (await api.get<{ items: CertificateRecord[] }>("/review/queue")).data;

export const addCertificateComment = async (id: string, payload: { authorName: string; comment: string }) =>
  (await api.post(`/certificates/${id}/comments`, payload)).data;

export const downloadCertificateExport = async (id: string, format: "json" | "csv" | "xlsx" | "pdf") => {
  const response = await api.get<ArrayBuffer>(`/exports/certificates/${id}`, {
    params: { format },
    responseType: "arraybuffer"
  });

  const contentTypeHeader = response.headers["content-type"];
  const contentType = typeof contentTypeHeader === "string" ? contentTypeHeader : "application/octet-stream";
  const blob = new Blob([response.data], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `certificate-${id}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
