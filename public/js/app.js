const socket = io();

let token = "";
let rol = "";
let username = "";

let pedidoActual = [];
let productoSeleccionado = null;

let sonidoActivo = false;

let audio = new Audio(
  "https://www.soundjay.com/buttons/sounds/button-3.mp3"
);

let pedidosPrevios = [];
let notificaciones = [];
let productosCache = [];

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
