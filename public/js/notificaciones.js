async function cargarNotificaciones(){
  const res = await fetch("/notificaciones",{
    headers:{ "Authorization":token }
  });

  notificaciones = await res.json();

  renderNotificaciones();
}
  function renderNotificaciones(){

  const panel = document.getElementById("panelNoti");
  const contador = document.getElementById("contadorNoti");

  panel.innerHTML = ""; // 🔥 LIMPIAR ANTES

  let noLeidas = 0;

  notificaciones.forEach(n=>{

    if(!n.leido) noLeidas++;

    let color = "#333";

    if(n.mensaje.includes("Stock bajo")){
      color = "#552222";
    }

    if(n.mensaje.includes("Nuevo pedido")){
      color = "#223355";
    }

    panel.innerHTML += 
  "<div style='border-bottom:1px solid gray; padding:5px; background:"+color+"'>" +
  "<b>" + n.usuario + "</b><br>" +
  n.mensaje + "<br>" +
  "<small>" + new Date(n.fecha).toLocaleString() + "</small><br>" +
  "<button onclick='eliminarNoti(\"" + n._id + "\")'>🗑️</button>" +
  "</div>";
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
