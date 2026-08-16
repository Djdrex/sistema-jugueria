const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET;

function auth(req, res, next) {

  const authorization = req.headers.authorization;
  const token = authorization && authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : authorization;

  if (!token) {
    return res.status(401).json({ error: "Autenticación requerida" });
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Token inválido o expirado" });
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
