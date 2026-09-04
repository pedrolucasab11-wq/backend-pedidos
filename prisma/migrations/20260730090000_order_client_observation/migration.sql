-- AlterTable: observação específica sobre o cliente neste pedido (ex:
-- preferências, combinados, instruções de entrega). Texto livre e opcional,
-- separado do campo "description" (observação geral do pedido).
ALTER TABLE `Order` ADD COLUMN `clientObservation` TEXT NULL;
