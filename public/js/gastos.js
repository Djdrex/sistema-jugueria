let gastoPendiente = null;

function verGastos(){
  const contenido = document.getElementById("contenido");
  contenido.innerHTML = `
    <header class="module-header">
      <div><p class="eyebrow">ADMINISTRACIÓN</p><h2>Gastos y compras</h2><p>Registro interno de egresos. Guarda cada operación con su responsable y fecha.</p></div>
      <div class="summary-card"><span>Total cargado (máx. 500)</span><strong id="gastosTotal">S/ 0.00</strong></div>
    </header>
    <section class="panel"><h3>Cuentas y servicios por pagar</h3><p>Registra obligaciones de SUNAT, alquiler, seguridad, luz, agua, gas y otros servicios, con vencimientos y estado.</p>
      <form id="cuentaServicioForm" class="responsive-form"><label class="field">Servicio o cuenta<input name="nombre" maxlength="120" required></label><label class="field">Categor�a<select name="categoria"><option value="sunat">SUNAT</option><option value="alquiler">Alquiler</option><option value="seguridad">Seguridad</option><option value="luz">Luz</option><option value="agua">Agua</option><option value="gas">Gas</option><option value="internet">Internet</option><option value="telefono">Tel�fono</option><option value="otro">Otro</option></select></label><label class="field">Monto estimado<input name="montoEstimado" type="number" min="0.01" step="0.01" required></label><label class="field">Periodicidad<select name="periodicidad"><option value="mensual">Mensual</option><option value="semanal">Semanal</option><option value="anual">Anual</option><option value="unico">�nico</option></select></label><label class="field">D�a de vencimiento<input name="diaVencimiento" type="number" min="1" max="31" value="10" required></label><label class="field">Proveedor<input name="proveedor" maxlength="160"></label><div class="field-wide form-actions"><button class="primary-button" type="submit">Agregar cuenta</button><span id="cuentaServicioStatus" role="status"></span></div></form>
      <div class="table-scroll"><table class="data-table"><thead><tr><th>Cuenta</th><th>Categor�a</th><th>Periodicidad</th><th>D�a l�mite</th><th>Estimado</th><th>Estado</th><th>Acci�n</th></tr></thead><tbody id="listaCuentasServicio"></tbody></table></div>
    </section>
    <section class="panel"><h3>Registrar comprobante o egreso</h3><p>Registra egresos pasados, actuales o futuros y adjunta vouchers.</p>
      <form id="gastoForm" class="responsive-form">
        <input type="hidden" name="cuentaId" id="cuentaIdGasto">
        <label class="field">Tipo<select name="tipo" required><option value="gasto">Gasto</option><option value="compra">Compra</option></select></label>
        <label class="field">Categoría<input name="categoria" maxlength="80" placeholder="Ej. servicios, insumos" required></label>
        <label class="field">Importe (S/)<input name="monto" type="number" min="0.01" step="0.01" inputmode="decimal" required></label>
        <label class="field">Método<select name="metodoPago"><option value="efectivo">Efectivo</option><option value="yape">Yape</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="otro">Otro</option></select></label>
        <label class="field">Fecha<input name="fecha" id="gastoFecha" type="date" required></label>
        <label class="field">Proveedor (opcional)<input name="proveedor" maxlength="160"></label>
        <label class="field field-wide">Descripción<textarea name="descripcion" rows="2" maxlength="300" required></textarea></label>
        <label class="field field-wide">Voucher (imagen, PDF, Word o Excel; m�ximo 8 MB)<input id="gastoArchivo" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx,.xls,.xlsx"></label>
        <label class="field">Cuenta relacionada<select id="gastoCuentaSelect"><option value="">Sin asociar</option></select></label>
        <div class="field-wide form-actions"><button class="primary-button" type="submit" id="guardarGasto">Guardar egreso</button><span id="gastoStatus" role="status" aria-live="polite"></span></div>
      </form>
    <section class="panel">
      <div class="section-heading"><div><h3>Historial</h3><p>Hasta 500 registros por consulta.</p></div>
        <div class="filter-row"><label>Desde <input id="gastosDesde" type="date"></label><label>Hasta <input id="gastosHasta" type="date"></label><label>Tipo <select id="gastosTipo"><option value="">Todos</option><option value="gasto">Gastos</option><option value="compra">Compras</option></select></label><button id="filtrarGastos" type="button">Filtrar</button></div>
      </div>
      <div class="table-scroll"><table class="data-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Categoría</th><th>Proveedor</th><th>Método</th><th class="numeric">Importe</th><th>Registrado por</th></tr></thead><tbody id="listaGastos"></tbody></table></div>
      <p id="gastosVacio" class="empty-state" hidden>No hay egresos para el filtro seleccionado.</p>
    </section>`;

  document.getElementById("gastoFecha").value = fechaHoyLima();
  document.getElementById("cuentaServicioForm").addEventListener("submit", guardarCuentaServicio);
  document.getElementById("gastoCuentaSelect").addEventListener("change", event => { document.getElementById("cuentaIdGasto").value = event.target.value; });
  cargarCuentasServicio();
  document.getElementById("gastoForm").addEventListener("submit", guardarGasto);
  document.getElementById("filtrarGastos").addEventListener("click", cargarGastos);
  cargarGastos();
}

