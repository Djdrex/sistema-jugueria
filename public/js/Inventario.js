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
  await fetch("/productos",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":token
    },
    body:JSON.stringify({
      nombre:document.getElementById("n").value,
      precio:document.getElementById("p").value,
      stock:document.getElementById("s").value,
      categoria:document.getElementById("c").value
    })
  });

  socket.emit("actualizar_manual");
  cargarProductos();
}

async function cargarProductos(){
  const res = await fetch("/productos");
  const data = await res.json();

  const cont = document.getElementById("listaProd");
  cont.innerHTML="";

  data.forEach(p=>{
    // Creamos un contenedor para la fila
    const div = document.createElement("div");
    div.innerHTML = 
  p.nombre + " - S/" + p.precio +
  " | Stock: " + p.stock + " ";
    
  const btnMas = document.createElement("button");
   btnMas.innerText = "➕";
   btnMas.onclick = () => modificarStock(p._id, 1);

   const btnMenos = document.createElement("button");
   btnMenos.innerText = "➖";
   btnMenos.onclick = () => modificarStock(p._id, -1);

   div.appendChild(btnMas);
   div.appendChild(btnMenos);
    // Creamos el botón "sin errores"
    const btn = document.createElement("button");
    btn.innerText = "❌";
    btn.onclick = () => eliminarProducto(p._id);
    
    // Agregamos el botón al div, y el div al contenedor principal
    div.appendChild(btn);
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

  if(data.error){
    alert("❌ " + data.error);
    return;
  }

  cargarProductos();
}

async function eliminarProducto(id){
  await fetch("/productos/"+id,{
    method:"DELETE",
    headers:{ "Authorization":token }
  });

  cargarProductos();
}

window.verInventario = verInventario;
window.crearProducto = crearProducto;
window.cargarProductos = cargarProductos;
window.modificarStock = modificarStock;
window.eliminarProducto = eliminarProducto;