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
    if (desde) filtro.fecha = { $gte: INICIO_LIMA(desde), $lt: new Date(INICIO_LIMA(hasta).getTime() + 86400000) };
    const encontrados = await Documento.find(filtro).sort({ fecha: -1, createdAt: -1 }).limit(1000).select("-archivo.datos");
    const documentos = encontrados.map(item => { const row = item.toObject(); if (row.archivo) delete row.archivo.datos; return row; });
    return res.json(documentos);
  });

  router.post("/", async (req, res) => {
    const { tipo, fecha, concepto, monto, metodoPago = "otro", proveedor = "", categoria = "", observaciones = "", serie = "", numero = "", ruc = "" } = req.body || {};
    if (!TIPOS.includes(tipo)) return res.status(400).json({ error: "Selecciona un tipo de registro válido" });
    if (!fechaValida(fecha)) return res.status(400).json({ error: "Indica una fecha válida" });
    if (typeof concepto !== "string" || !concepto.trim() || concepto.trim().length > 300) return res.status(400).json({ error: "El concepto es obligatorio (máximo 300 caracteres)" });
    if (monto !== "" && monto !== null && monto !== undefined && toCents(monto) === null) return res.status(400).json({ error: "El monto debe tener hasta dos decimales" });
    if (!new Set(["efectivo", "yape", "transferencia", "tarjeta", "otro"]).has(metodoPago)) return res.status(400).json({ error: "Método de pago inválido" });
    for (const [valor, maximo, etiqueta] of [[proveedor, 160, "Proveedor"], [categoria, 80, "Categoría"], [observaciones, 1000, "Observaciones"], [serie, 40, "Serie"], [numero, 60, "Número"], [ruc, 20, "RUC"]]) {
      if (typeof valor !== "string" || valor.length > maximo) return res.status(400).json({ error: `${etiqueta} inválido` });
    }
    const documento = await Documento.create({ tipo, fecha: new Date(`${fecha}T12:00:00-05:00`), concepto: concepto.trim(), monto: monto === "" || monto === null || monto === undefined ? undefined : toCents(monto) / 100, metodoPago, proveedor: proveedor.trim(), categoria: categoria.trim(), observaciones: observaciones.trim(), serie: serie.trim(), numero: numero.trim(), ruc: ruc.trim(), origen: "historial", registradoPor: req.user.username });
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
