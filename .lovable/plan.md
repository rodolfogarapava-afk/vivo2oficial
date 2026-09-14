# Guardar o acesso da operadora em cada cliente

## O que vai aparecer no app

No cadastro e na edição de cada cliente, um bloco novo **Acesso da operadora**:

- **Operadora** (ex.: TIM, Claro, Vivo) — campo de texto livre
- **Usuário / login** (normalmente o número da linha ou o CPF)
- **Senha**

No cartão do cliente e na Lista de clientes, quando houver acesso salvo:

- Um cadeado pequeno; ao tocar, abre uma caixinha com operadora, usuário e senha
- A senha aparece escondida (••••••) com um olhinho para mostrar
- Botão de copiar ao lado do usuário e da senha, para colar rápido no app da operadora
- Botão que abre o site/app da operadora em outra aba (TIM, Claro e Vivo já com endereço pronto; outras abrem busca)

## Importante ser honesto

- O app **não entra sozinho** na conta da operadora nem troca chip por você: ele guarda o acesso e te leva até lá com login e senha na mão para colar.
- A senha fica guardada na sua conta na nuvem, visível só para você (as regras de acesso do banco já bloqueiam qualquer outra pessoa), mas é senha de terceiro guardada em texto — vale só cadastrar o que o próprio cliente autorizou.
- O backup/importação passa a incluir esses campos, então o arquivo de backup também contém senhas: guarde esse arquivo em lugar seguro.

## Detalhes técnicos

- Migração: `ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS carrier text, ADD COLUMN IF NOT EXISTS portal_login text, ADD COLUMN IF NOT EXISTS portal_password text;` (RLS/GRANTs da tabela já cobrem as novas colunas).
- `useClients.ts`: campos novos na interface `Client`, em `addClient` e `updateClient`.
- `NewClientForm.tsx` e a edição em `SettingsModal.tsx`: bloco "Acesso da operadora" com os 3 campos, validação zod (trim, máx. 100 caracteres cada, todos opcionais).
- Novo `src/components/CarrierAccessPopover.tsx`: exibição mascarada, `navigator.clipboard.writeText`, mapa `CARRIER_URLS` (tim → meutim, claro → minhaclaro, vivo → meuvivo) com fallback de busca; usado por `ClientCard.tsx` e pela Lista de clientes.
- Backup em `SettingsModal.tsx`: incluir os campos no JSON gerado e aceitá-los na importação.
- Nada é enviado para a operadora; nenhuma senha vai para log ou console.
