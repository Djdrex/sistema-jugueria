function verPedidos(){
  document.getElementById("contenido").innerHTML = 

  "<h3>Crear Pedido</h3>" +


  "Mesa:<input id='mesa' placeholder='Ej: 1, 2, 10'><br><br>" +

  "Buscar:<input id='buscador' onkeyup='buscarProducto()'><br>" +
  "<div id='resultados'></div>" +

  "<div id='opcionesJugo'></div>" +

  "<h4>Pedido actual</h4>" +
  "<div id='preview'></div>" +

  "<button onclick='enviarPedido()'>Enviar Pedido</button>" +

  "<hr><h3>Pedidos y cobros</h3><div class='filter-row'><label>Estado<select id='filtroEstadoPedido' onchange='cargarPedidosMesero()'><option value=''>Operativos</option><option value='en_espera'>En espera</option><option value='preparando'>Preparando</option><option value='listo'>Listos</option><option value='entregado'>Entregados</option>" + (rol === "admin" ? "<option value='cancelado'>Historial cancelado</option>" : "") + "</select></label><label>Desde<input id='filtroPedidoDesde' type='date' onchange='cargarPedidosMesero()'></label><label>Hasta<input id='filtroPedidoHasta' type='date' onchange='cargarPedidosMesero()'></label><label>Método de pago<select id='filtroPedidoMetodo' onchange='cargarPedidosMesero()'><option value=''>Todos</option><option value='efectivo'>Efectivo</option><option value='yape'>Yape</option></select></label></div>" +
  "<div id='listaCobros'></div>";

  cargarPedidosMesero();
}

// BUSCAR
async function buscarProducto(){

  const texto = document.getElementById("buscador").value.toLowerCase();

  if(productosCache.length === 0){
    const res = await fetch("/productos", { headers:{ "Authorization":token } });
    if(!res.ok) throw new Error("No se pudieron cargar los productos");
    productosCache = await res.json();
  }

  const cont = document.getElementById("resultados");

  cont.innerHTML = "";

  productosCache.filter(p=>p.tipo !== "insumo" && p.activo !== false).forEach(p=>{
  if(p.nombre && p.nombre.toLowerCase().includes(texto)){

    const btn = document.createElement("button");

    btn.innerText = p.nombre + " - S/" + p.precio;

    btn.onclick = function(){
      seleccionarProducto(p.nombre, p.precio, p.categoria, p._id);
    };

    cont.appendChild(btn);
    cont.appendChild(document.createElement("br"));
  }
});
}

// SELECCIONAR
function seleccionarProducto(nombre,precio,categoria,productoId){

  productoSeleccionado = {nombre,precio,categoria,productoId};

  const cont = document.getElementById("opcionesJugo");
  cont.innerHTML = "";

  if(categoria && categoria.toLowerCase() === "jugo"){
    cont.innerHTML =
    "Sin azúcar <input type='checkbox' id='azucar'><br>" +
    "Helado <input type='checkbox' id='helado'><br>" +
    "Nota <input id='nota'><br>" +
    "<button onclick='agregarProducto()'>Agregar</button>";
  }else{
    agregarProducto();
  }
}

// AGREGAR
function agregarProducto(){

  if(!productoSeleccionado) return;

  let item = {
  producto: productoSeleccionado.nombre,
  productoId: productoSeleccionado.productoId,
  precio: productoSeleccionado.precio,
  pagado:false
};

  if(productoSeleccionado.categoria && productoSeleccionado.categoria.toLowerCase() === "jugo"){
    item.azucar = document.getElementById("azucar").checked;
    item.helado = document.getElementById("helado").checked;
    item.nota = document.getElementById("nota").value.trim();
  }

  pedidoActual.push(item);

  productoSeleccionado = null;
  document.getElementById("opcionesJugo").innerHTML="";

  renderPreview();
}

