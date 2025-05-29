import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

router.post("/", async (req, res) => {
  const { logo, name, email, phone } = req.body;
  const factory = await prisma.factory.create({
    data: { logo, name, email, phone },
  });
  res.json(factory);
});

router.get("/", async (req, res) => {
  try {
    const factories = await prisma.factory.findMany({
      include: {
        products: true,
      },
    });

    const result = factories.map((factory) => ({
      ...factory,
      products: factory.products.map((product) => ({
        ...product,
        colors: JSON.parse(product.colors),
      })),
    }));

    res.json(result);
  } catch (error) {
    console.error("Erro ao buscar fábricas:", error);
    res.status(500).json({ error: "Erro ao buscar fábricas" });
  }
});

router.get("/:id", async (req: any, res: any) => {
  const { id } = req.params;

  try {
    const factory = await prisma.factory.findUnique({
      where: { id: Number(id) },
      include: { products: true },
    });

    if (!factory) {
      return res.status(404).json({ error: "Fábrica não encontrada" });
    }

    const result = {
      ...factory,
      products: factory.products.map((product) => ({
        ...product,
        colors: JSON.parse(product.colors),
      })),
    };

    res.json(result);
  } catch (error) {
    console.error("Erro ao buscar fábrica:", error);
    res.status(500).json({ error: "Erro ao buscar fábrica" });
  }
});

export default router;
