function cargarTabs(){

  let html = "";

  if(rol === "mesero" || rol === "admin"){
    html += "<button onclick='verPedidos()'>Pedidos</button>";
  }

  if(rol === "barra" || rol === "admin"){
    html += "<button onclick='verBarra()'>Barra</button>";
  }

  if(rol === "mesero" || rol === "barra"){
    html += "<button onclick='verMiTurno()'>Mi turno</button>";
  }

  if(rol === "admin"){
    html += "<button onclick='verDashboard()'>Dashboard</button>";
    html += "<button onclick='verInventario()'>Inventario</button>";
    html += "<button onclick='verInformes()'>Informes</button>";
    html += "<button onclick='verUsuarios()'>Usuarios</button>";
    html += "<button onclick='verTrabajadores()'>Trabajadores</button>";
    html += "<button onclick='verPersonalActivo()'>Personal activo</button>";
    html += "<button onclick='verActividad()'>Actividad</button>";
  }

  document.getElementById("tabs").innerHTML = html;
}

window.cargarTabs = cargarTabs;
