# Persistência operacional de Pedidos

## Fluxo legado mapeado

`OrderList` / `OrderDetailsModal` / `NewOrderModal`
→ `ArteFlowContext`
→ `OrderService`
→ `IOrderRepository`
→ `LocalStorageOrderRepository`
→ `arteflow:v1:{organizationId}:orders`.

`OrderService` também cria OPs e eventos pelos repositórios locais de Produção. Esses módulos permanecem fora da migração desta etapa.

## Comportamento por modo

- `standalone` em desenvolvimento mantém `LocalStorageOrderRepository` e os dados demonstrativos.
- `connected` usa somente `SupabaseOrderRepository` para pedidos.
- Não existe fallback de Pedidos para `localStorage` em modo connected.
- A chave operacional legada `arteflow:v1:{organizationId}:orders` não é apagada nem migrada automaticamente; ela fica inativa para leitura e escrita de Pedidos em connected.
- Produção, Estoque, Compras e Financeiro continuam com os repositórios atuais nesta etapa.

## Autoridade e isolamento

O filtro `organization_id` do cliente é apenas uma otimização. A autoridade é aplicada no PostgreSQL por RLS e helpers privados que validam `auth.uid()`, membership ativa, organização ativa, entitlement ArteFlow, product access e a permissão específica.

A criação usa `arteflow_create_order`, que gera a numeração tenant-aware e grava pedido e itens na mesma transação.
