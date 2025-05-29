import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import routes from "./routes";
import authRoutes from "./routes/auth";

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

app.use("/", routes);

app.use("/auth", authRoutes);

app.get("/", (req, res) => {
  res.send("API Pedidos Online");
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

async function testConnection() {
  try {
    await prisma.$connect();
    console.log("✅ Prisma conectado ao MySQL!");
  } catch (error) {
    console.error("❌ Erro ao conectar com o banco:", error);
  }
}

testConnection();
