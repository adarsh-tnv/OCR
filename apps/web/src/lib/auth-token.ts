export const AUTH_TOKEN_STORAGE_KEY = "iso-ocr-api-token";
export const AUTH_TOKEN_CHANGED_EVENT = "iso-ocr-api-token-changed";
export const API_UNAUTHORIZED_EVENT = "iso-ocr-api-unauthorized";

export const getAuthToken = () => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ?? "";
};

export const setAuthToken = (token: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  window.dispatchEvent(new Event(AUTH_TOKEN_CHANGED_EVENT));
};

export const clearAuthToken = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.dispatchEvent(new Event(AUTH_TOKEN_CHANGED_EVENT));
};

export const notifyUnauthorized = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(API_UNAUTHORIZED_EVENT));
};
