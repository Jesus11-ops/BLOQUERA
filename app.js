import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, deleteDoc, doc,
  query, orderBy, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ── Firebase init ─────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyApLXRqDQTYuHbxPuVAt7UMn8S3K2W91m0",
  authDomain: "bloquera-b8717.firebaseapp.com",
  projectId: "bloquera-b8717",
  storageBucket: "bloquera-b8717.firebasestorage.app",
  messagingSenderId: "727421527675",
  appId: "1:727421527675:web:4f6abe06f9ce410be424de"
};
const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ── Auth guard ────────────────────────────────────────────────
onAuthStateChanged(auth, user => {
  if (!user) { window.location.href = "index.html"; return; }
  document.getElementById("userEmail").textContent = user.email;
  cargarTodo();
});

window.cerrarSesion = () => signOut(auth).then(() => window.location.href = "index.html");

// ── Helpers ───────────────────────────────────────────────────
const fmt = n => {
  // Si ya es número, úsalo directo; si es string, elimina puntos de miles y símbolo $ antes de parsear
  const num = typeof n === "number" ? n
    : parseFloat(String(n||0).replace(/\./g,"").replace(/[^0-9\-]/g,"")) || 0;
  return "$" + num.toLocaleString("es-CO", {minimumFractionDigits:0, maximumFractionDigits:0});
};
// Parsea un input monetario colombiano: acepta "380.000" o "380000" → 380000
const parseCOP = id => {
  const raw = document.getElementById(id)?.value || "0";
  return parseFloat(raw.replace(/\./g,"").replace(/[^0-9\-]/g,"")) || 0;
};
const hoy  = () => new Date().toISOString().slice(0,10);
const diaSemana = f => {
  const dias = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
  return dias[new Date(f+"T12:00:00").getDay()];
};

// Formatea número con puntos colombianos
const numCO = n => Number(n||0).toLocaleString("es-CO");

// ── Navegación ────────────────────────────────────────────────
window.showSection = function(id) {
  document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById("sec-"+id)?.classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n => {
    if (n.getAttribute("onclick")?.includes("'"+id+"'")) n.classList.add("active");
  });
};

window.switchTab = function(group, tabId, btn) {
  document.querySelectorAll(`[id^="${group.replace('tab','')}"]`).forEach(p => {});
  // find all tab panels in same section
  const section = btn.closest(".section, main");
  section.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  section.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById(tabId)?.classList.add("active");
  btn.classList.add("active");
};

// ── Fecha hoy ─────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const h = hoy();
  document.getElementById("fechaHoy").textContent = "Hoy: " + diaSemana(h) + " " + h;

  // prefill date fields
  ["prodFecha","ventaFecha","arenaCompFecha","arenaVentFecha",
   "compFecha","pagoFecha","capitalFecha"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = h;
  });
});

// ── DATOS en memoria ──────────────────────────────────────────
let DATA = {
  producciones: [],
  ventas: [],
  comprasArena: [],
  ventasArena: [],
  compras: [],
  pagos: [],
  capital: [],
  distribuciones: [],
  config: { precioBloque: 0 }
};

async function cargarTodo() {
  const colls = [
    ["Producciones","producciones"],
    ["Ventas","ventas"],
    ["ComprasArena","comprasArena"],
    ["VentasArena","ventasArena"],
    ["Compras","compras"],
    ["Pagos","pagos"],
    ["Capital","capital"],
    ["Distribuciones","distribuciones"]
  ];
  for (const [col, key] of colls) {
    const snap = await getDocs(query(collection(db, col), orderBy("fecha","desc")));
    DATA[key] = snap.docs.map(d => ({id: d.id, ...d.data()}));
  }
  // config
  const cfgDoc = await getDoc(doc(db,"Config","general"));
  if (cfgDoc.exists()) DATA.config = cfgDoc.data();

  renderTodo();
}

function renderTodo() {
  renderResumen();
  renderStock();
  renderProducciones();
  renderVentas();
  renderArena();
  renderCompras();
  renderPagos();
  renderCapital();
  renderDistribuciones();
  cargarConfigUI();
}

