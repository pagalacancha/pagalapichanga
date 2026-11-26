/* =====================================================================
 *  PLP: PAGA LA PICHANGA · Modo demo
 *  Simula Google Apps Script dentro del navegador para probar la app sin
 *  cuentas: guarda todo en localStorage y usa la misma lógica de backend.js.
 *  Se carga sólo cuando API_URL está vacío o la URL tiene ?demo
 * ===================================================================== */
var DEMO_KEY = (typeof DEMO_KEY !== 'undefined') ? DEMO_KEY : 'plp_demo_v2';
var DEMO_SEED = (typeof DEMO_SEED !== 'undefined') ? DEMO_SEED : true;

var Utilities = {
  DigestAlgorithm: { SHA_256: 'SHA_256' },
  Charset: { UTF_8: 'UTF_8' },
  getUuid: function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  },
  formatDate: function (d, tz, fmt) {
    var p = {};
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
    return fmt.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day)
      .replace('HH', p.hour).replace('mm', p.minute).replace('ss', p.second);
  },
  // Hash NO criptográfico: sólo para el demo. El servidor real usa SHA-256.
  computeDigest: function (alg, str) {
    var out = [];
    for (var seed = 0; seed < 8; seed++) {
      var h = 2166136261 ^ seed;
      for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
      for (var k = 0; k < 4; k++) out.push(((h >>> (k * 8)) & 255) - 128);
    }
    return out;
  }
};

var LockService = { getScriptLock: function () { return { waitLock: function () { }, releaseLock: function () { } }; } };

var CacheService = (function () {
  var m = {};
  var c = {
    get: function (k) { var e = m[k]; return e && e.t > Date.now() ? e.v : null; },
    put: function (k, v, s) { m[k] = { v: v, t: Date.now() + s * 1000 }; },
    remove: function (k) { delete m[k]; }
  };
  return { getScriptCache: function () { return c; } };
})();

var DEMO_STORE = (function () {
  var db = null;
  function save() {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); }
    catch (e) { throw err_('Demo: el almacenamiento del navegador está lleno. Usa "Reiniciar demo".'); }
  }
  function get() {
    if (db) return db;
    try { db = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null'); } catch (e) { db = null; }
    if (!db) {
      db = { _files: {} };
      Object.keys(TABLAS).forEach(function (t) { db[t] = []; });
      if (DEMO_SEED) seedDemo_(api);
      save();
    }
    return db;
  }
  function fila(t, obj) {
    var o = {};
    TABLAS[t].forEach(function (h) { o[h] = aTexto_(obj[h]); });
    return o;
  }
  var api = {
    prop: function (k, v) {
      var d = get(), p = d._props || (d._props = {});
      if (v === undefined) return p[k] || '';
      p[k] = String(v); save();
    },
    all: function (t) { var d = get(); return d[t] || (d[t] = []); },
    insert: function (t, obj) { var o = fila(t, obj); api.all(t).push(o); save(); return o; },
    update: function (t, key, val, patch) {
      var o = api.all(t).filter(function (r) { return r[key] === val; })[0];
      if (!o) throw err_('Registro no encontrado');
      Object.keys(patch).forEach(function (k) { o[k] = aTexto_(patch[k]); });
      save();
      return o;
    },
    remove: function (t, key, val) {
      var L = api.all(t);
      for (var i = 0; i < L.length; i++) if (L[i][key] === val) { L.splice(i, 1); break; }
      save();
    },
    saveFile: function (nombre, mime, b64) {
      var id = 'F' + Utilities.getUuid().slice(0, 8);
      get()._files[id] = { mime: mime, b64: b64 };
      save();
      return id;
    },
    readFile: function (id) {
      var f = get()._files[id];
      if (!f) throw err_('Archivo no encontrado');
      return { mime: f.mime, b64: f.b64 };
    },
    refresh: function () { db = null; },
    reset: function () { localStorage.removeItem(DEMO_KEY); db = null; }
  };
  return api;
})();

