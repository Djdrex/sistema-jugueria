const jwt = require("jsonwebtoken");
const Usuario = require("../models/Usuario");

async function auth(req, res, next) {

  const authorization = req.headers.authorization;
  const token = authorization && authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : authorization;

  if (!token || !process.env.JWT_SECRET) {
    return res.status(401).json({ error: "Autenticación requerida" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await Usuario.findById(decoded.id).select("username rol activo");
    if (!usuario || usuario.activo === false) {
      return res.status(403).json({ error: "Esta cuenta está desactivada" });
    }
    // Read current permissions from MongoDB so role changes take effect immediately.
    req.user = { id: String(usuario._id), username: usuario.username, rol: usuario.rol };
    return next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(403).json({ error: "Token inválido o expirado" });
    }
    return next(err);
  }
}

function soloAdmin(req, res, next) {
  if (req.user.rol !== "admin") {
    return res.sendStatus(403);
  }
  next();
}

function soloAdminPrincipal(req, res, next) {
  if (req.user.username !== "admin@titan02") {
    return res.status(403).json({
      error: "Solo admin principal"
    });
  }

  next();
}

function soloBarra(req, res, next) {
  if (
    req.user.rol !== "barra" &&
    req.user.rol !== "admin"
  ) {
    return res.sendStatus(403);
  }

  next();
}

function soloMesero(req, res, next) {
  if (
    req.user.rol !== "mesero" &&
    req.user.rol !== "admin"
  ) {
    return res.sendStatus(403);
  }

  next();
}

module.exports = {
  auth,
  soloAdmin,
  soloAdminPrincipal,
  soloBarra,
  soloMesero
};
