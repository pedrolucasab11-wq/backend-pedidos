import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticateToken } from "../middlewares/authMiddleware";
import { sendMail, isMailerConfigured } from "../lib/mailer";
import { buildOrderEmailHtml } from "../lib/orderEmailTemplate";

const router = Router();

// Regra simples de validação de e-mail (suficiente para bloquear entradas
// obviamente inválidas antes de tentar o envio via SMTP).
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Número do pedido curto e fácil de localizar/dizer em voz alta na hora de
// "dar baixa": prefixo PED + data (AAMMDD) + 4 dígitos aleatórios.
// Ex: PED-260827-4821 (bem mais curto que o formato anterior, que incluía
// o horário completo: ORDER-20260827160357-2828).
function generateOrderNumber() {
  const datePart = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(2, 8); // AAMMDD
  const random = Math.floor(1000 + Math.random() * 9000);
  return `PED-${datePart}-${random}`;
}

// Formas de pagamento que costumam ter prazo/parcelamento em dias (ex: boleto
// 30/60/90). O prazo é sempre texto livre porque varia de negociação para
// negociação, não é uma lista fixa de opções.
function isInstallmentPayment(paymentMethod: string) {
  const normalized = paymentMethod.trim().toLowerCase();
  return normalized.includes("boleto") || normalized.includes("prazo");
}

// Criar pedido (protegido por autenticação)
router.post("/", authenticateToken, async (req: any, res: any) => {
  const sellerId = req.user.sellerId;
  const {
    factoryId,
    clientId,
    products,
    paymentMethod,
    paymentTerms,
    buyerName,
    buyerPhone,
    sellerName,
    description,
    freightType,
  } = req.body;

  if (!factoryId || !clientId) {
    return res.status(400).json({ message: "Selecione a fábrica e o cliente do pedido." });
  }
  if (!paymentMethod?.trim()) {
    return res.status(400).json({ message: "Selecione a forma de pagamento." });
  }
  if (paymentTerms && typeof paymentTerms !== "string") {
    return res.status(400).json({ message: "O prazo de pagamento informado é inválido." });
  }
  if (!buyerName?.trim()) {
    return res.status(400).json({ message: "Informe o nome do comprador." });
  }
  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ message: "Adicione pelo menos um produto ao pedido." });
  }

  // Valida cada item do pedido: produto e quantidade obrigatórios, preço unitário
  // obrigatório e maior que zero (é sempre informado na hora do pedido, pois varia).
  for (const item of products) {
    if (!item?.productId) {
      return res.status(400).json({ message: "Um dos itens do pedido está sem produto selecionado." });
    }
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ message: "A quantidade de cada item deve ser maior que zero." });
    }
    const unitPrice = Number(item.unitPrice);
    if (item.unitPrice === undefined || item.unitPrice === null || item.unitPrice === "") {
      return res.status(400).json({ message: "Informe o valor unitário de cada produto do pedido." });
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return res.status(400).json({ message: "O valor unitário de cada item deve ser um número válido." });
    }
  }

  try {
    // Garante que a fábrica e o cliente pertencem ao vendedor autenticado
    const [factory, client] = await Promise.all([
      prisma.factory.findFirst({ where: { id: factoryId, sellerId } }),
      prisma.client.findFirst({ where: { id: clientId, sellerId } }),
    ]);

    if (!factory) {
      return res.status(404).json({ message: "Fábrica não encontrada." });
    }
    if (!client) {
      return res.status(404).json({ message: "Cliente não encontrado." });
    }
    if (client.active === false) {
      return res.status(400).json({ message: "Este cliente está inativo e não pode receber novos pedidos." });
    }

    // Garante que todos os produtos do pedido pertencem à fábrica selecionada
    // (evita, por exemplo, montar um pedido com productId de outra fábrica/vendedor).
    const productIds = products.map((item: any) => item.productId);
    const validProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, factoryId },
      select: { id: true },
    });
    const validProductIds = new Set(validProducts.map((p) => p.id));
    const invalidItem = products.find((item: any) => !validProductIds.has(item.productId));
    if (invalidItem) {
      return res.status(400).json({ message: "Um dos produtos selecionados não pertence a esta fábrica." });
    }

    const orderNumber = generateOrderNumber();
    // O prazo só é relevante para pagamentos parcelados (boleto/prazo); em
    // outras formas de pagamento ele é ignorado, mesmo que enviado por engano.
    const resolvedPaymentTerms = isInstallmentPayment(paymentMethod)
      ? paymentTerms?.trim() || null
      : null;

    const order = await prisma.order.create({
      data: {
        sellerId,
        factoryId,
        clientId,
        paymentMethod,
        paymentTerms: resolvedPaymentTerms,
        buyerName,
        buyerPhone,
        sellerName: sellerName?.trim() || null,
        description,
        freightType,
        orderNumber,
        items: {
          create: products.map((item: any) => ({
            productId: item.productId,
            type: item.type,
            observation: item.observation,
            discount: item.discount,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
          })),
        },
      },
      include: {
        items: { include: { product: true } },
      },
    });

    res.status(201).json(order);
  } catch (error) {
    console.error("Erro ao criar pedido:", error);
    res.status(500).json({ message: "Erro ao criar pedido. Tente novamente em alguns instantes." });
  }
});