function fechaHoyLima(){
  return new Intl.DateTimeFormat("en-CA", { timeZone:"America/Lima" }).format(new Date());
}

async function cargarCuentasServicio(){
  const tbody=document.getElementById("listaCuentasServicio");try{const response=await fetch("/gastos/cuentas",{headers:{Authorization:token}}),data=await response.json();if(!response.ok)throw new Error(data.error||"No se cargaron cuentas");if(!Array.isArray(data))throw new Error(data.error||"No se cargaron cuentas");
    const select=document.getElementById("gastoCuentaSelect");select.replaceChildren(new Option("Sin asociar",""));tbody.replaceChildren();data.forEach(c=>{const option=new Option(`${c.nombre} � S/ ${Number(c.montoEstimado).toFixed(2)}`,c._id);select.add(option);const tr=document.createElement("tr");[c.nombre,c.categoria,c.periodicidad,c.diaVencimiento,`S/ ${Number(c.montoEstimado).toFixed(2)}`,c.activa===false?"Inactiva":c.ultimoPago?`Pagado ${new Date(c.ultimoPago).toLocaleDateString("es-PE",{timeZone:"America/Lima"})}`:"Pendiente"].forEach(v=>{const td=document.createElement("td");td.textContent=v;tr.appendChild(td);});const td=document.createElement("td"),button=document.createElement("button");button.textContent=c.activa===false?"Activar":"Desactivar";button.onclick=()=>actualizarCuentaServicio(c._id,c.activa===false);td.append(button);tr.append(td);tbody.append(tr);});
  }catch(error){document.getElementById("cuentaServicioStatus").textContent=error.message;}}

async function guardarCuentaServicio(event){event.preventDefault();const form=event.currentTarget,status=document.getElementById("cuentaServicioStatus"),data=Object.fromEntries(new FormData(form));data.montoEstimado=Number(data.montoEstimado);data.diaVencimiento=Number(data.diaVencimiento);const res=await fetch("/gastos/cuentas",{method:"POST",headers:{Authorization:token,"Content-Type":"application/json"},body:JSON.stringify(data)}),result=await res.json();status.textContent=res.ok?"Cuenta agregada.":result.error||"No se pudo agregar";if(res.ok){form.reset();await cargarCuentasServicio();}}

async function actualizarCuentaServicio(id,activa){const res=await fetch(`/gastos/cuentas/${id}`,{method:"PUT",headers:{Authorization:token,"Content-Type":"application/json"},body:JSON.stringify({activa})});if(!res.ok){const data=await res.json();alert(data.error||"No se pudo actualizar");}await cargarCuentasServicio();}



