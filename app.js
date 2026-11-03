'use strict';
const KEY = 'inventario_v3', CATS = ['Electrónicos','Ropa','Hogar','Deportes','Libros','Accesorios','Alimentos','Otros'];
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => db.cfg.moneda + Number(n).toLocaleString('es', {minimumFractionDigits: 2, maximumFractionDigits: 2});
const fecha = t => new Date(t).toLocaleString('es', {dateStyle: 'short', timeStyle: 'short'});

function cargar0() {
  for (const k of [KEY, 'inventario_v2']) {
    try { const d = JSON.parse(localStorage.getItem(k)); if (d && Array.isArray(d.productos)) {
      d.proveedores ||= []; d.ventas ||= []; d.movs ||= []; d.empresa ||= 'Mi Negocio';
      d.sig ||= Math.max(0, ...d.productos.map(p => p.id)) + 1; d.sigP ||= d.proveedores.length + 1; d.sigV ||= d.ventas.length + 1;
      return d; } } catch (e) {}
  }
  return {empresa: 'Mi Negocio', sig: 4, sigP: 2, sigV: 1, movs: [], ventas: [],
    proveedores: [{id: 1, nombre: 'Proveedor General', tel: '', mail: ''}],
    productos: [
      {id:1, codigo:'1234567890123', nombre:'Laptop HP Pavilion', categoria:'Electrónicos', prov:1, descripcion:'15" 8GB RAM', stock:10, precio:599.99, min:2, venc:''},
      {id:2, codigo:'2345678901234', nombre:'Camiseta Básica', categoria:'Ropa', prov:1, descripcion:'100% algodón', stock:50, precio:19.99, min:10, venc:''},
      {id:3, codigo:'3456789012345', nombre:'Silla de Oficina', categoria:'Hogar', prov:1, descripcion:'Ergonómica', stock:8, precio:149.99, min:3, venc:''}]};
}
const CFG0 = {moneda: '$', tel: '', dir: '', logo: '', minDef: 5, diasVenc: 30, iva: 0, color: '#14b8a6', oscuro: false};
function cargar() { const d = cargar0(); d.cfg = {...CFG0, ...d.cfg}; d.cats ||= [...CATS]; d.compras ||= []; d.cierres ||= []; d.productos.forEach(p => p.costo ??= 0); return d; }
let db = cargar(), orden = {c: 'nombre', d: 1}, cart = [], compra = [];
const guardar = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('No se pudo guardar (almacenamiento lleno)', 'error'); } };
const prod = id => db.productos.find(p => p.id === +id);
const provNombre = id => db.proveedores.find(v => v.id === +id)?.nombre || '';
function toast(m, t = 'ok') { const e = document.createElement('div'); e.className = 'toast ' + t; e.textContent = m; $('toasts').appendChild(e); setTimeout(() => e.remove(), 3200); }
const diasPara = v => v ? Math.ceil((new Date(v + 'T23:59:59') - Date.now()) / 864e5) : null;

/* ================= ESCÁNER ================= */
const Scan = {
  inst: null, el: null, last: '', lastT: 0, ctx: null,
  beep() {
    try { this.ctx ||= new (window.AudioContext || window.webkitAudioContext)();
      const o = this.ctx.createOscillator(); o.frequency.value = 1000; o.connect(this.ctx.destination); o.start(); o.stop(this.ctx.currentTime + 0.12); } catch (e) {}
    navigator.vibrate?.(80);
  },
  async start(el, cb, continuo) {
    if (typeof Html5Qrcode === 'undefined') return toast('No cargó la librería del escáner. Revisa tu conexión a internet.', 'error');
    if (!window.isSecureContext) toast('La cámara solo funciona con HTTPS o localhost', 'warn');
    await this.stop();
    this.el = el; $(el).hidden = false; if (el === 'readerForm') $('hintForm').hidden = false;
    $(el).innerHTML = ''; this.n = 0;
    const s = this.inst = new Html5Qrcode(el, {verbose: false});
    const cfg = {fps: 12, qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.85); return {width: s, height: s}; }};
    const onOk = txt => {
      const now = Date.now(); if (txt === this.last && now - this.lastT < 1800) return;
      this.last = txt; this.lastT = now; this.beep(); cb(txt); if (!continuo) this.stop();
    };
    try { await s.start({facingMode: 'environment'}, cfg, onOk, () => this.tick()); }
    catch (e0) { try { await s.start({facingMode: 'environment'}, cfg, onOk, () => this.tick()); } catch (e1) {
      try { const cams = await Html5Qrcode.getCameras(); if (!cams.length) throw e1;
        await s.start(cams[cams.length - 1].id, cfg, onOk, () => this.tick()); }
      catch (e2) { this.inst = null; this.sync();
        const n = String(e2?.name || e2);
        toast(/NotAllowed|Permission/i.test(n) ? 'Permiso de cámara denegado. Actívalo en el navegador.' :
          /NotFound|NoCamera/i.test(n) ? 'No se encontró ninguna cámara.' : 'No se pudo abrir la cámara. Usa "Desde foto" o escribe el código.', 'error'); return; } }
    }
    this.sync();
  },
  tick() { if (++this.n % 10 === 0) { const t = '🔍 Buscando código… (' + this.n + ' lecturas)'; $('infoVenta').textContent = t; $('hintForm').textContent = t; } },
  async stop() {
    const s = this.inst; this.inst = null;
    if (s) { try { await s.stop(); } catch (e) {} try { s.clear(); } catch (e) {} }
    if (this.el === 'readerForm') { $('readerForm').hidden = true; $('hintForm').hidden = true; }
    this.sync();
  },
  sync() {
    const on = !!this.inst;
    if (!on) { $('infoVenta').textContent = ''; $('hintForm').textContent = 'Apunta al código a 15–20 cm, con buena luz y sin reflejos.'; }
    $('btnScanVenta').textContent = on && this.el === 'readerVenta' ? '⏹ Detener' : '📷 Iniciar escáner';
    $('btnScanCompra').textContent = on && this.el === 'readerCompra' ? '⏹ Detener' : '📷 Iniciar escáner';
    $('btnScanForm').textContent = on && this.el === 'readerForm' ? '⏹' : '📷';
  },
  async foto(file, cb) {
    if (!file || typeof Html5Qrcode === 'undefined') return;
    try { const r = await new Html5Qrcode('scanTmp', {verbose: false}).scanFile(file, false); this.beep(); cb(r); }
    catch (e) { toast('No se detectó ningún código en la foto', 'error'); }
  }
};
$('btnScanVenta').onclick = () => Scan.inst && Scan.el === 'readerVenta' ? Scan.stop() : Scan.start('readerVenta', addCart, true);
const codigoForm = t => {
  $('pCod').value = t; const o = db.productos.find(p => p.codigo === t && p.id !== (+$('pId').value || 0));
  o ? toast(`⚠ Ese código ya pertenece a "${o.nombre}"`, 'warn') : toast('Código leído: ' + t);
};
$('btnScanForm').onclick = () => Scan.inst && Scan.el === 'readerForm' ? Scan.stop() : Scan.start('readerForm', codigoForm, false);
$('fotoForm').onchange = e => { Scan.foto(e.target.files[0], codigoForm); e.target.value = ''; };
$('fotoVenta').onchange = e => { Scan.foto(e.target.files[0], addCart); e.target.value = ''; };

