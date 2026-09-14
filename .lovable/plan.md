# Painel da Vivo dentro do app

## O que já funciona
O app entra sozinho no painel da Vivo e lê suas linhas (grupo RAIO, 52 linhas + 1 principal), com nome, número e se está bloqueada.

## O que vou fazer agora

### 1. Botão "Sincronizar painel Vivo" (nas configurações)
- Puxa todas as linhas do painel.
- Compara com os clientes do app pelo número.
- Linha do painel **sem nome** entra no app como **Livre** (cartão branco com borda verde, como já é hoje).
- Linha do painel que não existe no app é adicionada; linha que existe é atualizada (nome e bloqueio).
- Antes de gravar, mostro uma lista do que vai mudar para você confirmar.

### 2. Giga por cliente
- Mostrar no cartão de cada cliente quantos giga a linha tem/consumiu, buscando isso do painel.
- Botão para enviar mais giga (2, 3, 5, 10 GB) direto do cartão.

## Sobre o que é honesto dizer
Hoje eu só **leio** o painel. Enviar giga e renomear linha são ações de **gravar** lá — ainda não testei se o painel aceita isso pelo mesmo caminho. Então:

- A parte 1 (sincronizar painel → app, com Livre) eu entrego com segurança.
- Na parte 2 eu primeiro investigo os endereços de consumo e de recarga do painel. Se responderem, entrego o giga no cartão e o botão de enviar. Se o painel exigir algo que eu não consigo reproduzir (confirmação extra, tela diferente), eu te aviso e o botão fica só de leitura, mostrando o giga sem enviar.
- "Adicionar cliente aqui e criar a linha lá" não existe: linhas vêm da operadora. O que dá é o contrário (painel → app) e, se a gravação funcionar, mudar nome e giga de uma linha que já existe.

## Detalhes técnicos
- `supabase/functions/vivo-gestao/index.ts`: novas ações `sync` (linhas normalizadas), `consumption` (giga por linha) e `recharge` (envio de pacote), sempre com a sessão login → welcome já implementada.
- Frontend: novo `src/hooks/useVivoPanel.ts` + tela de sincronização em `SettingsModal.tsx`; campo de giga exibido em `ClientCard.tsx`.
- Números comparados apenas por dígitos; nome vazio no painel vira `LIVRE`.
- Credenciais continuam só nos segredos do backend.