async function subirArchivoGasto(id,file){if(!file)return;if(file.size>8*1024*1024)throw new Error("El archivo supera 8 MB.");const contenido=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("No se pudo leer el voucher"));reader.readAsDataURL(file);});const response=await fetch(`/historial-financiero/${id}/archivo`,{method:"POST",headers:{Authorization:token,"Content-Type":"application/json"},body:JSON.stringify({nombre:file.name,tipoMime:file.type,contenido})}),result=await response.json();if(!response.ok)throw new Error(result.error||"No se pudo guardar el voucher");}
async function guardarGasto(event){
  const file=document.getElementById("gastoArchivo").files[0];if(file && file.size>8*1024*1024){document.getElementById("gastoStatus").textContent="El archivo supera 8 MB.";return;}
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  data.monto = Number(data.monto);
  const fingerprint = JSON.stringify(data);
  if(!gastoPendiente || gastoPendiente.fingerprint !== fingerprint){
    gastoPendiente = { fingerprint, key: crypto.randomUUID() };
  }
  const button = document.getElementById("guardarGasto");
  const status = document.getElementById("gastoStatus");
  button.disabled = true;
  button.textContent = "Guardando…";
  status.textContent = "";
  try {
    const cuentaSeleccionada = document.getElementById("gastoCuentaSelect").value; data.cuentaId = cuentaSeleccionada; const body = JSON.stringify(data); const res = await fetch("/gastos", { method:"POST", headers:{ "Content-Type":"application/json", "Authorization":token, "Idempotency-Key":gastoPendiente.key }, body });
    const result = await res.json();
    if(res.status < 500) gastoPendiente = null;
    if(!res.ok){status.textContent=result.error||"No se pudo guardar el egreso";return;}
    const registro=await fetch("/historial-financiero",{method:"POST",headers:{Authorization:token,"Content-Type":"application/json"},body:JSON.stringify({tipo:data.tipo==="compra"?"compra":"gasto",clase:"egreso",fecha:data.fecha,monto:data.monto,metodoPago:data.metodoPago,concepto:data.descripcion,categoria:data.categoria,proveedor:data.proveedor,cuentaId:data.cuentaId})}); const documento=await registro.json(); if(!registro.ok)throw new Error(documento.error||"No se pudo guardar en el historial contable"); const archivoGasto=document.getElementById("gastoArchivo").files[0]; if(archivoGasto) await subirArchivoGasto(documento._id,archivoGasto);
    if(data.cuentaId) await fetch(`/gastos/cuentas/${data.cuentaId}/pago`,{method:"POST",headers:{Authorization:token,"Content-Type":"application/json"},body:JSON.stringify({fecha:data.fecha,monto:data.monto})});
    if(data.cuentaId) await cargarCuentasServicio();
    form.reset();
    document.getElementById("gastoFecha").value = fechaHoyLima();
    status.textContent = "Egreso guardado.";
    await cargarGastos();
  } catch {
    status.textContent = "No hubo respuesta del servidor. Reintenta sin cambiar los datos para evitar duplicados.";
  } finally {
    button.disabled = false;
    button.textContent = "Guardar egreso";
  }
}

async function cargarGastos(){
  const status = document.getElementById("gastoStatus");
  const params = new URLSearchParams();
  const desde = document.getElementById("gastosDesde").value;
  const hasta = document.getElementById("gastosHasta").value;
  const tipo = document.getElementById("gastosTipo").value;
  if(desde) params.set("desde", desde);
  if(hasta) params.set("hasta", hasta);
  if(tipo) params.set("tipo", tipo);
  const tbody = document.getElementById("listaGastos");
  tbody.replaceChildren();
  try {
    const res = await fetch(`/gastos?${params}`, { headers:{ "Authorization":token } });
    const gastos = await res.json();
    if(!res.ok || !Array.isArray(gastos)) throw new Error(gastos.error || "No se pudo cargar el historial");
    let totalCents = 0;
    gastos.forEach(gasto => {
      totalCents += Math.round(Number(gasto.monto) * 100);
      const fila = document.createElement("tr");
      const valores = [new Date(gasto.fecha).toLocaleDateString("es-PE", { timeZone:"America/Lima" }), gasto.tipo === "compra" ? "Compra" : "Gasto", gasto.descripcion, gasto.categoria, gasto.proveedor || "—", gasto.metodoPago, `S/ ${Number(gasto.monto).toFixed(2)}`, gasto.registradoPor];
      valores.forEach((valor, indice) => { const celda = document.createElement("td"); celda.textContent = valor || "—"; if(indice === 6) celda.className = "numeric"; fila.appendChild(celda); });
      tbody.appendChild(fila);
    });
    document.getElementById("gastosTotal").textContent = `S/ ${(totalCents / 100).toFixed(2)}`;
    document.getElementById("gastosVacio").hidden = gastos.length > 0;
  } catch(err) {
    status.textContent = err.message;
    document.getElementById("gastosVacio").hidden = true;
  }
}

window.verGastos = verGastos;
