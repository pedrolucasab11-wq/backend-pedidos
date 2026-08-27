-- AlterTable: adiciona o prazo/parcelamento do pagamento (ex: "30/60/90"), usado
-- principalmente para boleto. Texto livre e opcional porque o prazo varia por
-- negociação e não é uma lista fixa de opções.
ALTER TABLE `Order` ADD COLUMN `paymentTerms` VARCHAR(191) NULL;
