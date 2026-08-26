import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET as string;

if (!SECRET) {
  // Sem JWT_SECRET não há como emitir ou validar tokens com segurança.
  // Falhar alto e cedo evita rodar em produção com autenticação quebrada/insegura.
  throw new Error(
    "JWT_SECRET não definido. Configure essa variável de ambiente antes de iniciar o servidor."
  );
}

export const authenticateToken = (
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

  jwt.verify(token, SECRET, (err, user) => {
    if (err) {
      if (err.name === "TokenExpiredError") {
        res.status(401).json({ message: "Sua sessão expirou. Faça login novamente." });
        return;
      }
      res.status(403).json({ message: "Token de autenticação inválido. Faça login novamente." });
      return;
    }
    (req as any).user = user;
    next();
  });
};