/* ================= NAVEGACIÓN ================= */
function ir(v) {
  document.querySelectorAll('.view').forEach(x => x.classList.toggle('active', x.id === 'v-' + v));
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.v === v));
  Scan.stop(); render(); if (v === 'ventas') $('manual').focus(); if (v === 'compras') $('manualC').focus();
}
document.querySelectorAll('.nav button').forEach(b => b.onclick = () => ir(b.dataset.v));

/* ================= RENDER ================= */
const bajo = p => p.stock <= p.min;
function barras(items, fmt = money) {
  const mx = Math.max(1, ...items.map(i => i.v));
  return items.map(i => `<div class="bar"><span>${esc(i.l)}</span><div><i style="width:${i.v / mx * 100}%;${i.v === 0 ? 'background:var(--bd)' : ''}"></i></div><b>${fmt(i.v)}</b></div>`).join('') || '<p class="empty">Sin datos todavía.</p>';
}
function dash() {
  const P = db.productos, hoy = new Date().setHours(0, 0, 0, 0), mes = new Date(hoy).setDate(1);
  const suma = d => db.ventas.filter(v => !v.anulada && v.fecha >= d).reduce((s, v) => s + v.total, 0);
  const gan = db.ventas.filter(v => !v.anulada).reduce((s, v) => s + (v.sub ?? v.total) - (v.desc || 0) - v.items.reduce((q, i) => q + (i.costo || 0) * i.cant, 0), 0);
  const C = [['Productos', P.length], ['Unidades', P.reduce((s, p) => s + p.stock, 0)], ['Valor inventario', money(P.reduce((s, p) => s + p.stock * p.precio, 0))],
    ['Stock bajo', P.filter(bajo).length, 'warn'], ['Ventas hoy', money(suma(hoy))], ['Ventas del mes', money(suma(mes))], ['Ganancia estimada', money(gan), 'ok']];
  $('cards').innerHTML = C.map(c => `<div class="card ${c[2] || ''}"><span>${c[0]}</span><strong>${c[1]}</strong></div>`).join('');
  const al = [...P.filter(bajo).map(p => `<li class="bad-t">${esc(p.nombre)}: ${p.stock === 0 ? 'agotado' : 'quedan ' + p.stock}</li>`),
    ...P.filter(p => p.venc && diasPara(p.venc) <= db.cfg.diasVenc).map(p => `<li class="${diasPara(p.venc) <= 0 ? 'bad-t' : 'warn-t'}">${esc(p.nombre)}: ${diasPara(p.venc) < 0 ? 'vencido' : 'vence en ' + diasPara(p.venc) + ' días'} ${diasPara(p.venc) <= 0 && p.stock > 0 ? `<button class="btn sm bad" data-baja="${p.id}">Dar de baja</button>` : ''}</li>`)];
  $('alertas').innerHTML = al.length ? '<ul>' + al.join('') + '</ul>' : '<p class="empty">Todo en orden ✔</p>';
  const ven = {}; db.ventas.filter(v => !v.anulada).forEach(v => v.items.forEach(i => ven[i.nombre] = (ven[i.nombre] || 0) + i.cant));
  $('top').innerHTML = barras(Object.entries(ven).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([l, v]) => ({l, v})), n => n + ' uds');
  const dias = [...Array(7)].map((_, i) => { const d = new Date(hoy); d.setDate(d.getDate() - 6 + i); return {l: d.toLocaleDateString('es', {weekday: 'short', day: 'numeric'}), a: +d, b: +d + 864e5}; });
  $('dias').innerHTML = barras(dias.map(d => ({l: d.l, v: db.ventas.filter(v => !v.anulada && v.fecha >= d.a && v.fecha < d.b).reduce((s, v) => s + v.total, 0)})));
  $('cats').innerHTML = barras(db.cats.map(c => ({l: c, v: P.filter(p => p.categoria === c).reduce((s, p) => s + p.stock * p.precio, 0)})));
}
function listaProd() {
  const q = $('buscar').value.trim().toLowerCase(), cat = $('fCat').value, st = $('fStock').value;
  return db.productos.filter(p => (!q || [p.nombre, p.codigo, p.categoria, p.descripcion].join(' ').toLowerCase().includes(q)) && (!cat || p.categoria === cat) &&
    (!st || (st === 'agotado' ? p.stock === 0 : bajo(p)))).sort((a, b) => {
    const x = a[orden.c] ?? '', y = b[orden.c] ?? ''; return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'es')) * orden.d; });
}
function tablaProd() {
  const L = listaProd();
  $('tProd').innerHTML = L.map(p => { const d = diasPara(p.venc);
    return `<tr><td class="mono">${esc(p.codigo) || '—'}</td><td><b class="lnk" data-h="${p.id}">${esc(p.nombre)}</b><small>${esc(provNombre(p.prov))}</small></td><td>${esc(p.categoria)}</td>
    <td><span class="pill ${p.stock === 0 ? 'p-bad' : bajo(p) ? 'p-warn' : 'p-ok'}">${p.stock}</span></td><td class="num">${money(p.precio)}</td><td>${p.costo > 0 && p.precio > 0 ? (m => `<span class="pill ${m >= 25 ? 'p-ok' : m >= 10 ? 'p-warn' : 'p-bad'}">${m.toFixed(0)}%</span>`)((p.precio - p.costo) / p.precio * 100) : '—'}</td>
    <td class="${d !== null && d <= db.cfg.diasVenc ? (d <= 0 ? 'bad-t' : 'warn-t') : ''}">${p.venc || '—'}</td>
    <td class="act"><button class="btn sm" data-e="${p.id}" title="Editar">✏️</button><button class="btn sm bad" data-d="${p.id}" title="Eliminar">🗑️</button></td></tr>`; }).join('');
  $('vacio').hidden = L.length > 0;
}
function render() {
  aplicarTema(); fillCats(); ajustesUI(); renderExtra(); dash(); tablaProd();
  $('empresa').textContent = db.empresa;
  $('tProv').innerHTML = db.proveedores.map(v => `<tr><td><b>${esc(v.nombre)}</b></td><td>${esc(v.tel)}</td><td>${esc(v.mail)}</td>
    <td>${db.productos.filter(p => p.prov === v.id).length}</td><td class="act"><button class="btn sm" data-ev="${v.id}">Editar</button><button class="btn sm bad" data-dv="${v.id}">Eliminar</button></td></tr>`).join('')
    || '<tr><td colspan="5" class="empty">Aún no hay proveedores.</td></tr>';
  $('pProv').innerHTML = '<option value="0">— Sin proveedor —</option>' + db.proveedores.map(v => `<option value="${v.id}">${esc(v.nombre)}</option>`).join('');
  $('mProd').innerHTML = db.productos.map(p => `<option value="${p.id}">${esc(p.nombre)} (stock ${p.stock})</option>`).join('');
  $('dlProd').innerHTML = db.productos.map(p => `<option value="${esc(p.nombre)}">`).join('');
  $('tMov').innerHTML = db.movs.slice(0, 100).map(m => `<tr><td>${fecha(m.fecha)}</td><td>${esc(m.nombre)}</td><td class="${['entrada', 'anulación', 'compra'].includes(m.tipo) ? 'ok-t' : 'bad-t'}">${m.tipo}</td><td>${m.cantidad}</td><td>${m.final}</td><td>${esc(m.nota)}</td></tr>`).join('')
    || '<tr><td colspan="6" class="empty">Sin movimientos.</td></tr>';
  $('tVentas').innerHTML = db.ventas.slice(0, 20).map(v => `<tr class="${v.anulada ? 'anul' : ''}"><td>${v.id}</td><td>${fecha(v.fecha)}</td><td>${v.items.map(i => `${i.cant}× ${esc(i.nombre)}`).join(', ')}</td><td>${esc(v.metodo || '—')}</td>
    <td>${money(v.total)}${v.anulada ? ' <span class="pill p-bad">Anulada</span>' : ''}</td><td class="act"><button class="btn sm sec" data-r="${v.id}">🧾</button>${v.anulada ? '' : `<button class="btn sm bad" data-a="${v.id}">Anular</button>`}</td></tr>`).join('')
    || '<tr><td colspan="6" class="empty">Sin ventas.</td></tr>';
  carrito();
}