// ═══ STATS GENERALES ══════════════════════════════════════════
function calcStats() {
  const totalProducido = DATA.producciones.reduce((s,p) => s+(p.cantidad||0), 0);
  const totalVendido   = DATA.ventas.reduce((s,v) => s+(v.cantidad||0), 0);
  const stockBloques   = totalProducido - totalVendido;

  const ingBloques  = DATA.ventas.reduce((s,v) => s+(v.total||0), 0);
  const ingArena    = DATA.ventasArena.reduce((s,v) => s+(v.valor||0), 0);
  const totalIngresos = ingBloques + ingArena;

  const egCompras   = DATA.compras.reduce((s,c) => s+(c.valor||0), 0);
  const egCompArena = DATA.comprasArena.reduce((s,c) => s+(c.valor||0), 0);
  const egPagos     = DATA.pagos.reduce((s,p) => s+(p.monto||0), 0);
  const egDistrib   = DATA.distribuciones.reduce((s,d) => s+(d.monto||0), 0);
  const totalEgresos = egCompras + egCompArena + egPagos + egDistrib;

  const capitalTotal = DATA.capital.reduce((s,c) => s+(c.monto||0), 0);
  const ganancia     = totalIngresos - egCompras - egCompArena - egPagos;
  const capitalActual = capitalTotal + ganancia - egDistrib;

  // ── Valor del stock de bloques (dinero "guardado" en material, no en efectivo) ──
  const precioBloqueActual = DATA.config.precioBloque || 0;
  const valorStockBloques  = stockBloques * precioBloqueActual;
  const patrimonioTotal    = capitalActual + valorStockBloques;

  // ── Ganancia del período actual (desde el día después de la última distribución) ──
  let periodoDesde = null;
  let periodoLabel = "inicio";
  if (DATA.distribuciones.length > 0) {
    const ultDist = DATA.distribuciones.reduce((a,b) => ((a.hasta||a.fecha) >= (b.hasta||b.fecha) ? a : b));
    const dHasta = ultDist.hasta || ultDist.fecha;
    const nextDay = new Date(dHasta + "T12:00:00");
    nextDay.setDate(nextDay.getDate() + 1);
    periodoDesde = nextDay.toISOString().slice(0,10);
    periodoLabel = "desde " + periodoDesde;
  }
  const filtPer = arr => periodoDesde ? arr.filter(x => x.fecha >= periodoDesde) : arr;
  const ingBloquesPer  = filtPer(DATA.ventas).reduce((s,v) => s+(v.total||0), 0);
  const ingArenaPer    = filtPer(DATA.ventasArena).reduce((s,v) => s+(v.valor||0), 0);
  const egComprasPer   = filtPer(DATA.compras).reduce((s,c) => s+(c.valor||0), 0);
  const egCompArenaPer = filtPer(DATA.comprasArena).reduce((s,c) => s+(c.valor||0), 0);
  const egPagosPer     = filtPer(DATA.pagos).reduce((s,p) => s+(p.monto||0), 0);
  const gananciaPeriodo = (ingBloquesPer + ingArenaPer) - egComprasPer - egCompArenaPer - egPagosPer;

  return { stockBloques, totalProducido, totalVendido,
           ingBloques, ingArena, totalIngresos,
           egCompras, egCompArena, egPagos, egDistrib,
           totalEgresos, capitalTotal, ganancia, capitalActual,
           gananciaPeriodo, periodoLabel,
           precioBloqueActual, valorStockBloques, patrimonioTotal };
}

// ═══ RESUMEN ══════════════════════════════════════════════════
function renderResumen() {
  const s = calcStats();
  document.getElementById("st-bloques").textContent   = numCO(s.stockBloques);
  document.getElementById("st-capital").textContent   = fmt(s.capitalActual);
  document.getElementById("st-ingresos").textContent  = fmt(s.totalIngresos);
  document.getElementById("st-egresos").textContent   = fmt(s.totalEgresos);
  const elValorStock = document.getElementById("st-valorstock");
  if (elValorStock) elValorStock.textContent = fmt(s.valorStockBloques);
  const elPatrimonio = document.getElementById("st-patrimonio");
  if (elPatrimonio) elPatrimonio.textContent = fmt(s.patrimonioTotal);
  // Ganancia del período (desde última distribución) y acumulada histórica
  const elGan = document.getElementById("st-ganancia");
  elGan.textContent = fmt(s.gananciaPeriodo);
  elGan.className = s.gananciaPeriodo >= 0 ? "stat-value pos" : "stat-value neg";
  const elRango = document.getElementById("st-ganancia-rango");
  if (elRango) elRango.textContent = s.periodoLabel;
  const elTotal = document.getElementById("st-ganancia-total");
  if (elTotal) {
    elTotal.textContent = fmt(s.ganancia);
    elTotal.className = s.ganancia >= 0 ? "stat-value pos" : "stat-value neg";
  }

  // últimas ventas
  const tbody = document.getElementById("resumenVentas");
  const ultV = DATA.ventas.slice(0,5);
  tbody.innerHTML = ultV.length ? ultV.map(v => `
    <tr>
      <td>${v.fecha}</td>
      <td>${numCO(v.cantidad)}</td>
      <td>${fmt(v.precio)}</td>
      <td class="pos">${fmt(v.total)}</td>
    </tr>`).join("") : `<tr><td colspan="4" class="empty-state"><p>Sin ventas</p></td></tr>`;

  // últimas producciones
  const tbodyP = document.getElementById("resumenProduccion");
  const ultP = DATA.producciones.slice(0,5);
  tbodyP.innerHTML = ultP.length ? ultP.map(p => `
    <tr>
      <td>${p.fecha}</td>
      <td><span class="badge badge-naranja">${numCO(p.cantidad)}</span></td>
      <td>${p.obs||"—"}</td>
    </tr>`).join("") : `<tr><td colspan="3" class="empty-state"><p>Sin producciones</p></td></tr>`;

  // últimas compras
  const tbodyC = document.getElementById("resumenCompras");
  const ultC = DATA.compras.slice(0,5);
  tbodyC.innerHTML = ultC.length ? ultC.map(c => `
    <tr>
      <td>${c.fecha}</td>
      <td><span class="badge badge-azul">${c.material}</span></td>
      <td>${c.proveedor||"—"}</td>
      <td class="neg">${fmt(c.valor)}</td>
      <td>${c.obs||"—"}</td>
    </tr>`).join("") : `<tr><td colspan="5" class="empty-state"><p>Sin compras</p></td></tr>`;
}

