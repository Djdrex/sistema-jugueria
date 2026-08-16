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

      document.getElementById("loginDiv").hidden=true;
      document.getElementById("app").hidden=false;
      document.getElementById("info").innerText=username+" ("+rol+")";

      cargarTabs();
      cargarNotificaciones();
    } else {
      alert("❌ Usuario o contraseña incorrectos");
    }

  } catch(err){
    console.error("ERROR LOGIN:", err);
    alert("❌ Error conectando con el servidor");
  }
}

window.login = login;

function logout(){
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
