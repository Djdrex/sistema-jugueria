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

async function verPerfil(){
  const cont = document.getElementById("contenido");
  cont.innerHTML = `<div class="module-header"><div><p class="eyebrow">Cuenta</p><h2>Mi perfil</h2><p>Consulta tus datos y actualiza tu contraseña.</p></div></div>
    <section class="panel"><div class="summary-grid"><article class="summary-card"><span>Usuario</span><strong>${escapeHtml(username)}</strong></article><article class="summary-card"><span>Rol</span><strong>${escapeHtml(rol)}</strong></article></div></section>
    <section class="panel"><h3>Cambiar contraseña</h3><form id="formMiPassword" class="responsive-form"><label class="field">Contraseña actual<input name="actual" type="password" autocomplete="current-password" required></label><label class="field">Nueva contraseña<input name="nueva" type="password" minlength="8" autocomplete="new-password" required></label><label class="field">Confirmar contraseña<input name="confirmar" type="password" minlength="8" autocomplete="new-password" required></label><div class="field-wide form-actions"><button class="primary-button" type="submit">Actualizar contraseña</button><span id="perfilStatus" role="status"></span></div></form></section>`;
  document.getElementById("formMiPassword").addEventListener("submit", cambiarMiPassword);
}
async function cambiarMiPassword(event){
  event.preventDefault();
  const form = event.currentTarget, data = new FormData(form), status = document.getElementById("perfilStatus");
  if(data.get("nueva") !== data.get("confirmar")){ status.textContent = "La confirmación no coincide."; return; }
  const boton = form.querySelector("button[type=submit]"); boton.disabled = true;
  try {
    const res = await fetch("/usuarios/cambiar-password", { method:"PUT", headers:{ "Content-Type":"application/json", Authorization:token }, body:JSON.stringify({ actual:data.get("actual"), nueva:data.get("nueva") }) });
    const result = await res.json();
    status.textContent = res.ok ? "Contraseña actualizada. Inicia sesión nuevamente para renovar la sesión." : (result.error || "No se pudo actualizar la contraseña.");
    if(res.ok) form.reset();
  } catch { status.textContent = "No se pudo conectar con el servidor."; }
  finally { boton.disabled = false; }
}
window.verPerfil = verPerfil;

async function cambiarMiEstado(estado){
  const res = await fetch("/usuarios/mi-estado", { method:"POST", headers:{ "Content-Type":"application/json", "Authorization":token }, body:JSON.stringify({ estado }) });
  const data = await res.json();
  if(data.error) alert(data.error);
  if(estado === "fin_turno" && !data.error) logout(false);
}
window.cambiarMiEstado = cambiarMiEstado;