// PREVIEW
function renderPreview(){

  const cont = document.getElementById("preview");

  cont.innerHTML="";

  pedidoActual.forEach((i,index)=>{

    let extras = [];

    if(i.azucar){
      extras.push("sin azúcar");
    }

    if(i.helado){
      extras.push("helado");
    }

    if(i.nota){
      extras.push(i.nota);
    }

    let texto = i.producto;

    if(extras.length > 0){
      texto += " (" + extras.join(", ") + ")";
    }

    const fila = document.createElement("div");
    const nombre = document.createElement("span");
    nombre.textContent = `${texto} S/${i.precio} `;
    const quitar = document.createElement("button");
    quitar.type = "button";
    quitar.textContent = "Quitar";
    quitar.addEventListener("click", () => eliminarItem(index));
    fila.append(nombre, quitar);
    cont.appendChild(fila);
  });
}

function eliminarItem(i){
  pedidoActual.splice(i,1);
  renderPreview();
}

// ENVIAR
async function enviarPedido(){

  try{

    if(pedidoActual.length === 0){
      alert("Agrega productos");
      return;
    }

    const mesa = document.getElementById("mesa").value;

    if(!mesa){
      alert("Ingresa una mesa");
      return;
    }

    const btn = document.querySelector("button[onclick='enviarPedido()']");
    btn.disabled = true;
    btn.innerText = "Enviando...";
    pedidoRequestId ||= crypto.randomUUID();

    const res = await fetch("/pedidos",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization":token,
        "Idempotency-Key":pedidoRequestId
      },
      body:JSON.stringify({
        mesa,
        items:pedidoActual
      })
    });

    const data = await res.json();

    if(data.error){
      alert("❌ " + data.error);
      btn.disabled = false;
      btn.innerText = "Enviar Pedido";
      return;
    }

    if(!res.ok) throw new Error(data.error || "No se pudo registrar el pedido");

    alert("✅ Pedido enviado");

    pedidoActual = [];
    pedidoRequestId = null;

    renderPreview();

    document.getElementById("mesa").value = "";
    document.getElementById("buscador").value = "";
    document.getElementById("resultados").innerHTML = "";

    btn.disabled = false;
    btn.innerText = "Enviar Pedido";

  }catch(err){

    console.error(err);

    alert("❌ Error enviando pedido");

    const btn = document.querySelector("button[onclick='enviarPedido()']");

    if(btn){
      btn.disabled = false;
      btn.innerText = "Enviar Pedido";
    }
  }
}

async function cargarPedidosMesero(){
  const params = new URLSearchParams();
  const estado = document.getElementById("filtroEstadoPedido")?.value;
  const desde = document.getElementById("filtroPedidoDesde")?.value, hasta = document.getElementById("filtroPedidoHasta")?.value;
  const metodo = document.getElementById("filtroPedidoMetodo")?.value;
  if(estado) params.set("estado", estado); if(desde) params.set("desde", desde); if(hasta) params.set("hasta", hasta); if(metodo) params.set("metodo", metodo);
  const res = await fetch(`/pedidos?${params}`, {
    headers:{ "Authorization":token }
  });
  const data = await res.json();


  const cont = document.getElementById("listaCobros");
  if(!cont || !res.ok || !Array.isArray(data)) { if(cont) cont.textContent = data.error || "No se pudieron cargar los pedidos"; return; }
  cont.innerHTML = "";

  data.forEach(p => {

    const estadoFiltro = document.getElementById("filtroEstadoPedido")?.value;
    if(estadoFiltro && p.estado !== estadoFiltro) return;
    if(!estadoFiltro && (p.estado === "entregado" && p.pagado)) return;

    const div = document.createElement("div");
    div.style.border = "1px solid white";
    div.style.margin = "5px";
    div.style.padding = "10px";

    let html = "<b>Mesa " + escapeHtml(p.mesa) + "</b><br>Estado: " + escapeHtml(p.estado) + "<br>";
    html += "Total: S/" + Number(p.total).toFixed(2) + "<br>";
    html += "Pagado: S/" + Number(p.totalPagado || 0).toFixed(2) + " · Saldo: S/" + (Number(p.total)-Number(p.totalPagado||0)).toFixed(2) + "<br><br>";

    p.items.forEach(i => {
      html += `- ${escapeHtml(i.producto)}${i.nota ? ` <strong>· Nota: ${escapeHtml(i.nota)}</strong>` : ""}${i.azucar ? " · Sin azúcar" : ""}${i.helado ? " · Helado" : ""}<br>`;
    });

    div.innerHTML = html;

    if(p.estado === "entregado" && !p.pagado){ const btn = document.createElement("button"); btn.innerText = "Cobrar / registrar abono"; btn.onclick = () => cobrarPedido(p._id, p); div.appendChild(btn); }

    cont.appendChild(div);
  });

}

