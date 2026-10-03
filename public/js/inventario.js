function verInventario(){
  document.getElementById("contenido").innerHTML = `<div class="module-header"><div><p class="eyebrow">Operaciones</p><h2>Menú e inventario</h2><p>Administra productos, precios y existencias.</p></div></div>
  <section class="panel"><h3>Agregar producto</h3><form id="nuevoProductoForm" class="responsive-form"><label class="field">Nombre<input id="n" maxlength="160" required></label><label class="field">Precio (S/)<input id="p" type="number" min="0" step="0.01" required></label><label class="field">Existencias<input id="s" type="number" min="0" step="1" required></label><label class="field">Categoría<select id="c" required></select></label><label class="field">Stock mínimo<input id="stockMin" type="number" min="0" step="1" value="5"></label><label class="field">Costo unitario (S/)<input id="costoProducto" type="number" min="0" step="0.01"></label><label class="field">Unidad<input id="unidadProducto" maxlength="30" value="unidad"></label><div class="field-wide form-actions"><button class="primary-button" type="submit">Agregar producto</button><span id="productoStatus" role="status"></span></div></form></section>
  <section class="panel"><div class="section-heading"><div><h3>Productos</h3><p>Los movimientos de stock se conservan en el historial.</p></div><div class="filter-row"><label>Buscar<input id="buscarProductoAdmin" placeholder="Nombre del producto"></label><label>Disponibilidad<select id="filtroDisponibilidad"><option value="">Todos</option><option value="disponible">Con stock</option><option value="bajo">Stock bajo</option><option value="agotado">Agotados</option></select></label><button type="button" onclick="cargarProductos()">Filtrar</button></div></div><div id="listaProd" class="table-scroll"></div></section>`;
  document.getElementById("nuevoProductoForm").addEventListener("submit", event => { event.preventDefault(); crearProducto(); });
  cargarCategoriasSelect();
  cargarProductos();
}

async function cargarCategoriasSelect(){
  const [res, select] = [await fetch("/productos/categorias", { headers:{ Authorization:token } }), document.getElementById("c")];
  if(!select) return;
  const data = await res.json();
  const nombres = res.ok && Array.isArray(data) ? data.filter(item => item.activo !== false).map(item => item.nombre) : ["Jugo", "Bebida", "Postre"];
  select.replaceChildren(...nombres.map(nombre => new Option(nombre, nombre)));
  if(!nombres.length) select.replaceChildren(new Option("Crea una categoría primero", ""));
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
      categoria:document.getElementById("c").value,
      stockMinimo:Number(document.getElementById("stockMin").value),
      costo:document.getElementById("costoProducto").value === "" ? undefined : Number(document.getElementById("costoProducto").value),
      unidad:document.getElementById("unidadProducto").value
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
  const query = new URLSearchParams();
  const buscar = document.getElementById("buscarProductoAdmin")?.value.trim(), disponibilidad = document.getElementById("filtroDisponibilidad")?.value;
  if(buscar) query.set("buscar", buscar); if(disponibilidad) query.set("disponibilidad", disponibilidad);
  const res = await fetch(`/productos?${query}`, { headers:{ "Authorization":token } });
  const data = await res.json();

  const cont = document.getElementById("listaProd");
  cont.replaceChildren();
  if(!res.ok) { cont.textContent = data.error || "No se pudieron cargar los productos"; return; }

  if(!data.length){ cont.innerHTML = "<p class='empty-state'>No hay productos para este filtro.</p>"; return; }
  const table = document.createElement("table"); table.className = "data-table"; table.innerHTML = "<thead><tr><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Estado</th><th>Acciones</th></tr></thead>";
  const body = document.createElement("tbody");
  data.forEach(p=>{
    const row = document.createElement("tr"), estado = p.stock === 0 ? "Agotado" : p.stock <= (p.stockMinimo ?? 5) ? "Stock bajo" : "Disponible";
    const values = [p.nombre, p.categoria || "—", `S/ ${Number(p.precio).toFixed(2)}`, `${p.stock} ${p.unidad || "unidad"}`, estado];
    values.forEach((value, i) => { const cell = document.createElement("td"); cell.textContent = value; if(i === 2 || i === 3) cell.className = "numeric"; row.appendChild(cell); });
    const actions = document.createElement("td"), plus = document.createElement("button"), minus = document.createElement("button"), edit = document.createElement("button"), history = document.createElement("button");
    plus.textContent = "Entrada +"; plus.onclick = () => modificarStock(p._id, 1);
    minus.textContent = "Salida −"; minus.disabled = p.stock <= 0; minus.onclick = () => modificarStock(p._id, -1);
    edit.textContent = "Editar"; edit.onclick = () => editarProducto(p);
    history.textContent = "Movimientos"; history.onclick = () => verMovimientosProducto(p);
    actions.append(plus, minus, edit, history); row.appendChild(actions); body.appendChild(row);
  });
  table.appendChild(body); cont.replaceChildren(table);
}

