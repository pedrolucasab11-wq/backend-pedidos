import { Router } from "express";
import prisma from "../lib/prisma";
import { authenticateToken } from "../middlewares/authMiddleware";

const router = Router();

router.use(authenticateToken);

// Criar cliente (vinculado ao vendedor autenticado)
router.post("/", async (req: any, res: any) => {
  const { companyName, cnpj, stateInscr, email, address, phone } = req.body;
  const sellerId = req.user.sellerId;

  try {
    const client = await prisma.client.create({
      data: { companyName, cnpj, stateInscr, email, address, phone, sellerId },
    });
    res.json(client);
  } catch (error) {
    console.error("Erro ao criar cliente:", error);
    res.status(500).json({ error: "Erro ao criar cliente" });
  }
});

// Listar clientes do vendedor autenticado
router.get("/", async (req: any, res: any) => {
  const sellerId = req.user.sellerId;

  try {
    const clients = await prisma.client.findMany({
      where: { sellerId },
      orderBy: { id: "desc" },
    });
    res.json(clients);
  } catch (error) {
    console.error("Erro ao listar clientes:", error);
    res.status(500).json({ error: "Erro ao listar clientes" });
  }
});

// Ativar/inativar cliente
router.patch("/:id/status", async (req: any, res: any) => {
  const { id } = req.params;
  const { active } = req.body;
  const sellerId = req.user.sellerId;

  if (typeof active !== "boolean") {
    return res.status(400).json({ error: "O campo 'active' deve ser um booleano." });
  }

  try {
    const existing = await prisma.client.findFirst({ where: { id: Number(id), sellerId } });
    if (!existing) {
      return res.status(404).json({ error: "Cliente não encontrado" });
    }

    const client = await prisma.client.update({
      where: { id: Number(id) },
      data: { active },
    });
    res.json(client);
  } catch (error) {
    console.error("Erro ao atualizar status do cliente:", error);
    res.status(500).json({ error: "Erro ao atualizar status do cliente" });
  }
});

export default router;
