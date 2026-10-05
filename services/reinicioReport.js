const ExcelJS = require("exceljs");

const MONEY_FORMAT = '"S/ "#,##0.00';
const text = value => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value;
  if (Buffer.isBuffer(value)) return "";
  if (Array.isArray(value)) return value.map(text).join(" | ");
  if (typeof value === "object") return value._bsontype === "ObjectId" ? String(value) : JSON.stringify(value);
  return value;
};
const date = value => value ? (value instanceof Date ? value : new Date(value)) : "";

function addSection(workbook, name, title, headers, rows, widths = []) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 3 }] });
  const endColumn = String.fromCharCode(64 + headers.length);
  sheet.mergeCells(`A1:${endColumn}1`);
  sheet.getCell("A1").value = title.toUpperCase();
  sheet.getCell("A1").font = { bold: true, size: 15, color: { argb: "FFFFFFFF" } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123F47" } };
  sheet.getCell("A1").alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 30;
  sheet.mergeCells(`A2:${endColumn}2`);
  sheet.getCell("A2").value = "Registros ordenados por fecha. Usa los filtros de la fila 3 para consultar cada columna.";
  sheet.getCell("A2").font = { italic: true, color: { argb: "FF52666A" } };
  sheet.addRow(headers);
  const header = sheet.getRow(3);
  header.height = 25;
  header.eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF24736B" } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  for (const row of rows) sheet.addRow(row);
  sheet.autoFilter = { from: { row: 3, column: 1 }, to: { row: Math.max(3, rows.length + 3), column: headers.length } };
  sheet.columns = headers.map((_, index) => ({ width: widths[index] || 20 }));
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 3) {
      row.height = 21;
      if (rowNumber % 2 === 0) row.eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F6F4" } }; });
    }
  });
  return sheet;
}

function progress(value, max, length = 22) {
  const filled = max > 0 ? Math.round(Math.min(1, Math.max(0, value / max)) * length) : 0;
  return `${"#".repeat(filled)}${"-".repeat(length - filled)}`;
}

