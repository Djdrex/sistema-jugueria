function verBarra(){

  document.getElementById("contenido").innerHTML = 
  "<div class='module-header'><div><p class='eyebrow'>Operaciones</p><h2>Barra</h2><p>Cola de preparación de pedidos.</p></div><label>Mostrar cancelados <input id='mostrarCanceladosBarra' type='checkbox' onchange='cargarPedidos()'></label></div>" +
  "<div id='lista' class='panel' style='height:min(65vh,700px); overflow-y:auto;'></div>";

  cargarPedidos();
}

async function cargarPedidos(){
  const params = new URLSearchParams();
  if(document.getElementById("mostrarCanceladosBarra")?.checked && rol === "admin") params.set("estado", "cancelado");
  const res = await fetch(`/pedidos?${params}`,{
  headers:{
    "Authorization":token
  }
});

  const data = await res.json();

  const cont = document.getElementById("lista");

  if(!cont) return;
  if(!res.ok || !Array.isArray(data)) { cont.textContent = data.error || "No se pudieron cargar los pedidos"; return; }

  const operativos = data.filter(p => p.estado !== "cancelado");
  const nuevosPedidos = operativos.length > pedidosPrevios.length;

  const scrollPos = cont.scrollTop;

  const atBottom =
    cont.scrollHeight - cont.clientHeight <= scrollPos + 50;

  cont.innerHTML = "";

  data.forEach(p => {

    if(p.estado !== "cancelado" && p.estado === "entregado") return;

    let color = "var(--surface-soft)";

    if(p.estado === "preparando"){
      color = "var(--surface-soft)";
    }

    if(p.estado === "listo"){
      color = "var(--accent-soft)";
    }

    const div = document.createElement("div");

    div.style.background = color;
    div.style.border = "1px solid var(--border)";

    div.style.padding = "10px";

    div.style.margin = "5px";

    div.style.borderRadius = "8px";

    let html =
      "<b>Mesa " + escapeHtml(p.mesa) + "</b> · " + escapeHtml(p.estado) + "<br>";

    html +=
      "<b>Total: S/ " + Number(p.total).toFixed(2) + "</b><br>";

    let fecha = new Date(p.fecha);

    html +=
      (isNaN(fecha)
        ? "Fecha inválida"
        : fecha.toLocaleString())
      + "<br><br>";

    const lista = document.createElement("div");
    lista.innerHTML = html;
    p.items.forEach(item => {
      const linea = document.createElement("article");
      linea.className = "bar-item";
      const nombre = document.createElement("strong");
      nombre.textContent = item.producto;
      linea.appendChild(nombre);
      const extras = [];
      if(item.azucar) extras.push("SIN AZÚCAR");
      if(item.helado) extras.push("Helado");
      if(extras.length){ const tag=document.createElement("span");tag.className="bar-item-tag";tag.textContent=extras.join(" · ");linea.appendChild(tag); }
      if(item.nota?.trim()){ const nota=document.createElement("p");nota.className="bar-item-note";nota.textContent=`NOTA: ${item.nota.trim()}`;linea.appendChild(nota); }
      lista.appendChild(linea);
    });
    div.replaceChildren(lista);

    if(p.estado === "cancelado"){
      const cancelado=document.createElement("strong");cancelado.className="cancelled-label";cancelado.textContent="Pedido cancelado · solo historial";div.appendChild(cancelado);cont.appendChild(div);return;
    }
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

  pedidosPrevios = operativos;
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
