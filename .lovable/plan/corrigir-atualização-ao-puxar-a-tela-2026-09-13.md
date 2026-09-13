# Corrigir atualização ao puxar a tela

## Alterações
- Detectar o gesto de puxar para baixo no topo da tela principal.
- Ao soltar, buscar novamente os clientes e verificar se existe uma versão nova do aplicativo.
- Mostrar uma indicação curta de atualização e recarregar automaticamente apenas quando uma nova versão assumir o controle.
- Manter o funcionamento normal quando o celular estiver sem internet.

## Detalhes técnicos
- Criar um hook pequeno e reutilizável para o gesto de atualização.
- Integrar o hook à tela principal usando o `refetch` já existente.
- Reaproveitar o registro seguro do aplicativo instalado, sem ativá-lo no preview ou desenvolvimento.
- Validar no celular e conferir o estado de compilação.
