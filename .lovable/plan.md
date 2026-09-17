# Transferência automática de números entre painéis

## Objetivo
Garantir que cada telefone exista em apenas um painel por vez. O grupo onde a linha estiver no Vivo Gestor será o dono do cliente no aplicativo.

## Alterações
- Ajustar a sincronização para localizar o telefone em todos os painéis vinculados.
- Quando o telefone estiver no painel errado, mover o cadastro existente para o painel correto em vez de criar uma cópia.
- Preservar nome, WhatsApp, valor e demais informações preenchidas no aplicativo durante a transferência; atualizar do Gestor apenas nome, bloqueio e franquia quando disponíveis.
- Evitar duplicidades caso já existam registros repetidos e informar quantas linhas foram transferidas no resultado da atualização.
- Publicar a função atualizada e conferir a sincronização e os erros.

## Resultado esperado
Se um número sair do grupo Raio e for ativado no grupo de uma revenda, ele desaparece do Raio e aparece somente na revenda. O mesmo vale no sentido contrário.

## Detalhes técnicos
A regra será aplicada na função segura de sincronização do Gestor, usando o telefone normalizado como identidade única entre todos os painéis ligados ao ADM.
