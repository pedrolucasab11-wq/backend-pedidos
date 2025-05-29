/*
  Warnings:

  - Added the required column `buyerName` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orderNumber` to the `Order` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paymentMethod` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `order` ADD COLUMN `buyerName` VARCHAR(191) NOT NULL,
    ADD COLUMN `description` VARCHAR(191) NULL,
    ADD COLUMN `orderNumber` VARCHAR(191) NOT NULL,
    ADD COLUMN `paymentMethod` VARCHAR(191) NOT NULL;
