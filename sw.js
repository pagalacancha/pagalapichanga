/* PLP: Paga la Pichanga · service worker
 * Guarda la app para que abra rápido y funcione como app instalada.
 * Los datos siempre se piden en línea a Apps Script (no se guardan aquí).
 * Si cambias index.html, sube el número de versión para forzar la actualización. */
const VERSION = 'plp-v5';
const SESION = 'plp-sesion';   // la app guarda aquí su sesión para que el aviso pueda pedir el texto
const SHELL = ['./', './index.html', './manifest.json', './logo.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  // Cada archivo por separado: si falta uno, el service worker igual se instala.
  e.waitUntil(caches.open(VERSION)
    .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => null))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== SESION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Red primero (para recibir siempre la versión nueva) y caché si no hay conexión.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});

/* ---------- Notificaciones ----------
 * El servidor manda un push vacío ("timbre"); aquí se pide el texto a Apps Script
 * con la sesión guardada y se muestra. Si no se puede, se muestra un aviso genérico. */
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let lista = [];
    try {
      const c = await caches.open(SESION);
      const r = await c.match('./__sesion');
      if (r) {
        const s = await r.json();
        const res = await fetch(s.api, {
          method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'notifRecientes', token: s.token, args: {} })
        });
        const j = await res.json();
        if (j.ok && Array.isArray(j.lista)) lista = j.lista;
      }
    } catch (x) { /* sin conexión o sesión vencida: aviso genérico */ }
    if (!lista.length) lista = [{ id: 'plp', texto: 'Tienes un recordatorio de pago. Abre la app para verlo.' }];
    await Promise.all(lista.map(n => self.registration.showNotification('PLP: Paga la Pichanga', {
      body: n.texto, tag: n.id, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: './?tab=cuenta' }
    })));
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(L => {
    for (const c of L) if ('focus' in c) { if ('navigate' in c) c.navigate(url).catch(() => { }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
