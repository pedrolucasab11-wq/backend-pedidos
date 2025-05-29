import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// --- Client ---
router.post("/", async (req, res) => {
  const { companyName, cnpj, stateInscr, email, address, phone } = req.body;
  const client = await prisma.client.create({
    data: { companyName, cnpj, stateInscr, email, address, phone },
  });
  res.json(client);
});

router.get("/", async (req, res) => {
  const clients = await prisma.client.findMany();
  res.json(clients);
});

export default router;