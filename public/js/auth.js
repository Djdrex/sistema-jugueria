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

    console.log("RESPUESTA LOGIN:", data);
    console.log("ROL recibido:", data.rol);
    if(data.token){
      token=data.token;
      rol=data.rol;
      username=data.username;

      document.getElementById("loginDiv").style.display="none";
      document.getElementById("app").style.display="block";
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