async function buildReinicioWorkbook(data, periodo) {
  const { pedidos = [], gastos = [], pagos = [], movimientos = [], asistencias = [], caja = [], notificaciones = [], documentos = [], cuentas = [], productos = [], categorias = [] } = data;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistema de juguería";
  workbook.subject = `Informe ${periodo.etiqueta}`;
  workbook.title = `Cierre ${periodo.tipo} ${periodo.etiqueta}`;
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const ventas = pedidos.reduce((sum, row) => sum + Number(row.totalPagado ?? (row.pagado ? row.total : 0) ?? 0), 0);
  const ingresos = documentos.filter(row => row.clase === "ingreso" && row.origen === "historial").reduce((sum, row) => sum + Number(row.monto || 0), 0);
  const egresosGastos = gastos.reduce((sum, row) => sum + Number(row.monto || 0), 0);
  const egresosPersonal = pagos.reduce((sum, row) => sum + Number(row.monto || 0), 0);
  const egresos = egresosGastos + egresosPersonal;
  const max = Math.max(ventas, ingresos, egresos, 1);

  const summary = workbook.addWorksheet("Resumen", { views: [{ showGridLines: false }] });
  summary.mergeCells("A1:F1"); summary.getCell("A1").value = `INFORME DE CIERRE ${periodo.etiqueta}`;
  summary.getCell("A1").font = { bold: true, size: 17, color: { argb: "FFFFFFFF" } };
  summary.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123F47" } };
  summary.getCell("A1").alignment = { horizontal: "center", vertical: "middle" }; summary.getRow(1).height = 38;
  summary.mergeCells("A2:F2"); summary.getCell("A2").value = `Periodo: ${periodo.desde} al ${periodo.hasta}  |  Generado: ${new Date().toLocaleString("es-PE", { timeZone: "America/Lima" })}  |  Moneda: PEN`;
  summary.getCell("A2").alignment = { horizontal: "center" };
  const cards = [["A4:B4", "VENTAS COBRADAS", ventas], ["C4:D4", "OTROS INGRESOS", ingresos], ["E4:F4", "EGRESOS", egresos], ["A7:B7", "RESULTADO NETO", ventas + ingresos - egresos], ["C7:D7", "PEDIDOS", pedidos.length], ["E7:F7", "GASTOS", gastos.length]];
  for (const [range, label, amount] of cards) {
    const [start, end] = range.split(":"); summary.mergeCells(range); const labelCell = summary.getCell(start); labelCell.value = label; labelCell.font = { bold: true, color: { argb: "FF123F47" } }; labelCell.alignment = { horizontal: "center" };
    const row = Number(start.match(/\d+/)[0]) + 1, first = start.match(/[A-F]/)[0], last = end.match(/[A-F]/)[0]; summary.mergeCells(`${first}${row}:${last}${row}`); const valueCell = summary.getCell(`${first}${row}`); valueCell.value = amount; valueCell.numFmt = typeof amount === "number" && !Number.isInteger(amount) ? MONEY_FORMAT : "#,##0"; valueCell.font = { bold: true, size: 16, color: { argb: "FF24736B" } }; valueCell.alignment = { horizontal: "center" };
  }
  summary.addRow([]); summary.addRow(["INDICADOR", "MONTO", "PARTICIPACIÓN", "BARRA VISUAL"]);
  const header = summary.getRow(10); header.eachCell(cell => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF24736B" } }; });
  [["Ventas cobradas", ventas], ["Otros ingresos", ingresos], ["Egresos", egresos], ["Gastos", egresosGastos], ["Pagos de personal", egresosPersonal]].forEach(([label, value]) => {
    const row = summary.addRow([label, value, max ? value / max : 0, progress(value, max)]); row.getCell(2).numFmt = MONEY_FORMAT; row.getCell(3).numFmt = "0.0%"; row.getCell(4).font = { name: "Consolas", bold: true, color: { argb: "FF24736B" } };
  });
  summary.columns = [{ width: 25 }, { width: 19 }, { width: 21 }, { width: 28 }, { width: 20 }, { width: 20 }];
  summary.mergeCells("A18:F18"); summary.getCell("A18").value = "El archivo se genera para descarga local. Las hojas siguientes contienen el detalle del periodo y los registros generales seleccionados."; summary.getCell("A18").alignment = { wrapText: true };

  addSection(workbook, "Pedidos", "Pedidos y ventas", ["Fecha", "Mesa", "Estado", "Atendido por", "Total", "Cobrado", "Saldo", "Pagado", "Métodos", "Detalle de pagos", "Productos y notas"], pedidos.map(row => [date(row.fecha), row.mesa, row.estado, row.creadoPor, Number(row.total || 0), Number(row.totalPagado || 0), Math.max(0, Number(row.total || 0) - Number(row.totalPagado || 0)), row.pagado, [...new Set((row.pagos || []).map(payment => payment.metodo))].join(", "), text(row.pagos), text(row.items)]), [22, 12, 16, 20, 15, 15, 15, 12, 18, 42, 55]);
  addSection(workbook, "Gastos", "Gastos y compras", ["Fecha", "Tipo", "Categoría", "Descripción", "Monto", "Método", "Proveedor", "Registrado por"], gastos.map(row => [date(row.fecha), row.tipo, row.categoria, row.descripcion, Number(row.monto || 0), row.metodoPago, row.proveedor, row.registradoPor]), [22, 15, 20, 42, 15, 18, 24, 20]);
  addSection(workbook, "Ingresos", "Otros ingresos y documentos", ["Fecha", "Clase", "Tipo", "Concepto", "Monto", "Proveedor", "Método", "Serie", "Número", "RUC", "Archivo adjunto", "Registrado por"], documentos.map(row => [date(row.fecha), row.clase, row.tipo, row.concepto, Number(row.monto || 0), row.proveedor, row.metodoPago, row.serie, row.numero, row.ruc, row.archivo?.nombre || "", row.registradoPor]), [22, 14, 15, 38, 15, 24, 18, 14, 16, 16, 30, 20]);
  addSection(workbook, "PagosPersonal", "Pagos de personal", ["Fecha", "Trabajador", "Monto", "Método", "Nota", "Registrado por", "Autorizado por"], pagos.map(row => [date(row.fecha), text(row.trabajador), Number(row.monto || 0), row.metodoPago, row.nota, row.registradoPor, row.autorizadoPor]), [22, 28, 15, 18, 40, 22, 22]);
  addSection(workbook, "Inventario", "Movimientos de inventario", ["Fecha", "Producto", "Cambio", "Saldo", "Tipo", "Motivo", "Usuario"], movimientos.map(row => [date(row.fecha), row.nombreProducto, row.cambio, row.saldo, row.tipo, row.motivo, row.usuario]), [22, 32, 14, 14, 16, 42, 22]);
  addSection(workbook, "Asistencias", "Asistencias", ["Fecha", "Trabajador", "Estado", "Entrada", "Salida", "Minutos tardanza", "Pago diario", "Observaciones", "Registrado por"], asistencias.map(row => [row.fecha, text(row.trabajador), row.estado, date(row.entrada), date(row.salida), row.minutosTardanza, Number(row.pagoDiario || 0), row.observaciones, row.registradoPor]), [16, 28, 17, 22, 22, 18, 15, 40, 22]);
  addSection(workbook, "Caja", "Cierres de caja", ["Fecha", "Fecha operativa", "Ventas", "Cantidad pedidos", "Cerrado por"], caja.map(row => [date(row.fecha), row.fechaOperativa, Number(row.totalVentas || 0), row.cantidadPedidos, row.cerradoPor]), [22, 20, 18, 20, 25]);
  addSection(workbook, "Notificaciones", "Notificaciones del periodo", ["Fecha", "Usuario", "Rol", "Mensaje", "Leído"], notificaciones.map(row => [date(row.fecha), row.usuario, row.rol, row.mensaje, row.leido]), [22, 24, 18, 70, 14]);
  addSection(workbook, "Servicios", "Cuentas y servicios", ["Nombre", "Categoría", "Monto estimado", "Periodicidad", "Día vencimiento", "Proveedor", "Activa", "Último pago", "Monto último pago"], cuentas.map(row => [row.nombre, row.categoria, Number(row.montoEstimado || 0), row.periodicidad, row.diaVencimiento, row.proveedor, row.activa, date(row.ultimoPago), Number(row.ultimoPagoMonto || 0)]), [30, 20, 20, 18, 18, 25, 14, 22, 20]);
  addSection(workbook, "Productos", "Productos e inventario actual", ["Nombre", "Tipo", "Categoría", "Precio", "Costo", "Stock", "Stock mínimo", "Unidad", "Activo", "Receta"], productos.map(row => [row.nombre, row.tipo, row.categoria, Number(row.precio || 0), Number(row.costo || 0), Number(row.stock || 0), Number(row.stockMinimo || 0), row.unidad, row.activo, text(row.receta)]), [32, 16, 22, 15, 15, 15, 18, 16, 14, 45]);
  addSection(workbook, "Categorias", "Categorías", ["Nombre", "Descripción", "Activa"], categorias.map(row => [row.nombre, row.descripcion, row.activo]), [32, 60, 15]);

  for (const sheetName of ["Pedidos", "Gastos", "Ingresos", "PagosPersonal", "Caja", "Servicios", "Productos"]) {
    const sheet = workbook.getWorksheet(sheetName);
    sheet.eachRow((row, index) => { if (index > 3) row.eachCell(cell => { if (typeof cell.value === "number" && /monto|total|cobrado|saldo|ventas/i.test(String(sheet.getRow(3).getCell(cell.col).value))) cell.numFmt = MONEY_FORMAT; }); });
  }
  return workbook.xlsx.writeBuffer();
}

module.exports = { buildReinicioWorkbook, safe: text };
