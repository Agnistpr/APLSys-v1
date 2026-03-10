export const cspDirectives = {
  // Base policy
  'default-src': ["'self'"],
  // Scripts: allow Office viewer domains (no wildcard duplicates)
  'script-src': [
    "'self'",
    "'unsafe-inline'",
    'https://*.cdn.office.net',
    'https://res.public.onecdn.static.microsoft',
    'https://view.officeapps.live.com',
    'https://*.officeapps.live.com'
  ],
  // Styles: allow Office viewer styles
  'style-src': [
    "'self'",
    "'unsafe-inline'",
    'https://*.cdn.office.net',
    'https://res.public.onecdn.static.microsoft',
    'https://view.officeapps.live.com',
    'https://*.officeapps.live.com'
  ],
  // Images: allow supabase, office viewer blobs and data URIs
  'img-src': [
    "'self'",
    'blob:',
    'data:',
    'https://*.supabase.co',
    'https://view.officeapps.live.com',
    'https://*.officeapps.live.com',
    'https://res.public.onecdn.static.microsoft'
  ],
  // Media (audio/video)
  'media-src': ["'self'", 'blob:'],
  // Fonts: allow office CDN and common font hosts used by viewer
  'font-src': [
    "'self'",
    'data:',
    'https://*.cdn.office.net',
    'https://res.public.onecdn.static.microsoft',
    'https://fonts.gstatic.com'
  ],
  // Frames: allow Office viewer frames + supabase
  'frame-src': [
    "'self'",
    'blob:',
    'https://*.supabase.co',
    'https://view.officeapps.live.com',
    'https://*.officeapps.live.com',
    'https://psg4-word-view.officeapps.live.com',
    'https://psg3-word-view.officeapps.live.com'
  ],
  // Objects
  'object-src': ["'self'", 'blob:', 'data:', 'https://*.supabase.co'],
  // Workers: explicitly allow blob: worker creation and CDN worker hosts
  'worker-src': [
    "'self'",
    'blob:',
    'https://*.cdn.office.net',
    'https://view.officeapps.live.com',
    'https://*.officeapps.live.com'
  ],
  // Connect: allow telemetry / collector endpoints used by Office viewer and other services
  'connect-src': [
    "'self'",
    'blob:',
    'data:',
    'http://127.0.0.1:8080',
    'http://localhost:8080',
    'https://*.railway.app',
    'https://cdn.jsdelivr.net',
    'https://generativelanguage.googleapis.com',
    'https://*.supabase.co',
    'https://word-telemetry.officeapps.live.com',
    'https://browser.events.data.microsoft.com',
    'https://*.officeapps.live.com',
    'https://aplsys-backend-331525477255.asia-east1.run.app',
    'http://15.135.87.190:8080'
  ]
};