/* ================= PRODUCTOS ================= */
function abrirProd(p) {
  Scan.stop(); $('mpTitulo').textContent = p ? 'Editar producto' : 'Nuevo producto';
  $('pId').value = p?.id || ''; $('pCod').value = p?.codigo || ''; $('pNom').value = p?.nombre || ''; $('pCat').value = p?.categoria || CATS[0];
  $('pProv').value = p?.prov || 0; $('pStock').value = p?.stock ?? ''; $('pPrecio').value = p?.precio ?? ''; $('pCosto').value = p?.costo ?? 0; $('pMin').value = p?.min ?? db.cfg.minDef;
  $('pVenc').value = p?.venc || ''; $('pDesc').value = p?.descripcion || ''; $('mProdModal').classList.add('show'); $('pNom').focus();
}
$('fProd').onsubmit = e => {
  e.preventDefault(); const id = +$('pId').value || null, codigo = $('pCod').value.trim();
  const p = {id, codigo, nombre: $('pNom').value.trim(), categoria: $('pCat').value, prov: +$('pProv').value, descripcion: $('pDesc').value.trim(),
    stock: parseInt($('pStock').value, 10), precio: parseFloat($('pPrecio').value), costo: Math.max(0, parseFloat($('pCosto').value) || 0), min: parseInt($('pMin').value, 10) || 0, venc: $('pVenc').value};
  if (!p.nombre) return toast('El nombre es obligatorio', 'error');
  if (!(p.stock >= 0) || !(p.precio >= 0)) return toast('Stock y precio deben ser válidos', 'error');
  if (codigo && db.productos.some(x => x.codigo === codigo && x.id !== id)) return toast('Ese código ya existe', 'error');
  if (id) { Object.assign(prod(id), p); toast('Producto actualizado'); } else { p.id = db.sig++; db.productos.push(p); toast('Producto agregado'); }
  guardar(); cerrar(); render();
};
$('tProd').onclick = e => {
  const t = e.target.dataset; if (t.h) historial(t.h); if (t.e) abrirProd(prod(t.e));
  if (t.d) { const p = prod(t.d); if (confirm(`¿Eliminar "${p.nombre}"?`)) { db.productos = db.productos.filter(x => x.id !== p.id); cart = cart.filter(c => c.pid !== p.id); compra = compra.filter(c => c.pid !== p.id); guardar(); render(); toast('Producto eliminado'); } }
};

