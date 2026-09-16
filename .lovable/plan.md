# Personalizar os cartões dos clientes

## O que será feito
- Deixar todo cliente já ativado com borda roxa grossa, no mesmo destaque visual da borda verde das linhas Livre.
- Manter as linhas Livre com a borda verde e o símbolo atual.
- Adicionar em **Engrenagem → Tema e Cores** uma barra de 0% a 100% para misturar o fundo do cartão entre branco e roxo.
- Adicionar a escolha **Letras e números: Preto ou Branco**.
- Aplicar e salvar essas escolhas imediatamente, inclusive após fechar ou atualizar o aplicativo.
- Usar o mesmo visual nos cartões do seu painel e nos cartões das revendas.

## Detalhes técnicos
- Ampliar as preferências visuais já salvas no aparelho com `clientCardPurple` e `clientCardText`.
- Aplicar as escolhas por variáveis de cor do tema, mantendo estados especiais como Livre, bloqueado, bônus, revenda e pago legíveis.
- Atualizar o controle da engrenagem e o cartão sem alterar dados dos clientes.

## Conferência
- Testar 0%, 50% e 100% de roxo com letras pretas e brancas.
- Confirmar que a borda verde continua nas linhas Livre e a borda roxa aparece nos clientes ativados.
- Conferir na tela principal e no painel da revenda em celular.
