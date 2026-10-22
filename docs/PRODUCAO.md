# Checklist de produção — Rede Frio (manutenção com QR Code)

Estado em 22/10/2026. Legenda: **[x]** feito · **[ ]** pendente · quem faz entre parênteses.
Os itens da seção 1 precisam estar resolvidos **antes de imprimir as etiquetas de verdade**.

## 1. Antes de imprimir qualquer etiqueta (bloqueadores)

- [ ] **Definir o endereço definitivo do app do técnico (cliente + Claude).** O QR guarda o endereço inteiro. Hoje é `https://rede-frio-tecnico.vercel.app`. Se o endereço mudar depois, as etiquetas já coladas deixam de funcionar. Recomendado: domínio próprio (ex.: `tecnico.redefrio.com.br`). Depois de comprar/configurar, trocar `VITE_TECNICO_URL` no projeto do admin e republicar. Manter o endereço antigo funcionando mesmo assim.
- [ ] **Testar o fluxo completo com serviços reais (você).** O banco tem 1 cliente e 1 aparelho de teste e **nenhum serviço lançado** até agora: o lançamento de serviço com foto, o modo offline e a sincronização ainda não passaram por teste com dados no banco. Roteiro na seção 5.
- [ ] **Testar a função da aba Equipe (você).** Está publicada, mas nunca foi chamada de verdade: criar, desativar e reativar um funcionário de teste, e trocar senha.
- [ ] **Testar a leitura da etiqueta impressa (cliente).** Imprimir 3 etiquetas no material final, colar em aparelho e ler com 2 modelos de celular, sob sol e à noite. Testar também uma etiqueta suja ou riscada.

## 2. Contas e segurança

- [ ] **Trocar as 3 senhas que foram escritas no chat (você).** Administração e Técnico 1 e 2. Pela aba Equipe, "Trocar senha". Daqui para frente, passar senha por mensagem privada, nunca por canal compartilhado.
- [ ] **Dar nomes reais aos funcionários (você).** Hoje são "Técnico 1" e "Técnico 2". O nome fica gravado em cada serviço: trocar **antes** do primeiro serviço real. (Aba Equipe, "Gerenciar", "Salvar dados".)
- [ ] **Desligar o cadastro aberto de usuários (você, painel Supabase).** Authentication > Sign In / Providers > Email > desmarcar "Allow new users to sign up". Mesmo hoje quem se cadastra sozinho não acessa nada (sem perfil, as regras bloqueiam tudo), mas não há motivo para deixar aberto.
- [ ] **Ativar proteção contra senhas vazadas (você).** Authentication > Attack protection. Exige plano Pro do Supabase. (Alerta do verificador de segurança.)
- [ ] **Definir política de senha (você).** Mínimo de 8 caracteres já é exigido na Equipe; avaliar aumentar para 10 no painel.
- [x] Regras de acesso por papel (RLS) testadas: técnico só registra em seu nome, não edita nem apaga serviço, não cria cliente nem etiqueta; só o admin corrige/cancela. Funções internas com acesso público fechado.
- [x] Chave de serviço do Supabase só existe na função de servidor; nunca vai para o celular. A chave que o app usa é a pública, feita para isso.
- [ ] **Contas individuais para o admin (cliente).** Evitar que várias pessoas usem a mesma conta de administração; cada pessoa com a sua (aba Equipe), para o histórico mostrar quem corrigiu o quê.
- [ ] **Ter um segundo administrador (cliente).** Se a única conta de admin for perdida, só dá para recuperar pelo painel do Supabase.
- [ ] **Privacidade / LGPD (cliente).** O sistema guarda nome, telefone, endereço e documento de clientes. Registrar a finalidade, avisar os clientes (política de privacidade) e definir por quanto tempo guardar o histórico. Pedir revisão de um responsável jurídico.

## 3. Infraestrutura e custos

- [ ] **Supabase: passar para o plano Pro (cliente).** O gratuito pausa o projeto após ~1 semana sem uso e não tem backup diário. Pro inclui backups diários e mais espaço. Avaliar a opção de recuperação a qualquer momento (PITR) se o histórico for crítico.
- [ ] **Vercel: confirmar o plano (cliente).** O plano gratuito (Hobby) é destinado a uso pessoal/não comercial pelos termos da Vercel; para uma empresa, conferir e usar o plano pago.
- [ ] **Conta de cada serviço no nome da empresa (cliente).** Hoje o projeto Supabase e a conta Vercel estão em contas pessoais de teste. Transferir (ou recriar) em contas da Rede Frio, com e-mail da empresa e cobrança no cartão da empresa.
- [ ] **Espaço das fotos (decisão).** Estimativa: ~5.000 serviços/mês × 2 fotos × ~250 KB ≈ 2,5 GB por mês (~30 GB/ano). Cabe no Pro (100 GB), mas cresce sempre. Opções: reduzir a qualidade da foto, limitar a 4 por serviço, ou arquivar fotos com mais de 2 anos.
- [ ] **Ligar o GitHub à Vercel (você).** Hoje as publicações são feitas à mão por mim. Instalar o aplicativo da Vercel no GitHub e conectar os dois projetos para publicar a cada alteração aprovada. Evita depender de uma pessoa só.
- [ ] **Monitoramento (cliente/Claude).** Alerta de site fora do ar (ex.: UptimeRobot, gratuito) nos dois endereços; olhar os logs e alertas do Supabase semanalmente no início.
- [ ] **Plano de volta atrás.** Vercel guarda cada versão: dá para promover a anterior em 1 clique. Banco: antes de qualquer mudança de estrutura, confirmar que há backup recente.
- [x] Banco com índices para as consultas principais; relatórios somam no servidor. Ajustes de desempenho do verificador aplicados (migração 0005). Restam avisos informativos sem impacto prático neste volume.

