let gastoPendiente = null;

function verGastos(){
  const contenido = document.getElementById("contenido");
  contenido.innerHTML = `
    <header class="module-header">
      <div><p class="eyebrow">ADMINISTRACIÓN</p><h2>Gastos y compras</h2><p>Registro interno de egresos. Guarda cada operación con su responsable y fecha.</p></div>
      <div class="summary-card"><span>Total cargado (máx. 500)</span><strong id="gastosTotal">S/ 0.00</strong></div>
    </header>
    <section class="panel">
      <h3>Registrar egreso</h3>
      <form id="gastoForm" class="responsive-form">
        <label class="field">Tipo<select name="tipo" required><option value="gasto">Gasto</option><option value="compra">Compra</option></select></label>
        <label class="field">Categoría<input name="categoria" maxlength="80" placeholder="Ej. servicios, insumos" required></label>
        <label class="field">Importe (S/)<input name="monto" type="number" min="0.01" step="0.01" inputmode="decimal" required></label>
        <label class="field">Método<select name="metodoPago"><option value="efectivo">Efectivo</option><option value="yape">Yape</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="otro">Otro</option></select></label>
        <label class="field">Fecha<input name="fecha" id="gastoFecha" type="date" required></label>
        <label class="field">Proveedor (opcional)<input name="proveedor" maxlength="160"></label>
        <label class="field field-wide">Descripción<textarea name="descripcion" rows="2" maxlength="300" required></textarea></label>
        <div class="field-wide form-actions"><button class="primary-button" type="submit" id="guardarGasto">Guardar egreso</button><span id="gastoStatus" role="status" aria-live="polite"></span></div>
      </form>
    </section>
    <section class="panel">
      <div class="section-heading"><div><h3>Historial</h3><p>Hasta 500 registros por consulta.</p></div>
        <div class="filter-row"><label>Desde <input id="gastosDesde" type="date"></label><label>Hasta <input id="gastosHasta" type="date"></label><label>Tipo <select id="gastosTipo"><option value="">Todos</option><option value="gasto">Gastos</option><option value="compra">Compras</option></select></label><button id="filtrarGastos" type="button">Filtrar</button></div>
      </div>
      <div class="table-scroll"><table class="data-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Categoría</th><th>Proveedor</th><th>Método</th><th class="numeric">Importe</th><th>Registrado por</th></tr></thead><tbody id="listaGastos"></tbody></table></div>
      <p id="gastosVacio" class="empty-state" hidden>No hay egresos para el filtro seleccionado.</p>
    </section>`;

  document.getElementById("gastoFecha").value = fechaHoyLima();
  document.getElementById("gastoForm").addEventListener("submit", guardarGasto);
  document.getElementById("filtrarGastos").addEventListener("click", cargarGastos);
  cargarGastos();
}

function fechaHoyLima(){
  return new Intl.DateTimeFormat("en-CA", { timeZone:"America/Lima" }).format(new Date());
}

async function guardarGasto(event){
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
    const res = await fetch("/gastos", { method:"POST", headers:{ "Content-Type":"application/json", "Authorization":token, "Idempotency-Key":gastoPendiente.key }, body:fingerprint });
    const result = await res.json();
    if(res.status < 500) gastoPendiente = null;
    if(!res.ok){ status.textContent = result.error || "No se pudo guardar el egreso"; return; }
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
