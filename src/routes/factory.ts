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

  if (!name || !email || !phone) {
    return res.status(400).json({ error: "Nome fantasia, e-mail e telefone são obrigatórios." });
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
    res.json(factory);
  } catch (error: any) {
    if (error.code === "P2002") {
      return res.status(409).json({ error: "Já existe uma fábrica cadastrada com este CNPJ." });
    }
    console.error("Erro ao criar fábrica:", error);
    res.status(500).json({ error: "Erro ao criar fábrica" });
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
    res.status(500).json({ error: "Erro ao buscar fábricas" });
  }
});

// Ativar/inativar fábrica
router.patch("/:id/status", async (req: any, res: any) => {
  const { id } = req.params;
  const { active } = req.body;
  const sellerId = req.user.sellerId;

  if (typeof active !== "boolean") {
    return res.status(400).json({ error: "O campo 'active' deve ser um booleano." });
  }

  try {
    const existing = await prisma.factory.findFirst({ where: { id: Number(id), sellerId } });
    if (!existing) {
      return res.status(404).json({ error: "Fábrica não encontrada" });
    }

    const factory = await prisma.factory.update({
      where: { id: Number(id) },
      data: { active },
    });
    res.json(factory);
  } catch (error: any) {
    console.error("Erro ao atualizar status da fábrica:", error);
    res.status(500).json({ error: "Erro ao atualizar status da fábrica" });
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
      return res.status(404).json({ error: "Fábrica não encontrada" });
    }

    res.json(factory);
  } catch (error) {
    console.error("Erro ao buscar fábrica:", error);
    res.status(500).json({ error: "Erro ao buscar fábrica" });
  }
});

export default router;