/* ================= PROVEEDORES ================= */
function abrirProv(v) {
  $('mvTitulo').textContent = v ? 'Editar proveedor' : 'Nuevo proveedor';
  $('vId').value = v?.id || ''; $('vNom').value = v?.nombre || ''; $('vTel').value = v?.tel || ''; $('vMail').value = v?.mail || ''; $('mProvModal').classList.add('show'); $('vNom').focus();
}
$('fProv').onsubmit = e => {
  e.preventDefault(); const id = +$('vId').value || null, v = {id, nombre: $('vNom').value.trim(), tel: $('vTel').value.trim(), mail: $('vMail').value.trim()};
  if (!v.nombre) return;
  if (id) Object.assign(db.proveedores.find(x => x.id === id), v); else { v.id = db.sigP++; db.proveedores.push(v); }
  guardar(); cerrar(); render(); toast('Proveedor guardado');
};
$('tProv').onclick = e => {
  const t = e.target.dataset; if (t.ev) abrirProv(db.proveedores.find(v => v.id === +t.ev));
  if (t.dv) { const n = db.productos.filter(p => p.prov === +t.dv).length;
    if (n) return toast(`No se puede eliminar: tiene ${n} producto(s) asociado(s)`, 'error');
    if (confirm('¿Eliminar proveedor?')) { db.proveedores = db.proveedores.filter(v => v.id !== +t.dv); guardar(); render(); } }
};

/* ================= VENTAS ================= */
function addCart(txt) {
  const t = String(txt).trim(), tl = t.toLowerCase(); if (!t) return;
  const p = db.productos.find(x => x.codigo === t) || db.productos.find(x => x.nombre.toLowerCase() === tl) ||
    (db.productos.filter(x => x.nombre.toLowerCase().includes(tl)).length === 1 ? db.productos.find(x => x.nombre.toLowerCase().includes(tl)) : null);
  if (!p) return toast(`Producto no encontrado: ${t}`, 'error');
  const it = cart.find(c => c.pid === p.id);
  if ((it?.cant || 0) + 1 > p.stock) return toast(`Sin stock suficiente de "${p.nombre}"`, 'error');
  it ? it.cant++ : cart.push({pid: p.id, cant: 1}); carrito(); toast('+ ' + p.nombre);
}
function calc() {
  const sub = cart.reduce((s, c) => s + prod(c.pid).precio * c.cant, 0), dp = Math.min(100, Math.max(0, parseFloat($('vDesc').value) || 0));
  const desc = sub * dp / 100, ivaP = db.cfg.iva, iva = (sub - desc) * ivaP / 100; return {sub, dp, desc, ivaP, iva, total: sub - desc + iva};
}
function carrito() {
  $('tCart').innerHTML = cart.map(c => { const p = prod(c.pid);
    return `<tr><td>${esc(p.nombre)}</td><td class="qty"><button class="btn sm sec" data-m="${p.id}">−</button> ${c.cant} <button class="btn sm sec" data-p="${p.id}">+</button></td><td class="num">${money(p.precio * c.cant)}</td><td><button class="btn sm bad" data-x="${p.id}" title="Quitar">🗑️</button></td></tr>`; }).join('')
    || '<tr><td colspan="4" class="empty">Carrito vacío</td></tr>';
  const t = calc();
  $('totales').innerHTML = `<div><span>Subtotal</span><b>${money(t.sub)}</b></div>` + (t.desc ? `<div><span>Descuento (${t.dp}%)</span><b>-${money(t.desc)}</b></div>` : '') +
    (t.iva ? `<div><span>IVA (${t.ivaP}%)</span><b>${money(t.iva)}</b></div>` : '') + `<div class="gt"><span>Total</span><b>${money(t.total)}</b></div>`;
}
$('tCart').onclick = e => {
  const t = e.target.dataset, id = +(t.m || t.p || t.x), it = cart.find(c => c.pid === id); if (!it) return;
  if (t.p) { if (it.cant + 1 > prod(id).stock) return toast('Sin más stock', 'error'); it.cant++; }
  if (t.m && --it.cant <= 0) cart = cart.filter(c => c !== it);
  if (t.x) cart = cart.filter(c => c !== it); carrito();
};
$('btnAdd').onclick = () => { addCart($('manual').value); $('manual').value = ''; $('manual').focus(); };
$('manual').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('btnAdd').click(); } };
$('btnVaciar').onclick = () => { cart = []; carrito(); };
$('btnCobrar').onclick = () => {
  if (!cart.length) return toast('El carrito está vacío', 'error');
  for (const c of cart) if (c.cant > prod(c.pid).stock) return toast(`Stock insuficiente de ${prod(c.pid).nombre}`, 'error');
  const t = calc(), id = db.sigV++, items = cart.map(c => ({pid: c.pid, nombre: prod(c.pid).nombre, cant: c.cant, precio: prod(c.pid).precio, costo: prod(c.pid).costo || 0}));
  items.forEach(i => { const p = prod(i.pid); p.stock -= i.cant; db.movs.unshift({fecha: Date.now(), nombre: p.nombre, tipo: 'venta', cantidad: i.cant, final: p.stock, nota: 'Venta #' + id});
    if (bajo(p)) toast(`⚠ Stock bajo: ${p.nombre}`, 'warn'); });
  db.ventas.unshift({id, fecha: Date.now(), items, sub: t.sub, descPct: t.dp, desc: t.desc, ivaPct: t.ivaP, iva: t.iva, total: t.total, metodo: $('vMetodo').value, anulada: false});
  db.movs = db.movs.slice(0, 500); db.ventas = db.ventas.slice(0, 1000);
  cart = []; $('vDesc').value = ''; guardar(); render(); toast(`Venta #${id} registrada: ${money(t.total)}`);
  if ($('vRecibo').checked) recibo(id);
};

