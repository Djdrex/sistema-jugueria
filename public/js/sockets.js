socket.on("actualizar", () => {
  if(document.getElementById("lista")) cargarPedidos();
  if(document.getElementById("listaProd")) cargarProductos();
  if(document.getElementById("stats")) cargarDashboard();
  if(document.getElementById("listaCobros")) cargarPedidosMesero();
  const panel = document.getElementById("panelNoti");
  if(panel && !panel.hidden) cargarNotificaciones();
});

setInterval(() => {
  if(document.getElementById("lista")) cargarPedidos();
}, 6000);
