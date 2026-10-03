const soles = value => `S/ ${Number(value || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function verDashboard(){
  document.getElementById("contenido").innerHTML = `<div class="module-header"><div><p class="eyebrow">Resumen operativo</p><h2>Dashboard</h2><p>Indicadores calculados con registros existentes.</p></div><button type="button" onclick="cargarDashboard()">Actualizar</button></div>
    <div id="dashboardStatus" role="status" class="empty-state">Cargando datos...</div><div id="dashboardCards" class="summary-grid"></div>
    <div class="panel"><h3>Pedidos de hoy</h3><div id="dashboardEstados" class="summary-grid"></div></div>
    <div class="panel"><h3>Productos más vendidos hoy</h3><div id="topProductos" class="table-scroll"></div></div>
    <div class="panel"><h3>Alertas de stock</h3><div id="dashboardStock"></div></div>`;
  cargarDashboard();
}

async function cargarDashboard(){
  const status = document.getElementById("dashboardStatus");
  if(!status) return;
  status.textContent = "Cargando datos...";
  try {
    const res = await fetch("/dashboard", { headers:{ Authorization:token } });
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || "No se pudo cargar el dashboard");
    const cards = [
      ["Ventas hoy cobradas", soles(data.dia.ventas), `${data.dia.pedidos} pedidos registrados`],
      ["Ventas de la semana cobradas", soles(data.semana.ventas), `${data.semana.pedidos} pedidos registrados`],
      ["Ventas del mes cobradas", soles(data.mes.ventas), `${data.mes.pedidos} pedidos registrados`],
      ["Gastos del mes", soles(data.gastosMes), "Según gastos registrados"],
      ["Pendientes de pago hoy", data.dia.pendientesPago, "Pedidos no cancelados"],
      ["Promedio cobrado hoy", data.dia.pedidos ? soles(data.dia.ventas / data.dia.pedidos) : "—", "Por pedido registrado"]
    ];
    const cardBox = document.getElementById("dashboardCards");
    cardBox.replaceChildren(...cards.map(([label, value, detail]) => { const article = document.createElement("article"); article.className = "summary-card"; const title = document.createElement("span"); title.textContent = label; const amount = document.createElement("strong"); amount.textContent = value; const note = document.createElement("small"); note.textContent = detail; article.append(title, amount, note); return article; }));
    const estados = document.getElementById("dashboardEstados");
    const estadoLabels = { en_espera:"En espera", preparando:"Preparando", listo:"Listos", entregado:"Entregados", cancelado:"Cancelados" };
    const estadoEntries = Object.entries(data.estados || {});
    estados.replaceChildren(...(estadoEntries.length ? estadoEntries : [["sin_datos", 0]]).map(([estado, cantidad]) => { const item = document.createElement("article"); item.className = "summary-card"; const label = document.createElement("span"); label.textContent = estadoLabels[estado] || estado; const value = document.createElement("strong"); value.textContent = cantidad; item.append(label, value); return item; }));
    const top = document.getElementById("topProductos");
    if(!data.topProductos?.length) top.innerHTML = "<p class='empty-state'>Aún no hay ventas de productos entregados hoy.</p>";
    else { const table = document.createElement("table"); table.className = "data-table"; table.innerHTML = "<thead><tr><th>Producto</th><th class='numeric'>Unidades</th></tr></thead>"; const body = document.createElement("tbody"); data.topProductos.forEach(([nombre, cantidad]) => { const row = document.createElement("tr"); const nameCell = document.createElement("td"); nameCell.textContent = nombre; const countCell = document.createElement("td"); countCell.className = "numeric"; countCell.textContent = cantidad; row.append(nameCell, countCell); body.appendChild(row); }); table.appendChild(body); top.replaceChildren(table); }
    const stock = document.getElementById("dashboardStock");
    const alertas = [...(data.agotados || []).map(p => ({ ...p, estado:"Agotado" })), ...(data.bajoStock || []).map(p => ({ ...p, estado:"Stock bajo" }))];
    if(!alertas.length) stock.innerHTML = "<p class='empty-state'>No hay alertas de stock.</p>";
    else { const table = document.createElement("table"); table.className = "data-table"; table.innerHTML = "<thead><tr><th>Producto</th><th>Estado</th><th class='numeric'>Existencias</th></tr></thead>"; const body = document.createElement("tbody"); alertas.forEach(p => { const row = document.createElement("tr"); [p.nombre, p.estado, p.stock].forEach((value, index) => { const cell = document.createElement("td"); cell.textContent = value; if(index === 2) cell.className = "numeric"; row.appendChild(cell); }); body.appendChild(row); }); table.appendChild(body); stock.replaceChildren(table); }
    status.textContent = "Actualizado con datos disponibles.";
  } catch(error) { status.textContent = error.message; }
}

function verInformes(){
  document.getElementById("contenido").innerHTML = `<div class="module-header"><div><p class="eyebrow">Administración</p><h2>Informes</h2><p>Consulta pedidos registrados en un periodo.</p></div></div><section class="panel"><div class="filter-row"><label>Desde<input type="date" id="desde"></label><label>Hasta<input type="date" id="hasta"></label><button class="primary-button" type="button" onclick="generarReporte()">Generar informe</button></div><div id="resultadoReporte" aria-live="polite"></div></section>`;
}

async function generarReporte(){
  const desde = document.getElementById("desde").value, hasta = document.getElementById("hasta").value;
  if(Boolean(desde) !== Boolean(hasta) || desde && desde > hasta){ alert("Selecciona un rango de fechas válido."); return; }
  const params = desde ? `?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}` : "";
  const res = await fetch(`/reporte${params}`, { headers:{ Authorization:token } });
  const data = await res.json(), cont = document.getElementById("resultadoReporte");
  if(!cont) return;
  cont.replaceChildren();
  if(!res.ok){ cont.textContent = data.error || "No se pudo generar el informe."; return; }
  const resumen = document.createElement("p"); resumen.textContent = `Cobrado: ${soles(data.total)} · Pedidos: ${data.cantidad}`; cont.appendChild(resumen);
  const exportar = document.createElement("button"); exportar.type="button"; exportar.textContent="Exportar CSV"; exportar.addEventListener("click",()=>exportarReporteCSV(data.pedidos||[])); cont.appendChild(exportar);
  const table = document.createElement("table"); table.className = "data-table"; table.innerHTML = "<thead><tr><th>Fecha</th><th>Mesa</th><th>Estado</th><th>Pago</th><th class='numeric'>Total</th></tr></thead>";
  const body = document.createElement("tbody");
  (data.pedidos || []).forEach(p => { const row = document.createElement("tr"); const pago = Number(p.totalPagado) || (p.pagado ? Number(p.total) || 0 : 0); [new Date(p.fecha).toLocaleString("es-PE"), p.mesa, p.estado, pago >= p.total ? "Pagado" : pago > 0 ? "Parcial" : "Pendiente", soles(pago)].forEach((value, index) => { const cell = document.createElement("td"); cell.textContent = value; if(index === 4) cell.className = "numeric"; row.appendChild(cell); }); body.appendChild(row); });
  table.appendChild(body); cont.appendChild(table);
}

async function verActividad(){
  document.getElementById("contenido").innerHTML = `<div class="module-header"><div><p class="eyebrow">Seguridad</p><h2>Actividad del sistema</h2><p>Acciones registradas recientemente.</p></div></div><section class="panel"><div id="listaActividad" class="empty-state">Cargando actividad...</div></section>`;
  const res = await fetch("/actividad", { headers:{ Authorization:token } });
  const data = await res.json(), cont = document.getElementById("listaActividad");
  if(!cont) return;
  cont.replaceChildren();
  if(!res.ok){ cont.textContent = data.error || "No se pudo cargar la actividad."; return; }
  if(!data.length){ cont.textContent = "No hay actividad registrada."; return; }
  const table = document.createElement("table"); table.className = "data-table"; table.innerHTML = "<thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead>"; const body = document.createElement("tbody");
  data.forEach(a => { const row = document.createElement("tr"); [new Date(a.fecha).toLocaleString("es-PE"), a.usuario, a.accion, a.detalle].forEach(value => { const cell = document.createElement("td"); cell.textContent = value || "—"; row.appendChild(cell); }); body.appendChild(row); }); table.appendChild(body); cont.replaceChildren(table);
}

async function cargarInformes(){
  const res = await fetch("/pedidos?estado=entregado", { headers:{ Authorization:token } });
  const data = await res.json();
  const cont = document.getElementById("listaInf");
  if(!cont) return;
  cont.replaceChildren();
  if(!res.ok || !data.length){ cont.textContent = "No hay pedidos entregados."; return; }
  data.forEach(p => { const fila = document.createElement("div"); fila.textContent = `Mesa ${p.mesa} · ${soles(p.total)} · ${new Date(p.fecha).toLocaleString("es-PE")}`; cont.appendChild(fila); });
}

Object.assign(window, { verDashboard, cargarDashboard, verInformes, generarReporte, verActividad, cargarInformes });

window.verSedes = async function(){
  const cont=document.getElementById("contenido");cont.innerHTML=`<div class="module-header"><div><p class="eyebrow">Configuración global</p><h2>Sedes</h2><p>Administra el directorio de sedes. Los registros históricos aún no se asignan automáticamente.</p></div></div><section class="panel"><form id="sedeForm" class="responsive-form"><label class="field">Nombre<input name="nombre" maxlength="120" required></label><label class="field">Dirección<input name="direccion" maxlength="200"></label><div class="form-actions"><button class="primary-button" type="submit">Crear sede</button><span id="sedeStatus" role="status"></span></div></form></section><section class="panel"><div id="listaSedes"></div></section>`;
  document.getElementById("sedeForm").addEventListener("submit", async e=>{e.preventDefault();const fields=Object.fromEntries(new FormData(e.currentTarget));const res=await fetch("/sedes",{method:"POST",headers:{"Content-Type":"application/json",Authorization:token},body:JSON.stringify(fields)}),data=await res.json();document.getElementById("sedeStatus").textContent=res.ok?"Sede creada.":data.error||"No se pudo guardar";if(res.ok){e.currentTarget.reset();cargarSedes();}});cargarSedes();
};
async function cargarSedes(){const res=await fetch("/sedes",{headers:{Authorization:token}}),data=await res.json(),cont=document.getElementById("listaSedes");if(!cont)return;if(!res.ok)return cont.textContent=data.error||"No se pudieron cargar sedes";if(!data.length)return cont.innerHTML="<p class='empty-state'>No hay sedes configuradas.</p>";const table=document.createElement("table");table.className="data-table";table.innerHTML="<thead><tr><th>Sede</th><th>Dirección</th><th>Estado</th><th>Acciones</th></tr></thead>";const body=document.createElement("tbody");data.forEach(s=>{const tr=document.createElement("tr");[s.nombre,s.direccion||"—",s.activa===false?"Inactiva":"Activa"].forEach(v=>{const td=document.createElement("td");td.textContent=v;tr.appendChild(td);});const td=document.createElement("td"),btn=document.createElement("button");btn.textContent="Editar";btn.onclick=async()=>{const nombre=prompt("Nombre de la sede",s.nombre);if(nombre===null)return;const direccion=prompt("Dirección",s.direccion||"");if(direccion===null)return;const activa=confirm("Aceptar para dejar activa; cancelar para desactivar");const out=await fetch(`/sedes/${s._id}`,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:token},body:JSON.stringify({nombre,direccion,activa})}),result=await out.json();if(!out.ok)alert(result.error||"No se pudo actualizar");cargarSedes();};td.appendChild(btn);tr.appendChild(td);body.appendChild(tr);});table.appendChild(body);cont.replaceChildren(table);}

window.verConfiguracion = async function(){
  const cont=document.getElementById("contenido");cont.innerHTML=`<div class="module-header"><div><p class="eyebrow">Configuración</p><h2>Configuración general</h2><p>Identidad y datos básicos del negocio.</p></div></div><section class="panel"><form id="configForm" class="responsive-form"><label class="field">Nombre comercial<input name="nombreComercial" maxlength="200" required></label><label class="field">Nombre legal<input name="nombreLegal" maxlength="200"></label><label class="field">Contacto<input name="contacto" maxlength="200"></label><label class="field">Dirección<input name="direccion" maxlength="200"></label><label class="field">Horario de atención<input name="horario" maxlength="200"></label><label class="field">URL del logo<input name="logoUrl" maxlength="1000" type="url" placeholder="https://..."></label><div class="field-wide form-actions"><button class="primary-button" type="submit">Guardar configuración</button><span id="configStatus" role="status"></span></div><div class="field-wide"><img id="logoPreview" alt="Vista previa del logotipo" hidden style="max-width:180px;max-height:90px"></div></form></section>`;
  const form=document.getElementById("configForm"),res=await fetch("/configuracion",{headers:{Authorization:token}}),data=await res.json();if(res.ok)Object.entries(data).forEach(([k,v])=>{if(form.elements[k])form.elements[k].value=v||"";});const preview=form.elements.logoUrl;preview.addEventListener("input",()=>{const img=document.getElementById("logoPreview");img.src=preview.value;img.hidden=!preview.value;});if(preview.value){document.getElementById("logoPreview").src=preview.value;document.getElementById("logoPreview").hidden=false;}
  form.addEventListener("submit",async e=>{e.preventDefault();const fields=Object.fromEntries(new FormData(form));const out=await fetch("/configuracion",{method:"PUT",headers:{"Content-Type":"application/json",Authorization:token},body:JSON.stringify(fields)}),result=await out.json();document.getElementById("configStatus").textContent=out.ok?"Configuración guardada.":result.error||"No se pudo guardar";});
};

window.verReinicio = function(){
  document.getElementById("contenido").innerHTML=`<div class="module-header"><div><p class="eyebrow">Solo administrador principal</p><h2>Reinicio del sistema</h2><p>La limpieza se mantiene bloqueada hasta tener una copia de seguridad externa verificable.</p></div></div><section class="panel"><div class="notice-card"><strong>Reinicio deshabilitado</strong><span>La aplicación no tiene configurado un almacenamiento de respaldos que pueda verificar. No se borrarán datos.</span></div><form id="reinicioPreviewForm" class="responsive-form"><label class="field field-wide">Contraseña actual<input name="password" type="password" autocomplete="current-password" required></label><div class="field-wide form-actions"><button type="submit">Consultar alcance y conteos</button><span id="reinicioStatus" role="status"></span></div></form><div id="reinicioConteos"></div></section>`;
  document.getElementById("reinicioPreviewForm").addEventListener("submit",async e=>{e.preventDefault();const out=await fetch("/reinicio/preview",{method:"POST",headers:{"Content-Type":"application/json",Authorization:token},body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))}),data=await out.json();document.getElementById("reinicioStatus").textContent=data.bloqueado||data.error||"Vista previa disponible";if(data.colecciones)document.getElementById("reinicioConteos").innerHTML=data.colecciones.map(x=>`<p>${escapeHtml(x.nombre)}: ${x.registros} registros</p>`).join("");});
};

window.exportarReporteCSV = function(pedidos){
  const headers=["fecha","mesa","estado","total","total_pagado","metodos"];
  const escape=value=>`"${String(value??"").replaceAll('"','""')}"`;
  const rows=pedidos.map(p=>[new Date(p.fecha).toISOString(),p.mesa,p.estado,p.total,p.totalPagado||0,[...new Set((p.pagos||[]).map(x=>x.metodo))].join("/")]);
  const csv=[headers,...rows].map(row=>row.map(escape).join(",")).join("\r\n");
  const blob=new Blob(["\ufeff",csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`informe-pedidos-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
};
