-- Antes de impor a restrição de unicidade, migra clientes duplicados (mesmo
-- vendedor + CNPJ) que possam já existir na base: mantém o cadastro mais
-- antigo (menor id), reatribui os pedidos dos duplicados para ele, e remove
-- os registros duplicados. Isso evita que a migration falhe em produção caso
-- já existam duplicatas (que é exatamente o bug relatado pelo cliente).

-- Tabela temporária: para cada (sellerId, cnpj) com mais de um cliente,
-- mapeia cada id duplicado para o id do cliente "canônico" (o mais antigo).
CREATE TEMPORARY TABLE `_client_dedup` AS
SELECT c.id AS old_id, k.keep_id AS keep_id
FROM `Client` c
JOIN (
  SELECT sellerId, cnpj, MIN(id) AS keep_id
  FROM `Client`
  WHERE sellerId IS NOT NULL
  GROUP BY sellerId, cnpj
  HAVING COUNT(*) > 1
) k ON c.sellerId = k.sellerId AND c.cnpj = k.cnpj
WHERE c.id <> k.keep_id;

-- Reatribui os pedidos dos clientes duplicados para o cliente canônico.
UPDATE `Order` o
JOIN `_client_dedup` d ON o.clientId = d.old_id
SET o.clientId = d.keep_id;

-- Remove os cadastros de cliente duplicados (já sem pedidos vinculados).
DELETE c FROM `Client` c
JOIN `_client_dedup` d ON c.id = d.old_id;

DROP TEMPORARY TABLE `_client_dedup`;

-- CreateIndex
CREATE UNIQUE INDEX `Client_sellerId_cnpj_key` ON `Client`(`sellerId`, `cnpj`);
