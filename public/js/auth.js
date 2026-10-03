async function login(){
  try {
    const res = await fetch("/usuarios/login",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        username:document.getElementById("user").value,
        password:document.getElementById("pass").value
      })
    });

    const data = await res.json();

    if(data.token){
      token=data.token;
      rol=data.rol;
      username=data.username;
      socket.auth = { token };
      socket.connect();

      document.getElementById("loginDiv").hidden=true;
      document.getElementById("app").hidden=false;
      document.getElementById("info").innerText=username+" ("+rol+")";

      cargarTabs();
      cargarNotificaciones();
      if(rol === "mesero" || rol === "barra") mostrarControlEstado();
    } else {
      alert("❌ Usuario o contraseña incorrectos");
    }

  } catch(err){
    console.error("ERROR LOGIN:", err);
    alert("❌ Error conectando con el servidor");
  }
}

window.login = login;

function logout(registrarFin = true){
  if(registrarFin && (rol === "mesero" || rol === "barra")) fetch("/usuarios/mi-estado", { method:"POST", headers:{ "Content-Type":"application/json", "Authorization":token }, body:JSON.stringify({ estado:"fin_turno" }) });
  socket.disconnect();
  socket.auth = { token: "" };
  token = "";
  rol = "";
  username = "";
  pedidoActual = [];
  productoSeleccionado = null;
  document.getElementById("app").hidden = true;
  document.getElementById("loginDiv").hidden = false;
  document.getElementById("pass").value = "";
  document.getElementById("contenido").replaceChildren();
  document.getElementById("tabs").replaceChildren();
}

window.logout = logout;

function mostrarControlEstado(){
  const info = document.getElementById("info");
  const control = document.createElement("span");
  control.id = "controlEstado";
  control.innerHTML = " Estado: <select onchange='cambiarMiEstado(this.value)'><option value='activo'>Activo</option><option value='descanso'>Descanso</option><option value='servicios_higienicos'>Servicios higiénicos</option><option value='almuerzo'>Almuerzo</option><option value='reunion'>Reunión</option><option value='otro'>Otro</option><option value='fin_turno'>Fin de turno</option></select>";
  info.appendChild(control);
}

async function cambiarMiEstado(estado){
  const res = await fetch("/usuarios/mi-estado", { method:"POST", headers:{ "Content-Type":"application/json", "Authorization":token }, body:JSON.stringify({ estado }) });
  const data = await res.json();
  if(data.error) alert(data.error);
  if(estado === "fin_turno" && !data.error) logout(false);
}
window.cambiarMiEstado = cambiarMiEstado;
