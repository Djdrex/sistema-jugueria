function verHistorialFinanciero(){
  document.getElementById("contenido").innerHTML = `
    <div class="module-header"><div><p class="eyebrow">ADMINISTRACIÓN</p><h2>Historial financiero</h2><p>Consolida recibos, pagos Yape, gastos y compras de fechas anteriores, de hoy o futuras. Solo administración puede consultar y descargar los archivos.</p></div></div>
    <section class="panel"><h3>Registrar movimiento</h3><form id="historialForm" class="responsive-form">
      <label class="field">Tipo<select name="tipo" required><option value="yape">Pago Yape</option><option value="recibo">Recibo</option><option value="gasto">Gasto</option><option value="compra">Compra</option><option value="pago">Otro pago</option><option value="boleta">Boleta</option><option value="factura">Factura</option><option value="servicio">Servicio</option><option value="otro">Otro</option></select></label>
      <label class="field">Fecha del movimiento<input type="date" name="fecha" id="historialFecha" required></label>
      <label class="field">Monto (S/)<input type="number" name="monto" min="0" step="0.01" placeholder="Opcional"></label>
      <label class="field">Método<select name="metodoPago"><option value="yape">Yape</option><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="otro">Otro</option></select></label>
      <label class="field">Categoría<input name="categoria" maxlength="80" placeholder="Ej. alquiler, insumos"></label>
      <label class="field">Proveedor o persona<input name="proveedor" maxlength="160"></label>
      <label class="field">Serie (opcional)<input name="serie" maxlength="40"></label><label class="field">Número (opcional)<input name="numero" maxlength="60"></label>
      <label class="field field-wide">Concepto<input name="concepto" maxlength="300" required placeholder="Descripción del movimiento"></label>
      <label class="field field-wide">Observaciones<textarea name="observaciones" rows="2" maxlength="1000"></textarea></label>
      <label class="field field-wide">Adjuntar imagen, PDF, Word o Excel (máx. 8 MB)<input id="historialArchivo" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.xls,.xlsx"></label>
      <div class="field-wide form-actions"><button class="primary-button" id="guardarHistorial" type="submit">Guardar movimiento</button><span id="historialStatus" role="status" aria-live="polite"></span></div>
    </form></section>
    <section class="panel"><div class="section-heading"><div><h3>Registros</h3><p>Consulta movimientos financieros y sus documentos adjuntos.</p></div><div class="filter-row"><label>Desde<input id="historialDesde" type="date"></label><label>Hasta<input id="historialHasta" type="date"></label><label>Tipo<select id="historialTipo"><option value="">Todos</option>${[["yape","Pagos Yape"],["recibo","Recibos"],["gasto","Gastos"],["compra","Compras"],["pago","Pagos"],["boleta","Boletas"],["factura","Facturas"],["servicio","Servicios"],["otro","Otros"]].map(([v,n])=>`<option value="${v}">${n}</option>`).join("")}</select></label><button id="filtrarHistorial" type="button">Filtrar</button></div></div>
    <div class="table-scroll"><table class="data-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Categoría</th><th>Proveedor</th><th>Método</th><th class="numeric">Monto</th><th>Documento</th><th>Registrado por</th></tr></thead><tbody id="listaHistorial"></tbody></table></div><p id="historialVacio" class="empty-state" hidden>No hay registros para el filtro seleccionado.</p></section>`;
  document.getElementById("historialFecha").value = fechaHoyLima();
  document.getElementById("historialForm").addEventListener("submit", guardarMovimientoHistorial);
  document.getElementById("filtrarHistorial").addEventListener("click", cargarHistorialFinanciero);
  cargarHistorialFinanciero();
}

async function guardarMovimientoHistorial(event){
  event.preventDefault();
  const form = event.currentTarget, status = document.getElementById("historialStatus"), button = document.getElementById("guardarHistorial");
  const archivo = document.getElementById("historialArchivo").files[0];
  if(archivo && archivo.size > 8*1024*1024){ status.textContent = "El archivo supera 8 MB."; return; }
  const data = Object.fromEntries(new FormData(form));
  button.disabled = true; status.textContent = "Guardando…";
  try {
    const res = await fetch("/historial-financiero", {method:"POST", headers:{Authorization:token,"Content-Type":"application/json"}, body:JSON.stringify(data)}), result = await res.json();
    if(!res.ok) throw new Error(result.error || "No se pudo guardar el movimiento");
    if(archivo){
      const contenido = await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("No se pudo leer el archivo"));reader.readAsDataURL(archivo);});
      const upload = await fetch(`/historial-financiero/${result._id}/archivo`, {method:"POST",headers:{Authorization:token,"Content-Type":"application/json"},body:JSON.stringify({nombre:archivo.name,tipoMime:archivo.type,contenido})}), uploaded = await upload.json();
      if(!upload.ok) throw new Error(uploaded.error || "El movimiento se guardó, pero falló el archivo");
    }
    form.reset(); document.getElementById("historialFecha").value = fechaHoyLima(); status.textContent = "Movimiento guardado."; await cargarHistorialFinanciero();
  } catch(error){ status.textContent = error.message; }
  finally { button.disabled = false; }
}

async function cargarHistorialFinanciero(){
  const tbody = document.getElementById("listaHistorial"), status = document.getElementById("historialStatus"), params = new URLSearchParams();
  const desde = document.getElementById("historialDesde").value, hasta = document.getElementById("historialHasta").value, tipo = document.getElementById("historialTipo").value;
  if(desde) params.set("desde",desde); if(hasta) params.set("hasta",hasta); if(tipo) params.set("tipo",tipo);
  tbody.replaceChildren();
  try {
    const res = await fetch(`/historial-financiero?${params}`,{headers:{Authorization:token}}), rows = await res.json();
    if(!res.ok || !Array.isArray(rows)) throw new Error(rows.error || "No se pudo cargar el historial");
    rows.forEach(item=>{
      const tr=document.createElement("tr"), values=[new Date(item.fecha).toLocaleDateString("es-PE",{timeZone:"America/Lima"}),item.tipo,item.concepto,item.categoria||"—",item.proveedor||"—",item.metodoPago||"—",item.monto==null?"—":`S/ ${Number(item.monto).toFixed(2)}`];
      values.forEach((value,i)=>{const td=document.createElement("td");td.textContent=value;if(i===6)td.className="numeric";tr.appendChild(td);});
      const archivo=document.createElement("td");
      if(item.archivo?.nombre){const a=document.createElement("a");a.href=`/historial-financiero/${item._id}/archivo`;a.textContent=item.archivo.nombre;a.target="_blank";a.rel="noopener";a.addEventListener("click",async event=>{event.preventDefault();try{const response=await fetch(a.href,{headers:{Authorization:token}});if(!response.ok)throw new Error("No se pudo descargar el documento");const blob=await response.blob(), url=URL.createObjectURL(blob), link=document.createElement("a");link.href=url;link.download=item.archivo.nombre;link.click();URL.revokeObjectURL(url);}catch(error){status.textContent=error.message;}});archivo.appendChild(a);}else archivo.textContent="—";
      tr.append(archivo);const registrado=document.createElement("td");registrado.textContent=item.registradoPor||"—";tr.append(registrado);tbody.append(tr);
    });
    document.getElementById("historialVacio").hidden=rows.length>0; status.textContent="";
  } catch(error){ status.textContent=error.message; document.getElementById("historialVacio").hidden=true; }
}

window.verHistorialFinanciero=verHistorialFinanciero;
