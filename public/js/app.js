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
