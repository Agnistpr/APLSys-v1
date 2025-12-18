
// Public API base URL used by the frontend. Prefer environment variables in production.
export const API_BASE_URL =
	process.env.NEXT_PUBLIC_API_BASE_URL || process.env.VITE_API_URL || "https://aplsys-backend-331525477255.asia-east1.run.app";

export const PARSING_SERVICE_URL =
	process.env.NEXT_PUBLIC_PARSING_SERVICE_URL || "https://open-parser-api-production.up.railway.app";

// Backwards-compatible alias
export const BACKEND_URL = API_BASE_URL;


export const DEV_TEST_URL = "http://localhost:8080"
