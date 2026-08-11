const rawBaseUrl = import.meta.env.BASE_URL || "/app/";
const normalizedBase = rawBaseUrl.replace(/\/$/, "");

export const APP_BASE_PATH = normalizedBase || "/app";
export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";
