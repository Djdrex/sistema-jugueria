require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const Usuario = require("../models/Usuario");

async function main() {
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!process.env.MONGO_URI || !password || password.length < 12) {
    throw new Error("Configura MONGO_URI y ADMIN_BOOTSTRAP_PASSWORD (mínimo 12 caracteres)");
  }
  await mongoose.connect(process.env.MONGO_URI);
  const username = "admin@titan02";
  if (await Usuario.exists({ username })) {
    console.log("El administrador ya existe; no se modificó ninguna cuenta.");
    return;
  }
  await Usuario.create({ username, password: await bcrypt.hash(password, 12), rol: "admin", activo: true });
  console.log("Administrador inicial creado. Quita ADMIN_BOOTSTRAP_PASSWORD del entorno y cambia la contraseña al iniciar sesión.");
}

main().catch(err => {
  console.error("No se pudo crear el administrador inicial:", err.message);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
