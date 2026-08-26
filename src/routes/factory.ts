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

// Listar fábricas do vendedor autenticado
router.get("/", async (req: any, res: any) => {
  const sellerId = req.user.sellerId;

  try {
    const factories = await prisma.factory.findMany({
      where: { sellerId },
      include: {
        products: true,
      },
      orderBy: { id: "desc" },
    });

    res.json(factories);
  } catch (error) {
    console.error("Erro ao buscar fábricas:", error);
    res.status(500).json({ message: "Erro ao buscar fábricas. Tente novamente em alguns instantes." });
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
