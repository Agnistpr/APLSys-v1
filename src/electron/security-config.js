export const cspDirectives = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'",],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'blob:', 'data:', 'https://*.supabase.co', 'https://view.officeapps.live.com', 'https://psg4-word-view.officeapps.live.com/', 'https://psg3-word-view.officeapps.live.com/','https://res.public.onecdn.static.microsoft'],
  'media-src': ["'self'", 'blob:'],
  'font-src': ["'self'", 'data:'],
  'frame-src': ["'self'", 'blob:', 'https://*.supabase.co', 'https://view.officeapps.live.com', 'https://psg4-word-view.officeapps.live.com/', 'https://psg3-word-view.officeapps.live.com/','https://res.public.onecdn.static.microsoft'],
  'object-src': ["'self'", 'blob:', 'data:', 'https://*.supabase.co'], 
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
