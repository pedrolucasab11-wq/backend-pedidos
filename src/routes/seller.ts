import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const router = Router();
const prisma = new PrismaClient();

// --- Seller ---
router.post("/", async (req, res) => {
  const { name, email, phone, logo, password } = req.body;

  const hashedPassword = await bcrypt.hash(password, 10);

  const seller = await prisma.seller.create({
    data: {
      name,
      email,
      phone,
      logo,
      password: hashedPassword,
    },
  });

  res.json(seller);
});

router.get("/", async (req, res) => {
  const sellers = await prisma.seller.findMany();
  res.json(sellers);
});

// --- Buscar vendedor por ID ---
router.get("/:id", async (req: any, res: any) => {
  const { id } = req.params;

  const seller = await prisma.seller.findUnique({
    where: { id: Number(id) },
  });

  if (!seller) {
    return res.status(404).json({ message: "Vendedor não encontrado." });
  }

  res.json(seller);
});

export default router;
