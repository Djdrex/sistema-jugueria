socket.on("actualizar", () => {
  if(refrescoActivo) return;
  refrescoActivo = true;
  if(document.getElementById("lista")) cargarPedidos();
  if(document.getElementById("listaProd")) { productosCache = []; cargarProductos(); }
  if(document.getElementById("listaInsumos")) cargarInsumos();
  if(document.getElementById("listaCategorias")) cargarCategorias();
  if(document.getElementById("dashboardStatus")) cargarDashboard();
  if(document.getElementById("listaCobros")) cargarPedidosMesero();
  if(document.getElementById("personalActivo")) cargarPersonalActivo();
  setTimeout(() => { refrescoActivo = false; }, 250);
  const panel = document.getElementById("panelNoti");
  if(panel && !panel.hidden) cargarNotificaciones();
});

setInterval(() => {
  if(document.getElementById("lista")) cargarPedidos();
}, 3000);

setInterval(() => {
  if(document.getElementById("personalActivo")) cargarPersonalActivo();
}, 10000);
