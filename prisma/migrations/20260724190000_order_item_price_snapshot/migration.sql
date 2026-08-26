-- AlterTable: torna o preço do produto opcional (o preço real agora é definido no pedido)
ALTER TABLE `Product` MODIFY `unitPrice` DOUBLE NULL;

-- AlterTable: adiciona unitPrice em OrderItem como NULL primeiro, para permitir backfill
ALTER TABLE `OrderItem` ADD COLUMN `unitPrice` DOUBLE NULL;

-- Backfill: preenche os itens de pedidos já existentes com o preço atual do produto
-- (não há como saber o preço exato usado no passado, então usamos o melhor dado disponível).
UPDATE `OrderItem` oi
JOIN `Product` p ON p.`id` = oi.`productId`
SET oi.`unitPrice` = COALESCE(p.`unitPrice`, 0)
WHERE oi.`unitPrice` IS NULL;

-- Garante que nenhum registro ficou sem valor (produtos sem preço de referência viram 0)
UPDATE `OrderItem` SET `unitPrice` = 0 WHERE `unitPrice` IS NULL;

-- Agora que todos os registros têm valor, torna a coluna obrigatória
ALTER TABLE `OrderItem` MODIFY `unitPrice` DOUBLE NOT NULL;