/* ================= MOVIMIENTOS ================= */
$('fMov').onsubmit = e => {
  e.preventDefault(); const p = prod($('mProd').value), c = parseInt($('mCant').value, 10), t = $('mTipo').value;
  if (!p || !(c > 0)) return toast('Datos inválidos', 'error');
  if (t === 'salida' && c > p.stock) return toast(`Stock insuficiente (hay ${p.stock})`, 'error');
  p.stock += t === 'entrada' ? c : -c;
  db.movs.unshift({fecha: Date.now(), nombre: p.nombre, tipo: t, cantidad: c, final: p.stock, nota: $('mNota').value.trim()});
  guardar(); render(); e.target.reset(); toast('Movimiento registrado');
};

/* ================= DATOS ================= */
function bajar(n, txt, tipo) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], {type: tipo})); a.download = n; a.click(); URL.revokeObjectURL(a.href); }
$('btnCsv').onclick = () => {
  const c = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const f = [['ID','Código','Nombre','Categoría','Proveedor','Stock','Precio','Mínimo','Vence','Descripción']].concat(db.productos.map(p => [p.id, p.codigo, p.nombre, p.categoria, provNombre(p.prov), p.stock, p.precio, p.min, p.venc, p.descripcion]));
  bajar('inventario.csv', '\uFEFF' + f.map(r => r.map(c).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
};
$('btnJson').onclick = () => bajar('inventario_respaldo.json', JSON.stringify(db, null, 2), 'application/json');
$('fImp').onchange = e => {
  const f = e.target.files[0]; if (!f) return; const r = new FileReader();
  r.onload = () => { try { const d = JSON.parse(r.result); if (!Array.isArray(d.productos)) throw 0;
    if (!confirm('Esto reemplaza los datos actuales. ¿Continuar?')) return;
    localStorage.setItem(KEY, JSON.stringify(d)); db = cargar(); guardar(); render(); toast('Datos importados'); } catch (x) { toast('Archivo inválido', 'error'); } };
  r.readAsText(f); e.target.value = '';
};
$('btnReset').onclick = () => { if (confirm('¿Borrar TODO? No se puede deshacer.')) { db = {empresa: db.empresa, cfg: db.cfg, cats: db.cats, sig: 1, sigP: 1, sigV: 1, productos: [], proveedores: [], ventas: [], movs: [], compras: [], cierres: []}; cart = []; compra = []; guardar(); render(); } };

/* ================= RECIBO Y ANULAR ================= */
function recibo(id) {
  const v = db.ventas.find(x => x.id === +id); if (!v) return; const c = db.cfg;
  $('ticket').innerHTML = `<div class="tk"><div class="c">${c.logo ? `<img src="${c.logo}" alt="">` : ''}<h2>${esc(db.empresa)}</h2>${c.dir ? `<div>${esc(c.dir)}</div>` : ''}${c.tel ? `<div>Tel: ${esc(c.tel)}</div>` : ''}</div><hr>
    <div>Recibo #${v.id}${v.anulada ? ' (ANULADA)' : ''}</div><div>${fecha(v.fecha)}</div><hr>
    <table>${v.items.map(i => `<tr><td>${i.cant}× ${esc(i.nombre)}</td><td class="r">${money(i.cant * i.precio)}</td></tr>`).join('')}</table><hr>
    <table><tr><td>Subtotal</td><td class="r">${money(v.sub ?? v.total)}</td></tr>${v.desc ? `<tr><td>Descuento (${v.descPct}%)</td><td class="r">-${money(v.desc)}</td></tr>` : ''}
    ${v.iva ? `<tr><td>IVA (${v.ivaPct}%)</td><td class="r">${money(v.iva)}</td></tr>` : ''}<tr class="t"><td>TOTAL</td><td class="r">${money(v.total)}</td></tr></table>
    <div>Pago: ${esc(v.metodo || 'Efectivo')}</div><hr><div class="c">¡Gracias por su compra!</div></div>`;
  setTimeout(() => window.print(), 80);
}
function anular(id) {
  const v = db.ventas.find(x => x.id === +id); if (!v || v.anulada) return;
  if (!confirm(`¿Anular la venta #${v.id}? Se devolverá el stock.`)) return;
  v.items.forEach(i => { const p = prod(i.pid); if (p) { p.stock += i.cant; db.movs.unshift({fecha: Date.now(), nombre: p.nombre, tipo: 'anulación', cantidad: i.cant, final: p.stock, nota: 'Anulación venta #' + v.id}); } });
  v.anulada = true; guardar(); render(); toast('Venta anulada');
}
$('tVentas').onclick = e => { const t = e.target.dataset; if (t.r) recibo(t.r); if (t.a) anular(t.a); };
$('vDesc').oninput = carrito;

/* ================= AJUSTES ================= */
function aplicarTema() {
  document.documentElement.style.setProperty('--pri', db.cfg.color); document.body.classList.toggle('dark', !!db.cfg.oscuro);
  $('logoBox').innerHTML = db.cfg.logo ? `<img src="${db.cfg.logo}" alt="">` : '📦'; document.title = db.empresa + ' · Inventario';
}
function fillCats() {
  const a = $('pCat').value, b = $('fCat').value, o = db.cats.map(c => `<option>${esc(c)}</option>`).join('');
  $('pCat').innerHTML = o; $('fCat').innerHTML = '<option value="">Todas las categorías</option>' + o; $('pCat').value = a; $('fCat').value = b;
}
function ajustesUI() {
  const c = db.cfg; $('cNom').value = db.empresa; $('cTel').value = c.tel; $('cDir').value = c.dir; $('cMon').value = c.moneda;
  $('cMin').value = c.minDef; $('cDias').value = c.diasVenc; $('cIva').value = c.iva; $('cColor').value = c.color; $('cOscuro').checked = c.oscuro;
  $('listaCats').innerHTML = db.cats.map((n, i) => `<li><span>${esc(n)} <small>(${db.productos.filter(p => p.categoria === n).length})</small></span><span><button class="btn sm sec" data-rc="${i}">Renombrar</button> <button class="btn sm bad" data-dc="${i}">Eliminar</button></span></li>`).join('');
}
$('fCfg').onsubmit = e => {
  e.preventDefault(); db.empresa = $('cNom').value.trim() || db.empresa; const c = db.cfg;
  Object.assign(c, {tel: $('cTel').value.trim(), dir: $('cDir').value.trim(), moneda: $('cMon').value.trim() || '$', minDef: Math.max(0, parseInt($('cMin').value, 10) || 0),
    diasVenc: Math.max(1, parseInt($('cDias').value, 10) || 30), iva: Math.min(100, Math.max(0, parseFloat($('cIva').value) || 0)), color: $('cColor').value, oscuro: $('cOscuro').checked});
  guardar(); render(); toast('Ajustes guardados');
};
$('cColor').oninput = e => document.documentElement.style.setProperty('--pri', e.target.value);
$('cOscuro').onchange = e => document.body.classList.toggle('dark', e.target.checked);
$('cLogo').onchange = e => {
  const f = e.target.files[0]; if (!f) return; const r = new FileReader();
  r.onload = () => { const im = new Image(); im.onerror = () => toast('Imagen inválida', 'error');
    im.onload = () => { const s = Math.min(1, 160 / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = im.width * s; cv.height = im.height * s;
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); db.cfg.logo = cv.toDataURL('image/png'); guardar(); render(); toast('Logo actualizado'); };
    im.src = r.result; };
  r.readAsDataURL(f); e.target.value = '';
};
$('btnLogoDel').onclick = () => { db.cfg.logo = ''; guardar(); render(); };
$('btnAddCat').onclick = () => {
  const n = $('nuevaCat').value.trim(); if (!n) return;
  if (db.cats.some(c => c.toLowerCase() === n.toLowerCase())) return toast('Esa categoría ya existe', 'error');
  db.cats.push(n); $('nuevaCat').value = ''; guardar(); render();
};
$('listaCats').onclick = e => {
  const t = e.target.dataset;
  if (t.rc !== undefined) { const v = db.cats[t.rc], n = (prompt('Nuevo nombre:', v) || '').trim();
    if (!n || n === v) return; if (db.cats.includes(n)) return toast('Esa categoría ya existe', 'error');
    db.productos.forEach(p => { if (p.categoria === v) p.categoria = n; }); db.cats[t.rc] = n; guardar(); render(); }
  if (t.dc !== undefined) { const v = db.cats[t.dc], n = db.productos.filter(p => p.categoria === v).length;
    if (n) return toast(`No se puede eliminar: ${n} producto(s) la usan`, 'error');
    if (db.cats.length < 2) return toast('Debe quedar al menos una categoría', 'error'); db.cats.splice(t.dc, 1); guardar(); render(); }
};
$('btnDelVentas').onclick = () => { if (confirm('¿Borrar todas las ventas?')) { db.ventas = []; guardar(); render(); toast('Ventas borradas'); } };
$('btnDelMovs').onclick = () => { if (confirm('¿Borrar todos los movimientos?')) { db.movs = []; guardar(); render(); toast('Movimientos borrados'); } };

/* ================= COMPRAS ================= */
function buscarProd(t) {
  t = String(t).trim(); const tl = t.toLowerCase(); if (!t) return null; const m = db.productos.filter(x => x.nombre.toLowerCase().includes(tl));
  return db.productos.find(x => x.codigo === t) || db.productos.find(x => x.nombre.toLowerCase() === tl) || (m.length === 1 ? m[0] : null);
}
function addCompra(txt) {
  const p = buscarProd(txt); if (!p) return toast('Producto no encontrado: ' + txt, 'error');
  const it = compra.find(c => c.pid === p.id); it ? it.cant++ : compra.push({pid: p.id, cant: 1, costo: p.costo || 0}); renderCompra(); toast('+ ' + p.nombre);
}
function renderCompra() {
  $('tCompra').innerHTML = compra.map((c, i) => `<tr><td>${esc(prod(c.pid).nombre)}</td><td><input type="number" min="1" class="inp" value="${c.cant}" data-cq="${i}"></td>
    <td><input type="number" min="0" step="0.01" class="inp" value="${c.costo}" data-cc="${i}"></td><td><button class="btn sm bad" data-cx="${i}">×</button></td></tr>`).join('')
    || '<tr><td colspan="4" class="empty">Sin productos</td></tr>';
  totalCompra();
}
const totalCompra = () => $('totalC').innerHTML = `<div class="gt"><span>Total compra</span><b>${money(compra.reduce((s, c) => s + c.cant * c.costo, 0))}</b></div>`;
$('tCompra').oninput = e => { const t = e.target.dataset;
  if (t.cq !== undefined) compra[t.cq].cant = parseInt(e.target.value, 10) || 0; if (t.cc !== undefined) compra[t.cc].costo = parseFloat(e.target.value) || 0; totalCompra(); };
$('tCompra').onclick = e => { const i = e.target.dataset.cx; if (i !== undefined) { compra.splice(i, 1); renderCompra(); } };
$('btnScanCompra').onclick = () => Scan.inst && Scan.el === 'readerCompra' ? Scan.stop() : Scan.start('readerCompra', addCompra, true);
$('btnAddC').onclick = () => { addCompra($('manualC').value); $('manualC').value = ''; $('manualC').focus(); };
$('manualC').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('btnAddC').click(); } };
$('btnVaciarC').onclick = () => { compra = []; renderCompra(); };
$('btnRegC').onclick = () => {
  if (!compra.length) return toast('La compra está vacía', 'error');
  if (compra.some(c => !(c.cant > 0))) return toast('Revisa las cantidades', 'error');
  const id = (db.compras[0]?.id || 0) + 1, items = [];
  compra.forEach(c => { const p = prod(c.pid), tot = p.stock + c.cant;
    p.costo = tot ? Math.round((p.stock * (p.costo || 0) + c.cant * c.costo) / tot * 100) / 100 : c.costo; p.stock = tot;
    db.movs.unshift({fecha: Date.now(), nombre: p.nombre, tipo: 'compra', cantidad: c.cant, final: p.stock, nota: 'Compra #' + id}); items.push({nombre: p.nombre, cant: c.cant, costo: c.costo}); });
  db.compras.unshift({id, fecha: Date.now(), prov: +$('cProvSel').value || 0, items, total: items.reduce((s, i) => s + i.cant * i.costo, 0)});
  db.movs = db.movs.slice(0, 500); db.compras = db.compras.slice(0, 500); compra = []; guardar(); render(); toast('Compra #' + id + ' registrada');
};
function renderExtra() {
  const sel = $('cProvSel').value; $('cProvSel').innerHTML = '<option value="0">— Proveedor —</option>' + db.proveedores.map(v => `<option value="${v.id}">${esc(v.nombre)}</option>`).join(''); $('cProvSel').value = sel;
  $('tCompras').innerHTML = db.compras.slice(0, 10).map(c => `<tr><td>${c.id}</td><td>${fecha(c.fecha)}</td><td>${esc(provNombre(c.prov)) || '—'}</td><td>${c.items.map(i => `${i.cant}× ${esc(i.nombre)}`).join(', ')}</td><td class="num">${money(c.total)}</td></tr>`).join('')
    || '<tr><td colspan="5" class="empty">Sin compras.</td></tr>';
  $('tCierres').innerHTML = db.cierres.slice(0, 10).map(r => `<tr><td>${r.id}</td><td>${fecha(r.fecha)}</td><td>${r.n}</td><td class="num">${money(r.efectivo)}</td><td class="num">${money(r.tarjeta)}</td><td class="num">${money(r.transferencia)}</td><td class="num"><b>${money(r.total)}</b></td></tr>`).join('')
    || '<tr><td colspan="7" class="empty">Aún no hay cierres.</td></tr>';
  renderCompra();
}