// ═══ STOCK ════════════════════════════════════════════════════
function renderStock() {
  const s = calcStats();
  document.getElementById("stockNumGrande").textContent = numCO(s.stockBloques);
  document.getElementById("totalProducido").textContent  = numCO(s.totalProducido);
  document.getElementById("totalVendido").textContent    = numCO(s.totalVendido);
  document.getElementById("precioBloque").textContent    = DATA.config.precioBloque ? fmt(DATA.config.precioBloque) : "Sin configurar";
  const elVSB = document.getElementById("valorStockBloques");
  if (elVSB) elVSB.textContent = DATA.config.precioBloque ? fmt(s.valorStockBloques) : "Configure el precio";

  // historial de movimientos (producciones + ventas mezcladas por fecha)
  const movs = [
    ...DATA.producciones.map(p => ({fecha:p.fecha, tipo:"Producción", cantidad:+p.cantidad, obs:p.obs||""})),
    ...DATA.ventas.map(v => ({fecha:v.fecha, tipo:"Venta", cantidad:-v.cantidad, obs:v.cliente||""}))
  ].sort((a,b) => b.fecha.localeCompare(a.fecha));

  // calcular stock acumulado (de más antiguo a más reciente)
  const movsCrono = [...movs].reverse();
  let acum = 0;
  const stockMap = movsCrono.map(m => {
    acum += m.cantidad;
    return { ...m, acum };
  });
  // invertir para mostrar más reciente primero
  stockMap.reverse();

  const tbody = document.getElementById("historialStock");
  tbody.innerHTML = stockMap.length ? stockMap.map(m => `
    <tr>
      <td>${m.fecha}</td>
      <td><span class="badge ${m.cantidad>0?'badge-verde':'badge-rojo'}">${m.tipo}</span></td>
      <td class="${m.cantidad>0?'pos':'neg'}">${m.cantidad>0?'+':''}${numCO(Math.abs(m.cantidad))}</td>
      <td><strong>${numCO(m.acum)}</strong></td>
      <td>${m.obs}</td>
    </tr>`).join("") : `<tr><td colspan="5" class="empty-state"><p>Sin movimientos</p></td></tr>`;
}

// ═══ PRODUCCIÓN ═══════════════════════════════════════════════
function renderProducciones() {
  const h = hoy();
  const mes = h.slice(0,7);
  const prodHoy = DATA.producciones.filter(p=>p.fecha===h).reduce((s,p)=>s+p.cantidad,0);
  const prodMes = DATA.producciones.filter(p=>p.fecha.startsWith(mes)).reduce((s,p)=>s+p.cantidad,0);
  document.getElementById("prodHoy").textContent = numCO(prodHoy);
  document.getElementById("prodMes").textContent = numCO(prodMes);

  const tbody = document.getElementById("tablaProducciones");
  tbody.innerHTML = DATA.producciones.length ? DATA.producciones.map(p => `
    <tr>
      <td>${p.fecha} <small style="color:var(--texto-sec)">(${diaSemana(p.fecha)})</small></td>
      <td><strong>${numCO(p.cantidad)}</strong></td>
      <td>${p.obs||"—"}</td>
      <td><button class="btn-del" onclick="eliminar('Producciones','${p.id}')">🗑</button></td>
    </tr>`).join("") : `<tr><td colspan="4" class="empty-state"><p>Sin registros</p></td></tr>`;
}

