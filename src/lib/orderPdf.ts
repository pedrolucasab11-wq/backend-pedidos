import PDFDocument from "pdfkit";
import { applyCascadeDiscount } from "./discount";

interface OrderItemForPdf {
  quantity: number;
  unitPrice: number;
  discount?: string | null;
  type?: string | null;
  observation?: string | null;
  product: { name: string; code: string };
}

interface OrderForPdf {
  orderNumber: string;
  createdAt: Date;
  buyerName: string;
  buyerPhone?: string | null;
  sellerName?: string | null;
  clientObservation?: string | null;
  paymentMethod: string;
  paymentTerms?: string | null;
  freightType?: string | null;
  description?: string | null;
  items: OrderItemForPdf[];
  seller: { name: string; email: string; phone: string; representation?: string | null };
  factory: { name: string; email: string; phone: string };
  client: {
    companyName: string;
    cnpj: string;
    stateInscr?: string | null;
    email: string;
    phone: string;
    address: string;
  };
}

const fmt = (v: number) => `R$ ${v.toFixed(2)}`;

/**
 * Gera o PDF do pedido em memória (Buffer), reproduzindo o mesmo layout usado
 * na impressão feita pelo navegador (ver pedidos/src/utils/pdfGenerator.ts),
 * para ser anexado ao e-mail enviado ao cliente/fábrica.
 */
