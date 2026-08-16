function verUsuarios(){
  document.getElementById("contenido").innerHTML = "<h3>Panel de Usuarios</h3>Usuario <input id='u'><br>Contraseña <input id='p' type='password'><br>Rol <select id='r'><option value='mesero'>Mesero</option><option value='barra'>Barra</option><option value='admin'>Admin</option></select><br><button onclick='crearUsuario()'>Crear Usuario</button><h4>Lista de usuarios</h4><div id='listaUsuarios'></div>";
  cargarUsuarios();
}

async function crearUsuario(){
  const res = await fetch("/usuarios", { method:"POST", headers:{ "Content-Type":"application/json", "Authorization":token }, body:JSON.stringify({ username:document.getElementById("u").value, password:document.getElementById("p").value, rol:document.getElementById("r").value }) });
  const data = await res.json();
  if(data.error) return alert(data.error);
  document.getElementById("u").value = "";
  document.getElementById("p").value = "";
  cargarUsuarios();
}

async function cargarUsuarios(){
  const res = await fetch("/usuarios", { headers:{ "Authorization":token } });
  const data = await res.json(), cont = document.getElementById("listaUsuarios");
  if(!cont) return;
  cont.replaceChildren();
  (data || []).forEach(u => {
    const fila = document.createElement("div");
    const principal = u.username === "admin@titan02";
    fila.append(`${u.username} (${u.rol})${principal ? " ADMIN PRINCIPAL" : ""} `);
    if(!principal){
      const eliminar = document.createElement("button"); eliminar.textContent = "Eliminar"; eliminar.onclick = () => eliminarUsuario(u._id); fila.appendChild(eliminar);
      const selector = document.createElement("select");
      ["mesero", "barra", "admin"].forEach(rolDisponible => { const opcion = document.createElement("option"); opcion.value = rolDisponible; opcion.textContent = rolDisponible; opcion.selected = rolDisponible === u.rol; selector.appendChild(opcion); });
      selector.onchange = () => cambiarRol(u._id, selector.value); fila.appendChild(selector);
    }
    const password = document.createElement("button"); password.textContent = "Cambiar contraseña"; password.onclick = () => cambiarPasswordAdmin(u._id); fila.appendChild(password);
    cont.appendChild(fila);
  });
}

async function cambiarRol(id, rolNuevo){
  const res = await fetch(`/usuarios/${id}/rol`, { method:"PUT", headers:{ "Content-Type":"application/json", "Authorization":token }, body:JSON.stringify({ rol:rolNuevo }) });
  const data = await res.json();
  if(data.error) alert(data.error);
  cargarUsuarios();
}

async function cambiarPasswordAdmin(id){
  const nueva = prompt("Nueva contraseña:");
  if(!nueva) return;
  const res = await fetch(`/usuarios/${id}/password`, { method:"PUT", headers:{ "Content-Type":"application/json", "Authorization":token }, body:JSON.stringify({ nueva }) });
  const data = await res.json();
  alert(data.error || "Contraseña actualizada");
}

async function eliminarUsuario(id){
  const res = await fetch(`/usuarios/${id}`, { method:"DELETE", headers:{ "Authorization":token } });
  const data = await res.json();
  if(data.error) alert(data.error);
  cargarUsuarios();
}

Object.assign(window, { verUsuarios, crearUsuario, cargarUsuarios, cambiarRol, cambiarPasswordAdmin, eliminarUsuario });
