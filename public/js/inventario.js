function verInventario(){
  document.getElementById("contenido").innerHTML =
  "Nombre <input id='n'><br>" +
  "Precio <input id='p'><br>" +
  "Stock <input id='s'><br>" +
  "Categoria <select id='c'>" +
  "<option value='jugo'>Jugo</option>" +
  "<option value='bebida'>Bebida</option>" +
  "<option value='postre'>Postre</option>" +
  "</select><br>" +
  "<button onclick='crearProducto()'>Agregar</button>" +
  "<div id='listaProd'></div>";

  cargarProductos();
}

async function crearProducto(){
  const res = await fetch("/productos",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":token
    },
    body:JSON.stringify({
      nombre:document.getElementById("n").value,
      precio:Number(document.getElementById("p").value),
      stock:Number(document.getElementById("s").value),
      categoria:document.getElementById("c").value
    })
  });
  const data = await res.json();
  if(!res.ok){ alert(data.error || "No se pudo crear el producto"); return; }
  document.getElementById("n").value = "";
  document.getElementById("p").value = "";
  document.getElementById("s").value = "";
  cargarProductos();
}

async function cargarProductos(){
  const res = await fetch("/productos", { headers:{ "Authorization":token } });
  const data = await res.json();

  const cont = document.getElementById("listaProd");
  cont.replaceChildren();
  if(!res.ok) { cont.textContent = data.error || "No se pudieron cargar los productos"; return; }

  data.forEach(p=>{
    // Creamos un contenedor para la fila
    const div = document.createElement("div");
    div.textContent = `${p.nombre} - S/${p.precio} | Stock: ${p.stock} `;
    
  const btnMas = document.createElement("button");
   btnMas.innerText = "➕";
   btnMas.onclick = () => modificarStock(p._id, 1);

   const btnMenos = document.createElement("button");
   btnMenos.innerText = "➖";
   btnMenos.onclick = () => modificarStock(p._id, -1);

   div.appendChild(btnMas);
   div.appendChild(btnMenos);
    // Creamos el botón "sin errores"
    cont.appendChild(div);
  });
}

async function modificarStock(id, cambio){

  const res = await fetch("/productos/"+id+"/stock",{
    method:"PUT",
    headers:{
      "Content-Type":"application/json",
      "Authorization":token
    },
    body:JSON.stringify({cambio})
  });

  const data = await res.json();

  if(!res.ok || data.error){
    alert("❌ " + data.error);
    return;
  }

  cargarProductos();
}

async function eliminarProducto(id){
  const res = await fetch("/productos/"+id,{ method:"DELETE", headers:{ "Authorization":token } });
  const data = await res.json();
  if(!res.ok) alert(data.error || "No se pudo eliminar el producto");
  cargarProductos();
}

window.verInventario = verInventario;
window.crearProducto = crearProducto;
window.cargarProductos = cargarProductos;
window.modificarStock = modificarStock;
window.eliminarProducto = eliminarProducto;

console.log("inventario cargado");
