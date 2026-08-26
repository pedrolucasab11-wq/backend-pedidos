-- AlterTable
ALTER TABLE `Product` MODIFY `observation` TEXT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Product_factoryId_code_key` ON `Product`(`factoryId`, `code`);
