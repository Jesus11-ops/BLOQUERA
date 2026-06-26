import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

window.exportarExcel = async function() {
  const desde = document.getElementById("informeDesde")?.value;
  const hasta  = document.getElementById("informeHasta")?.value;
  if (!desde || !hasta) { alert("⚠️ Seleccione el rango de fechas en la sección Informes"); return; }

  if (!window.ExcelJS) {
    await new Promise((res,rej) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js";
      s.onload = res; s.onerror = () => rej(new Error("No se pudo cargar ExcelJS"));
      document.head.appendChild(s);
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Bloquera · Sistema de Gestión";
  wb.created = new Date();

  const fmt    = n => { const num = typeof n === "number" ? n : parseFloat(String(n||0).replace(/\./g,"").replace(/[^0-9\-]/g,""))||0; return num; };
  const fmtStr = n => "$" + Number(n||0).toLocaleString("es-CO");
  const fill   = a => ({type:"pattern",pattern:"solid",fgColor:{argb:a}});
  const hdrRow = (ws,color) => {
    ws.getRow(1).height = 20;
    ws.getRow(1).eachCell(c => {
      c.fill = fill(color);
      c.font = {bold:true,color:{argb:"FFFFFFFF"},size:10};
      c.alignment = {vertical:"middle",horizontal:"center"};
    });
  };

  // Leer colecciones
  const snapV  = await getDocs(query(collection(db,"Ventas"),  orderBy("fecha","asc")));
  const snapP  = await getDocs(query(collection(db,"Producciones"), orderBy("fecha","asc")));
  const snapCA = await getDocs(query(collection(db,"ComprasArena"), orderBy("fecha","asc")));
  const snapVA = await getDocs(query(collection(db,"VentasArena"),  orderBy("fecha","asc")));
  const snapC  = await getDocs(query(collection(db,"Compras"), orderBy("fecha","asc")));
  const snapG  = await getDocs(query(collection(db,"Pagos"),   orderBy("fecha","asc")));
  const snapDist = await getDocs(query(collection(db,"Distribuciones"), orderBy("fecha","asc")));

  const filtrar = (docs) => docs.filter(d => d.fecha >= desde && d.fecha <= hasta);

  const ventas   = filtrar(snapV.docs.map(d=>({...d.data()})));
  const prods    = filtrar(snapP.docs.map(d=>({...d.data()})));
  const compArena= filtrar(snapCA.docs.map(d=>({...d.data()})));
  const ventArena= filtrar(snapVA.docs.map(d=>({...d.data()})));
  const compras  = filtrar(snapC.docs.map(d=>({...d.data()})));
  const pagos    = filtrar(snapG.docs.map(d=>({...d.data()})));
  const distrib  = snapDist.docs.map(d=>({...d.data()}));

  const ingBloques = ventas.reduce((s,v)=>s+(v.total||0),0);
  const ingArena   = ventArena.reduce((s,v)=>s+(v.valor||0),0);
  const egCompras  = compras.reduce((s,c)=>s+(c.valor||0),0);
  const egArena    = compArena.reduce((s,c)=>s+(c.valor||0),0);
  const egPagos    = pagos.reduce((s,p)=>s+(p.monto||0),0);
  const ganancia   = ingBloques + ingArena - egCompras - egArena - egPagos;
  const totalProd  = prods.reduce((s,p)=>s+(p.cantidad||0),0);
  const totalVend  = ventas.reduce((s,v)=>s+(v.cantidad||0),0);

  // ── HOJA 1: RESUMEN EJECUTIVO ──────────────────────────────
  const wsR = wb.addWorksheet("Resumen Ejecutivo");
  wsR.columns = [{width:35},{width:22}];

  const addTit = (txt,c) => {
    const r=wsR.addRow([txt,""]);
    r.font={bold:true,size:13,color:{argb:"FFFFFFFF"}};
    r.fill=fill(c);
    wsR.mergeCells(`A${r.number}:B${r.number}`);
  };
  const addFil = (lbl,val,c) => {
    const r=wsR.addRow([lbl,val]);
    r.getCell(1).font={bold:true};
    r.getCell(2).numFmt="#,##0";
    r.getCell(2).fill=fill(c);
    r.getCell(2).font={bold:true,color:{argb:"FFFFFFFF"}};
    r.getCell(2).alignment={horizontal:"right"};
  };
  const addInfo = (lbl,val) => {
    const r=wsR.addRow([lbl,val]);
    r.getCell(1).font={bold:true};
    r.getCell(2).font={bold:true,color:{argb:"FF2980b9"}};
  };

  addTit(`RESUMEN FINANCIERO · ${desde} al ${hasta}`, "FF0f1923");
  wsR.addRow([]);
  addTit("INGRESOS","FF27ae60");
  addFil("Ventas de Bloques",   ingBloques, "FF27ae60");
  addFil("Venta de Arena",      ingArena,   "FF27ae60");
  addFil("TOTAL INGRESOS", ingBloques+ingArena, "FF1a7a45");
  wsR.addRow([]);
  addTit("EGRESOS","FFc0392b");
  addFil("Compras M.P. (Arena+Cemento)", egCompras, "FFc0392b");
  addFil("Compras Arena (para venta)",  egArena,   "FFc0392b");
  addFil("Pagos Trabajador + Fletes",   egPagos,   "FFc0392b");
  addFil("TOTAL EGRESOS", egCompras+egArena+egPagos, "FF8e1a1a");
  wsR.addRow([]);
  addFil("GANANCIA NETA DEL PERÍODO", ganancia, ganancia>=0?"FF27ae60":"FFc0392b");
  wsR.addRow([]);
  addInfo("Bloques producidos en período", totalProd);
  addInfo("Bloques vendidos en período",   totalVend);
  addInfo("Stock resultante",              totalProd - totalVend);

  // ── HOJA 2: VENTAS BLOQUES ─────────────────────────────────
  const wsV = wb.addWorksheet("Ventas Bloques");
  wsV.columns = [
    {header:"Fecha",key:"fecha",width:13},{header:"Día",key:"dia",width:12},
    {header:"Cliente",key:"cli",width:22},{header:"Cantidad",key:"cant",width:12},
    {header:"Precio/u",key:"precio",width:14},{header:"Flete",key:"flete",width:16},
    {header:"Total",key:"total",width:16},{header:"Observación",key:"obs",width:30}
  ];
  hdrRow(wsV,"FF27ae60");
  let totV=0, totFl=0;
  ventas.forEach(v=>{
    const row=wsV.addRow({fecha:v.fecha,dia:v.diaSemana||"",cli:v.cliente||"",
      cant:v.cantidad,precio:fmt(v.precio),flete:v.valorFlete?fmt(v.valorFlete):0,
      total:fmt(v.total),obs:v.obs||""});
    ["precio","flete","total"].forEach(k=>row.getCell(k).numFmt="#,##0");
    totV+=v.total||0; totFl+=v.valorFlete||0;
  });
  const trV=wsV.addRow({fecha:"",dia:"",cli:"TOTALES",cant:"",precio:"",flete:totFl,total:totV,obs:""});
  trV.eachCell((c,i)=>{c.font={bold:true};if([6,7].includes(i)){c.numFmt="#,##0";c.fill=fill("FFFFD700");}});

  // ── HOJA 3: PRODUCCIÓN ─────────────────────────────────────
  const wsPr = wb.addWorksheet("Producción");
  wsPr.columns = [
    {header:"Fecha",key:"fecha",width:13},{header:"Día",key:"dia",width:12},
    {header:"Bloques Producidos",key:"cant",width:20},{header:"Observación",key:"obs",width:35}
  ];
  hdrRow(wsPr,"FFe8621a");
  let totPr=0;
  prods.forEach(p=>{
    wsPr.addRow({fecha:p.fecha,dia:p.diaSemana||"",cant:p.cantidad||0,obs:p.obs||""});
    totPr+=p.cantidad||0;
  });
  const trPr=wsPr.addRow({fecha:"",dia:"TOTAL",cant:totPr,obs:""});
  trPr.eachCell((c,i)=>{c.font={bold:true};if(i===3)c.fill=fill("FFFFD700");});

  // ── HOJA 4: ARENA COMPRAS/VENTAS ───────────────────────────
  const wsA = wb.addWorksheet("Arena");
  wsA.columns = [
    {header:"Tipo",key:"tipo",width:14},{header:"Fecha",key:"fecha",width:13},
    {header:"Cliente/Obs",key:"ref",width:25},{header:"Valor",key:"valor",width:16}
  ];
  hdrRow(wsA,"FF2980b9");
  compArena.forEach(c=>wsA.addRow({tipo:"COMPRA VOLCO",fecha:c.fecha,ref:c.obs||"",valor:fmt(c.valor)}));
  ventArena.forEach(v=>wsA.addRow({tipo:"VENTA ARENA",fecha:v.fecha,ref:v.cliente||v.obs||"",valor:fmt(v.valor)}));
  wsA.eachRow((row,i)=>{if(i>1) row.getCell("valor").numFmt="#,##0";});
  const totCA=compArena.reduce((s,c)=>s+(c.valor||0),0);
  const totVA=ventArena.reduce((s,v)=>s+(v.valor||0),0);
  wsA.addRow([]);
  const r1=wsA.addRow({tipo:"Total invertido en volcos",fecha:"",ref:"",valor:totCA});
  r1.eachCell(c=>c.font={bold:true}); r1.getCell("valor").numFmt="#,##0"; r1.getCell("valor").fill=fill("FFfecaca");
  const r2=wsA.addRow({tipo:"Total vendido en arena",fecha:"",ref:"",valor:totVA});
  r2.eachCell(c=>c.font={bold:true}); r2.getCell("valor").numFmt="#,##0"; r2.getCell("valor").fill=fill("FFd1fae5");
  const r3=wsA.addRow({tipo:"GANANCIA ARENA",fecha:"",ref:"",valor:totVA-totCA});
  r3.eachCell(c=>c.font={bold:true}); r3.getCell("valor").numFmt="#,##0"; r3.getCell("valor").fill=fill("FFFFD700");

  // ── HOJA 5: COMPRAS M.P. ───────────────────────────────────
  const wsC = wb.addWorksheet("Compras MP");
  wsC.columns = [
    {header:"Fecha",key:"fecha",width:13},{header:"Día",key:"dia",width:12},
    {header:"Material",key:"mat",width:22},{header:"Proveedor",key:"prov",width:22},
    {header:"Cantidad/Desc",key:"cant",width:18},{header:"Valor",key:"valor",width:16},
    {header:"Observación",key:"obs",width:30}
  ];
  hdrRow(wsC,"FF8e1a1a");
  let totC=0;
  compras.forEach(c=>{
    const row=wsC.addRow({fecha:c.fecha,dia:c.diaSemana||"",mat:c.material,
      prov:c.proveedor||"",cant:c.cantidad||"",valor:fmt(c.valor),obs:c.obs||""});
    row.getCell("valor").numFmt="#,##0"; totC+=c.valor||0;
  });
  const trC=wsC.addRow({fecha:"",dia:"",mat:"TOTAL",prov:"",cant:"",valor:totC,obs:""});
  trC.eachCell((c,i)=>{c.font={bold:true};if(i===6){c.numFmt="#,##0";c.fill=fill("FFFFD700");}});

  // ── HOJA 6: PAGOS & FLETES ─────────────────────────────────
  const wsG = wb.addWorksheet("Pagos y Fletes");
  wsG.columns = [
    {header:"Fecha",key:"fecha",width:13},{header:"Día",key:"dia",width:12},
    {header:"Tipo",key:"tipo",width:22},{header:"Monto",key:"monto",width:16},
    {header:"Descripción",key:"desc",width:35}
  ];
  hdrRow(wsG,"FF6b21a8");
  let totG=0;
  pagos.forEach(p=>{
    const row=wsG.addRow({fecha:p.fecha,dia:p.diaSemana||"",tipo:p.tipo,
      monto:fmt(p.monto),desc:p.descripcion||""});
    row.getCell("monto").numFmt="#,##0"; totG+=p.monto||0;
  });
  const trG=wsG.addRow({fecha:"",dia:"",tipo:"TOTAL PAGOS",monto:totG,desc:""});
  trG.eachCell((c,i)=>{c.font={bold:true};if(i===4){c.numFmt="#,##0";c.fill=fill("FFFFD700");}});

  // ── HOJA 7: DISTRIBUCIONES ────────────────────────────────
  const wsD = wb.addWorksheet("Distribuciones");
  wsD.columns = [
    {header:"Fecha",key:"fecha",width:13},{header:"Período",key:"per",width:14},
    {header:"Desde",key:"desde",width:13},{header:"Hasta",key:"hasta",width:13},
    {header:"Monto",key:"monto",width:16},{header:"Nota",key:"nota",width:35}
  ];
  hdrRow(wsD,"FF1a5276");
  let totD=0;
  distrib.forEach(d=>{
    const row=wsD.addRow({fecha:d.fecha,per:d.periodo,desde:d.desde,hasta:d.hasta,
      monto:fmt(d.monto),nota:d.nota||""});
    row.getCell("monto").numFmt="#,##0"; totD+=d.monto||0;
  });
  const trD=wsD.addRow({fecha:"",per:"",desde:"",hasta:"TOTAL",monto:totD,nota:""});
  trD.eachCell((c,i)=>{c.font={bold:true};if(i===5){c.numFmt="#,##0";c.fill=fill("FFFFD700");}});

  // ── Descargar ────────────────────────────────────────────
  const buf  = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href=url; a.download=`bloquera_${desde}_${hasta}.xlsx`;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1500);
  alert("✅ Excel exportado con 7 hojas:\n1. Resumen Ejecutivo\n2. Ventas Bloques\n3. Producción\n4. Arena\n5. Compras M.P.\n6. Pagos & Fletes\n7. Distribuciones");
};