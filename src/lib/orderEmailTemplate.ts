import { applyCascadeDiscount } from "./discount";

interface OrderItemForEmail {
  quantity: number;
  unitPrice: number;
  discount?: string | null;
  type?: string | null;
  observation?: string | null;
  product: { name: string; code: string };
}

interface OrderForEmail {
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
  items: OrderItemForEmail[];
  seller: { name: string; email: string; phone: string };
  factory: { name: string; email: string; phone: string };
  client: { companyName: string; cnpj: string; email: string; phone: string; address: string };
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Monta o HTML do e-mail de resumo do pedido, com produtos, descontos e totais.
 * Usa apenas tabelas e estilos inline por compatibilidade com clientes de e-mail
 * (Gmail, Outlook, etc. não suportam bem CSS moderno em <style>).
 */
export function buildOrderEmailHtml(order: OrderForEmail): string {
  const total = order.items.reduce((sum, item) => {
    const withDiscount = applyCascadeDiscount(item.unitPrice, item.discount);
    return sum + withDiscount * item.quantity;
  }, 0);

  const rows = order.items
    .map((item) => {
      const subtotal = applyCascadeDiscount(item.unitPrice, item.discount);
      const finalValue = subtotal * item.quantity;
      return `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(item.product.code)}</td>
          <td style="padding:8px;border:1px solid #ddd;">
            <strong>${escapeHtml(item.product.name)}</strong>
            ${item.type ? `<br><small>Tipo: ${escapeHtml(item.type)}</small>` : ""}
            ${item.observation ? `<br><small>Obs: ${escapeHtml(item.observation)}</small>` : ""}
          </td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center;">${item.quantity}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right;">${fmt(item.unitPrice)}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center;">${item.discount ? escapeHtml(item.discount) : "-"}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:right;"><strong>${fmt(finalValue)}</strong></td>
        </tr>`;
    })
    .join("");

  return `
  <div style="font-family:Arial,sans-serif;color:#222;max-width:700px;margin:0 auto;">
    <div style="background:#1a56db;color:#fff;padding:20px;border-radius:8px 8px 0 0;">
      <h2 style="margin:0;">Pedido ${escapeHtml(order.orderNumber)}</h2>
      <p style="margin:4px 0 0;opacity:0.9;">${order.createdAt.toLocaleDateString("pt-BR")}</p>
    </div>

    <div style="border:1px solid #ddd;border-top:none;padding:20px;">
      <table style="width:100%;margin-bottom:20px;">
        <tr>
          <td style="vertical-align:top;width:33%;padding-right:10px;">
            <strong>Vendedor</strong><br>
            ${escapeHtml(order.sellerName || order.seller.name)}<br>
            <small>${escapeHtml(order.seller.email)}</small><br>
            <small>${escapeHtml(order.seller.phone)}</small>
          </td>
          <td style="vertical-align:top;width:33%;padding-right:10px;">
            <strong>Fábrica</strong><br>
            ${escapeHtml(order.factory.name)}<br>
            <small>${escapeHtml(order.factory.email)}</small><br>
            <small>${escapeHtml(order.factory.phone)}</small>
          </td>
          <td style="vertical-align:top;width:33%;">
            <strong>Cliente</strong><br>
            ${escapeHtml(order.client.companyName)}<br>
            <small>CNPJ: ${escapeHtml(order.client.cnpj)}</small><br>
            <small>${escapeHtml(order.client.email)}</small>
          </td>
        </tr>
      </table>

      <p style="margin:0 0 4px;"><strong>Comprador:</strong> ${escapeHtml(order.buyerName)}${order.buyerPhone ? ` — ${escapeHtml(order.buyerPhone)}` : ""}</p>
      <p style="margin:0 0 4px;"><strong>Forma de pagamento:</strong> ${escapeHtml(order.paymentMethod)}${order.paymentTerms ? ` (prazo: ${escapeHtml(order.paymentTerms)} dias)` : ""}</p>
      ${order.freightType ? `<p style="margin:0 0 4px;"><strong>Frete:</strong> ${escapeHtml(order.freightType)}</p>` : ""}
      ${order.clientObservation ? `<p style="margin:0 0 4px;"><strong>Observação do cliente:</strong> ${escapeHtml(order.clientObservation)}</p>` : ""}
      ${order.description ? `<p style="margin:0 0 4px;"><strong>Observações:</strong> ${escapeHtml(order.description)}</p>` : ""}

      <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px;">
        <thead>
          <tr style="background:#f0f4f8;">
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Código</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left;">Produto</th>
            <th style="padding:8px;border:1px solid #ddd;">Qtd</th>
            <th style="padding:8px;border:1px solid #ddd;">Valor Unit.</th>
            <th style="padding:8px;border:1px solid #ddd;">Desconto</th>
            <th style="padding:8px;border:1px solid #ddd;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div style="text-align:right;margin-top:16px;font-size:18px;">
        <strong>Total Geral: ${fmt(total)}</strong>
      </div>
    </div>

    <p style="color:#888;font-size:12px;text-align:center;margin-top:16px;">
      Este é um e-mail automático enviado pelo Sistema de Pedidos.
    </p>
  </div>`;
}
