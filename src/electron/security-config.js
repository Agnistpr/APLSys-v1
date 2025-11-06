export const cspDirectives = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'blob:', 'data:'],
  'media-src': ["'self'", 'blob:'],
  'font-src': ["'self'", 'data:'],
  'frame-src': ["'self'", 'blob:'],
  'object-src': ["'self'", 'blob:'], 
  'connect-src': [
    "'self'",
    'blob:',
    'data:',
    'http://127.0.0.1:8000',
    'http://localhost:8000',
    'https://*.railway.app',
    'https://cdn.jsdelivr.net',
    'https://generativelanguage.googleapis.com',
    'https://*.supabase.co',
  ]
};