/* ---------- Datos de ejemplo ---------- */
function seedDemo_(st) {
  var dia = function (n) {
    var d = new Date(Date.now() + n * 86400000);
    return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
  };
  var t = Date.now() - 20 * 86400000;
  var ts = function () { t += 60000; return new Date(t).toISOString(); };

  Object.keys(CONFIG_DEFAULT).forEach(function (k) { st.insert('Config', { clave: k, valor: CONFIG_DEFAULT[k] }); });
  st.update('Config', 'clave', 'nombreGrupo', { valor: 'Fútbol de los Jueves' });
  st.update('Config', 'clave', 'codigoGrupo', { valor: 'DEMO' });
  st.update('Config', 'clave', 'lugar', { valor: 'Cancha Municipal 2' });
  st.update('Config', 'clave', 'datosTransferencia', { valor: 'Banco Ejemplo · Cuenta Vista\nN° 12345678\nRUT 11.111.111-1\nJonathan (demo)\npagos@ejemplo.com' });

  // Los 3 administradores fijos + jugadores. Ingreso: nombre + teléfono.
  var nombres = ['Jonathan', 'Jugador Demo', 'Tomas', 'Alvaro', 'Pato', 'Nico', 'Seba', 'Mati', 'Feña', 'Rodri',
    'Cami', 'Benja', 'Diego', 'Lucho', 'Gonza', 'Vale'];
  var tels = { 0: '911111111', 1: '922222222', 2: '933333333', 3: '944444444' };
  var J = nombres.map(function (n, i) {
    var id = 'J' + (100 + i);
    st.insert('Jugadores', {
      id: id, nombre: n, telefono: '56' + (tels[i] || '95' + String(1000000 + i * 37).slice(0, 7)), pinHash: '',
      rol: (i === 0 || i === 2 || i === 3) ? 'admin' : 'jugador', activo: 'si', creado: ts()
    });
    return id;
  });

  function partido(id, fecha, estado) {
    st.insert('Partidos', {
      id: id, fecha: fecha, hora: '20:00', lugar: 'Cancha Municipal 2', cupo: 12, precio: 5000,
      costoTotal: 60000, estado: estado, nota: '', creado: ts(),
      datosTransferencia: 'Banco Ejemplo · Cuenta Vista\nN° 12345678\nRUT 11.111.111-1\nJonathan (demo)\npagos@ejemplo.com'
    });
  }
  function anota(pid, jid, estado) {
    var x = ts();
    st.insert('Inscripciones', { id: 'I' + pid + jid, partidoId: pid, jugadorId: jid, estado: estado, creado: x, actualizado: x, por: jid });
  }
  function mov(o) {
    st.insert('Movimientos', Object.assign({
      id: 'M' + Utilities.getUuid().slice(0, 8), fecha: ts(), partidoId: '', metodo: '', comprobanteId: '',
      estado: 'confirmado', nota: '', creadoPor: J[0], revisadoPor: J[0]
    }, o));
  }

  // 1) Partido de hace 14 días: cerrado y cobrado, con video.
  partido('P1', dia(-14), 'cerrado');
  st.update('Partidos', 'id', 'P1', { nombre: 'Pichanga de los jueves', video: 'https://www.youtube.com/', cerradoEn: dia(-14) + ' 22:00' });
  J.slice(0, 12).forEach(function (j) { anota('P1', j, 'titular'); });
  t = Date.now() - 13.9 * 86400000;
  J.slice(0, 12).forEach(function (j) { mov({ jugadorId: j, tipo: 'cargo', monto: 5000, partidoId: 'P1', nota: 'Partido ' + fechaCorta_(dia(-14)) }); });
  [0, 2, 3, 4, 5, 6, 8].forEach(function (k) { mov({ jugadorId: J[k], tipo: 'pago', monto: 5000, metodo: k % 2 ? 'efectivo' : 'transferencia' }); });

  // 2) Partido de hace 7 días: se jugó pero el admin aún no lo cierra.
  partido('P2', dia(-7), 'abierto');
  J.slice(0, 12).forEach(function (j) { anota('P2', j, 'titular'); });
  anota('P2', J[13], 'cancelado_tarde');

  // 3) Próximo partido: 9 anotados (el "Jugador Demo" no, para que pruebe anotarse).
  partido('P3', dia(2), 'abierto');
  [0, 2, 3, 4, 5, 6, 7, 9, 10].forEach(function (k) { anota('P3', J[k], 'titular'); });

  // Deuda acumulada de arrastre (Rodri debe más de 2 partidos: no puede anotarse) y un pago pendiente con comprobante.
  mov({ jugadorId: J[9], tipo: 'cargo', monto: 10000, nota: 'Saldo inicial' });
  // Perfiles de ejemplo
  st.update('Jugadores', 'id', J[0], { nacimiento: '1990-03-15', altura: '1.78', peso: '80', posicionA: 'medio', posicionB: 'centro', pie: 'derecho' });
  st.update('Jugadores', 'id', J[4], { nacimiento: '1995-08-02', altura: '1.70', peso: '68', posicionA: 'delantero', posicionB: 'izquierda', pie: 'izquierdo' });
  var comp = '';
  try { comp = st.saveFile('comprobante_demo.png', 'image/png', comprobanteDemo_()); } catch (e) { }
  mov({ jugadorId: J[7], tipo: 'pago', monto: 5000, metodo: 'transferencia', comprobanteId: comp, estado: 'pendiente', nota: 'Partido pasado', revisadoPor: '' });

  // La deuda corre desde que se anotan: cargo para los anotados de los partidos abiertos.
  migrarCargos_(st);
}

/** Dibuja un comprobante falso para el demo (si hay canvas disponible). */
function comprobanteDemo_() {
  if (typeof document === 'undefined') return '';
  var c = document.createElement('canvas');
  c.width = 360; c.height = 420;
  var g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 360, 420);
  g.fillStyle = '#0f7a3d'; g.fillRect(0, 0, 360, 70);
  g.fillStyle = '#fff'; g.font = 'bold 20px sans-serif'; g.fillText('Transferencia exitosa', 24, 44);
  g.fillStyle = '#14201a'; g.font = '15px sans-serif';
  ['Monto: $5.000', 'Destino: Jonathan (demo)', 'Cuenta: 12345678', 'Comentario: futbol', 'EJEMPLO · DEMO'].forEach(function (s, i) {
    g.fillText(s, 24, 120 + i * 44);
  });
  return c.toDataURL('image/png').split(',')[1];
}
