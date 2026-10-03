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

  "<hr><h3>💰 Cobrar Pedidos</h3>" +
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

  productosCache.forEach(p=>{
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
    item.nota = document.getElementById("nota").value;
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

  const res = await fetch("/pedidos", {
    headers:{ "Authorization":token }
  });
  const data = await res.json();


  const cont = document.getElementById("listaCobros");
  if(!cont || !res.ok || !Array.isArray(data)) { if(cont) cont.textContent = data.error || "No se pudieron cargar los pedidos"; return; }
  cont.innerHTML = "";

  data.forEach(p => {

    // 🔥 SOLO PEDIDOS ENTREGADOS Y NO PAGADOS
    if(p.estado !== "entregado" || p.pagado) return;

    const div = document.createElement("div");
    div.style.border = "1px solid white";
    div.style.margin = "5px";
    div.style.padding = "10px";

    let html = "<b>Mesa " + escapeHtml(p.mesa) + "</b><br>";
    html += "Total: S/" + Number(p.total).toFixed(2) + "<br><br>";

    p.items.forEach(i => {
      html += "- " + escapeHtml(i.producto) + "<br>";
    });

    div.innerHTML = html;

    const btn = document.createElement("button");
    btn.innerText = "💰 Cobrar";
    btn.onclick = () => cobrarPedido(p._id, p);

    div.appendChild(btn);

    cont.appendChild(div);
  });

}

async function cobrarPedido(id, pedido){ 

  let html = `
    <h3>💰 Cobrar Pedido</h3>
    <b>Mesa ${escapeHtml(pedido.mesa)}</b><br><br>

    <button onclick="seleccionarTodo()">✅ Seleccionar todo</button>
    <button onclick="deseleccionarTodo()">❌ Limpiar</button>

    <h4>Selecciona productos</h4>
  `;

  let pagado = pedido.totalPagado || 0;

  html += `<p>💰 Ya pagado: S/ ${Number(pagado).toFixed(2)}</p>`;
  html += `<p>🧾 Restante: S/ ${(Number(pedido.total) - Number(pagado)).toFixed(2)}</p><br>`;
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

  pedido.items.forEach((item, index) => {

  // 🔥 SI YA ESTÁ PAGADO
  if(item.pagado){

    html += `
      <div style="opacity:0.5;color:lightgreen">
        ✅ ${escapeHtml(item.producto)} - PAGADO
      </div>
    `;

    return;
  }
      html += `
    <input 
      type="checkbox" 
      class="itemCheck" 
      data-index="${index}"
      data-precio="${Number(item.precio).toFixed(2)}"
    >
    ${escapeHtml(item.producto)} - S/${Number(item.precio).toFixed(2)}
    <br>
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

if(btn){
  btn.disabled = true;
  btn.innerText = "Procesando...";
}

  let res, data;
  try {
    res = await fetch("/pedidos/" + id + "/pagar",{
      method:"POST",
      headers:{ "Content-Type":"application/json", "Authorization":token, "Idempotency-Key":paymentAttemptKey },
      body:JSON.stringify({ monto:Number(monto), metodo, recibido, indices })
    });
    data = await res.json();
  } catch(err) {
    if(btn){ btn.disabled = false; btn.innerText = "Reintentar"; }
    alert("No se pudo confirmar la respuesta del servidor. Reintenta para verificar el mismo pago.");
    return;
  }
  paymentAttemptKey = null;

  if(data.error){
    if(btn){
  btn.disabled = false;
  btn.innerText = "Confirmar";
}
    alert("❌ " + data.error);
  } else {
    alert("✅ Pago registrado");
  }

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
