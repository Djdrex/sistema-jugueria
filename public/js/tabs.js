function cargarTabs(){

  let html = "";

  if(rol === "mesero" || rol === "admin"){
    html += "<button onclick='verPedidos()'>Pedidos</button>";
  }

  if(rol === "barra" || rol === "admin"){
    html += "<button onclick='verBarra()'>Barra</button>";
  }

  if(rol === "admin"){
    html += "<button onclick='verInventario()'>Inventario</button>";
    html += "<button onclick='verInformes()'>Informes</button>";
    html += "<button onclick='verUsuarios()'>Usuarios</button>";
    html += "<button onclick='verActividad()'>Actividad</button>";
    html += "<button onclick='resetSistema()'>RESET</button>";
  }

  document.getElementById("tabs").innerHTML = html;
}

window.cargarTabs = cargarTabs;