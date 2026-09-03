# Contrato Prexyon → ArteFlow

Estado auditado em 2026-09-02 no projeto Supabase central `ybsdwcaagcazfedrwhjm`.

## Identidade e tenant consumidos

O ArteFlow usa, sem criar autoridades paralelas:

- `auth.users` e `profiles` para identidade;
- `organization_members` para membership e papel organizacional;
- `organizations` para o tenant ativo;
- `prexyon_get_organization_entitlements(uuid)` para entitlement efetivo, inclusive homologação;
- `prexyon_user_product_access` para acesso individual ao produto;
- `prexyon_user_product_roles`, `prexyon_role_permissions`, `prexyon_permission_definitions` e
  `prexyon_user_permission_overrides` para grants;
- Edge Function `prexyon-sso-exchange` para o exchange público seguro;
- `prexyon_exchange_sso_code(text,text)` e `prexyon_rollback_sso_code(text)` como RPCs internas,
  acessíveis somente por `service_role` e `postgres`.

Função operacional do ArteFlow (`OPERADOR`, `DESIGNER`, `PRODUCAO`, `GERENTE`, `ADMIN`) permanece
separada do papel organizacional Prexyon. Ela não concede privilégios.

## Callback

- Audience e product code: `arteflow`
- Path estável: `/auth/prexyon?code=...`
- URL completa: `${VITE_ARTEFLOW_APP_URL}/auth/prexyon`
- O portal deve manter essa URL em allowlist e nunca aceitar redirect fornecido livremente pelo browser.
- O callback aceita temporariamente `code` ou `sso_code`, rejeita valores conflitantes e remove o código
  da barra de endereço antes da primeira operação assíncrona.
- O browser envia somente `{ code, audience: "arteflow" }` à Edge Function e nunca chama a RPC interna.
- Código inválido, expirado, reutilizado ou de outra audience é sempre negado.

## SSO V2 homologado

A Edge Function consome o código por RPC interna, gera server-side um magic link sem envio de e-mail e
devolve `token_hash` e `verification_type`. O ArteFlow chama `verifyOtp`, exige `session` e `user`, compara
ambos com `exchange.user_id` e confirma novamente a identidade com `getUser()` antes do tenant bootstrap.
O JSON do exchange nunca é tratado isoladamente como autenticação. Nenhum `service_role` chega ao browser.

## Matriz canônica proposta

- `arteflow.view`
- `arteflow.orders.view`
- `arteflow.orders.create`
- `arteflow.orders.edit`
- `arteflow.production.view`
- `arteflow.production.manage`
- `arteflow.inventory.view`
- `arteflow.inventory.manage`
- `arteflow.procurement.view`
- `arteflow.procurement.manage`
- `arteflow.finance.view`
- `arteflow.finance.manage`
- `arteflow.settings.manage`
- `arteflow.users.manage`

O catálogo remoto contém as 14 permissões canônicas acima e os dois aliases legados. Grants desconhecidos
ou ausentes continuam negados.

O adapter mantém compatibilidade temporária de:

- `arteflow.production.move_stages` → `arteflow.production.manage`
- `arteflow.production.reassign` → `arteflow.production.manage`

## Condições para homologação de entrada

1. Manter produto/audience `arteflow`, callback allowlist e URL de produção configurados.
2. Conceder entitlement de homologação somente após validar o deny real sem entitlement.
3. Garantir acesso individual e associar roles/overrides às permissões canônicas.
4. Preservar as RPCs internas com `search_path` vazio e sem `EXECUTE` para browser.

Nenhuma migration remota foi aplicada nesta etapa. A persistência operacional continua local e suas
migrations/RLS serão elaboradas por módulo em etapas posteriores.
