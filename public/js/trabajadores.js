const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const textoEstado = estado => ({ activo:"Activo", descanso:"Descanso", servicios_higienicos:"Servicios higiénicos", almuerzo:"Almuerzo", reunion:"Reunión", otro:"Otro", desconectado:"Desconectado" }[estado] || estado);
const fechaHora = valor => valor ? new Date(valor).toLocaleString("es-PE") : "—";

function verTrabajadores(){
  document.getElementById("contenido").innerHTML = "<h3>Trabajadores</h3><p>Estado actual, turnos, horarios y faltas. Los pagos aún no se calculan aquí.</p><div id='resumenTrabajadores'></div><h4>Faltas programadas</h4><label>Desde <input id='faltasDesde' type='date'></label><label>Hasta <input id='faltasHasta' type='date'></label><button onclick='cargarFaltas()'>Ver faltas</button><div id='faltasTrabajadores'></div><hr><div id='listaTrabajadores'></div>";
  cargarTrabajadores();
}

async function cargarTrabajadores(){
  const res = await fetch("/trabajadores", { headers:{ Authorization:token } });
  const trabajadores = await res.json();
  if(!res.ok) return alert(trabajadores.error || "No se pudieron cargar los trabajadores");
  const resumen = document.getElementById("resumenTrabajadores");
  if(!resumen) return;
  const conteo = (trabajadores || []).reduce((a, t) => { a[t.estadoLaboral || "desconectado"] = (a[t.estadoLaboral || "desconectado"] || 0) + 1; return a; }, {});
  resumen.textContent = Object.entries(conteo).map(([estado, cantidad]) => `${textoEstado(estado)}: ${cantidad}`).join(" · ") || "Sin trabajadores registrados";
  const lista = document.getElementById("listaTrabajadores");
  lista.replaceChildren();
  trabajadores.forEach(t => lista.appendChild(tarjetaTrabajador(t)));
}

function tarjetaTrabajador(t){
  const tarjeta = document.createElement("article");
  tarjeta.className = "tarjeta-trabajador";
  const dias = (t.horario?.dias || []).map(d => DIAS[d]).join(", ") || "Sin días asignados";
  tarjeta.innerHTML = `<h4>${t.username} · ${t.rol}</h4><p><strong>${textoEstado(t.estadoLaboral)}</strong> ${t.activo ? "" : "(cuenta desactivada)"}</p><p>Conexión: ${fechaHora(t.ultimaConexion)} · Fin/desconexión: ${fechaHora(t.ultimaDesconexion)}</p><p>Horario: ${dias} · ${t.horario?.horaEntrada || "—"} a ${t.horario?.horaSalida || "—"}</p>`;
  const form = document.createElement("div");
  form.innerHTML = "<strong>Configurar horario:</strong>";
  DIAS.forEach((dia, indice) => { const etiqueta = document.createElement("label"); const check = document.createElement("input"); check.type = "checkbox"; check.value = indice; check.checked = (t.horario?.dias || []).includes(indice); etiqueta.append(check, ` ${dia} `); form.appendChild(etiqueta); });
  const entrada = document.createElement("input"); entrada.type = "time"; entrada.value = t.horario?.horaEntrada || "";
  const salida = document.createElement("input"); salida.type = "time"; salida.value = t.horario?.horaSalida || "";
  const activo = document.createElement("input"); activo.type = "checkbox"; activo.checked = t.activo;
  const guardar = document.createElement("button"); guardar.textContent = "Guardar horario"; guardar.onclick = () => guardarHorario(t._id, form, entrada.value, salida.value, activo.checked);
  form.append(" Entrada ", entrada, " Salida ", salida, " Activo ", activo, guardar);
  tarjeta.appendChild(form);
  const historial = document.createElement("details");
  historial.innerHTML = `<summary>Asistencia reciente (${(t.asistencias || []).length})</summary>`;
  (t.asistencias || []).forEach(a => { const fila = document.createElement("p"); fila.textContent = `${a.fecha}: ${a.estado} · entrada ${fechaHora(a.entrada)} · salida ${fechaHora(a.salida)} · estado final ${textoEstado(a.estadoActual)}`; historial.appendChild(fila); });
  tarjeta.appendChild(historial);
  return tarjeta;
}

async function guardarHorario(id, form, horaEntrada, horaSalida, activo){
  const dias = [...form.querySelectorAll("input[type=checkbox]")].filter(c => c.checked).map(c => Number(c.value));
  const res = await fetch(`/trabajadores/${id}/configuracion`, { method:"PUT", headers:{ "Content-Type":"application/json", Authorization:token }, body:JSON.stringify({ activo, horario:{ dias, horaEntrada, horaSalida } }) });
  const data = await res.json();
  if(data.error) return alert(data.error);
  cargarTrabajadores();
}

async function cargarFaltas(){
  const desde = document.getElementById("faltasDesde").value, hasta = document.getElementById("faltasHasta").value;
  const res = await fetch(`/trabajadores/faltas/resumen?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`, { headers:{ Authorization:token } });
  const data = await res.json(), cont = document.getElementById("faltasTrabajadores");
  if(data.error) return alert(data.error);
  cont.textContent = data.faltas.length ? data.faltas.map(f => `${f.fecha}: ${f.username}`).join(" · ") : "No hay faltas en el período seleccionado.";
}

Object.assign(window, { verTrabajadores, cargarTrabajadores, cargarFaltas, guardarHorario });
