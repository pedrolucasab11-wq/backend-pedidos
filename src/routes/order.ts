import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticateToken } from "../middlewares/authMiddleware";

const router = Router();

function generateOrderNumber() {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ORDER-${timestamp}-${random}`;
}

// Criar pedido (protegido por autenticação)
router.post("/", authenticateToken, async (req: any, res: any) => {
  const sellerId = req.user.sellerId;
  const {
    factoryId,
    clientId,
    products,
    paymentMethod,
    buyerName,
    buyerPhone,
    description,
    freightType,
  } = req.body;

  try {
    // Garante que a fábrica e o cliente pertencem ao vendedor autenticado
    const [factory, client] = await Promise.all([
      prisma.factory.findFirst({ where: { id: factoryId, sellerId } }),
      prisma.client.findFirst({ where: { id: clientId, sellerId } }),
    ]);

    if (!factory) {
      return res.status(404).json({ error: "Fábrica não encontrada" });
    }
    if (!client) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }
    if (client.active === false) {
      return res.status(400).json({ error: "Este cliente está inativo e não pode receber novos pedidos." });
    }

    const orderNumber = generateOrderNumber();

    const order = await prisma.order.create({
      data: {
        sellerId,
        factoryId,
        clientId,
        paymentMethod,
        buyerName,
        buyerPhone,
        description,
        freightType,
        orderNumber,
        items: {
          create: products.map((product: any) => ({
            productId: product.productId,
            type: product.type,
            observation: product.observation,
            discount: product.discount,
            quantity: product.quantity,
          })),
        },
      },
      include: {
        items: true,
      },
    });

    res.json(order);
  } catch (error) {
    console.error("Erro ao criar pedido:", error);
    res.status(500).json({ error: "Erro ao criar pedido" });
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
    res.status(500).json({ error: "Erro ao buscar pedidos" });
  }
});

export default router;
