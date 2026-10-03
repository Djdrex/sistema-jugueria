let pagoPersonalPendiente = null;

function verPagosPersonal(){
  document.getElementById("contenido").innerHTML = `
    <header class="module-header">
      <div><p class="eyebrow">ADMINISTRACIÓN · PERSONAL</p><h2>Pagos al personal</h2><p>Registro interno de pagos realizados. No calcula sueldos ni reemplaza una planilla formal.</p></div>
      <div class="summary-card"><span>Total registrado (máx. 500)</span><strong id="pagosPersonalTotal">S/ 0.00</strong></div>
    </header>
      <div class="notice-card" role="note"><strong>Control interno</strong><span>Registra solo pagos ya autorizados. Yape queda como método declarado, no se confirma el depósito. Acuerdos salariales, beneficios, impuestos y obligaciones laborales deben verificarse por separado en Perú.</span></div>
    <section class="panel">
      <h3>Registrar pago realizado</h3>
      <form id="pagoPersonalForm" class="responsive-form">
        <label class="field field-wide">Trabajador<select id="pagoTrabajador" name="trabajador" required><option value="">Cargando trabajadores…</option></select></label>
        <label class="field">Importe (S/)<input name="monto" type="number" min="0.01" step="0.01" inputmode="decimal" required></label>
        <label class="field">Método<select name="metodoPago"><option value="efectivo">Efectivo</option><option value="yape">Yape</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="otro">Otro</option></select></label>
        <label class="field">Fecha<input name="fecha" id="pagoPersonalFecha" type="date" required></label>
        <label class="field field-wide">Observación<input name="nota" maxlength="500" placeholder="Concepto, período o comprobante de referencia"></label>
        <div class="field-wide form-actions"><button class="primary-button" type="submit" id="guardarPagoPersonal">Guardar registro</button><span id="pagoPersonalStatus" role="status" aria-live="polite"></span></div>
      </form>
    </section>
    <section class="panel">
      <div class="section-heading"><div><h3>Historial de pagos</h3><p>Los registros son internos; no hay cálculo de pendiente salarial.</p></div>
        <div class="filter-row"><label>Trabajador<select id="filtroPagoTrabajador"><option value="">Todos</option></select></label><label>Desde<input id="pagosDesde" type="date"></label><label>Hasta<input id="pagosHasta" type="date"></label><button id="filtrarPagosPersonal" type="button">Filtrar</button></div>
      </div>
      <div class="table-scroll"><table class="data-table"><thead><tr><th>Fecha</th><th>Trabajador</th><th>Importe</th><th>Método</th><th>Observación</th><th>Autorizó / registró</th></tr></thead><tbody id="listaPagosPersonal"></tbody></table></div>
      <p id="pagosPersonalVacio" class="empty-state" hidden>No hay pagos para el filtro seleccionado.</p>
    </section>`;
  document.getElementById("pagoPersonalFecha").value = fechaPagoLima();
  document.getElementById("pagoPersonalForm").addEventListener("submit", guardarPagoPersonal);
  document.getElementById("filtrarPagosPersonal").addEventListener("click", cargarPagosPersonal);
  cargarOpcionesTrabajador();
  cargarPagosPersonal();
}

function fechaPagoLima(){ return new Intl.DateTimeFormat("en-CA", { timeZone:"America/Lima" }).format(new Date()); }

async function cargarOpcionesTrabajador(){
  const [res, select, filtro] = [await fetch("/trabajadores", { headers:{ "Authorization":token } }), document.getElementById("pagoTrabajador"), document.getElementById("filtroPagoTrabajador")];
  const trabajadores = await res.json();
  if(!res.ok || !Array.isArray(trabajadores)){ select.replaceChildren(new Option("No se pudieron cargar trabajadores", "")); return; }
  select.replaceChildren(new Option("Selecciona un trabajador", ""));
  trabajadores.forEach(persona => {
    const nombre = `${persona.username} · ${persona.rol}${persona.activo === false ? " · inactivo" : ""}`;
    select.appendChild(new Option(nombre, persona._id));
    filtro.appendChild(new Option(nombre, persona._id));
  });
}

async function guardarPagoPersonal(event){
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  data.monto = Number(data.monto);
  const fingerprint = JSON.stringify(data);
  if(!pagoPersonalPendiente || pagoPersonalPendiente.fingerprint !== fingerprint) pagoPersonalPendiente = { fingerprint, key:crypto.randomUUID() };
  const button = document.getElementById("guardarPagoPersonal"), status = document.getElementById("pagoPersonalStatus");
  button.disabled = true;
  status.textContent = "";
  try {
    const res = await fetch("/pagos-personal", { method:"POST", headers:{ "Content-Type":"application/json", "Authorization":token, "Idempotency-Key":pagoPersonalPendiente.key }, body:fingerprint });
    const result = await res.json();
    if(res.status < 500) pagoPersonalPendiente = null;
    if(!res.ok){ status.textContent = result.error || "No se pudo guardar el pago"; return; }
    const trabajador = form.elements.trabajador.value;
    form.reset();
    document.getElementById("pagoTrabajador").value = trabajador;
    document.getElementById("pagoPersonalFecha").value = fechaPagoLima();
    status.textContent = "Pago registrado.";
    await cargarPagosPersonal();
  } catch {
    status.textContent = "Sin respuesta del servidor. Reintenta sin cambiar los datos para evitar duplicados.";
  } finally {
    button.disabled = false;
  }
}

async function cargarPagosPersonal(){
  const params = new URLSearchParams();
  const trabajador = document.getElementById("filtroPagoTrabajador").value;
  const desde = document.getElementById("pagosDesde").value, hasta = document.getElementById("pagosHasta").value;
  if(trabajador) params.set("trabajador", trabajador);
  if(desde) params.set("desde", desde);
  if(hasta) params.set("hasta", hasta);
  const tbody = document.getElementById("listaPagosPersonal");
  tbody.replaceChildren();
  const status = document.getElementById("pagoPersonalStatus");
  try {
    const res = await fetch(`/pagos-personal?${params}`, { headers:{ "Authorization":token } });
    const pagos = await res.json();
    if(!res.ok || !Array.isArray(pagos)) throw new Error(pagos.error || "No se pudo cargar el historial");
    let total = 0;
    pagos.forEach(pago => {
      total += Math.round(Number(pago.monto) * 100);
      const fila = document.createElement("tr");
      [new Date(pago.fecha).toLocaleDateString("es-PE", { timeZone:"America/Lima" }), pago.trabajador?.username || "Trabajador inactivo", `S/ ${Number(pago.monto).toFixed(2)}`, pago.metodoPago, pago.nota || "—", pago.autorizadoPor || pago.registradoPor].forEach((valor, indice) => {
        const celda = document.createElement("td"); celda.textContent = valor || "—"; if(indice === 2) celda.className = "numeric"; fila.appendChild(celda);
      });
      tbody.appendChild(fila);
    });
    document.getElementById("pagosPersonalTotal").textContent = `S/ ${(total / 100).toFixed(2)}`;
    document.getElementById("pagosPersonalVacio").hidden = pagos.length > 0;
  } catch(err) {
    status.textContent = err.message;
    document.getElementById("pagosPersonalVacio").hidden = true;
  }
}

window.verPagosPersonal = verPagosPersonal;
