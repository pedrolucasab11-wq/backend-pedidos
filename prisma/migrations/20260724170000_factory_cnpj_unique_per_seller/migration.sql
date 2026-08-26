-- DropIndex
DROP INDEX `Factory_cnpj_key` ON `Factory`;

-- CreateIndex
CREATE UNIQUE INDEX `Factory_sellerId_cnpj_key` ON `Factory`(`sellerId`, `cnpj`);