/* ================= CAJA, BAJAS, CÓDIGOS, EXPORTAR ================= */
$('btnCierre').onclick = () => {
  const desde = db.cierres[0]?.fecha || new Date().setHours(0, 0, 0, 0), vs = db.ventas.filter(v => !v.anulada && v.fecha > desde);
  if (!vs.length) return toast('No hay ventas nuevas desde el último cierre', 'error');
  const por = m => vs.filter(v => (v.metodo || 'Efectivo') === m).reduce((s, v) => s + v.total, 0);
  const r = {id: (db.cierres[0]?.id || 0) + 1, fecha: Date.now(), n: vs.length, efectivo: por('Efectivo'), tarjeta: por('Tarjeta'), transferencia: por('Transferencia')};
  r.total = r.efectivo + r.tarjeta + r.transferencia;
  if (!confirm(`Cierre de caja (${r.n} ventas)\nEfectivo: ${money(r.efectivo)}\nTarjeta: ${money(r.tarjeta)}\nTransferencia: ${money(r.transferencia)}\nTOTAL: ${money(r.total)}\n\n¿Cerrar caja?`)) return;
  db.cierres.unshift(r); guardar(); render(); toast('Caja cerrada');
};
$('alertas').onclick = e => {
  const p = prod(e.target.dataset.baja); if (!p || !confirm(`¿Dar de baja ${p.stock} unidad(es) de "${p.nombre}"?`)) return;
  db.movs.unshift({fecha: Date.now(), nombre: p.nombre, tipo: 'baja', cantidad: p.stock, final: 0, nota: 'Producto vencido'}); p.stock = 0; guardar(); render(); toast('Producto dado de baja');
};
$('btnGen').onclick = () => { let n = db.sig, c; do { c = 'PROD-' + String(n++).padStart(4, '0'); } while (db.productos.some(p => p.codigo === c)); $('pCod').value = c; };
$('btnCsvFilt').onclick = () => {
  const c = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const f = [['Código','Nombre','Categoría','Proveedor','Stock','Mínimo','Costo','Precio','Vence']].concat(listaProd().map(p => [p.codigo, p.nombre, p.categoria, provNombre(p.prov), p.stock, p.min, p.costo || 0, p.precio, p.venc]));
  bajar('productos_filtrados.csv', '\uFEFF' + f.map(r => r.map(c).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
};

/* ================= BÚSQUEDA GLOBAL E HISTORIAL ================= */
function palette() { $('mBuscar').classList.add('show'); $('gq').value = ''; $('gres').innerHTML = ''; $('gq').focus(); }
$('gq').oninput = () => {
  const q = $('gq').value.trim().toLowerCase(); if (!q) { $('gres').innerHTML = ''; return; } const r = [];
  db.productos.filter(p => (p.nombre + ' ' + p.codigo).toLowerCase().includes(q)).slice(0, 6).forEach(p => r.push(`<li data-t="p" data-q="${esc(p.nombre)}">📦 ${esc(p.nombre)} <small>stock ${p.stock}</small></li>`));
  db.proveedores.filter(v => v.nombre.toLowerCase().includes(q)).slice(0, 3).forEach(v => r.push(`<li data-t="v">🚚 ${esc(v.nombre)}</li>`));
  db.ventas.filter(v => v.items.some(i => i.nombre.toLowerCase().includes(q))).slice(0, 4).forEach(v => r.push(`<li data-t="s">🛒 Venta #${v.id} · ${fecha(v.fecha)} · ${money(v.total)}</li>`));
  $('gres').innerHTML = r.join('') || '<li class="empty">Sin resultados</li>';
};
$('gres').onclick = e => {
  const li = e.target.closest('li'); if (!li || !li.dataset.t) return; cerrar(); const t = li.dataset.t;
  if (t === 'p') { ir('productos'); $('buscar').value = li.dataset.q; tablaProd(); } if (t === 'v') ir('proveedores'); if (t === 's') ir('ventas');
};
function historial(id) {
  const p = prod(id); if (!p) return; const E = ['entrada', 'anulación', 'compra'], dias = {};
  db.movs.filter(m => m.nombre === p.nombre).forEach(m => { const k = new Date(m.fecha).toDateString(), d = dias[k] || (dias[k] = {f: m.fecha, e: 0, s: 0}); E.includes(m.tipo) ? d.e += m.cantidad : d.s += m.cantidad; });
  const hoy = new Date().toDateString(), ay = new Date(Date.now() - 864e5).toDateString();
  $('hTitulo').textContent = p.nombre + ' · stock ' + p.stock;
  $('hBody').innerHTML = Object.entries(dias).map(([k, d]) => `<div class="bar2"><b>${k === hoy ? 'Hoy' : k === ay ? 'Ayer' : new Date(d.f).toLocaleDateString('es', {day: 'numeric', month: 'short'})}</b><span class="ok-t">+${d.e} entraron</span><span class="bad-t">−${d.s} salieron</span></div>`).join('')
    || '<p class="empty">Sin movimientos de este producto.</p>';
  $('mHist').classList.add('show');
}

/* ================= INICIO ================= */
function cerrar() { Scan.stop(); document.querySelectorAll('.modal').forEach(m => m.classList.remove('show')); }
document.querySelectorAll('[data-close]').forEach(b => b.onclick = cerrar);
document.querySelectorAll('.modal').forEach(m => m.onclick = e => { if (e.target === m) cerrar(); });
document.onkeydown = e => {
  if (e.key === 'Escape') cerrar();
  else if (e.key === 'F2') { e.preventDefault(); ir('ventas'); }
  else if (e.key === 'F4') { e.preventDefault(); ir('productos'); abrirProd(); }
  else if (e.key === 'F9') { e.preventDefault(); $('btnCobrar').click(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette(); }
};
document.querySelectorAll('th[data-s]').forEach(th => th.onclick = () => { orden = {c: th.dataset.s, d: orden.c === th.dataset.s ? -orden.d : 1}; tablaProd(); });
['buscar', 'fCat', 'fStock'].forEach(i => $(i).oninput = tablaProd);
$('btnNuevo').onclick = () => abrirProd(); $('btnNuevoProv').onclick = () => abrirProv();
$('empresa').onclick = () => { const n = prompt('Nombre del negocio:', db.empresa); if (n?.trim()) { db.empresa = n.trim().slice(0, 40); guardar(); render(); } };
render();
