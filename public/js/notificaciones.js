async function cargarNotificaciones(){
  const res = await fetch("/notificaciones",{
    headers:{ "Authorization":token }
  });

  const data = await res.json();
  if(!res.ok || !Array.isArray(data)) { notificaciones = []; return; }
  notificaciones = data;

  renderNotificaciones();
}
  function renderNotificaciones(){

  const panel = document.getElementById("panelNoti");
  const contador = document.getElementById("contadorNoti");

  panel.replaceChildren();

  const limpiar = document.createElement("button");
  limpiar.type = "button";
  limpiar.textContent = "Limpiar todo";
  limpiar.addEventListener("click", limpiarNotificaciones);
  panel.appendChild(limpiar);

  const filtros = document.createElement("div"); filtros.className = "notification-filters";
  const select = document.createElement("select"); select.setAttribute("aria-label", "Filtrar notificaciones");
  [["", "Todas"], ["no-leidas", "No leídas"], ["Nuevo pedido", "Pedidos"], ["Stock", "Inventario"]].forEach(([value, label]) => select.appendChild(new Option(label, value)));
  select.addEventListener("change", async () => { const params = new URLSearchParams(); if(select.value === "no-leidas") params.set("leido", "false"); else if(select.value) params.set("tipo", select.value); const res = await fetch(`/notificaciones?${params}`, { headers:{ Authorization:token } }), data = await res.json(); if(res.ok && Array.isArray(data)){ notificaciones = data; renderNotificaciones(); } });
  filtros.appendChild(select); panel.appendChild(filtros);

  let noLeidas = 0;

  notificaciones.forEach(n=>{

    if(!n.leido) noLeidas++;
    const textoMensaje = String(n.mensaje || "");

    let color = "#333";

    if(textoMensaje.includes("Stock bajo")){
      color = "#552222";
    }

    if(textoMensaje.includes("Nuevo pedido")){
      color = "#223355";
    }

    const fila = document.createElement("article");
    fila.className = `notification-item ${n.leido ? "is-read" : "is-unread"}`;
    const autor = document.createElement("strong");
    autor.textContent = n.usuario || "Sistema";
    const mensaje = document.createElement("p");
    mensaje.textContent = textoMensaje;
    const fecha = document.createElement("small");
    fecha.textContent = new Date(n.fecha).toLocaleString("es-PE");
    const borrar = document.createElement("button");
    borrar.type = "button";
    borrar.textContent = "Eliminar";
    borrar.addEventListener("click", () => eliminarNoti(n._id));
    const acciones = document.createElement("div"); acciones.className = "notification-actions";
    if(!n.leido){ const leer = document.createElement("button"); leer.type="button"; leer.textContent="Marcar leída"; leer.addEventListener("click", () => marcarUnaLeida(n._id)); acciones.appendChild(leer); }
    acciones.appendChild(borrar);
    fila.append(autor, mensaje, fecha, acciones);
    panel.appendChild(fila);
  });

  contador.innerText = noLeidas > 0 ? "(" + noLeidas + ")" : "";
}
async function marcarUnaLeida(id){
  const res = await fetch(`/notificaciones/${id}/leido`, { method:"PUT", headers:{ Authorization:token } });
  if(res.ok) await cargarNotificaciones();
}
  function toggleNotificaciones(){
  const panel = document.getElementById("panelNoti");

  if(panel.hidden){
    panel.hidden = false;
    marcarLeido();
  } else {
    panel.hidden = true;
  }
}
async function marcarLeido(){
  await fetch("/notificaciones/leido",{
    method:"PUT",
    headers:{ "Authorization":token }
  });

  cargarNotificaciones();
}
  async function eliminarNoti(id){
  await fetch("/notificaciones/" + id,{
    method:"DELETE",
    headers:{ "Authorization":token }
  });

  await cargarNotificaciones();
}
  async function limpiarNotificaciones(){
  if(!confirm("¿Eliminar todas las notificaciones?")) return;

  await fetch("/notificaciones",{
    method:"DELETE",
    headers:{ "Authorization":token }
  });

  cargarNotificaciones();
}
