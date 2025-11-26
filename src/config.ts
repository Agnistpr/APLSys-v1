// Frontend config used by files inside `src/`
export const API_BASE_URL =(() => {
  // Try environment variables first (Vite will inject these)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Fallback
  return "https://aplsys-backend-production.up.railway.app";
})();

export const PARSING_SERVICE_URL = "https://open-parser-api-production.up.railway.app";

export const BACKEND_URL = API_BASE_URL;