## 4. Dados

- [ ] **Apagar os dados de teste (Claude, quando você autorizar).** 1 cliente, 1 aparelho e 1 etiqueta de teste (e qualquer serviço lançado nos testes).
- [x] **Importação por planilha (feita).** Admin > Aparelhos > "Importar planilha de aparelhos": lê CSV, sugere as colunas pelo cabeçalho (você ajusta), mostra o resumo e os erros antes de gravar, não duplica clientes nem aparelhos com o mesmo número de série, tem modo teste (10 linhas) e "Desfazer" (arquiva o lote). Depois gera as etiquetas em páginas de 60 (QR + código + cliente + local) e uma planilha dos códigos para gráfica. **Falta testar com a planilha real da cliente.**
- [ ] **Definir a periodicidade correta por aparelho (cliente).** O padrão é 30 dias (a planilha pode trazer a coluna). Aparelho sem nenhuma data passa a vencer 1 período depois do cadastro.
- [ ] **Lista de clientes inicial (cliente).** O técnico só escolhe clientes já cadastrados; cadastrar os principais antes do piloto.
- [ ] **Logo oficial (cliente).** O logo atual foi recriado a partir de um print. Enviar o arquivo oficial (SVG ou PNG transparente) e, se houver, um símbolo para o ícone do app.

## 5. Roteiro de teste de ponta a ponta (antes do piloto)

1. Admin: cadastrar 2 clientes e gerar 6 etiquetas.
2. Técnico 1 (celular A, com internet): ler etiqueta nova, cadastrar o aparelho, lançar serviço com 2 fotos.
3. Admin: ver o serviço em Serviços e no Relatório; abrir as fotos; corrigir o texto; cancelar um serviço e ver o total diminuir.
4. Técnico 2 (celular B): ler o mesmo aparelho e ver o histórico com o nome do Técnico 1.
5. **Sem sinal:** colocar o celular em modo avião, ler um aparelho já aberto antes, lançar um serviço, voltar a conexão e ver a faixa de pendência sumir e o serviço aparecer no admin.
6. **Etiqueta repetida:** os dois técnicos cadastrando a mesma etiqueta nova ao mesmo tempo (um deve receber aviso).
7. **Desativar** um funcionário e confirmar que ele não consegue mais entrar.
8. Relatório: conferir que os totais por funcionário batem com a lista de Serviços; baixar as 2 planilhas e abrir no Excel (acentos corretos).
9. **iPhone:** instalar na tela inicial pelo Safari ("Compartilhar" > "Adicionar à Tela de Início"). Sem instalar, o Safari apaga os dados salvos do app após cerca de 7 dias sem uso, o que apagaria registros ainda não enviados. **Todos os técnicos devem instalar o app na tela inicial.**
10. Teste de carga: 20 contas lançando serviços ao mesmo tempo (Claude pode montar o script).

## 6. Operação

- [ ] **Quem faz o quê (cliente).** Quem imprime e cola etiquetas, quem cadastra clientes, quem cria e desativa funcionários, quem corrige serviços, quem olha os relatórios, quem recebe os alertas de site fora do ar.
- [ ] **Treinamento dos técnicos (cliente).** Uma folha de 1 página: instalar o app, entrar, ler o QR, cadastrar aparelho, lançar serviço, o que fazer sem sinal (a faixa laranja mostra o que está pendente) e o que fazer se aparecer "erro" na fila.
- [ ] **Piloto de 1 semana (cliente).** 2 a 3 técnicos em um cliente só, com aparelhos pré-cadastrados. Critérios para seguir: nenhum registro perdido, todo serviço apareceu no admin, técnicos conseguem usar sem ajuda.
- [ ] **Canal de suporte (cliente).** Para onde o técnico manda o problema (grupo, telefone) e quem responde.
- [ ] **Material da etiqueta (cliente).** Adesivo resistente a calor, umidade e sol, QR com pelo menos 3 x 3 cm, local do aparelho que não seja tocado por limpeza.

## 7. Melhorias técnicas depois do lançamento

- Pré-carregar no celular os aparelhos do dia, para o técnico não precisar de internet na primeira leitura de cada aparelho.
- Alertas automáticos de manutenção vencida (e-mail/WhatsApp) para o admin.
- Recuperação de senha pelo próprio funcionário (hoje só o admin troca).
- Mais de um telefone/contato por cliente; aparelhos com mais de um local.

## Referências do projeto

| Item | Valor |
|---|---|
| App do técnico | https://rede-frio-tecnico.vercel.app |
| App de administração | https://rede-frio-admin.vercel.app |
| Banco | Supabase `rede-frio-manutencao` (região São Paulo), migrações em `supabase/migrations` |
| Função de servidor | `funcionarios` (Supabase Edge Function), código em `supabase/functions/funcionarios` |
| Como publicar | ver `README.md`, seção "Publicação (Vercel)" |