window.registrarProduccion = async function() {
  const fecha    = document.getElementById("prodFecha").value;
  const cantidad = parseInt(document.getElementById("prodCantidad").value);
  const obs      = document.getElementById("prodObs").value.trim();

  if (!fecha || !cantidad || cantidad < 1) { alert("⚠️ Ingrese fecha y cantidad válidas"); return; }

  await addDoc(collection(db,"Producciones"), {
    fecha, cantidad, obs, diaSemana: diaSemana(fecha),
    creadoEn: new Date().toISOString()
  });
  document.getElementById("prodCantidad").value = "";
  document.getElementById("prodObs").value = "";
  await cargarTodo();
  alert("✅ Producción registrada: " + numCO(cantidad) + " bloques");
};

// ═══ VENTAS BLOQUES ════════════════════════════════════════════
function renderVentas() {
  const s = calcStats();
  document.getElementById("totalIngresosVentas").textContent = fmt(s.ingBloques);
  document.getElementById("totalBloquesVendidos").textContent = numCO(s.totalVendido);
  const totalFl = DATA.ventas.reduce((acc,v)=>acc+(v.valorFlete||0),0);
  document.getElementById("totalFletes").textContent = fmt(totalFl);

  const tbody = document.getElementById("tablaVentas");
  tbody.innerHTML = DATA.ventas.length ? DATA.ventas.map(v => `
    <tr>
      <td>${v.fecha}</td>
      <td>${v.cliente||"—"}</td>
      <td>${numCO(v.cantidad)}</td>
      <td>${fmt(v.precio)}</td>
      <td>${v.valorFlete ? fmt(v.valorFlete) : "—"}</td>
      <td class="pos">${fmt(v.total)}</td>
      <td>${v.obs||"—"}</td>
      <td><button class="btn-del" onclick="eliminarVenta('${v.id}')">🗑</button></td>
    </tr>`).join("") : `<tr><td colspan="8" class="empty-state"><p>Sin ventas</p></td></tr>`;
}

window.toggleFlete = function() {
  const v = document.getElementById("ventaFlete").value;
  document.getElementById("boxFleteExterno").style.display = v==="externo" ? "block" : "none";
  calcularVenta();
};

window.calcularVenta = function() {
  const cant   = parseFloat(document.getElementById("ventaCantidad").value)||0;
  const precio = parseCOP("ventaPrecio")||0;
  const flete  = document.getElementById("ventaFlete").value;
  const vflete = flete==="externo" ? (parseCOP("ventaValorFlete")||0) : 0;
  const total  = cant * precio;
  const prev   = document.getElementById("ventaPreview");
  const txt    = document.getElementById("ventaPreviewTxt");
  if (cant && precio) {
    txt.textContent = `${numCO(cant)} bloques × ${fmt(precio)} = ${fmt(total)}` +
      (vflete ? ` | Flete: ${fmt(vflete)}` : "");
    prev.style.display = "flex";
  } else {
    prev.style.display = "none";
  }
};

window.registrarVenta = async function() {
  const fecha    = document.getElementById("ventaFecha").value;
  const cliente  = document.getElementById("ventaCliente").value.trim();
  const cantidad = parseInt(document.getElementById("ventaCantidad").value);
  const precio   = parseCOP("ventaPrecio");
  const flete    = document.getElementById("ventaFlete").value;
  const valFlete = flete==="externo" ? (parseCOP("ventaValorFlete")||0) : 0;
  const obs      = document.getElementById("ventaObs").value.trim();

  if (!fecha || !cantidad || !precio) { alert("⚠️ Complete fecha, cantidad y precio"); return; }

  const s = calcStats();
  if (cantidad > s.stockBloques) {
    alert(`⚠️ No hay suficiente stock. Disponible: ${numCO(s.stockBloques)} bloques`); return;
  }

  const total = cantidad * precio;
  await addDoc(collection(db,"Ventas"), {
    fecha, cliente, cantidad, precio, total,
    flete, valorFlete: valFlete, obs,
    diaSemana: diaSemana(fecha), creadoEn: new Date().toISOString()
  });

  // Si hay flete externo, registrar como egreso en Pagos
  if (flete==="externo" && valFlete>0) {
    await addDoc(collection(db,"Pagos"), {
      fecha, tipo:"Flete Externo", monto:valFlete,
      descripcion:`Flete venta ${numCO(cantidad)} bloques ${cliente?'a '+cliente:''}`,
      creadoEn: new Date().toISOString()
    });
  }

  document.getElementById("ventaCantidad").value = "";
  document.getElementById("ventaPrecio").value = "";
  document.getElementById("ventaValorFlete").value = "";
  document.getElementById("ventaCliente").value = "";
  document.getElementById("ventaObs").value = "";
  document.getElementById("ventaPreview").style.display = "none";

  await cargarTodo();
  alert("✅ Venta registrada: " + fmt(total));
};

window.eliminarVenta = async function(id) {
  if (!confirm("¿Eliminar esta venta?")) return;
  await deleteDoc(doc(db,"Ventas",id));
  await cargarTodo();
};