// Listar pedidos do vendedor autenticado
router.get("/", authenticateToken, async (req: any, res: any) => {
  const sellerId = req.user.sellerId;

  try {
    const orders = await prisma.order.findMany({
      where: { sellerId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        seller: { select: { id: true, name: true, email: true, phone: true, logo: true } },
        factory: true,
        client: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    res.json(orders);
  } catch (error) {
    console.error("Erro ao buscar pedidos:", error);
    res.status(500).json({ message: "Erro ao buscar pedidos. Tente novamente em alguns instantes." });
  }
});

// Busca um pedido específico do vendedor autenticado (usado na tela de edição).
router.get("/:id", authenticateToken, async (req: any, res: any) => {
  const sellerId = req.user.sellerId;
  const orderId = Number(req.params.id);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ message: "Identificador de pedido inválido." });
  }

  try {
    const order = await prisma.order.findFirst({
      where: { id: orderId, sellerId },
      include: {
        items: { include: { product: true } },
        seller: { select: { id: true, name: true, email: true, phone: true, logo: true } },
        factory: { include: { products: true } },
        client: true,
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Pedido não encontrado." });
    }

    res.json(order);
  } catch (error) {
    console.error("Erro ao buscar pedido:", error);
    res.status(500).json({ message: "Erro ao buscar pedido. Tente novamente em alguns instantes." });
  }
});

// Atualiza um pedido existente: dados gerais e a lista completa de itens.
// A fábrica do pedido não pode ser trocada aqui (evitaria inconsistência com
// os produtos já vinculados); para mudar de fábrica, crie um novo pedido.
router.put("/:id", authenticateToken, async (req: any, res: any) => {
  const sellerId = req.user.sellerId;
  const orderId = Number(req.params.id);
  const {
    clientId,
    products,
    paymentMethod,
    paymentTerms,
    buyerName,
    buyerPhone,
    sellerName,
    description,
    freightType,
  } = req.body;

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ message: "Identificador de pedido inválido." });
  }
  if (!clientId) {
    return res.status(400).json({ message: "Selecione o cliente do pedido." });
  }
  if (!paymentMethod?.trim()) {
    return res.status(400).json({ message: "Selecione a forma de pagamento." });
  }
  if (paymentTerms && typeof paymentTerms !== "string") {
    return res.status(400).json({ message: "O prazo de pagamento informado é inválido." });
  }
  if (!buyerName?.trim()) {
    return res.status(400).json({ message: "Informe o nome do comprador." });
  }
  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ message: "O pedido precisa ter pelo menos um produto." });
  }

  for (const item of products) {
    if (!item?.productId) {
      return res.status(400).json({ message: "Um dos itens do pedido está sem produto selecionado." });
    }
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({ message: "A quantidade de cada item deve ser maior que zero." });
    }
    const unitPrice = Number(item.unitPrice);
    if (item.unitPrice === undefined || item.unitPrice === null || item.unitPrice === "") {
      return res.status(400).json({ message: "Informe o valor unitário de cada produto do pedido." });
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return res.status(400).json({ message: "O valor unitário de cada item deve ser um número válido." });
    }
  }

  try {
    const existingOrder = await prisma.order.findFirst({ where: { id: orderId, sellerId } });
    if (!existingOrder) {
      return res.status(404).json({ message: "Pedido não encontrado." });
    }

    const client = await prisma.client.findFirst({ where: { id: clientId, sellerId } });
    if (!client) {
      return res.status(404).json({ message: "Cliente não encontrado." });
    }
    if (client.active === false) {
      return res.status(400).json({ message: "Este cliente está inativo e não pode receber pedidos." });
    }

    // Os produtos precisam pertencer à fábrica original do pedido (que não muda na edição).
    const productIds = products.map((item: any) => item.productId);
    const validProducts = await prisma.product.findMany({
      where: { id: { in: productIds }, factoryId: existingOrder.factoryId },
      select: { id: true },
    });
    const validProductIds = new Set(validProducts.map((p) => p.id));
    const invalidItem = products.find((item: any) => !validProductIds.has(item.productId));
    if (invalidItem) {
      return res.status(400).json({ message: "Um dos produtos selecionados não pertence à fábrica deste pedido." });
    }

    // Substitui todos os itens do pedido: remove os antigos e cria os novos
    // dentro de uma transação, para não deixar o pedido em estado inconsistente
    // caso algo falhe no meio do caminho.
    const resolvedPaymentTerms = isInstallmentPayment(paymentMethod)
      ? paymentTerms?.trim() || null
      : null;

    const updatedOrder = await prisma.$transaction(async (tx) => {
      await tx.orderItem.deleteMany({ where: { orderId } });

      return tx.order.update({
        where: { id: orderId },
        data: {
          clientId,
          paymentMethod,
          paymentTerms: resolvedPaymentTerms,
          buyerName,
          buyerPhone,
          sellerName: sellerName?.trim() || null,
          description,
          freightType,
          items: {
            create: products.map((item: any) => ({
              productId: item.productId,
              type: item.type,
              observation: item.observation,
              discount: item.discount,
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
            })),
          },
        },
        include: {
          items: { include: { product: true } },
          factory: true,
          client: true,
        },
      });
    });

    res.json(updatedOrder);
  } catch (error) {
    console.error("Erro ao atualizar pedido:", error);
    res.status(500).json({ message: "Erro ao atualizar pedido. Tente novamente em alguns instantes." });
  }
});

