import "dotenv/config";
import express from "express";
import cors from "cors";
import routes from "./routes";
import authRoutes from "./routes/auth";
import prisma from "./lib/prisma";

const app = express();

// Em produção, defina CORS_ORIGIN com a URL do frontend (ex: https://seu-app.vercel.app).
// Sem essa variável, libera qualquer origem — cenário aceitável para desenvolvimento local.
const allowedOrigins = process.env.CORS_ORIGIN?.split(",").map((o) => o.trim());
app.use(cors({ origin: allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : true }));
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/", routes);

app.get("/", (req, res) => {
  res.send("API Pedidos Online ✅");
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
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
