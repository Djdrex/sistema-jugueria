const express = require("express");
const Documento = require("../models/Documento");
const Actividad = require("../models/Actividad");
const { auth, soloAdmin } = require("../middlewares/auth");
const { fechaValida } = require("../services/gastoValidation");
const { toCents } = require("../services/money");

const TIPOS = ["boleta", "factura", "recibo", "compra", "servicio", "yape", "gasto", "pago", "otro"];
const INICIO_LIMA = value => new Date(`${value}T00:00:00-05:00`);
const MAX_ARCHIVO = 8 * 1024 * 1024;
const MIME_PERMITIDOS = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]);
const EXTENSION_MIME = { ".pdf": "application/pdf", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".xls": "application/vnd.ms-excel", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
const MIME_EXTENSION = Object.fromEntries(Object.entries(EXTENSION_MIME).map(([extension, mime]) => [mime, extension]));

module.exports = () => {
  const router = express.Router();
  router.use(auth, soloAdmin);

  router.get("/", async (req, res) => {
    const { desde, hasta, tipo } = req.query;
    if (Boolean(desde) !== Boolean(hasta) || desde && (!fechaValida(desde) || !fechaValida(hasta) || desde > hasta)) return res.status(400).json({ error: "Rango de fechas inválido" });
    if (tipo && !TIPOS.includes(tipo)) return res.status(400).json({ error: "Tipo inválido" });
    const filtro = {};
    if (tipo) filtro.tipo = tipo;
    if (req.query.clase && !["ingreso", "egreso"].includes(req.query.clase)) return res.status(400).json({ error: "Clase de movimiento inválida" });
    if (req.query.clase) filtro.clase = req.query.clase;
    if (desde) filtro.fecha = { $gte: INICIO_LIMA(desde), $lt: new Date(INICIO_LIMA(hasta).getTime() + 86400000) };
    const encontrados = await Documento.find(filtro).sort({ fecha: -1, createdAt: -1 }).limit(1000).select("-archivo.datos");
    const documentos = encontrados.map(item => { const row = item.toObject(); if (row.archivo) delete row.archivo.datos; return row; });
    return res.json(documentos);
  });

  router.post("/", async (req, res) => {
    const { tipo, clase = "ingreso", fecha, concepto, monto, metodoPago = "otro", proveedor = "", categoria = "", observaciones = "", serie = "", numero = "", ruc = "", cuentaId } = req.body || {};
    if (!TIPOS.includes(tipo)) return res.status(400).json({ error: "Selecciona un tipo de registro válido" });
    if (!["ingreso", "egreso"].includes(clase)) return res.status(400).json({ error: "Selecciona ingreso o egreso" });
    if (!fechaValida(fecha)) return res.status(400).json({ error: "Indica una fecha válida" });
    if (typeof concepto !== "string" || !concepto.trim() || concepto.trim().length > 300) return res.status(400).json({ error: "El concepto es obligatorio (máximo 300 caracteres)" });
    if (monto !== "" && monto !== null && monto !== undefined && toCents(monto) === null) return res.status(400).json({ error: "El monto debe tener hasta dos decimales" });
    if (!new Set(["efectivo", "yape", "transferencia", "tarjeta", "otro"]).has(metodoPago)) return res.status(400).json({ error: "Método de pago inválido" });
    for (const [valor, maximo, etiqueta] of [[proveedor, 160, "Proveedor"], [categoria, 80, "Categoría"], [observaciones, 1000, "Observaciones"], [serie, 40, "Serie"], [numero, 60, "Número"], [ruc, 20, "RUC"]]) {
      if (typeof valor !== "string" || valor.length > maximo) return res.status(400).json({ error: `${etiqueta} inválido` });
    }
    const documento = await Documento.create({ tipo, clase, fecha: new Date(`${fecha}T12:00:00-05:00`), concepto: concepto.trim(), monto: monto === "" || monto === null || monto === undefined ? undefined : toCents(monto) / 100, metodoPago, proveedor: proveedor.trim(), categoria: categoria.trim(), observaciones: observaciones.trim(), serie: serie.trim(), numero: numero.trim(), ruc: ruc.trim(), origen: "historial", referencia: cuentaId || undefined, registradoPor: req.user.username });
    await Actividad.create({ usuario: req.user.username, accion: "HISTORIAL_FINANCIERO_REGISTRADO", detalle: `Registró ${tipo}: ${concepto.trim()}` });
    return res.status(201).json(documento);
  });

  router.post("/:id/archivo", async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ error: "Identificador inválido" });
    const { nombre, tipoMime, contenido } = req.body || {};
    if (typeof nombre !== "string" || !nombre.trim() || nombre.length > 180 || /[\\/\r\n]/.test(nombre)) return res.status(400).json({ error: "Nombre de archivo inválido" });
    if (typeof contenido !== "string" || !/^data:[^;,]+;base64,[A-Za-z\d+/]+=*$/.test(contenido)) return res.status(400).json({ error: "Archivo inválido" });
    const match = contenido.match(/^data:([^;,]+);base64,(.*)$/);
    const ext = nombre.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
    if (!MIME_PERMITIDOS.has(tipoMime) || match[1] !== tipoMime || EXTENSION_MIME[ext] !== tipoMime) return res.status(400).json({ error: "Solo se aceptan imágenes, PDF, Word o Excel con extensión y formato coincidentes" });
    const datos = Buffer.from(match[2], "base64");
    if (!datos.length || datos.length > MAX_ARCHIVO || datos.toString("base64") !== match[2]) return res.status(400).json({ error: "El archivo supera 8 MB o está dañado" });
    const firmaPdf = datos.subarray(0, 5).toString() === "%PDF-";
    const firmaJpeg = datos[0] === 0xff && datos[1] === 0xd8 && datos[2] === 0xff;
    const firmaPng = datos.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const firmaWebp = datos.length > 12 && datos.subarray(0, 4).toString() === "RIFF" && datos.subarray(8, 12).toString() === "WEBP";
    const firmaZip = datos.subarray(0, 2).toString() === "PK";
    const firmaOle = datos.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    const firmaValida = tipoMime === "application/pdf" ? firmaPdf : tipoMime === "image/jpeg" ? firmaJpeg : tipoMime === "image/png" ? firmaPng : tipoMime === "image/webp" ? firmaWebp : tipoMime.endsWith("openxmlformats-officedocument.wordprocessingml.document") || tipoMime.endsWith("openxmlformats-officedocument.spreadsheetml.sheet") ? firmaZip : firmaOle;
    if (!firmaValida) return res.status(400).json({ error: "El contenido no coincide con el formato del archivo" });
    const documento = await Documento.findById(req.params.id);
    if (!documento) return res.sendStatus(404);
    documento.archivo = { datos, nombre: nombre.trim(), tipoMime, tamano: datos.length };
    await documento.save();
    await Actividad.create({ usuario: req.user.username, accion: "ARCHIVO_HISTORIAL_CARGADO", detalle: `Adjuntó ${nombre.trim()} a ${documento.tipo}` });
    return res.json({ ok: true, nombre: documento.archivo.nombre, tamano: documento.archivo.tamano });
  });

  router.get("/cuentas", async (_req, res) => {
    const cuentas = await require("mongoose").connection.collection("cuentasServicio").find().sort({ activa: -1, nombre: 1 }).limit(500).toArray();
    return res.json(cuentas);
  });

  router.post("/cuentas", async (req, res) => {
    const { nombre, categoria, montoEstimado, periodicidad = "mensual", diaVencimiento, proveedor = "", observaciones = "" } = req.body || {};
    const montoCentavos = toCents(montoEstimado);
    if (typeof nombre !== "string" || !nombre.trim() || nombre.trim().length > 120) return res.status(400).json({ error: "Indica el nombre del servicio o cuenta" });
    if (typeof categoria !== "string" || !["sunat", "alquiler", "seguridad", "luz", "agua", "gas", "internet", "telefono", "otro"].includes(categoria)) return res.status(400).json({ error: "Selecciona una categoría de cuenta" });
    if (montoCentavos === null || montoCentavos <= 0) return res.status(400).json({ error: "El monto estimado debe ser positivo" });
    if (!["mensual", "semanal", "anual", "unico"].includes(periodicidad)) return res.status(400).json({ error: "Periodicidad inválida" });
    if (!Number.isInteger(diaVencimiento) || diaVencimiento < 1 || diaVencimiento > 31) return res.status(400).json({ error: "El día de vencimiento debe estar entre 1 y 31" });
    if (typeof proveedor !== "string" || proveedor.length > 160 || typeof observaciones !== "string" || observaciones.length > 500) return res.status(400).json({ error: "Proveedor u observaciones inválidos" });
    const row = { nombre: nombre.trim(), categoria, montoEstimado: montoCentavos / 100, periodicidad, diaVencimiento, proveedor: proveedor.trim(), observaciones: observaciones.trim(), activa: true, creadoPor: req.user.username, creadoEn: new Date() };
    const result = await require("mongoose").connection.collection("cuentasServicio").insertOne(row);
    await Actividad.create({ usuario: req.user.username, accion: "CUENTA_SERVICIO_CREADA", detalle: `Creó cuenta de servicio ${row.nombre}` });
    return res.status(201).json({ ...row, _id: result.insertedId });
  });

  router.put("/cuentas/:id", async (req, res) => {
    const mongoose = require("mongoose");
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: "Identificador de cuenta inválido" });
    if (typeof req.body.activa !== "boolean") return res.status(400).json({ error: "Indica si la cuenta queda activa" });
    const result = await mongoose.connection.collection("cuentasServicio").findOneAndUpdate({ _id: new mongoose.Types.ObjectId(req.params.id) }, { $set: { activa: req.body.activa, actualizadoPor: req.user.username, actualizadoEn: new Date() } }, { returnDocument: "after" });
    if (!result) return res.sendStatus(404);
    return res.json(result);
  });

  router.get("/:id/archivo", async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ error: "Identificador inválido" });
    const documento = await Documento.findById(req.params.id).select("+archivo.datos archivo.nombre archivo.tipoMime archivo.tamano");
    if (!documento?.archivo?.datos) return res.sendStatus(404);
    const nombre = documento.archivo.nombre.replace(/[\r\n"\\]/g, "_");
    res.set({ "Content-Type": documento.archivo.tipoMime, "Content-Length": documento.archivo.tamano, "Content-Disposition": `inline; filename="archivo${MIME_EXTENSION[documento.archivo.tipoMime] || ""}"; filename*=UTF-8''${encodeURIComponent(nombre)}`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" });
    return res.send(documento.archivo.datos);
  });

  return router;
};
