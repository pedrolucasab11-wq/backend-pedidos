-- AlterTable: nome da representação comercial do vendedor (razão/trade name),
-- opcional pois nem todo vendedor tem uma representação formalmente registrada.
-- Exibido no PDF do pedido no lugar do rótulo genérico "Representante".
ALTER TABLE `Seller` ADD COLUMN `representation` VARCHAR(191) NULL;

-- AlterTable: nome de quem efetivamente vendeu este pedido específico. Pode
-- divergir do nome cadastrado na conta (ex: outro vendedor usando a mesma
-- conta/representação). Editável livremente na tela de criação do pedido;
-- quando não informado, o PDF usa o nome do vendedor da conta.
ALTER TABLE `Order` ADD COLUMN `sellerName` VARCHAR(191) NULL;
