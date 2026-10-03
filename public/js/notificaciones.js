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
    fila.style.cssText = `border-bottom:1px solid gray;padding:5px;background:${color}`;
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
    fila.append(autor, mensaje, fecha, document.createElement("br"), borrar);
    panel.appendChild(fila);
  });

  contador.innerText = noLeidas > 0 ? "(" + noLeidas + ")" : "";
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
