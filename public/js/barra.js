function verBarra(){

  document.getElementById("contenido").innerHTML = 
  "<h3>Barra</h3>" +
  "<div id='lista' style='height:400px; overflow-y:auto; border:1px solid white; padding:10px;'></div>";

  cargarPedidos();
}

async function cargarPedidos(){

  const res = await fetch("/pedidos",{
  headers:{
    "Authorization":token
  }
});

  const data = await res.json();

  const cont = document.getElementById("lista");

  if(!cont) return;
  if(!res.ok || !Array.isArray(data)) { cont.textContent = data.error || "No se pudieron cargar los pedidos"; return; }

  const nuevosPedidos =
    data.length > pedidosPrevios.length;

  const scrollPos = cont.scrollTop;

  const atBottom =
    cont.scrollHeight - cont.clientHeight <= scrollPos + 50;

  cont.innerHTML = "";

  data.forEach(p => {

    if(p.estado === "entregado") return;

    let color = "#300";

    if(p.estado === "preparando"){
      color = "#663300";
    }

    if(p.estado === "listo"){
      color = "#003300";
    }

    const div = document.createElement("div");

    div.style.background = color;

    div.style.padding = "10px";

    div.style.margin = "5px";

    div.style.borderRadius = "8px";

    let html =
      "<b>Mesa " + escapeHtml(p.mesa) + "</b><br>";

    html +=
      "<b>Total: S/ " + Number(p.total).toFixed(2) + "</b><br>";

    let fecha = new Date(p.fecha);

    html +=
      (isNaN(fecha)
        ? "Fecha inválida"
        : fecha.toLocaleString())
      + "<br><br>";

    const agrupados = {};

    p.items.forEach(i => {

      let extras = [];

      if(i.azucar){
        extras.push("Sin azúcar");
      }

      if(i.helado){
        extras.push("Helado");
      }

      if(i.nota && i.nota.trim() !== ""){
        extras.push(i.nota.trim());
      }

      let nombreFinal = i.producto;

      if(extras.length > 0){
        nombreFinal +=
          " (" + extras.join(", ") + ")";
      }

      if(!agrupados[nombreFinal]){
        agrupados[nombreFinal] = 0;
      }

      agrupados[nombreFinal]++;

    });

    Object.entries(agrupados)
      .forEach(([nombre, cantidad]) => {

        html +=
          cantidad + "x " + escapeHtml(nombre) + "<br>";

      });

    div.innerHTML = html;

    const btn1 = document.createElement("button");

    btn1.innerText = "Preparando";

    btn1.onclick = event =>
      cambiarEstado(p._id, "preparando", event.currentTarget);

    const btn2 = document.createElement("button");

    btn2.innerText = "Listo";

    btn2.onclick = event =>
      cambiarEstado(p._id, "listo", event.currentTarget);

    const btn3 = document.createElement("button");

    btn3.innerText = "Entregado";

    btn3.onclick = event =>
      cambiarEstado(p._id, "entregado", event.currentTarget);

    div.appendChild(document.createElement("br"));

    div.appendChild(btn1);

    div.appendChild(btn2);

    div.appendChild(btn3);

    cont.appendChild(div);

  });

  if(atBottom){

    cont.scrollTop = cont.scrollHeight;

  } else {

    cont.scrollTop = scrollPos;

  }

  if(nuevosPedidos && sonidoActivo){

    audio.currentTime = 0;

    audio.play().catch(()=>{});

  }

  pedidosPrevios = data;
}

async function cambiarEstado(id,estado,boton){
  if(boton) boton.disabled = true;
  try {
    const res = await fetch("/pedidos/"+id,{
      method:"PUT",
      headers:{ "Content-Type":"application/json", "Authorization":token },
      body:JSON.stringify({estado})
    });
    const data = await res.json();
    if(!res.ok) { alert(data.error || "No se pudo actualizar el pedido"); await cargarPedidos(); return; }
  } catch {
    alert("No se pudo conectar con el servidor");
  } finally {
    if(boton) boton.disabled = false;
  }

  if(estado === "listo" && sonidoActivo){

    audio.currentTime = 0;

    audio.play().catch(()=>{});

  }

}
