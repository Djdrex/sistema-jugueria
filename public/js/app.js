const socket = io({ autoConnect: false, auth: { token: "" } });

let token = "";
let rol = "";
let username = "";

let pedidoActual = [];
let productoSeleccionado = null;
let pedidoRequestId = null;
let paymentAttemptKey = null;

let sonidoActivo = false;

let audio = new Audio(
  "https://www.soundjay.com/buttons/sounds/button-3.mp3"
);

let pedidosPrevios = [];
let notificaciones = [];
let productosCache = [];

function inicializarTema(){
  const guardado = localStorage.getItem("jugueria-theme");
  const tema = guardado === "light" || guardado === "dark" ? guardado : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = tema;
  actualizarBotonTema();
}
function actualizarBotonTema(){
  const boton = document.getElementById("themeToggle");
  if(!boton) return;
  const oscuro = document.documentElement.dataset.theme === "dark";
  boton.textContent = oscuro ? "Modo claro" : "Modo oscuro";
  boton.setAttribute("aria-pressed", String(oscuro));
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", oscuro ? "#111714" : "#f5f7f5");
}
function alternarTema(){
  const tema = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = tema;
  localStorage.setItem("jugueria-theme", tema);
  actualizarBotonTema();
}
inicializarTema();
window.alternarTema = alternarTema;

function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[char]));
}
window.escapeHtml = escapeHtml;

document.body.addEventListener("click", () => {

  if(!sonidoActivo){

    audio.play()
      .then(()=>{

        audio.pause();
        audio.currentTime = 0;

        sonidoActivo = true;

      })
      .catch(()=>{});

  }

}, { once:true });
