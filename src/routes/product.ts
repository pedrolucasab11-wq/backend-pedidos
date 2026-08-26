import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticateToken } from "../middlewares/authMiddleware";

const router = Router();

router.use(authenticateToken);

// Criar produto (a fábrica precisa pertencer ao vendedor autenticado)
router.post("/", async (req: any, res: any) => {
  const { name, code, type, observation, unitPrice, factoryId } = req.body;
  const sellerId = req.user.sellerId;

  if (!name?.trim() || !code?.trim() || unitPrice === undefined || unitPrice === null) {
    return res.status(400).json({ message: "Nome, código e preço unitário são obrigatórios." });
  }
  if (!factoryId) {
    return res.status(400).json({ message: "Selecione a fábrica do produto." });
  }
  if (typeof unitPrice !== "number" || Number.isNaN(unitPrice) || unitPrice < 0) {
    return res.status(400).json({ message: "Preço unitário inválido." });
  }

  try {
    const factory = await prisma.factory.findFirst({ where: { id: factoryId, sellerId } });
    if (!factory) {
      return res.status(404).json({ message: "Fábrica não encontrada." });
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

    res.status(201).json(product);
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "Já existe um produto cadastrado com este código." });
    }
    console.error("Erro ao criar produto:", error);
    res.status(500).json({ message: "Erro ao criar produto. Tente novamente em alguns instantes." });
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
    res.status(500).json({ message: "Erro ao listar produtos. Tente novamente em alguns instantes." });
  }
});

export default router;
