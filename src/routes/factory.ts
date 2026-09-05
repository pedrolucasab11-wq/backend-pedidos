import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticateToken } from "../middlewares/authMiddleware";

const router = Router();

router.use(authenticateToken);

// Criar fábrica (vinculada ao vendedor autenticado)
router.post("/", async (req: any, res: any) => {
  const sellerId = req.user.sellerId;
  const {
    logo,
    // Dados
    cnpj,
    name,
    razaoSocial,
    inscricaoEstadual,
    // Contato
    phone,
    celular,
    email,
    // Endereço
    cep,
    estado,
    cidade,
    bairro,
    endereco,
    // Atividade econômica
    dataAbertura,
    porte,
    atividadePrincipal,
    atividadeSecundaria,
    naturezaJuridica,
  } = req.body;

  if (!name?.trim() || !email?.trim() || !phone?.trim()) {
    return res.status(400).json({ message: "Nome fantasia, e-mail e telefone são obrigatórios." });
  }

  try {
    const factory = await prisma.factory.create({
      data: {
        sellerId,
        logo: logo ?? "",
        cnpj,
        name,
        razaoSocial,
        inscricaoEstadual,
        phone,
        celular,
        email,
        cep,
        estado,
        cidade,
        bairro,
        endereco,
        dataAbertura: dataAbertura ? new Date(dataAbertura) : null,
        porte,
        atividadePrincipal,
        atividadeSecundaria,
        naturezaJuridica,
      },
    });
    res.status(201).json(factory);
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "Já existe uma fábrica cadastrada com este CNPJ." });
    }
    console.error("Erro ao criar fábrica:", error);
    res.status(500).json({ message: "Erro ao criar fábrica. Tente novamente em alguns instantes." });
  }
});

// Atualiza os dados de uma fábrica já cadastrada (mesmos campos do cadastro).
router.put("/:id", async (req: any, res: any) => {
  const sellerId = req.user.sellerId;
  const factoryId = Number(req.params.id);
  const {
    logo,
    // Dados
    cnpj,
    name,
    razaoSocial,
    inscricaoEstadual,
    // Contato
    phone,
    celular,
    email,
    // Endereço
    cep,
    estado,
    cidade,
    bairro,
    endereco,
    // Atividade econômica
    dataAbertura,
    porte,
    atividadePrincipal,
    atividadeSecundaria,
    naturezaJuridica,
  } = req.body;

  if (!Number.isInteger(factoryId) || factoryId <= 0) {
    return res.status(400).json({ message: "Identificador de fábrica inválido." });
  }
  if (!name?.trim() || !email?.trim() || !phone?.trim()) {
    return res.status(400).json({ message: "Nome fantasia, e-mail e telefone são obrigatórios." });
  }

  try {
    const existing = await prisma.factory.findFirst({ where: { id: factoryId, sellerId } });
    if (!existing) {
      return res.status(404).json({ message: "Fábrica não encontrada." });
    }

    const factory = await prisma.factory.update({
      where: { id: factoryId },
      data: {
        logo: logo ?? "",
        cnpj,
        name,
        razaoSocial,
        inscricaoEstadual,
        phone,
        celular,
        email,
        cep,
        estado,
        cidade,
        bairro,
        endereco,
        dataAbertura: dataAbertura ? new Date(dataAbertura) : null,
        porte,
        atividadePrincipal,
        atividadeSecundaria,
        naturezaJuridica,
      },
    });
    res.json(factory);
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "Já existe uma fábrica cadastrada com este CNPJ." });
    }
    console.error("Erro ao atualizar fábrica:", error);
    res.status(500).json({ message: "Erro ao atualizar fábrica. Tente novamente em alguns instantes." });
  }
});