export function generateOrderPdfBuffer(order: OrderForPdf): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 36 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;

    // ===== Header: Representação / Vendedor / Fábrica (3 colunas) =====
    const colWidth = pageWidth / 3;
    const headerTop = doc.y;

    const drawHeaderColumn = (x: number, title: string, lines: string[]) => {
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#000").text(title.toUpperCase(), x, headerTop, { width: colWidth - 10 });
      doc.moveTo(x, doc.y + 2).lineTo(x + colWidth - 15, doc.y + 2).strokeColor("#ccc").stroke();
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#000");
      lines.forEach((line, i) => {
        doc.font(i === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(i === 0 ? 9 : 8).fillColor(i === 0 ? "#000" : "#666");
        doc.text(line, x, doc.y, { width: colWidth - 10 });
      });
    };

    let colY = headerTop;
    drawHeaderColumn(left, "Representação", [
      order.seller.representation || order.seller.name,
      order.seller.email,
      order.seller.phone,
    ]);
    const col1Bottom = doc.y;
    doc.y = colY;
    drawHeaderColumn(left + colWidth, "Vendedor", [order.sellerName || order.seller.name]);
    const col2Bottom = doc.y;
    doc.y = colY;
    drawHeaderColumn(left + colWidth * 2, "Fábricante", [order.factory.name, order.factory.email, order.factory.phone]);
    const col3Bottom = doc.y;

    doc.y = Math.max(col1Bottom, col2Bottom, col3Bottom) + 6;
    doc.moveTo(left, doc.y).lineTo(left + pageWidth, doc.y).strokeColor("#000").lineWidth(1.5).stroke();
    doc.moveDown(0.5);

    // ===== Título + Número do Pedido =====
    const titleBarTop = doc.y;
    doc.rect(left, titleBarTop, pageWidth, 26).fillAndStroke("#f0f0f0", "#000");
    doc
      .font("Helvetica-Bold")
      .fontSize(13)
      .fillColor("#000")
      .text(`PEDIDO DE VENDA   N° ${order.orderNumber}`, left + 10, titleBarTop + 7, { continued: false });
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#444")
      .text(`DATA: ${order.createdAt.toLocaleDateString("pt-BR")}`, left, titleBarTop + 8, {
        width: pageWidth - 10,
        align: "right",
      });
    doc.y = titleBarTop + 26 + 8;

    // ===== Seção Cliente =====
    const clientBoxTop = doc.y;
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#000").text("CLIENTE", left + 8, clientBoxTop + 6);
    doc.font("Helvetica-Bold").fontSize(10).text(order.client.companyName || "", left + 8, doc.y + 2);
    doc.font("Helvetica").fontSize(8).fillColor("#333");
    doc.text(`ENDEREÇO: ${order.client.address || ""}`, left + 8, doc.y + 4, { width: pageWidth - 16 });
    doc.text(`CNPJ: ${order.client.cnpj || ""}    INSC. ESTADUAL: ${order.client.stateInscr || ""}`, left + 8, doc.y + 2);
    doc.text(`TEL: ${order.client.phone || ""}    E-MAIL: ${order.client.email || ""}`, left + 8, doc.y + 2);
    doc.text(
      `FORMA PGTO: ${order.paymentMethod}${order.paymentTerms ? ` — Prazo: ${order.paymentTerms} dias` : ""}`,
      left + 8,
      doc.y + 2
    );
    if (order.clientObservation) {
      doc.font("Helvetica-Bold").fontSize(8).text("OBS. CLIENTE:", left + 8, doc.y + 4, { continued: true });
      doc.font("Helvetica").text(` ${order.clientObservation}`, { width: pageWidth - 90 });
    }
    if (order.buyerName || order.buyerPhone) {
      doc.font("Helvetica-Bold").fontSize(8).text("COMPRADOR:", left + 8, doc.y + 4, { continued: true });
      doc.font("Helvetica").text(` ${order.buyerName || "—"}${order.buyerPhone ? ` — ${order.buyerPhone}` : ""}`);
    }
    doc.moveDown(0.4);
    const clientBoxBottom = doc.y + 4;
    doc.rect(left, clientBoxTop, pageWidth, clientBoxBottom - clientBoxTop).strokeColor("#000").lineWidth(1).stroke();
    doc.y = clientBoxBottom + 10;

    // ===== Tabela de Produtos =====
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#000").text("PRODUTOS", left, doc.y, { width: pageWidth, align: "center" });
    doc.moveDown(0.3);

    const colWidths = {
      code: pageWidth * 0.13,
      name: pageWidth * 0.32,
      qty: pageWidth * 0.08,
      unit: pageWidth * 0.13,
      disc: pageWidth * 0.13,
      total: pageWidth * 0.21,
    };

    const drawTableHeader = () => {
      const rowTop = doc.y;
      doc.rect(left, rowTop, pageWidth, 18).fillAndStroke("#f0f0f0", "#000");
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#000");
      let x = left;
      doc.text("CÓDIGO", x + 3, rowTop + 5, { width: colWidths.code - 6 });
      x += colWidths.code;
      doc.text("PRODUTO", x + 3, rowTop + 5, { width: colWidths.name - 6 });
      x += colWidths.name;
      doc.text("QTD", x, rowTop + 5, { width: colWidths.qty, align: "center" });
      x += colWidths.qty;
      doc.text("VALOR", x, rowTop + 5, { width: colWidths.unit, align: "center" });
      x += colWidths.unit;
      doc.text("DESC", x, rowTop + 5, { width: colWidths.disc, align: "center" });
      x += colWidths.disc;
      doc.text("TOTAL", x, rowTop + 5, { width: colWidths.total - 3, align: "center" });
      doc.y = rowTop + 18;
    };

    drawTableHeader();

    let total = 0;
    order.items.forEach((item, idx) => {
      const subtotal = applyCascadeDiscount(item.unitPrice, item.discount);
      const finalValue = subtotal * item.quantity;
      total += finalValue;

      // Quebra de página se necessário
      if (doc.y > doc.page.height - doc.page.margins.bottom - 100) {
        doc.addPage();
        doc.y = doc.page.margins.top;
        drawTableHeader();
      }

      const rowTop = doc.y;
      const nameLines = [item.product.name, item.type ? `Tipo: ${item.type}` : "", item.observation ? `Obs: ${item.observation}` : ""].filter(Boolean);
      const rowHeight = Math.max(16, nameLines.length * 10 + 4);

      if (idx % 2 === 1) {
        doc.rect(left, rowTop, pageWidth, rowHeight).fill("#f9f9f9");
      }
      doc.strokeColor("#ccc").lineWidth(0.5).rect(left, rowTop, pageWidth, rowHeight).stroke();

      let x = left;
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#000").text(item.product.code, x + 3, rowTop + 4, { width: colWidths.code - 6 });
      x += colWidths.code;
      doc.font("Helvetica-Bold").fontSize(8).text(nameLines[0], x + 3, rowTop + 4, { width: colWidths.name - 6 });
      if (nameLines.length > 1) {
        doc.font("Helvetica").fontSize(7).fillColor("#555").text(nameLines.slice(1).join(" | "), x + 3, doc.y, { width: colWidths.name - 6 });
      }
      x += colWidths.name;
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#000").text(String(item.quantity), x, rowTop + 4, { width: colWidths.qty, align: "center" });
      x += colWidths.qty;
      doc.font("Helvetica").fontSize(8).text(fmt(item.unitPrice), x, rowTop + 4, { width: colWidths.unit, align: "center" });
      x += colWidths.unit;
      doc.text(item.discount || "0", x, rowTop + 4, { width: colWidths.disc, align: "center" });
      x += colWidths.disc;
      doc.font("Helvetica-Bold").text(fmt(finalValue), x, rowTop + 4, { width: colWidths.total - 3, align: "center" });

      doc.y = rowTop + rowHeight;
    });

    doc.moveDown(0.6);

    // ===== Seção inferior: descrição/frete + totais =====
    if (doc.y > doc.page.height - doc.page.margins.bottom - 90) {
      doc.addPage();
      doc.y = doc.page.margins.top;
    }

    const bottomTop = doc.y;
    const leftColWidth = pageWidth * 0.62;
    const rightColWidth = pageWidth * 0.34;
    const rightX = left + pageWidth - rightColWidth;

    doc.rect(left, bottomTop, leftColWidth, 70).strokeColor("#ccc").stroke();
    let by = bottomTop + 6;
    if (order.freightType) {
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#000").text("TIPO DE FRETE", left + 8, by);
      by = doc.y + 2;
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#333")
        .text(
          `${order.freightType} - ${order.freightType === "CIF" ? "Fornecedor responsável" : "Comprador responsável"}`,
          left + 8,
          by,
          { width: leftColWidth - 16 }
        );
      by = doc.y + 6;
    }
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#000").text("OBSERVAÇÕES", left + 8, by);
    by = doc.y + 2;
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#333")
      .text(order.description || "Nenhuma observação adicional.", left + 8, by, { width: leftColWidth - 16 });

    doc.rect(rightX, bottomTop, rightColWidth, 70).strokeColor("#000").lineWidth(1).stroke();
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#333").text("Total dos Produtos", rightX + 8, bottomTop + 10);
    doc.font("Helvetica-Bold").fontSize(9).text(fmt(total), rightX + 8, doc.y, { width: rightColWidth - 16, align: "right" });
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#000").text("TOTAL GERAL", rightX + 8, doc.y + 6);
    doc.font("Helvetica-Bold").fontSize(12).text(fmt(total), rightX + 8, doc.y, { width: rightColWidth - 16, align: "right" });

    doc.end();
  });
}
