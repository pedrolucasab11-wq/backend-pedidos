import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticateToken } from "../middlewares/authMiddleware";

const router = Router();

router.use(authenticateToken);

// Limites alinhados ao tamanho das colunas VARCHAR(191) no banco.
// Deixamos uma margem (150) para não colar exatamente no limite físico.
const MAX_TEXT_FIELD_LENGTH = 150;

// Criar produto (a fábrica precisa pertencer ao vendedor autenticado)
// O preço unitário é opcional aqui: o valor de venda real é sempre informado
// no momento do pedido, pois pode variar por negociação com o cliente.
router.post("/", async (req: any, res: any) => {
  const sellerId = req.user.sellerId;
  const factoryId = Number(req.body.factoryId);
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const code = typeof req.body.code === "string" ? req.body.code.trim() : "";
  const type = typeof req.body.type === "string" ? req.body.type.trim() : null;
  const observation = typeof req.body.observation === "string" ? req.body.observation.trim() : null;

  const hasUnitPrice = req.body.unitPrice !== undefined && req.body.unitPrice !== null && req.body.unitPrice !== "";
  const unitPrice = hasUnitPrice ? Number(req.body.unitPrice) : null;

  if (!req.body.factoryId || !Number.isInteger(factoryId) || factoryId <= 0) {
    return res.status(400).json({ message: "Selecione a fábrica do produto." });
  }
  if (!name || !code) {
    return res.status(400).json({ message: "Nome e código do produto são obrigatórios." });
  }
  if (name.length > MAX_TEXT_FIELD_LENGTH) {
    return res.status(400).json({ message: `O nome do produto deve ter no máximo ${MAX_TEXT_FIELD_LENGTH} caracteres.` });
  }
  if (code.length > MAX_TEXT_FIELD_LENGTH) {
    return res.status(400).json({ message: `O código do produto deve ter no máximo ${MAX_TEXT_FIELD_LENGTH} caracteres.` });
  }
  if (type && type.length > MAX_TEXT_FIELD_LENGTH) {
    return res.status(400).json({ message: `O tipo do produto deve ter no máximo ${MAX_TEXT_FIELD_LENGTH} caracteres.` });
  }
  if (hasUnitPrice && (!Number.isFinite(unitPrice) || (unitPrice as number) < 0)) {
    return res.status(400).json({ message: "O preço de referência deve ser um número maior ou igual a zero." });
  }
  if (hasUnitPrice && (unitPrice as number) > 999_999_999) {
    return res.status(400).json({ message: "O preço de referência informado é muito alto." });
  }

  try {
    const factory = await prisma.factory.findFirst({ where: { id: factoryId, sellerId } });
    if (!factory) {
      return res.status(404).json({ message: "Fábrica não encontrada." });
    }
    if (!factory.active) {
      return res.status(400).json({ message: "Esta fábrica está inativa e não pode receber novos produtos." });
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
      return res.status(409).json({ message: "Já existe um produto com este código nesta fábrica." });
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
