# Você como ADM: token de acesso, nome da revenda e Gestor só no seu app

## 1. Você é o ADM

Sua conta (www.raio.top@gmail.com) passa a ser a **administradora**. Só ela vê:

- o botão **Gestor** (painel da Vivo) — nas cópias do app para outras pessoas ele simplesmente não aparece;
- a área de **Tokens de acesso** na engrenagem;
- a área de **Nome dos painéis / revenda**.

## 2. Token de acesso (primeira coisa dentro da engrenagem)

Nova área **Tokens de acesso**, logo no começo das configurações:

- Botão **Gerar token de 30 dias** e **Gerar token vitalício**.
- Cada token aparece na lista com o código (ex.: `RAIO-8FK2-QP7M`), o tipo, se já foi usado, por quem e quando vence.
- Botão de **copiar** o código (para mandar no WhatsApp) e de **cancelar** um token que ainda não foi usado.

Na tela de cadastro (quando alguém abre uma cópia do seu app):

- Campo obrigatório **Token de acesso**. Sem token válido, a conta não é liberada.
- Token de 30 dias: a pessoa usa 30 dias; depois disso o app **bloqueia** e mostra "Acesso vencido — fale com o administrador".
- Token vitalício: nunca vence.
- Cada token serve para **uma** pessoa só.
- Sua conta ADM nunca é bloqueada.

Para renovar alguém, você gera um token novo; na tela bloqueada existe um campo para a pessoa digitar o token e voltar a usar.

## 3. Nome da revenda e o botão do painel

Na engrenagem, área **Painéis / Revenda** (só você vê):

- Você define o **nome do seu painel** (ex.: RAIO TELECOM) e o **nome de cada revenda** (ex.: CHIP NET, e outros que aparecerem).
- O botão azul do topo passa a mostrar **o nome do outro painel**: quando você está no Raio Telecom, o botão mostra CHIP NET; quando está no CHIP NET, o botão mostra RAIO TELECOM.
- Se houver mais de uma revenda, o botão abre a lista de painéis para escolher.
- O nome só muda por você (as outras contas apenas veem o nome que você definiu).

## Detalhes técnicos

- Migração:
  - `app_role` enum (`admin`, `user`), tabela `user_roles` + `has_role(uuid, app_role)` security definer; linha `admin` para `a4326bcb-…`.
  - `access_tokens` (code unique, plan `30d`|`lifetime`, created_by, used_by, used_at, revoked, expires_at) — RLS: leitura/escrita apenas para admin via `has_role`; GRANTs para `authenticated` e `service_role`.
  - `profiles`: `access_plan text`, `access_expires_at timestamptz`.
  - `panel_names` (user_id pk, label text) — SELECT para `authenticated`, INSERT/UPDATE só admin.
- Edge function `access-token` (`verify_jwt=false`, valida JWT em código, cliente service role):
  - `redeem`: valida token não usado/não cancelado, marca `used_by`/`used_at` e grava `access_plan`/`access_expires_at` (now + 30 dias ou null) no perfil do usuário autenticado.
  - `create` / `list` / `revoke`: exigem `has_role(admin)`.
- Novo `src/hooks/useAccessControl.ts`: papel do usuário (`isAdmin`), plano e vencimento; expõe `isBlocked`.
- `src/hooks/usePanelNames.ts`: lê `panel_names`, salva (admin), resolve o rótulo do painel oposto via `panel_links`.
- `src/pages/Auth.tsx`: campo Token no cadastro (zod, obrigatório), chama `redeem` após o `signUp`.
- `src/pages/Index.tsx`: tela de bloqueio quando `isBlocked` (com campo de token novo); botão do painel usa o rótulo de `usePanelNames`; `OfflineIndicator`/Gestor renderizado só se `isAdmin`.
- `src/components/SettingsModal.tsx`: blocos "Tokens de acesso" (topo) e "Painéis / Revenda", ambos só para admin.
- `src/components/ChipNetModal.tsx`: título e textos usam o rótulo configurado; `partner_label` gravado com esse nome.
