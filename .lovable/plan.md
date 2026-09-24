# Cadastro completo de revenda

## Resultado
- O botão **Revenda** abrirá uma janela própria para escolher, criar e administrar revendas.
- Ao informar o nome da revenda e tocar no **+**, o aplicativo gerará o token e um link curto de cadastro pronto para copiar e enviar.
- Quem abrir esse link verá **Revenda Raio Telecom** no lugar de **Cliente Vivo**.
- O cadastro da revenda pedirá nome completo, CPF, data de nascimento, WhatsApp, e-mail, senha e aceite do termo de adesão com 6 meses de fidelidade.

## Funcionamento
- O link identificará automaticamente o token e o nome da revenda.
- Depois do cadastro, o token será usado para ligar a conta à revenda criada e fazê-la aparecer no painel do administrador.
- Os dados pessoais e o aceite serão salvos com a conta, com validação de CPF, telefone, data e campos obrigatórios.
- O acesso comum continuará mostrando a tela atual, sem os campos exclusivos do link de revenda.

## Detalhes técnicos
- Ampliar o perfil existente com nome completo, CPF, nascimento, aceite e data do aceite.
- Validar os dados no formulário e também no serviço que processa o token.
- Usar uma URL curta do próprio aplicativo, no formato `/auth?r=TOKEN`, sem serviço externo.
- Reaproveitar a janela de revendas existente, separando a seleção da administração em uma janela dedicada.
- Conferir o fluxo completo em tela de celular: gerar link, abrir cadastro, validar formulário e confirmar a aparência das janelas.