// Envia o resumo do pedido por e-mail para o cliente e/ou a fábrica.
// O corpo aceita destinatários independentes por tipo, permitindo enviar só
// para um dos dois, ou para ambos com e-mails diferentes dos cadastrados.
router.post("/:id/send-email", authenticateToken, async (req: any, res: any) => {
  const sellerId = req.user.sellerId;
  const orderId = Number(req.params.id);
  const { recipients } = req.body as {
    recipients?: { type: "client" | "factory"; email: string }[];
  };

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ message: "Identificador de pedido inválido." });
  }
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ message: "Selecione ao menos um destinatário para o envio." });
  }

  for (const recipient of recipients) {
    if (recipient.type !== "client" && recipient.type !== "factory") {
      return res.status(400).json({ message: "Tipo de destinatário inválido." });
    }
    if (!recipient.email?.trim() || !EMAIL_REGEX.test(recipient.email.trim())) {
      return res.status(400).json({ message: `E-mail inválido para ${recipient.type === "client" ? "o cliente" : "a fábrica"}.` });
    }
  }

  if (!isMailerConfigured()) {
    return res.status(503).json({
      message: "O envio de e-mails não está configurado no servidor. Contate o suporte.",
    });
  }

  try {
    const order = await prisma.order.findFirst({
      where: { id: orderId, sellerId },
      include: {
        items: { include: { product: true } },
        seller: { select: { name: true, email: true, phone: true } },
        factory: true,
        client: true,
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Pedido não encontrado." });
    }

    const html = buildOrderEmailHtml({
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      buyerName: order.buyerName,
      buyerPhone: order.buyerPhone,
      sellerName: order.sellerName,
      paymentMethod: order.paymentMethod,
      paymentTerms: order.paymentTerms,
      freightType: order.freightType,
      description: order.description,
      items: order.items,
      seller: order.seller,
      factory: order.factory,
      client: order.client,
    });

    const subject = `Pedido ${order.orderNumber} - ${order.factory.name}`;

    // Envia para cada destinatário independentemente: se um falhar (ex: e-mail
    // inexistente), os demais ainda devem ser enviados, e o resultado de cada
    // um é reportado separadamente ao usuário.
    const results = await Promise.all(
      recipients.map(async (recipient) => {
        try {
          await sendMail({ to: recipient.email.trim(), subject, html });
          return { type: recipient.type, email: recipient.email.trim(), success: true };
        } catch (error) {
          console.error(`Erro ao enviar e-mail para ${recipient.type}:`, error);
          return { type: recipient.type, email: recipient.email.trim(), success: false };
        }
      })
    );

    const allFailed = results.every((r) => !r.success);
    res.status(allFailed ? 502 : 200).json({
      message: allFailed
        ? "Não foi possível enviar o e-mail para nenhum destinatário."
        : "Envio processado.",
      results,
    });
  } catch (error) {
    console.error("Erro ao enviar e-mail do pedido:", error);
    res.status(500).json({ message: "Erro ao enviar e-mail do pedido. Tente novamente em alguns instantes." });
  }
});

export default router;