// ═══ ARENA VENTA ══════════════════════════════════════════════
function renderArena() {
  const totInvertido = DATA.comprasArena.reduce((s,c)=>s+(c.valor||0),0);
  const totVendido   = DATA.ventasArena.reduce((s,v)=>s+(v.valor||0),0);
  const ganancia     = totVendido - totInvertido;

  document.getElementById("arenaInvertido").textContent  = fmt(totInvertido);
  document.getElementById("arenaVendidoTotal").textContent = fmt(totVendido);
  document.getElementById("arenaGanancia").textContent   = fmt(ganancia);

  // Resumen de volcos
  const resDiv = document.getElementById("resumenVolcos");
  if (DATA.comprasArena.length === 0) {
    resDiv.innerHTML = `<div class="empty-state"><div class="icon">🏖️</div><p>Sin volcos</p></div>`;
  } else {
    resDiv.innerHTML = DATA.comprasArena.map(v => {
      const pct = totVendido > 0 ? Math.min(100, (totVendido/totInvertido*100)).toFixed(0) : 0;
      return `
        <div style="margin-bottom:12px;padding:12px;background:var(--negro);border:1px solid var(--gris-brd);border-radius:6px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-size:12px;font-weight:700;">${v.fecha} — ${v.obs||"Volco"}</span>
            <span style="color:var(--azul);font-weight:800;font-size:14px;">${fmt(v.valor)}</span>
          </div>
        </div>`;
    }).join("") + `<div style="padding-top:8px;border-top:1px solid var(--gris-brd)">
      <div style="font-size:11px;color:var(--texto-sec);margin-bottom:4px;">Recuperación total</div>
      <div class="arena-meter"><div class="arena-meter-fill" style="width:${Math.min(100,(totVendido/totInvertido*100)||0)}%"></div></div>
      <div style="font-size:11px;margin-top:4px;">${fmt(totVendido)} / ${fmt(totInvertido)}</div>
    </div>`;
  }

  // tabla volcos
  const tbody1 = document.getElementById("tablaVolcos");
  tbody1.innerHTML = DATA.comprasArena.length ? DATA.comprasArena.map(c => `
    <tr>
      <td>${c.fecha}</td>
      <td class="neg">${fmt(c.valor)}</td>
      <td>${c.obs||"—"}</td>
      <td><button class="btn-del" onclick="eliminar('ComprasArena','${c.id}')">🗑</button></td>
    </tr>`).join("") : `<tr><td colspan="4" class="empty-state"><p>Sin registros</p></td></tr>`;

  // tabla ventas arena
  const tbody2 = document.getElementById("tablaVentasArena");
  tbody2.innerHTML = DATA.ventasArena.length ? DATA.ventasArena.map(v => `
    <tr>
      <td>${v.fecha}</td>
      <td>${v.cliente||"—"}</td>
      <td class="pos">${fmt(v.valor)}</td>
      <td>${v.obs||"—"}</td>
      <td><button class="btn-del" onclick="eliminar('VentasArena','${v.id}')">🗑</button></td>
    </tr>`).join("") : `<tr><td colspan="5" class="empty-state"><p>Sin ventas</p></td></tr>`;
}

window.registrarCompraArena = async function() {
  const fecha = document.getElementById("arenaCompFecha").value;
  const valor = parseCOP("arenaCompValor");
  const obs   = document.getElementById("arenaCompObs").value.trim();
  if (!fecha || !valor) { alert("⚠️ Ingrese fecha y valor"); return; }
  await addDoc(collection(db,"ComprasArena"), {
    fecha, valor, obs, creadoEn: new Date().toISOString()
  });
  document.getElementById("arenaCompValor").value = "";
  document.getElementById("arenaCompObs").value   = "";
  await cargarTodo();
  alert("✅ Volco de arena registrado: " + fmt(valor));
};

window.registrarVentaArena = async function() {
  const fecha   = document.getElementById("arenaVentFecha").value;
  const cliente = document.getElementById("arenaVentCliente").value.trim();
  const valor   = parseCOP("arenaVentValor");
  const obs     = document.getElementById("arenaVentObs").value.trim();
  if (!fecha || !valor) { alert("⚠️ Ingrese fecha y valor"); return; }
  await addDoc(collection(db,"VentasArena"), {
    fecha, cliente, valor, obs, creadoEn: new Date().toISOString()
  });
  document.getElementById("arenaVentValor").value  = "";
  document.getElementById("arenaVentCliente").value = "";
  document.getElementById("arenaVentObs").value    = "";
  await cargarTodo();
  alert("✅ Venta de arena registrada: " + fmt(valor));
};