// Listar fábricas do vendedor autenticado.
// Retorna só a contagem de produtos (_count), não a lista completa: uma
// fábrica pode ter muitos produtos, e essa rota é usada em listagens (ex:
// select de fábrica ao criar pedido) que só precisam mostrar "X produtos".
// Para trabalhar com os produtos em si, use GET /products?factoryId=... .
router.get("/", async (req: any, res: any) => {
  const sellerId = req.user.sellerId;

  try {
    const factories = await prisma.factory.findMany({
      where: { sellerId },
      include: {
        _count: { select: { products: true } },
      },
      orderBy: { id: "desc" },
    });

    res.json(factories);
  } catch (error) {
    console.error("Erro ao buscar fábricas:", error);
    res.status(500).json({ message: "Erro ao buscar fábricas. Tente novamente em alguns instantes." });
  }
});

// Exclui definitivamente uma fábrica. Só é permitido quando ela não tem
// produtos cadastrados nem pedidos vinculados (histórico de vendas e catálogo
// não podem ser perdidos); nesses casos o vendedor deve inativar em vez de excluir.
router.delete("/:id", async (req: any, res: any) => {
  const { id } = req.params;
  const sellerId = req.user.sellerId;

  if (!Number.isInteger(Number(id))) {
    return res.status(400).json({ message: "Identificador de fábrica inválido." });
  }

  try {
    const existing = await prisma.factory.findFirst({ where: { id: Number(id), sellerId } });
    if (!existing) {
      return res.status(404).json({ message: "Fábrica não encontrada." });
    }

    const [ordersCount, productsCount] = await Promise.all([
      prisma.order.count({ where: { factoryId: Number(id) } }),
      prisma.product.count({ where: { factoryId: Number(id) } }),
    ]);

    if (ordersCount > 0) {
      return res.status(409).json({
        message:
          "Esta fábrica já possui pedidos registrados e não pode ser excluída. Inative a fábrica em vez de excluí-la.",
      });
    }
    if (productsCount > 0) {
      return res.status(409).json({
        message:
          "Esta fábrica possui produtos cadastrados e não pode ser excluída. Remova os produtos primeiro ou inative a fábrica.",
      });
    }

    await prisma.factory.delete({ where: { id: Number(id) } });
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao excluir fábrica:", error);
    res.status(500).json({ message: "Erro ao excluir fábrica. Tente novamente em alguns instantes." });
  }
});

// Ativar/inativar fábrica
router.patch("/:id/status", async (req: any, res: any) => {
  const { id } = req.params;
  const { active } = req.body;
  const sellerId = req.user.sellerId;

  if (!Number.isInteger(Number(id))) {
    return res.status(400).json({ message: "Identificador de fábrica inválido." });
  }
  if (typeof active !== "boolean") {
    return res.status(400).json({ message: "O campo 'active' deve ser verdadeiro ou falso." });
  }

  try {
    const existing = await prisma.factory.findFirst({ where: { id: Number(id), sellerId } });
    if (!existing) {
      return res.status(404).json({ message: "Fábrica não encontrada." });
    }

    const factory = await prisma.factory.update({
      where: { id: Number(id) },
      data: { active },
    });
    res.json(factory);
  } catch (error: any) {
    console.error("Erro ao atualizar status da fábrica:", error);
    res.status(500).json({ message: "Erro ao atualizar status da fábrica. Tente novamente em alguns instantes." });
  }
});

// Buscar fábrica por ID (somente do vendedor autenticado)
router.get("/:id", async (req: any, res: any) => {
  const { id } = req.params;
  const sellerId = req.user.sellerId;

  try {
    const factory = await prisma.factory.findFirst({
      where: { id: Number(id), sellerId },
      include: { products: true },
    });

    if (!factory) {
      return res.status(404).json({ message: "Fábrica não encontrada." });
    }

    res.json(factory);
  } catch (error) {
    console.error("Erro ao buscar fábrica:", error);
    res.status(500).json({ message: "Erro ao buscar fábrica. Tente novamente em alguns instantes." });
  }
});

export default router;
