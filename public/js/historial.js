function verHistorialFinanciero(){
  const contenido = document.getElementById("contenido");
  contenido.innerHTML = `
    <div class="module-header"><div><p class="eyebrow">ADMINISTRACIÓN</p><h2>Historial financiero</h2><p>Registra ingresos y egresos pasados, actuales o futuros. Adjunta Yapes, recibos y comprobantes. Este apartado solo está disponible para administración.</p></div></div>
    <section class="panel"><h3>Subir ingreso o egreso</h3><p>Indica el tipo, la fecha del movimiento y adjunta el comprobante que quieras conservar.</p>
      <form id="historialForm" class="responsive-form">
        <label class="field">Movimiento<select id="historialClase" required><option value="ingreso">Ingreso</option><option value="egreso">Egreso</option></select></label>
        <label class="field">Tipo<select name="tipo" id="historialTipoRegistro" required></select></label>
        <label class="field">Fecha del movimiento<input name="fecha" id="historialFecha" type="date" required></label>
        <label class="field">Monto (S/)<input name="monto" type="number" min="0" step="0.01" placeholder="Opcional"></label>
        <label class="field">Método de pago<select name="metodoPago" id="historialMetodo"><option value="yape">Yape</option><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="otro">Otro</option></select></label>
        <label class="field">Categoría<input name="categoria" maxlength="80" placeholder="Ej. alquiler, insumos"></label>
        <label class="field">Proveedor o persona<input name="proveedor" maxlength="160"></label>
        <label class="field">Serie (opcional)<input name="serie" maxlength="40"></label>
        <label class="field">Número (opcional)<input name="numero" maxlength="60"></label>
        <label class="field field-wide">Concepto<input name="concepto" maxlength="300" required placeholder="Ej. Yape recibido, pago de alquiler"></label>
        <label class="field field-wide">Observaciones<textarea name="observaciones" rows="2" maxlength="1000"></textarea></label>
        <label class="field field-wide">Comprobante: imagen, PDF, Word o Excel (máx. 8 MB)<input id="historialArchivo" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.xls,.xlsx"><small id="historialArchivoSeleccionado">No hay archivo seleccionado.</small></label>
        <div class="field-wide form-actions"><button class="primary-button" id="guardarHistorial" type="submit">Subir al historial</button><span id="historialStatus" role="status" aria-live="polite"></span></div>
      </form>
    </section>
    <section class="panel"><div class="section-heading"><div><h3>Historial de ingresos y egresos</h3><p>Registros y comprobantes guardados.</p></div><div class="filter-row"><label>Desde<input id="historialDesde" type="date"></label><label>Hasta<input id="historialHasta" type="date"></label><label>Tipo<select id="historialFiltroTipo"><option value="">Todos</option>${[["yape","Pagos Yape"],["recibo","Recibos"],["gasto","Gastos"],["compra","Compras"],["pago","Pagos"],["boleta","Boletas"],["factura","Facturas"],["servicio","Servicios"],["otro","Otros"]].map(([v,n])=>`<option value="${v}">${n}</option>`).join("")}</select></label><button id="filtrarHistorial" type="button">Filtrar historial</button></div></div>
      <div class="table-scroll"><table class="data-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto</th><th>Categoría</th><th>Proveedor</th><th>Método</th><th class="numeric">Monto</th><th>Comprobante</th><th>Registrado por</th></tr></thead><tbody id="listaHistorial"></tbody></table></div><p id="historialVacio" class="empty-state" hidden>No hay registros para el filtro seleccionado.</p>
    </section>`;
  document.getElementById("historialFecha").value = fechaHoyLima();
  const clase = document.getElementById("historialClase"), tipo = document.getElementById("historialTipoRegistro");
  const actualizarTipos = () => {
    const opciones = clase.value === "ingreso" ? [["yape","Pago Yape"],["recibo","Recibo de ingreso"],["pago","Otro ingreso"],["otro","Otro ingreso"]] : [["gasto","Gasto"],["compra","Compra"],["servicio","Servicio"],["recibo","Recibo de egreso"],["pago","Otro egreso"],["otro","Otro egreso"]];
    tipo.replaceChildren(...opciones.map(([valor, etiqueta]) => new Option(etiqueta, valor)));
    document.getElementById("historialMetodo").value = clase.value === "ingreso" ? "yape" : "efectivo";
  };
  clase.addEventListener("change", actualizarTipos); actualizarTipos();
  document.getElementById("historialArchivo").addEventListener("change", event => { document.getElementById("historialArchivoSeleccionado").textContent = event.target.files[0]?.name || "No hay archivo seleccionado."; });
  document.getElementById("historialForm").addEventListener("submit", guardarMovimientoHistorial);
  document.getElementById("filtrarHistorial").addEventListener("click", cargarHistorialFinanciero);
  cargarHistorialFinanciero();
}

