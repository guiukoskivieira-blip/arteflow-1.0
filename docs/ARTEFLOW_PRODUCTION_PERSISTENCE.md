# Persistência de Produção do ArteFlow

## Contrato auditado

O fluxo anterior era `ProductionPage/ProductionBoard/ProductionJobDrawer → ArteFlowContext → JobService → IProductionJobRepository/IWorkflowStageRepository/IProductionEventRepository → localStorage`. As chaves antigas são `arteflow:v1:{organizationId}:jobs`, `:stages` e `:events`.

Cada item de pedido gera uma OP independente. Portanto, o contrato persistido é **um job por item**, protegido por `unique (organization_id, order_item_id)`. O job referencia o pedido e o item reais por FKs compostas tenant-safe; dados comerciais continuam em `arteflow_orders` e `arteflow_order_items` e são lidos por relação, sem segunda fonte de verdade.

## Modelo PostgreSQL

- `arteflow_production_stages`: 11 etapas fixas do fluxo atual, materializadas por organização com posição persistida.
- `arteflow_production_jobs`: estado operacional, gates, prioridade, prazo, responsável e `version`.
- `arteflow_production_job_events`: histórico imutável, criado apenas pelo servidor.
- `arteflow_production_job_sequences`: numeração anual atômica por organização.

Não há tabela separada de assignments: o domínio atual possui somente um responsável por OP, logo os campos de atribuição permanecem no job. Realtime foi adiado; confirmação de RPC seguida de recarga do repository é suficiente para esta etapa.

## Segurança e concorrência

Todas as tabelas têm RLS fail-closed. SELECT exige membership, organização ativa, entitlement, product access e `arteflow.production.view` (OWNER preserva o bypass de permissão, não de tenant/acesso). Mutações são exclusivamente RPCs com `auth.uid()`, autorização `production.manage`/aliases homologados, `search_path=''` e ACL mínima. `anon` não executa nenhuma RPC.

Movimentações usam row lock e `expected_version`. A primeira atualização incrementa a versão; uma tentativa concorrente com versão antiga recebe `PRODUCTION_CONFLICT`, sem last-write-wins. Job e evento são gravados na mesma transação. Histórico não possui INSERT/UPDATE/DELETE para clientes.

## Modos de execução

- `connected`: `SupabaseProductionJobRepository`, `SupabaseWorkflowStageRepository` e `SupabaseProductionEventRepository`; nunca há fallback silencioso para localStorage.
- `standalone` DEV: repositories locais e seed demonstrativo permanecem disponíveis.

Estoque, compras, financeiro, recebíveis e expedição não foram migrados. Suas integrações locais existentes foram preservadas e permanecem fora do escopo desta etapa.
