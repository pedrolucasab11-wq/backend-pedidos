import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middlewares/authMiddleware";

const router = Router();
const prisma = new PrismaClient();

function generateOrderNumber() {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ORDER-${timestamp}-${random}`;
}

router.post("/", async (req, res) => {
  const {
    sellerId,
    factoryId,
    clientId,
    products,
    paymentMethod,
    buyerName,
    description,
  } = req.body;

  try {
    const orderNumber = generateOrderNumber();

    const order = await prisma.order.create({
      data: {
        sellerId,
        factoryId,
        clientId,
        paymentMethod,
        buyerName,
        description,
        orderNumber,
        items: {
          create: products.map((product: any) => ({
            productId: product.productId,
            color: product.color,
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

router.get("/", async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        items: {
          include: {
            product: true,
          },
        },
        seller: true,
        factory: true,
        client: true,
      },
    });
    res.json(orders);
  } catch (error) {
    console.error("Erro ao buscar pedidos:", error);
    res.status(500).json({ error: "Erro ao buscar pedidos" });
  }
});

export default router;
