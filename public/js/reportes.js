function verDashboard(){
  document.getElementById("contenido").innerHTML = "<h3>Dashboard</h3><div id='stats'></div><h4>Productos más vendidos</h4><div id='topProductos'></div>";
  cargarDashboard();
}

async function cargarDashboard(){
  const res = await fetch("/pedidos", { headers:{ "Authorization":token } });
  const pedidos = await res.json();
  let totalVentas = 0, pedidosHoy = 0;
  const productos = {}, hoy = new Date().toDateString();
  pedidos.forEach(p => {
    if(p.estado !== "entregado" || !p.pagado) return;
    totalVentas += Number(p.total) || 0;
    if(new Date(p.fecha).toDateString() === hoy) pedidosHoy++;
    p.items.forEach(i => productos[i.producto] = (productos[i.producto] || 0) + 1);
  });
  const stats = document.getElementById("stats"), top = document.getElementById("topProductos");
  if(!stats || !top) return;
  stats.textContent = `Ventas totales: S/${totalVentas} | Pedidos hoy: ${pedidosHoy}`;
  top.replaceChildren(...Object.entries(productos).sort((a,b) => b[1] - a[1]).slice(0,5).map(([nombre,cantidad]) => {
    const fila = document.createElement("div"); fila.textContent = `${nombre} (${cantidad})`; return fila;
  }));
}

function verInformes(){
  document.getElementById("contenido").innerHTML = "<h3>Reportes</h3>Desde <input type='date' id='desde'><br>Hasta <input type='date' id='hasta'><br><br><button onclick='generarReporte()'>Generar</button><div id='resultadoReporte'></div>";
}

async function generarReporte(){
  const desde = document.getElementById("desde").value, hasta = document.getElementById("hasta").value;
  const params = desde && hasta ? `?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}` : "";
  const res = await fetch(`/reporte${params}`, { headers:{ "Authorization":token } });
  const data = await res.json(), cont = document.getElementById("resultadoReporte");
  if(!cont) return;
  cont.replaceChildren();
  const resumen = document.createElement("div"); resumen.textContent = `Total vendido: S/${data.total} | Pedidos: ${data.cantidad}`; cont.appendChild(resumen);
  (data.pedidos || []).forEach(p => { const fila = document.createElement("div"); fila.textContent = `Mesa ${p.mesa} | S/${p.total} | ${new Date(p.fecha).toLocaleString()}`; cont.appendChild(fila); });
}

async function verActividad(){
  document.getElementById("contenido").innerHTML = "<h3>Actividad del sistema</h3><div id='listaActividad'></div>";
  const res = await fetch("/actividad", { headers:{ "Authorization":token } });
  const data = await res.json(), cont = document.getElementById("listaActividad");
  if(!cont) return;
  (data || []).forEach(a => { const fila = document.createElement("div"); fila.textContent = `${a.usuario} | ${a.accion} | ${a.detalle} | ${new Date(a.fecha).toLocaleString()}`; cont.appendChild(fila); });
}

async function resetSistema(){
  const confirmacion = prompt("Escribe CONFIRMAR para reiniciar");
  if(confirmacion !== "CONFIRMAR") return;
  const res = await fetch("/reset", { method:"DELETE", headers:{ "Authorization":token, "Content-Type":"application/json" }, body:JSON.stringify({ confirmacion }) });
  const data = await res.json();
  if(data.error) return alert(data.error);
  socket.emit("actualizar_manual");
  alert("Sistema reiniciado");
}

async function cargarInformes(){
  const res = await fetch("/pedidos", { headers:{ "Authorization":token } });
  const data = await res.json();
  const cont = document.getElementById("listaInf");
  if(!cont) return;
  cont.replaceChildren();
  (data || []).filter(p => p.estado === "entregado").forEach(p => {
    const fila = document.createElement("div");
    fila.textContent = `Mesa ${p.mesa} S/${p.total} `;
    const eliminar = document.createElement("button");
    eliminar.textContent = "Eliminar";
    eliminar.onclick = () => eliminarPedido(p._id);
    fila.appendChild(eliminar);
    cont.appendChild(fila);
  });
}

async function eliminarPedido(id){
  const res = await fetch(`/pedidos/${id}`, { method:"DELETE", headers:{ "Authorization":token } });
  const data = await res.json();
  if(data.error) return alert(data.error);
  socket.emit("actualizar_manual");
  cargarInformes();
}

Object.assign(window, { verDashboard, cargarDashboard, verInformes, generarReporte, verActividad, resetSistema, cargarInformes, eliminarPedido });
