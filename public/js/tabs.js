const seccionesNav = [
  { grupo:"General", items:[
    { texto:"Dashboard", icono:"▦", click:"verDashboard()", roles:["admin"] },
    { texto:"Notificaciones", icono:"◉", click:"toggleNotificaciones()", roles:["admin","mesero","barra"] }
  ]},
  { grupo:"Operaciones", items:[
    { texto:"Pedidos", icono:"▤", click:"verPedidos()", roles:["admin","mesero"] },
    { texto:"Barra", icono:"◷", click:"verBarra()", roles:["admin","barra"] },
    { texto:"Menú e inventario", icono:"◫", click:"verInventario()", roles:["admin"] },
    { texto:"Insumos y recetas", icono:"◩", click:"verInsumos()", roles:["admin"] },
    { texto:"Categorías", icono:"▧", click:"verCategorias()", roles:["admin"] },
    { texto:"Gastos y caja", icono:"▣", click:"verGastos()", roles:["admin"] }
  ]},
  { grupo:"Administración", items:[
    { texto:"Informes", icono:"▥", click:"verInformes()", roles:["admin"] },
    { texto:"Trabajadores", icono:"♙", click:"verTrabajadores()", roles:["admin"] },
    { texto:"Pagos al personal", icono:"＄", click:"verPagosPersonal()", roles:["admin"] },
    { texto:"Mis pagos", icono:"＄", click:"verMisPagos()", roles:["mesero","barra"] },
    { texto:"Mi turno", icono:"◷", click:"verMiTurno()", roles:["mesero","barra"] },
    { texto:"Usuarios", icono:"♧", click:"verUsuarios()", roles:["admin"] },
    { texto:"Actividad y auditoría", icono:"≡", click:"verActividad()", roles:["admin"] }
  ]},
  { grupo:"Configuración", items:[
    { texto:"Mi perfil", icono:"♙", click:"verPerfil()", roles:["admin","mesero","barra"] },
    { texto:"Sedes", icono:"⌖", click:"verSedes()", roles:["adminPrincipal"] },
    { texto:"Configuración general", icono:"⚙", click:"verConfiguracion()", roles:["adminPrincipal"] },
    { texto:"Reinicio del sistema", icono:"⟳", click:"verReinicio()", roles:["adminPrincipal"] }
  ]}
];

function esAdminPrincipal(){ return rol === "admin" && username === "admin@titan02"; }
function cargarTabs(){
  const nav = document.getElementById("tabs");
  nav.replaceChildren();
  seccionesNav.forEach(grupo => {
    const disponibles = grupo.items.filter(item => item.roles.includes(rol) || item.roles.includes("adminPrincipal") && esAdminPrincipal());
    if(!disponibles.length) return;
    const titulo = document.createElement("p"); titulo.className = "nav-group-title"; titulo.textContent = grupo.grupo; nav.appendChild(titulo);
    disponibles.forEach(item => {
      const button = document.createElement("button"); button.type = "button"; button.className = "nav-item"; button.dataset.title = item.texto;
      const icon = document.createElement("span"); icon.className = "nav-icon"; icon.setAttribute("aria-hidden", "true"); icon.textContent = item.icono;
      const label = document.createElement("span"); label.className = "nav-label"; label.textContent = item.texto;
      button.append(icon, label); button.addEventListener("click", () => { document.querySelectorAll(".nav-item").forEach(el => el.removeAttribute("aria-current")); button.setAttribute("aria-current", "page"); document.getElementById("pageTitle").textContent = item.texto; new Function(item.click)(); }); nav.appendChild(button);
    });
  });
}
function alternarMenu(){ document.getElementById("app").classList.toggle("sidebar-collapsed"); }
window.cargarTabs = cargarTabs;
window.alternarMenu = alternarMenu;