async function editarProducto(producto){
  const nombre = prompt("Nombre del producto", producto.nombre); if(nombre === null) return;
  const precio = Number(prompt("Precio (S/)", producto.precio)); if(!Number.isFinite(precio) || precio < 0) return alert("Precio inválido.");
  const stockMinimo = Number(prompt("Stock mínimo", producto.stockMinimo ?? 5)); if(!Number.isInteger(stockMinimo) || stockMinimo < 0) return alert("Stock mínimo inválido.");
  const res = await fetch(`/productos/${producto._id}`, { method:"PUT", headers:{ "Content-Type":"application/json", Authorization:token }, body:JSON.stringify({ nombre:nombre.trim(), precio, stockMinimo }) });
  const data = await res.json(); if(!res.ok) return alert(data.error || "No se pudo editar el producto"); cargarProductos();
}
async function verMovimientosProducto(producto){
  const res = await fetch(`/productos/${producto._id}/movimientos`, { headers:{ Authorization:token } }), data = await res.json();
  if(!res.ok) return alert(data.error || "No se pudieron cargar los movimientos");
  const texto = data.length ? data.map(item => `${new Date(item.fecha).toLocaleString("es-PE")} · ${item.tipo} ${item.cambio > 0 ? "+" : ""}${item.cambio} · saldo ${item.saldo} · ${item.usuario} · ${item.motivo}`).join("\n") : "Sin movimientos registrados.";
  alert(`${producto.nombre}\n\n${texto}`);
}

async function modificarStock(id, cambio){

  const res = await fetch("/productos/"+id+"/stock",{
    method:"PUT",
    headers:{
      "Content-Type":"application/json",
      "Authorization":token
    },
    body:JSON.stringify({cambio, motivo:prompt(cambio > 0 ? "Motivo de entrada" : "Motivo de salida", "Ajuste manual") || "Ajuste manual"})
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
window.verCategorias = function(){
  const cont = document.getElementById("contenido");
  cont.innerHTML = `<div class="module-header"><div><p class="eyebrow">Operaciones</p><h2>Categorías</h2><p>Administra las categorías del catálogo.</p></div></div><section class="panel"><form id="categoriaForm" class="filter-row"><label>Nombre<input id="categoriaNombre" maxlength="80" required></label><label>Descripción<input id="categoriaDescripcion" maxlength="300"></label><button class="primary-button" type="submit">Crear categoría</button><span id="categoriaStatus" role="status"></span></form></section><section class="panel"><div id="listaCategorias"></div></section>`;
  document.getElementById("categoriaForm").addEventListener("submit", crearCategoria); cargarCategorias();
};
async function cargarCategorias(){
  const res = await fetch("/productos/categorias", { headers:{ Authorization:token } }), data = await res.json(), cont = document.getElementById("listaCategorias"); if(!cont) return;
  if(!res.ok) return cont.textContent = data.error || "No se pudieron cargar categorías";
  if(!data.length) return cont.innerHTML = "<p class='empty-state'>Aún no hay categorías.</p>";
  const table = document.createElement("table"); table.className = "data-table"; table.innerHTML = "<thead><tr><th>Categoría</th><th>Productos</th><th>Estado</th><th>Acción</th></tr></thead>"; const body = document.createElement("tbody");
  data.forEach(c => { const row = document.createElement("tr"); [c.nombre, c.descripcion || "—", c.productos, c.activo === false ? "Inactiva" : "Activa"].forEach(v => { const cell = document.createElement("td"); cell.textContent = v; row.appendChild(cell); }); const cell = document.createElement("td"), btn = document.createElement("button"); btn.textContent = c.heredada ? "Editar desde productos" : c.activo === false ? "Activar" : "Desactivar"; btn.disabled = Boolean(c.heredada); if(!c.heredada) btn.onclick = () => cambiarEstadoCategoria(c); cell.appendChild(btn); row.appendChild(cell); body.appendChild(row); }); table.querySelector("thead").innerHTML = "<tr><th>Categoría</th><th>Descripción</th><th>Productos</th><th>Estado</th><th>Acción</th></tr>"; table.appendChild(body); cont.replaceChildren(table);
}
async function crearCategoria(event){
  event.preventDefault(); const nombre = document.getElementById("categoriaNombre").value.trim(), descripcion = document.getElementById("categoriaDescripcion").value.trim();
  const res = await fetch("/productos/categorias", { method:"POST", headers:{ "Content-Type":"application/json", Authorization:token }, body:JSON.stringify({ nombre, descripcion }) }), data = await res.json();
  document.getElementById("categoriaStatus").textContent = res.ok ? "Categoría creada." : data.error || "No se pudo crear."; if(res.ok){ event.currentTarget.reset(); cargarCategorias(); }
}
async function cambiarEstadoCategoria(categoria){
  const nuevoNombre = prompt("Nombre de categoría", categoria.nombre); if(nuevoNombre === null) return;
  const descripcion = prompt("Descripción de la categoría (opcional)", categoria.descripcion || ""); if(descripcion === null) return;
  const res = await fetch(`/productos/categorias/${categoria._id}`, { method:"PUT", headers:{ "Content-Type":"application/json", Authorization:token }, body:JSON.stringify({ activo:categoria.activo === false, descripcion, nombre:nuevoNombre }) }), data = await res.json(); if(!res.ok) return alert(data.error || "No se pudo actualizar"); cargarCategorias();
}

console.log("inventario cargado");