// ═══ COMPRAS MATERIA PRIMA ════════════════════════════════════
function renderCompras() {
  // resumen por material
  const por = {};
  DATA.compras.forEach(c => {
    if (!por[c.material]) por[c.material] = 0;
    por[c.material] += c.valor||0;
  });
  const resDiv = document.getElementById("resumenMateriales");
  if (Object.keys(por).length === 0) {
    resDiv.innerHTML = `<div class="empty-state"><div class="icon">📦</div><p>Sin compras</p></div>`;
  } else {
    resDiv.innerHTML = Object.entries(por).map(([mat,val]) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--gris-brd)">
        <span style="font-weight:600;">${mat}</span>
        <span class="badge badge-rojo">${fmt(val)}</span>
      </div>`).join("");
  }

  const tbody = document.getElementById("tablaCompras");
  tbody.innerHTML = DATA.compras.length ? DATA.compras.map(c => `
    <tr>
      <td>${c.fecha}</td>
      <td><span class="badge badge-azul">${c.material}</span></td>
      <td>${c.proveedor||"—"}</td>
      <td>${c.cantidad||"—"}</td>
      <td class="neg">${fmt(c.valor)}</td>
      <td>${c.obs||"—"}</td>
      <td><button class="btn-del" onclick="eliminar('Compras','${c.id}')">🗑</button></td>
    </tr>`).join("") : `<tr><td colspan="7" class="empty-state"><p>Sin compras</p></td></tr>`;
}

window.registrarCompra = async function() {
  const fecha     = document.getElementById("compFecha").value;
  const material  = document.getElementById("compMaterial").value;
  const proveedor = document.getElementById("compProveedor").value.trim();
  const valor     = parseCOP("compValor");
  const cantidad  = document.getElementById("compCantidad").value.trim();
  const obs       = document.getElementById("compObs").value.trim();
  if (!fecha || !valor) { alert("⚠️ Ingrese fecha y valor"); return; }
  await addDoc(collection(db,"Compras"), {
    fecha, material, proveedor, valor, cantidad, obs,
    diaSemana: diaSemana(fecha), creadoEn: new Date().toISOString()
  });
  document.getElementById("compValor").value    = "";
  document.getElementById("compProveedor").value = "";
  document.getElementById("compCantidad").value  = "";
  document.getElementById("compObs").value       = "";
  await cargarTodo();
  alert("✅ Compra registrada: " + material + " — " + fmt(valor));
};

// ═══ PAGOS ════════════════════════════════════════════════════
function renderPagos() {
  const por = {};
  DATA.pagos.forEach(p => {
    if (!por[p.tipo]) por[p.tipo] = 0;
    por[p.tipo] += p.monto||0;
  });
  const resDiv = document.getElementById("resumenPagos");
  if (Object.keys(por).length === 0) {
    resDiv.innerHTML = `<div class="empty-state"><div class="icon">💸</div><p>Sin pagos</p></div>`;
  } else {
    resDiv.innerHTML = Object.entries(por).map(([tipo,val]) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--gris-brd)">
        <span style="font-weight:600;">${tipo}</span>
        <span class="badge badge-rojo">${fmt(val)}</span>
      </div>`).join("");
  }

  const tbody = document.getElementById("tablaPagos");
  tbody.innerHTML = DATA.pagos.length ? DATA.pagos.map(p => `
    <tr>
      <td>${p.fecha}</td>
      <td><span class="badge badge-naranja">${p.tipo}</span></td>
      <td class="neg">${fmt(p.monto)}</td>
      <td>${p.descripcion||"—"}</td>
      <td><button class="btn-del" onclick="eliminar('Pagos','${p.id}')">🗑</button></td>
    </tr>`).join("") : `<tr><td colspan="5" class="empty-state"><p>Sin pagos</p></td></tr>`;
}

window.registrarPago = async function() {
  const fecha = document.getElementById("pagoFecha").value;
  const tipo  = document.getElementById("pagoTipo").value;
  const monto = parseCOP("pagoMonto");
  const desc  = document.getElementById("pagoDesc").value.trim();
  if (!fecha || !monto) { alert("⚠️ Ingrese fecha y monto"); return; }
  await addDoc(collection(db,"Pagos"), {
    fecha, tipo, monto, descripcion:desc,
    diaSemana: diaSemana(fecha), creadoEn: new Date().toISOString()
  });
  document.getElementById("pagoMonto").value = "";
  document.getElementById("pagoDesc").value  = "";
  await cargarTodo();
  alert("✅ Pago registrado: " + tipo + " — " + fmt(monto));
};