async function cobrarPedido(id, pedido){ 
  window.pedidoCobroActual = pedido;

  let html = `<div class="module-header"><div><p class="eyebrow">Cobro</p><h2>Mesa ${escapeHtml(pedido.mesa)}</h2><p>Registra el pago de productos seleccionados o un abono parcial.</p></div><button type="button" onclick="verPedidos()">Volver a pedidos</button></div>`;

  let pagado = pedido.totalPagado || 0;

  html += `<p>💰 Ya pagado: S/ ${Number(pagado).toFixed(2)}</p>`;
  html += `<p>🧾 Restante: S/ ${(Number(pedido.total) - Number(pagado)).toFixed(2)}</p><br>`;
  html += `<section class="panel"><h3>Abono por importe</h3><div class="filter-row"><label>Monto a registrar (S/) <input id="montoAbono" type="number" min="0.01" max="${(Number(pedido.total)-Number(pagado)).toFixed(2)}" step="0.01"></label><button type="button" onclick="prepararAbono('${id}')">Continuar con abono</button></div><div id="abonoConfirmacion"></div></section>`;
  html += "<h4>💰 Pagos realizados</h4>";

if(pedido.pagos && pedido.pagos.length > 0){

  pedido.pagos.forEach(p => {

    html += `
      <div style="
        border:1px solid gray;
        padding:5px;
        margin-bottom:5px;
        border-radius:5px;
      ">

        Método: ${escapeHtml(p.metodo)}<br>
        Monto: S/${Number(p.monto).toFixed(2)}<br>

        ${p.recibido ? `
          Recibido: S/${Number(p.recibido).toFixed(2)}<br>
          Vuelto: S/${Number(p.vuelto).toFixed(2)}<br>
        ` : ""}

        Mesero: ${escapeHtml(p.mesero || "Desconocido")}

      </div>
    `;

  });

}else{

  html += "<p>No hay pagos registrados</p>";

}

  html += "<h3>O cobrar por productos seleccionados</h3><button onclick='seleccionarTodo()'>Seleccionar todo</button><button onclick='deseleccionarTodo()'>Limpiar</button><br>";
  pedido.items.forEach((item, index) => {

  // 🔥 SI YA ESTÁ PAGADO
  if(item.pagado){

    html += `
      <div style="opacity:0.6;color:var(--accent)">
        ✅ ${escapeHtml(item.producto)} - PAGADO
      </div>
    `;

    return;
  }
    html += `
    <label class="payment-item"><input type="checkbox" class="itemCheck" data-index="${index}" data-precio="${Number(item.precio).toFixed(2)}"><span>${escapeHtml(item.producto)}${item.nota ? ` · Nota: ${escapeHtml(item.nota)}` : ""} - S/${Number(item.precio).toFixed(2)}</span></label>
  `;
    });

  html += `
    <br>
    <button onclick="calcularTotalSeleccionado('${id}')">Calcular total</button>

    <div id="totalSeleccionado"></div>
  `;
   

  document.getElementById("contenido").innerHTML = html;
}

function seleccionarTodo(){
  document.querySelectorAll(".itemCheck").forEach(c => c.checked = true);
}

