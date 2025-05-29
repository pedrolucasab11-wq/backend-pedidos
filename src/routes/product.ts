import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// --- Product ---
// Criar produto
router.post("/", async (req, res) => {
  const { name, code, colors, unitPrice, factoryId } = req.body;

  try {
    const product = await prisma.product.create({
      data: {
        name,
        code,
        colors: JSON.stringify(colors),
        unitPrice,
        factory: { connect: { id: factoryId } },
      },
      include: { factory: true }, // <-- inclui dados da fábrica na resposta
    });

    // Deserializa colors na resposta
    const result = {
      ...product,
      colors: JSON.parse(product.colors),
    };

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao criar produto" });
  }
});

// Listar produtos
router.get("/", async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { factory: true }, // <-- inclui dados da fábrica na listagem
    });

    const result = products.map((p) => ({
      ...p,
      colors: JSON.parse(p.colors),
    }));

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro ao listar produtos" });
  }
});

export default router;