// ═══ CAPITAL ══════════════════════════════════════════════════
function renderCapital() {
  const tbody = document.getElementById("tablaCapital");
  tbody.innerHTML = DATA.capital.length ? DATA.capital.map(c => `
    <tr>
      <td>${c.fecha}</td>
      <td class="pos">${fmt(c.monto)}</td>
      <td>${c.nota||"—"}</td>
      <td><button class="btn-del" onclick="eliminar('Capital','${c.id}')">🗑</button></td>
    </tr>`).join("") : `<tr><td colspan="4" class="empty-state"><p>Sin registros</p></td></tr>`;

  const s = calcStats();
  document.getElementById("capitalActualInfo").innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;justify-content:space-between;">
        <span style="color:var(--texto-sec)">Capital invertido:</span>
        <strong>${fmt(s.capitalTotal)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="color:var(--texto-sec)">Ganancia acumulada:</span>
        <strong class="${s.ganancia>=0?'pos':'neg'}">${fmt(s.ganancia)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="color:var(--texto-sec)">Distribuciones:</span>
        <strong class="neg">-${fmt(s.egDistrib)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;border-top:1px solid var(--gris-brd);padding-top:10px;">
        <span style="font-weight:700;">Capital Actual (efectivo):</span>
        <strong style="font-size:18px;color:var(--verde)">${fmt(s.capitalActual)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;padding-top:6px;">
        <span style="color:var(--texto-sec)">+ Valor en stock (${numCO(s.stockBloques)} bloques × ${fmt(s.precioBloqueActual)}):</span>
        <strong style="color:var(--naranja)">${fmt(s.valorStockBloques)}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;border-top:1px solid var(--gris-brd);padding-top:10px;">
        <span style="font-weight:700;">Patrimonio Total (efectivo + material):</span>
        <strong style="font-size:18px;color:var(--azul)">${fmt(s.patrimonioTotal)}</strong>
      </div>
      <p style="font-size:11px;color:var(--texto-sec);margin-top:4px;">
        El "Capital Actual" es lo que tienes disponible en efectivo. El "Valor en stock" es dinero que ya está convertido en bloques sin vender — no lo repartas como si fuera efectivo. Súbelo/bájalo cambiando el "Precio de venta por bloque" en Configuración.
      </p>
    </div>`;
}

function cargarConfigUI() {
  if (DATA.config.precioBloque) {
    document.getElementById("configPrecioBloque").value = DATA.config.precioBloque;
  }
}

window.guardarCapital = async function() {
  const fecha = document.getElementById("capitalFecha").value;
  const monto = parseCOP("capitalInicial");
  const nota  = document.getElementById("capitalNota").value.trim();
  if (!fecha || !monto) { alert("⚠️ Ingrese fecha y monto"); return; }
  await addDoc(collection(db,"Capital"), { fecha, monto, nota, creadoEn: new Date().toISOString() });
  document.getElementById("capitalInicial").value = "";
  document.getElementById("capitalNota").value    = "";
  await cargarTodo();
  alert("✅ Capital registrado: " + fmt(monto));
};

window.guardarConfig = async function() {
  const precio = parseCOP("configPrecioBloque")||0;
  await setDoc(doc(db,"Config","general"), { precioBloque: precio }, { merge: true });
  DATA.config.precioBloque = precio;
  renderResumen();
  renderStock();
  alert("✅ Configuración guardada");
};

// ═══ DISTRIBUCIÓN ═════════════════════════════════════════════
function renderDistribuciones() {
  const tbody = document.getElementById("tablaDistribuciones");
  tbody.innerHTML = DATA.distribuciones.length ? DATA.distribuciones.map(d => `
    <tr>
      <td>${d.fecha}</td>
      <td><span class="badge badge-amarillo">${d.periodo}</span></td>
      <td class="neg">${fmt(d.monto)}</td>
      <td>${d.nota||"—"}</td>
      <td><button class="btn-del" onclick="eliminar('Distribuciones','${d.id}')">🗑</button></td>
    </tr>`).join("") : `<tr><td colspan="5" class="empty-state"><p>Sin distribuciones</p></td></tr>`;
}

window.calcularDistribucion = function() {
  const desde = document.getElementById("distDesde").value;
  const hasta = document.getElementById("distHasta").value;
  if (!desde || !hasta) { alert("⚠️ Seleccione el rango de fechas"); return; }

  const filtrar = (arr, campo) => arr.filter(x => x.fecha >= desde && x.fecha <= hasta);

  const ingBloques = filtrar(DATA.ventas).reduce((s,v)=>s+(v.total||0),0);
  const ingArena   = filtrar(DATA.ventasArena).reduce((s,v)=>s+(v.valor||0),0);
  const egCompras  = filtrar(DATA.compras).reduce((s,c)=>s+(c.valor||0),0);
  const egArena    = filtrar(DATA.comprasArena).reduce((s,c)=>s+(c.valor||0),0);
  const egPagos    = filtrar(DATA.pagos).reduce((s,p)=>s+(p.monto||0),0);
  const totalIng   = ingBloques + ingArena;
  const totalEg    = egCompras + egArena + egPagos;
  const ganancia   = totalIng - totalEg;

  document.getElementById("distIngresos").textContent = fmt(totalIng);
  document.getElementById("distEgresos").textContent  = fmt(totalEg);
  const gEl = document.getElementById("distGanancia");
  gEl.textContent = fmt(ganancia);
  gEl.className   = ganancia >= 0 ? "pos" : "neg";
  document.getElementById("distMonto").value = ganancia > 0 ? ganancia : 0;
  document.getElementById("distResultado").style.display = "block";

  // Aviso: cuánto del "patrimonio" está guardado en bloques sin vender (no es efectivo)
  const s = calcStats();
  const elAviso = document.getElementById("distAvisoStock");
  if (elAviso) {
    elAviso.innerHTML = s.valorStockBloques > 0 ? `
      ⚠️ Tienes <strong>${numCO(s.stockBloques)} bloques</strong> sin vender, que representan
      <strong>${fmt(s.valorStockBloques)}</strong> en material (a ${fmt(s.precioBloqueActual)}/bloque).
      Ese valor <u>no es efectivo disponible</u> — verifica que el capital en caja alcance antes de confirmar el reparto.
    ` : `Configura el "Precio de venta por bloque" en Capital para ver cuánto vale tu stock actual.`;
  }
};

window.confirmarDistribucion = async function() {
  const desde  = document.getElementById("distDesde").value;
  const hasta  = document.getElementById("distHasta").value;
  const periodo= document.getElementById("distPeriodo").value;
  const monto  = parseCOP("distMonto");
  const nota   = document.getElementById("distNota").value.trim();
  if (!monto || monto <= 0) { alert("⚠️ Ingrese un monto válido"); return; }
  if (!confirm(`¿Confirmar distribución de ${fmt(monto)}?`)) return;

  await addDoc(collection(db,"Distribuciones"), {
    fecha: hoy(), desde, hasta, periodo, monto, nota,
    creadoEn: new Date().toISOString()
  });
  document.getElementById("distResultado").style.display = "none";
  document.getElementById("distMonto").value = "";
  document.getElementById("distNota").value  = "";
  await cargarTodo();
  alert("✅ Distribución registrada: " + fmt(monto));
};

// ═══ INFORMES ══════════════════════════════════════════════════
window.generarInforme = function() {
  const desde = document.getElementById("informeDesde").value;
  const hasta = document.getElementById("informeHasta").value;
  if (!desde || !hasta) { alert("⚠️ Seleccione el rango"); return; }

  const filtrar = arr => arr.filter(x => x.fecha >= desde && x.fecha <= hasta);

  const ventas   = filtrar(DATA.ventas);
  const ventArena= filtrar(DATA.ventasArena);
  const compras  = filtrar(DATA.compras);
  const compArena= filtrar(DATA.comprasArena);
  const pagos    = filtrar(DATA.pagos);

  const ingBloques = ventas.reduce((s,v)=>s+(v.total||0),0);
  const ingArena   = ventArena.reduce((s,v)=>s+(v.valor||0),0);
  const egCompras  = compras.reduce((s,c)=>s+(c.valor||0),0) + compArena.reduce((s,c)=>s+(c.valor||0),0);
  const egPagos    = pagos.reduce((s,p)=>s+(p.monto||0),0);
  const ganancia   = ingBloques + ingArena - egCompras - egPagos;

  document.getElementById("infIngBloques").textContent = fmt(ingBloques);
  document.getElementById("infIngArena").textContent   = fmt(ingArena);
  document.getElementById("infCompras").textContent    = fmt(egCompras);
  document.getElementById("infPagos").textContent      = fmt(egPagos);
  const gEl = document.getElementById("infGanancia");
  gEl.textContent = fmt(ganancia);
  gEl.className   = ganancia >= 0 ? "pos" : "neg";

  document.getElementById("infTablaVentas").innerHTML = ventas.length
    ? ventas.map(v=>`<tr><td>${v.fecha}</td><td>${v.cliente||"—"}</td><td>${numCO(v.cantidad)}</td><td class="pos">${fmt(v.total)}</td></tr>`).join("")
    : `<tr><td colspan="4" class="empty-state"><p>Sin ventas</p></td></tr>`;

  document.getElementById("infTablaCompras").innerHTML = compras.length
    ? compras.map(c=>`<tr><td>${c.fecha}</td><td>${c.material}</td><td class="neg">${fmt(c.valor)}</td></tr>`).join("")
    : `<tr><td colspan="3" class="empty-state"><p>Sin compras</p></td></tr>`;

  document.getElementById("informeResultado").style.display = "block";
  document.getElementById("informeVacio").style.display     = "none";
};

// ═══ ELIMINAR GENÉRICO ════════════════════════════════════════
window.eliminar = async function(colName, id) {
  if (!confirm("¿Eliminar este registro?")) return;
  await deleteDoc(doc(db, colName, id));
  await cargarTodo();
};