function prepararAbono(id){
  const pedidoId = id, monto = Number(document.getElementById("montoAbono")?.value), box = document.getElementById("abonoConfirmacion");
  const pedido = window.pedidoCobroActual;
  if(!pedido || String(pedido._id) !== String(pedidoId) || !Number.isFinite(monto) || monto <= 0 || monto > Number(pedido.total)-Number(pedido.totalPagado||0)) return alert("Ingresa un abono válido que no supere el saldo pendiente.");
  box.innerHTML = `<p>Registrar abono de S/ ${monto.toFixed(2)}. Selecciona método:</p><button type="button" onclick="confirmarAbonoMetodo('${pedidoId}',${monto},'yape')">Yape (ya verificado)</button><button type="button" onclick="confirmarAbonoMetodo('${pedidoId}',${monto},'efectivo')">Efectivo</button>`;
}
function confirmarAbonoMetodo(id,monto,metodo){
  const box=document.getElementById("abonoConfirmacion");
  if(metodo === "yape") return box.innerHTML=`<p>Confirma solo después de comprobar el abono en la cuenta.</p><button id="btnConfirmarPago" type="button" onclick="confirmarPago('${id}',${monto},'yape',null,undefined)">Confirmar pago</button>`;
  box.innerHTML=`<label>Recibido (S/)<input id="abonoRecibido" type="number" min="${monto}" step="0.01"></label><button type="button" onclick="confirmarAbonoEfectivo('${id}',${monto})">Calcular vuelto</button><div id="abonoVuelto"></div>`;
}
function confirmarAbonoEfectivo(id,monto){const recibido=Number(document.getElementById("abonoRecibido").value);if(!Number.isFinite(recibido)||recibido<monto)return alert("El monto recibido no cubre el abono.");document.getElementById("abonoVuelto").innerHTML=`Vuelto: S/ ${(recibido-monto).toFixed(2)} <button id="btnConfirmarPago" type="button" onclick="confirmarPago('${id}',${monto},'efectivo',${recibido},undefined)">Confirmar pago</button>`;}

function deseleccionarTodo(){
  document.querySelectorAll(".itemCheck").forEach(c => c.checked = false);
}

function calcularTotalSeleccionado(id){

  const checks = document.querySelectorAll(".itemCheck");

  let total = 0;
  let indicesSeleccionados = [];

  checks.forEach(c => {

  if(c.checked){

    total += Number(c.dataset.precio);

    indicesSeleccionados.push(
      Number(c.dataset.index)
    );
  }
});

  if(total === 0){
    alert("Selecciona al menos un producto");
    return;
  }

  fetch("/pedidos", {
    headers:{ "Authorization":token }
  })
    .then(res => res.json())
    .then(data => {

      const pedido = data.find(p => p._id === id);

      const pagado = Number(pedido.totalPagado || 0);
      const restante = Number(pedido.total) - pagado;

      if(total > restante){
      total = restante; 
      total = Number(total.toFixed(2));
       alert("El total seleccionado excede el restante. Se ajustará a S/ " + total);
     }
      
      total = Number(total.toFixed(2));

      document.getElementById("totalSeleccionado").innerHTML = `
        <h4>Total: S/ ${total}</h4>

        <button onclick='seleccionarMetodo(
  "yape",
  "${id}",
  ${total},
  ${JSON.stringify(indicesSeleccionados)}
)'>Yape</button>

<button onclick='seleccionarMetodo(
  "efectivo",
  "${id}",
  ${total},
  ${JSON.stringify(indicesSeleccionados)}
)'>Efectivo</button>
      `;
    });
}

function seleccionarMetodo(metodo, id, total, indices){

  const zona = document.getElementById("totalSeleccionado");

  if(!zona){
    alert("Error en interfaz de pago");
    return;
  }

  if(metodo === "yape"){
    zona.innerHTML = `
      <p>Registra este pago solo después de verificar el abono en la cuenta Yape: S/ ${total}</p>
      <button id="btnConfirmarPago"
onclick="confirmarPago(
  '${id}',
  ${total},
  'yape',
  null,
  ${JSON.stringify(indices)}
)">
Confirmar
</button>
    `;
  }

  if(metodo === "efectivo"){
    zona.innerHTML = `
      <p>Total: S/ ${total}</p>
      Recibido: <input id="recibido" type="number"><br><br>
      <button onclick="calcularVuelto('${id}', ${total}, ${JSON.stringify(indices)})">Calcular vuelto</button>
      <div id="resultadoVuelto"></div>
    `;
  }
}