async function guardarMovimientoHistorial(event){
  event.preventDefault();
  const form = event.currentTarget, status = document.getElementById("historialStatus"), button = document.getElementById("guardarHistorial"), archivo = document.getElementById("historialArchivo").files[0];
  if(archivo && archivo.size > 8 * 1024 * 1024){ status.textContent = "El archivo supera 8 MB."; return; }
  const data = Object.fromEntries(new FormData(form));
  if(document.getElementById("historialClase").value === "egreso" && data.tipo === "boleta") data.tipo = "gasto";
  button.disabled = true; status.textContent = "Guardando movimiento…";
  try {
    const res = await fetch("/historial-financiero", { method:"POST", headers:{ Authorization:token, "Content-Type":"application/json" }, body:JSON.stringify(data) }), result = await res.json();
    if(!res.ok) throw new Error(result.error || "No se pudo guardar el movimiento");
    if(archivo){
      const contenido = await new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=()=>reject(new Error("No se pudo leer el archivo")); reader.readAsDataURL(archivo); });
      const upload = await fetch(`/historial-financiero/${result._id}/archivo`, { method:"POST", headers:{ Authorization:token, "Content-Type":"application/json" }, body:JSON.stringify({ nombre:archivo.name, tipoMime:archivo.type, contenido }) }), uploaded = await upload.json();
      if(!upload.ok) throw new Error(uploaded.error || "El movimiento se guardó, pero no se pudo adjuntar el archivo");
    }
    form.reset(); document.getElementById("historialFecha").value = fechaHoyLima(); document.getElementById("historialArchivoSeleccionado").textContent = "No hay archivo seleccionado."; claseRefrescar();
    status.textContent = archivo ? "Movimiento y comprobante guardados en el historial." : "Movimiento guardado en el historial.";
    await cargarHistorialFinanciero();
  } catch(error){ status.textContent = error.message; }
  finally { button.disabled = false; }
}
function claseRefrescar(){ document.getElementById("historialClase").dispatchEvent(new Event("change")); }

async function cargarHistorialFinanciero(){
  const tbody = document.getElementById("listaHistorial"), status = document.getElementById("historialStatus"), params = new URLSearchParams();
  const desde = document.getElementById("historialDesde").value, hasta = document.getElementById("historialHasta").value, tipo = document.getElementById("historialFiltroTipo").value;
  if(desde) params.set("desde",desde); if(hasta) params.set("hasta",hasta); if(tipo) params.set("tipo",tipo);
  tbody.replaceChildren();
  try {
    const res = await fetch(`/historial-financiero?${params}`, { headers:{ Authorization:token } }), rows = await res.json();
    if(!res.ok || !Array.isArray(rows)) throw new Error(rows.error || "No se pudo cargar el historial");
    rows.forEach(item=>{
      const tr=document.createElement("tr"), values=[new Date(item.fecha).toLocaleDateString("es-PE",{timeZone:"America/Lima"}),item.tipo,item.concepto,item.categoria||"—",item.proveedor||"—",item.metodoPago||"—",item.monto==null?"—":`S/ ${Number(item.monto).toFixed(2)}`];
      values.forEach((value,i)=>{const td=document.createElement("td");td.textContent=value;if(i===6)td.className="numeric";tr.appendChild(td);});
      const archivo=document.createElement("td");
      if(item.archivo?.nombre){const a=document.createElement("a");a.href=`/historial-financiero/${item._id}/archivo`;a.textContent=item.archivo.nombre;a.addEventListener("click",async event=>{event.preventDefault();try{const response=await fetch(a.href,{headers:{Authorization:token}});if(!response.ok)throw new Error("No se pudo descargar el comprobante");const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=item.archivo.nombre;link.click();URL.revokeObjectURL(url);}catch(error){status.textContent=error.message;}});archivo.appendChild(a);}else archivo.textContent="—";
      tr.append(archivo);const registrado=document.createElement("td");registrado.textContent=item.registradoPor||"—";tr.append(registrado);tbody.append(tr);
    });
    document.getElementById("historialVacio").hidden=rows.length>0; status.textContent="";
  } catch(error){ status.textContent=error.message; document.getElementById("historialVacio").hidden=true; }
}
window.verHistorialFinanciero = verHistorialFinanciero;