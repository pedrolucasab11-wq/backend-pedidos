import { Router } from "express";
import factoryRoutes from "./factory";
import clientRoutes from "./client";
import productRoutes from "./product";
import orderRoutes from "./order";

const router = Router();

router.use("/factories", factoryRoutes);
router.use("/clients", clientRoutes);
router.use("/products", productRoutes);
router.use("/orders", orderRoutes);

export default router;
