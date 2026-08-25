import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticateToken } from "../middlewares/authMiddleware";

const router = Router();

router.use(authenticateToken);

// Criar produto (a fábrica precisa pertencer ao vendedor autenticado)
router.post("/", async (req: any, res: any) => {
  const { name, code, type, observation, unitPrice, factoryId } = req.body;
  const sellerId = req.user.sellerId;

  try {
    const factory = await prisma.factory.findFirst({ where: { id: factoryId, sellerId } });
    if (!factory) {
      return res.status(404).json({ message: "Fábrica não encontrada" });
    }

    const product = await prisma.product.create({
      data: {
        name,
        code,
        type,
        observation,
        unitPrice,
        factory: { connect: { id: factoryId } },
      },
      include: { factory: true },
    });

    res.json(product);
  } catch (error) {
    console.error("Erro ao criar produto:", error);
    res.status(500).json({ message: "Erro ao criar produto" });
  }
});

// Listar produtos das fábricas do vendedor autenticado
router.get("/", async (req: any, res: any) => {
  const sellerId = req.user.sellerId;

  try {
    const products = await prisma.product.findMany({
      where: { factory: { sellerId } },
      include: { factory: true },
    });

    res.json(products);
  } catch (error) {
    console.error("Erro ao listar produtos:", error);
    res.status(500).json({ message: "Erro ao listar produtos" });
  }
});

export default router;
