const ExcelJS = require("exceljs");

const MONEY_FORMAT = '"S/ "#,##0.00';
const safe = value => {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value;
  if (Buffer.isBuffer(value)) return "";
  if (Array.isArray(value)) return value.map(safe).join(" | ");
  if (typeof value === "object") {
    if (value._bsontype === "ObjectId") return String(value);
    if (value._bsontype === "Decimal128") return Number(value.toString());
    return JSON.stringify(value, (_key, nested) => Buffer.isBuffer(nested) ? undefined : nested);
  }
  return value;
};
const dateValue = value => value ? (value instanceof Date ? value : new Date(value)) : "";

function addTable(workbook, name, columns, rows, moneyColumns = []) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns.map(column => ({ header: column.header, key: column.key, width: column.width || 20 }));
  sheet.addRows(rows);
  sheet.getRow(1).height = 26;
  sheet.getRow(1).eachCell(cell => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123F47" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  for (const column of moneyColumns) sheet.getColumn(column).numFmt = MONEY_FORMAT;
  sheet.eachRow((row, index) => { if (index > 1 && index % 2 === 0) row.eachCell(cell => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F7F5" } }; }); });
  return sheet;
}

function addProgress(sheet, row, label, value, max, color = "638C5A") {
  sheet.getCell(`A${row}`).value = label;
  sheet.getCell(`B${row}`).value = value;
  sheet.getCell(`B${row}`).numFmt = MONEY_FORMAT;
  sheet.getCell(`C${row}`).value = max > 0 ? value / max : 0;
  sheet.getCell(`C${row}`).numFmt = "0.0%";
  sheet.getCell(`D${row}`).value = max > 0 ? value / max : 0;
  sheet.getCell(`D${row}`).numFmt = ';;;';
  sheet.getCell(`D${row}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${color}` } };
  sheet.getCell(`D${row}`).alignment = { shrinkToFit: true };
}

async function buildReinicioWorkbook(data, periodo) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistema de juguería";
  workbook.subject = `Informe de cierre ${periodo.etiqueta}`;
  workbook.title = `Informe financiero y operativo ${periodo.etiqueta}`;
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;
  const { pedidos, gastos, pagos, movimientos, asistencias, caja, notificaciones, documentos, cuentas, productos, categorias, adjuntos } = data;
  const totalVentas = pedidos.reduce((sum, p) => sum + Number(p.totalPagado ?? (p.pagado ? p.total : 0) ?? 0), 0);
  const ingresos = documentos.filter(d => d.clase === "ingreso" && d.origen === "historial").reduce((sum, d) => sum + Number(d.monto || 0), 0);
  const totalGastos = gastos.reduce((sum, g) => sum + Number(g.monto || 0), 0);
  const totalPagos = pagos.reduce((sum, p) => sum + Number(p.monto || 0), 0);
  const egresos = totalGastos + totalPagos;
  const neto = totalVentas + ingresos - egresos;
  const max = Math.max(totalVentas, ingresos, egresos, 1);
  const resumen = workbook.addWorksheet("Resumen", { views: [{ showGridLines: false }] });
  resumen.mergeCells("A1:F1"); resumen.getCell("A1").value = `INFORME FINANCIERO Y OPERATIVO · ${periodo.etiqueta.toUpperCase()}`;
  resumen.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
  resumen.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123F47" } };
  resumen.getCell("A1").alignment = { vertical: "middle", horizontal: "center" }; resumen.getRow(1).height = 36;
  resumen.mergeCells("A2:F2"); resumen.getCell("A2").value = `Periodo: ${periodo.desde} al ${periodo.hasta} · Generado: ${new Date().toLocaleString("es-PE", { timeZone: "America/Lima" })} · Moneda: PEN`;
  const tiles = [["A4:B4", "VENTAS COBRADAS", totalVentas], ["C4:D4", "OTROS INGRESOS", ingresos], ["E4:F4", "EGRESOS", egresos], ["A7:B7", "RESULTADO NETO", neto], ["C7:D7", "PEDIDOS", pedidos.length], ["E7:F7", "GASTOS REGISTRADOS", gastos.length]];
  for (const [range, label, value] of tiles) {
    resumen.mergeCells(range); const cell = resumen.getCell(range.split(":")[0]); cell.value = label; cell.font = { bold: true, color: { argb: "FF123F47" } }; cell.alignment = { horizontal: "center" };
    const row = Number(range.match(/\d+/)[0]) + 1; const cols = range.match(/[A-F]/g); resumen.mergeCells(`${cols[0]}${row}:${cols[1]}${row}`); const amount = resumen.getCell(`${cols[0]}${row}`); amount.value = value; amount.numFmt = typeof value === "number" && !Number.isInteger(value) ? MONEY_FORMAT : "#,##0"; amount.font = { bold: true, size: 16, color: { argb: "FF1D564B" } }; amount.alignment = { horizontal: "center" };
  }
  resumen.getCell("A10").value = "Indicador"; resumen.getCell("B10").value = "Monto"; resumen.getCell("C10").value = "% del valor mayor"; resumen.getCell("D10").value = "Barra comparativa";
  resumen.getRow(10).eachCell(cell => { cell.font = { bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123F47" } }; });
  addProgress(resumen, 11, "Ventas cobradas", totalVentas, max, "34897A"); addProgress(resumen, 12, "Otros ingresos", ingresos, max, "4F9A78"); addProgress(resumen, 13, "Egresos", egresos, max, "CB7856");
  resumen.getColumn(1).width = 24; resumen.getColumn(2).width = 18; resumen.getColumn(3).width = 23; resumen.getColumn(4).width = 42; resumen.getColumn(5).width = 18; resumen.getColumn(6).width = 18;
  resumen.getCell("A15").value = "Criterio de cálculo"; resumen.getCell("A15").font = { bold: true };
  resumen.mergeCells("A16:F17"); resumen.getCell("A16").value = "El resultado neto resta gastos y pagos de personal a ventas cobradas y otros ingresos registrados manualmente. El inventario actual y las cuentas de servicio se presentan como fotografía del momento de exportación. Los documentos con archivo adjunto se incluyen en la hoja AdjuntosBase64, divididos en bloques para respetar el límite de Excel."; resumen.getCell("A16").alignment = { wrapText: true, vertical: "top" };
  resumen.getRow(16).height = 32; resumen.getRow(17).height = 26;
  const salesByMethod = new Map();
  for (const order of pedidos) for (const payment of order.pagos || []) salesByMethod.set(payment.metodo || "otro", (salesByMethod.get(payment.metodo || "otro") || 0) + Number(payment.monto || 0));
  const chartData = [...salesByMethod].map(([metodo, monto]) => ({ metodo, monto }));
  if (chartData.length) {
    const chartSheet = workbook.addWorksheet("Tendencias"); chartSheet.addRows([["Método de pago", "Ventas"], ...chartData.map(row => [row.metodo, row.monto])]);
    chartSheet.getRow(1).font = { bold: true };
    const chart = (type, title, extra) => ({
      type, title, ...extra,
      series: [{ name: { formula: `Tendencias!$B$1` }, labels: { formula: `Tendencias!$A$2:$A$${chartData.length + 1}` }, values: { formula: `Tendencias!$B$2:$B$${chartData.length + 1}` } }],
    });
    chartSheet.addChart(chart("doughnut", "Ventas por método de pago", { holeSize: 55, showPercent: true }), "D2");
    chartSheet.addChart(chart("bar", "Ventas por método de pago", { barDir: "bar", catAxisLabelPos: "low", valAxisLabelFormatCode: '"S/ "#,##0', showValue: true }), "D20");
  }
  const orderRows = pedidos.map(p => ({ fecha: dateValue(p.fecha), mesa: p.mesa, estado: p.estado, creadoPor: p.creadoPor, total: Number(p.total || 0), totalPagado: Number(p.totalPagado || 0), saldo: Math.max(0, Number(p.total || 0) - Number(p.totalPagado || 0)), pagado: p.pagado, metodos: [...new Set((p.pagos || []).map(x => x.metodo))].join(", "), pagos: safe(p.pagos), detalle: safe(p.items) }));
  addTable(workbook, "Pedidos", [{header:"Fecha",key:"fecha",width:22},{header:"Mesa",key:"mesa"},{header:"Estado",key:"estado"},{header:"Registrado por",key:"creadoPor"},{header:"Total",key:"total"},{header:"Cobrado",key:"totalPagado"},{header:"Saldo",key:"saldo"},{header:"Pagado",key:"pagado"},{header:"Métodos",key:"metodos"},{header:"Detalle de pagos",key:"pagos",width:45},{header:"Productos y notas",key:"detalle",width:60}], orderRows, [5,6,7]);
  addTable(workbook, "Gastos", [{header:"Fecha",key:"fecha"},{header:"Tipo",key:"tipo"},{header:"Categoría",key:"categoria"},{header:"Descripción",key:"descripcion",width:42},{header:"Monto",key:"monto"},{header:"Método",key:"metodoPago"},{header:"Proveedor",key:"proveedor"},{header:"Registrado por",key:"registradoPor"},{header:"Cuenta",key:"cuentaId"}], gastos.map(g=>({ ...g, fecha:dateValue(g.fecha) })), [5]);
  addTable(workbook, "PagosPersonal", [{header:"Fecha",key:"fecha"},{header:"Trabajador",key:"trabajador"},{header:"Monto",key:"monto"},{header:"Método",key:"metodoPago"},{header:"Nota",key:"nota",width:35},{header:"Registrado por",key:"registradoPor"},{header:"Autorizado por",key:"autorizadoPor"},{header:"Asistencia",key:"asistencia"}], pagos.map(p=>({ ...p, fecha:dateValue(p.fecha) })), [3]);
  addTable(workbook, "InventarioMov", [{header:"Fecha",key:"fecha"},{header:"Producto",key:"nombreProducto"},{header:"Cambio",key:"cambio"},{header:"Saldo",key:"saldo"},{header:"Tipo",key:"tipo"},{header:"Motivo",key:"motivo",width:38},{header:"Usuario",key:"usuario"}], movimientos.map(m=>({ ...m, fecha:dateValue(m.fecha) })));
  addTable(workbook, "Asistencias", [{header:"Fecha",key:"fecha"},{header:"Trabajador",key:"trabajador"},{header:"Estado",key:"estado"},{header:"Entrada",key:"entrada"},{header:"Salida",key:"salida"},{header:"Min. tardanza",key:"minutosTardanza"},{header:"Pago diario",key:"pagoDiario"},{header:"Observaciones",key:"observaciones",width:38},{header:"Registrado por",key:"registradoPor"}], asistencias.map(a=>({ ...a, entrada:dateValue(a.entrada), salida:dateValue(a.salida) })), [7]);
  addTable(workbook, "Caja", [{header:"Fecha",key:"fecha"},{header:"Fecha operativa",key:"fechaOperativa"},{header:"Ventas",key:"totalVentas"},{header:"Cantidad pedidos",key:"cantidadPedidos"},{header:"Cerrado por",key:"cerradoPor"}], caja.map(c=>({ ...c, fecha:dateValue(c.fecha) })), [3]);
  addTable(workbook, "Notificaciones", [{header:"Fecha",key:"fecha"},{header:"Usuario",key:"usuario"},{header:"Rol",key:"rol"},{header:"Mensaje",key:"mensaje",width:65},{header:"Leído",key:"leido"}], notificaciones.map(n=>({ ...n, fecha:dateValue(n.fecha) })));
  addTable(workbook, "Documentos", [{header:"Fecha",key:"fecha"},{header:"Clase",key:"clase"},{header:"Tipo",key:"tipo"},{header:"Concepto",key:"concepto",width:38},{header:"Monto",key:"monto"},{header:"Proveedor",key:"proveedor"},{header:"Categoría",key:"categoria"},{header:"Método",key:"metodoPago"},{header:"Serie",key:"serie"},{header:"Número",key:"numero"},{header:"RUC",key:"ruc"},{header:"Observaciones",key:"observaciones",width:40},{header:"Origen",key:"origen"},{header:"Registrado por",key:"registradoPor"},{header:"Archivo",key:"archivo"}], documentos.map(d=>({ ...d, fecha:dateValue(d.fecha), archivo:d.archivo ? `${d.archivo.nombre} (${d.archivo.tamano} bytes)` : "" })), [5]);
  addTable(workbook, "CuentasServicio", [{header:"Nombre",key:"nombre"},{header:"Categoría",key:"categoria"},{header:"Monto estimado",key:"montoEstimado"},{header:"Periodicidad",key:"periodicidad"},{header:"Día vencimiento",key:"diaVencimiento"},{header:"Proveedor",key:"proveedor"},{header:"Activa",key:"activa"},{header:"Fecha último pago",key:"fechaUltimoPago"},{header:"Monto último pago",key:"montoUltimoPago"},{header:"Observaciones",key:"observaciones",width:40}], cuentas.map(c=>({ ...c, fechaUltimoPago:dateValue(c.ultimoPago), montoUltimoPago:c.ultimoPagoMonto ?? "" })), [3,9]);
  addTable(workbook, "InventarioActual", [{header:"Nombre",key:"nombre"},{header:"Tipo",key:"tipo"},{header:"Categoría",key:"categoria"},{header:"Precio",key:"precio"},{header:"Costo",key:"costo"},{header:"Stock",key:"stock"},{header:"Stock mínimo",key:"stockMinimo"},{header:"Unidad",key:"unidad"},{header:"Activo",key:"activo"},{header:"Receta",key:"receta",width:40}], productos.map(p=>({ ...p, receta:safe(p.receta) })), [4,5]);
  addTable(workbook, "Categorias", [{header:"Nombre",key:"nombre"},{header:"Descripción",key:"descripcion",width:45},{header:"Activa",key:"activo"}], categorias);
  const attachmentRows = [];
  for (const item of adjuntos) {
    const encoded = item.datos.toString("base64");
    for (let offset = 0, part = 1; offset < encoded.length; offset += 30000, part++) attachmentRows.push({ documentoId:item.documentoId, nombre:item.nombre, mime:item.mime, tamano:item.tamano, parte:part, contenido:encoded.slice(offset, offset + 30000) });
  }
  addTable(workbook, "AdjuntosBase64", [{header:"ID documento",key:"documentoId",width:28},{header:"Nombre archivo",key:"nombre",width:32},{header:"Tipo MIME",key:"mime",width:58},{header:"Tamaño bytes",key:"tamano"},{header:"Parte",key:"parte"},{header:"Base64 (unir por ID y parte)",key:"contenido",width:55}], attachmentRows);
  const objects = [pedidos,gastos,pagos,movimientos,asistencias,caja,notificaciones,documentos,cuentas,productos,categorias];
  const collectionNames = ["Pedidos", "Gastos", "Pagos personal", "Movimientos inventario", "Asistencias", "Cierres de caja", "Notificaciones", "Documentos financieros", "Cuentas de servicio", "Productos e insumos", "Categorías"];
  const index = workbook.addWorksheet("Alcance"); index.addRow(["Colección", "Registros incluidos"]); collectionNames.forEach((name, i)=>index.addRow([name,objects[i].length])); index.addRow(["Archivos adjuntos", adjuntos.length]); index.addRow(["Bloques Base64", attachmentRows.length]);
  index.getRow(1).font = { bold:true,color:{argb:"FFFFFFFF"} }; index.getRow(1).fill = { type:"pattern",pattern:"solid",fgColor:{argb:"FF123F47"} }; index.columns = [{width:32},{width:20}];
  return workbook.xlsx.writeBuffer();
}

module.exports = { buildReinicioWorkbook, safe };