function calcularVuelto(id, total, indices){

  const input = document.getElementById("recibido");

  if(!input){
    alert("Error: no se encontró el campo de pago");
    return;
  }

  const recibido = parseFloat(input.value);

  if(isNaN(recibido)){
    alert("Ingresa un monto válido");
    return;
  }

  if(recibido < total){
    alert("Monto insuficiente");
    return;
  }

  const vuelto = (recibido - total).toFixed(2);

  document.getElementById("resultadoVuelto").innerHTML = `
    Vuelto: S/ ${vuelto} <br><br>
    <button id="btnConfirmarPago"
onclick="confirmarPago(
  '${id}',
  ${total},
  'efectivo',
  ${recibido},
  ${JSON.stringify(indices)}
)">
Confirmar pago
</button>
  `;
}

async function confirmarPago(id, monto, metodo, recibido, indices){
  paymentAttemptKey ||= crypto.randomUUID();
  const btn = document.getElementById("btnConfirmarPago");
  if(btn){ btn.disabled = true; btn.innerText = "Procesando..."; }
  let res, data;
  try {
    const body = { monto:Number(monto), metodo, recibido };
    if(Array.isArray(indices)) body.indices = indices;
    res = await fetch(`/pedidos/${id}/pagar`, { method:"POST", headers:{ "Content-Type":"application/json", Authorization:token, "Idempotency-Key":paymentAttemptKey }, body:JSON.stringify(body) });
    data = await res.json();
  } catch {
    if(btn){ btn.disabled = false; btn.innerText = "Reintentar"; }
    alert("No se pudo confirmar la respuesta del servidor. Reintenta para verificar el mismo pago.");
    return;
  }
  if(!res.ok || data.error){
    paymentAttemptKey = null;
    if(btn){ btn.disabled = false; btn.innerText = "Confirmar"; }
    alert(data.error || "No se pudo registrar el pago.");
    return;
  }
  paymentAttemptKey = null;
  window.pedidoCobroActual = data;
  alert("Pago registrado.");
  verPedidos();
}

function dividirCuenta(id, total){

  const personas = Number(document.getElementById("personas").value);

  if(!personas || personas <= 0){
    alert("Número inválido");
    return;
  }

  const porPersona = (total / personas).toFixed(2);

  let html = "<h4>Cada persona paga: S/ " + porPersona + "</h4>";

  for(let i=0; i<personas; i++){
    html += `
      Persona ${i+1} 
      <button onclick="confirmarPago('${id}', ${porPersona}, 'yape', null)">Yape</button>
      <button onclick="pagoEfectivoSeparado('${id}', ${porPersona})">Efectivo</button>
      <br><br>
    `;
  }

  document.getElementById("zonaPago").innerHTML = html;
}

function pagoEfectivoSeparado(id, monto){

  const recibido = prompt("Monto recibido:");

  if(!recibido || Number(recibido) < monto){
    alert("Monto insuficiente");
    return;
  }

  confirmarPago(id, monto, "efectivo", Number(recibido));
}

window.verPedidos = verPedidos;
window.buscarProducto = buscarProducto;
window.seleccionarProducto = seleccionarProducto;
window.agregarProducto = agregarProducto;
window.renderPreview = renderPreview;
window.eliminarItem = eliminarItem;
window.enviarPedido = enviarPedido;
window.cargarPedidosMesero = cargarPedidosMesero;
window.cobrarPedido = cobrarPedido;
window.seleccionarTodo = seleccionarTodo;
window.deseleccionarTodo = deseleccionarTodo;
window.calcularTotalSeleccionado = calcularTotalSeleccionado;
window.seleccionarMetodo = seleccionarMetodo;
window.calcularVuelto = calcularVuelto;
window.confirmarPago = confirmarPago;
window.dividirCuenta = dividirCuenta;
window.pagoEfectivoSeparado = pagoEfectivoSeparado;
