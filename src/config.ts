// Frontend config used by files inside `src/`
export const API_BASE_URL =
  (typeof process !== 'undefined' && process.env && (process.env.NEXT_PUBLIC_API_BASE_URL as string)) ||
  (typeof process !== 'undefined' && process.env && (process.env.VITE_API_URL as string)) ||
  "https://aplsys-backend-production.up.railway.app";

export const BACKEND_URL = API_BASE_URL;
