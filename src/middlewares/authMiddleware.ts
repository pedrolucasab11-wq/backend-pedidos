import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

const SECRET = process.env.JWT_SECRET as string;

if (!SECRET) {
  // Sem JWT_SECRET não há como emitir ou validar tokens com segurança.
  // Falhar alto e cedo evita rodar em produção com autenticação quebrada/insegura.
  throw new Error(
    "JWT_SECRET não definido. Configure essa variável de ambiente antes de iniciar o servidor."
  );
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({ message: "Token de autenticação não informado. Faça login novamente." });
    return;
  }

  jwt.verify(token, SECRET, async (err, decoded) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        res.status(401).json({ message: "Sua sessão expirou. Faça login novamente." });
        return;
      }
      res.status(403).json({ message: "Token de autenticação inválido. Faça login novamente." });
      return;
    }

    const sellerId = (decoded as any)?.sellerId;

    try {
      // Garante que o vendedor do token ainda existe no banco.
      // Evita 500 por chave estrangeira quebrada quando o token é de uma conta
      // que não existe mais (ex: banco resetado, dados de outro ambiente).
      const seller = await prisma.seller.findUnique({ where: { id: sellerId } });
      if (!seller) {
        res.status(401).json({ message: "Sua conta não foi encontrada. Faça login novamente." });
        return;
      }
    } catch (dbError) {
      console.error("Erro ao validar vendedor autenticado:", dbError);
      res.status(500).json({ message: "Erro ao validar sua sessão. Tente novamente em alguns instantes." });
      return;
    }

    (req as any).user = decoded;
    next();
  });
};
