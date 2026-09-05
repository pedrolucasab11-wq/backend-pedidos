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

// Atualiza um produto já cadastrado (a fábrica dele precisa pertencer ao
// vendedor autenticado). Mesmos campos e validações do cadastro; a fábrica do
// produto não pode ser trocada aqui.
router.put("/:id", async (req: any, res: any) => {
  const sellerId = req.user.sellerId;
  const productId = Number(req.params.id);
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const code = typeof req.body.code === "string" ? req.body.code.trim() : "";
  const type = typeof req.body.type === "string" ? req.body.type.trim() : null;
  const observation = typeof req.body.observation === "string" ? req.body.observation.trim() : null;

  const hasUnitPrice = req.body.unitPrice !== undefined && req.body.unitPrice !== null && req.body.unitPrice !== "";
  const unitPrice = hasUnitPrice ? Number(req.body.unitPrice) : null;

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ message: "Identificador de produto inválido." });
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
    const existing = await prisma.product.findFirst({ where: { id: productId, factory: { sellerId } } });
    if (!existing) {
      return res.status(404).json({ message: "Produto não encontrado." });
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: { name, code, type, observation, unitPrice },
      include: { factory: true },
    });

    res.json(product);
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "Já existe um produto com este código nesta fábrica." });
    }
    console.error("Erro ao atualizar produto:", error);
    res.status(500).json({ message: "Erro ao atualizar produto. Tente novamente em alguns instantes." });
  }
});

// Exclui definitivamente um produto. Só é permitido quando ele não foi usado
// em nenhum pedido (histórico de vendas não pode ficar com referência quebrada);
// nesse caso, oriente o vendedor a apenas não usar mais o produto em novos pedidos.
router.delete("/:id", async (req: any, res: any) => {
  const sellerId = req.user.sellerId;
  const productId = Number(req.params.id);

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ message: "Identificador de produto inválido." });
  }

  try {
    const existing = await prisma.product.findFirst({ where: { id: productId, factory: { sellerId } } });
    if (!existing) {
      return res.status(404).json({ message: "Produto não encontrado." });
    }

    const orderItemsCount = await prisma.orderItem.count({ where: { productId } });
    if (orderItemsCount > 0) {
      return res.status(409).json({
        message: "Este produto já foi usado em pedidos e não pode ser excluído.",
      });
    }

    await prisma.product.delete({ where: { id: productId } });
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao excluir produto:", error);
    res.status(500).json({ message: "Erro ao excluir produto. Tente novamente em alguns instantes." });
  }
});

// Limite de resultados por busca: uma fábrica pode ter centenas/milhares de
// produtos, então nunca retornamos a lista inteira de uma vez — o vendedor
// digita e a busca via nome/código traz só os resultados mais relevantes.
const SEARCH_RESULTS_LIMIT = 30;

// Listar produtos das fábricas do vendedor autenticado.
// Aceita filtros opcionais via query string:
//   - factoryId: restringe a uma fábrica específica (usado ao montar um pedido)
//   - search: busca por nome OU código do produto (contém, sem diferenciar caixa)
// Sem "search", retorna só os primeiros produtos (útil para listagens simples);
// o uso típico ao criar pedido é sempre combinar factoryId + search.
router.get("/", async (req: any, res: any) => {
  const sellerId = req.user.sellerId;
  const { factoryId, search } = req.query as { factoryId?: string; search?: string };

  const where: any = { factory: { sellerId } };
  if (factoryId) {
    const parsedFactoryId = Number(factoryId);
    if (!Number.isInteger(parsedFactoryId) || parsedFactoryId <= 0) {
      return res.status(400).json({ message: "Identificador de fábrica inválido." });
    }
    where.factoryId = parsedFactoryId;
  }
  if (search && typeof search === "string" && search.trim()) {
    const term = search.trim();
    where.OR = [
      { name: { contains: term } },
      { code: { contains: term } },
    ];
  }

  try {
    const products = await prisma.product.findMany({
      where,
      include: { factory: true },
      orderBy: { name: "asc" },
      take: SEARCH_RESULTS_LIMIT,
    });

    res.json(products);
  } catch (error) {
    console.error("Erro ao listar produtos:", error);
    res.status(500).json({ message: "Erro ao listar produtos. Tente novamente em alguns instantes." });
  }
});

export default router;
