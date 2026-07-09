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
    const res = await fetch("/productos");
    productosCache = await res.json();
  }

  const cont = document.getElementById("resultados");

  cont.innerHTML = "";

  productosCache.forEach(p=>{
  if(p.nombre && p.nombre.toLowerCase().includes(texto)){

    const btn = document.createElement("button");

    btn.innerText = p.nombre + " - S/" + p.precio;

    btn.onclick = function(){
      seleccionarProducto(p.nombre, p.precio, p.categoria);
    };

    cont.appendChild(btn);
    cont.appendChild(document.createElement("br"));
  }
});
}

// SELECCIONAR
function seleccionarProducto(nombre,precio,categoria){

  productoSeleccionado = {nombre,precio,categoria};

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
  precio: productoSeleccionado.precio,
  pagado:true
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

    cont.innerHTML +=
      texto +
      " S/" + i.precio +
      " <button onclick='eliminarItem(" + index + ")'>❌</button><br>";
  });
}

function eliminarItem(i){
  pedidoActual.splice(i,1);
  renderPreview();
}

window.verPedidos = verPedidos;
window.buscarProducto = buscarProducto;
window.seleccionarProducto = seleccionarProducto;
window.agregarProducto = agregarProducto;
window.renderPreview = renderPreview;
window.eliminarItem = eliminarItem;