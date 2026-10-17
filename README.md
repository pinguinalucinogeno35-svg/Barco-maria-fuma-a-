# AC QR — manutenção de ar-condicionado com QR Code

Monorepo com dois PWAs (React + Vite + TypeScript) sobre Supabase.

| Pasta | O que é |
|---|---|
| `apps/tecnico` | Técnicos: escaneiam o QR, veem o histórico, registram manutenção (**funciona offline**) |
| `apps/admin` | Administração: clientes, aparelhos, lotes de etiquetas QR, todos os serviços (filtro por funcionário/período/tipo, correção e cancelamento), aparelhos vencidos |
| `packages/shared` | Tipos, login, código/QR, fila offline e sincronização |
| `supabase/migrations` | Banco, índices, RLS por papel (`tecnico`, `admin`) |

## Como rodar
1. Projeto Supabase `rede-frio-manutencao` (região sa-east-1, ref `pzxmlcwuvupqhihcoglb`) já criado e com as migrações `0001`–`0003` aplicadas. Para recriar do zero, aplique-as em ordem.
2. Crie os usuários em Authentication e uma linha em `perfis` para cada um (nome + papel).
3. `cp .env.example .env` e preencha.
4. `npm install`, depois `npm run dev:tecnico` (porta 5173) ou `npm run dev:admin` (5174).
5. `npm test` · `npm run typecheck` · `npm run build`

## Fluxo
1. **Admin** cadastra os clientes e gera lotes de etiquetas QR em branco para imprimir (aba Etiquetas).
2. **Técnico** cola a etiqueta no aparelho e a lê com o app: se for nova, cadastra o aparelho (cliente, marca, modelo, local…) e já lança o serviço. Tudo funciona offline.
3. **Técnico** vê em *Meus serviços* a contagem (hoje/mês/total) e os detalhes do que fez. **Admin** vê tudo, com resumo por funcionário no mês, e pode corrigir ou cancelar serviços (nada é apagado; cancelados não contam).

## Decisões para suportar 20 técnicos simultâneos / 5 mil aparelhos
- **QR = URL** `https://<app-tecnico>/e/AC-XXXXXXXX`. O código é aleatório (sem número sequencial adivinhável) e a etiqueta usa correção de erro alta.
- **Offline-first no técnico:** registros vão para uma fila no IndexedDB e sincronizam ao voltar o sinal. Cada registro tem UUID gerado no celular, então reenviar nunca duplica. Fichas dos equipamentos abertos ficam em cache (até 300).
- **Detalhes ao ler o QR:** o técnico edita modelo e local (também offline; o banco bloqueia qualquer outra coluna). Cada manutenção guarda serviço, data e hora (editáveis, padrão agora) e o histórico mostra o nome de quem fez. O nome é gravado em cada registro pelo banco (`tecnico_nome`), então trocar ou desativar o perfil depois não altera o histórico.
- **Histórico protegido:** técnico só insere serviços em seu próprio nome e não edita; só o admin corrige/cancela, com registro de quem e quando. Ninguém apaga.
- **Fotos** são reduzidas no celular (~200 KB) e vão para o bucket privado `manutencoes`.
- **Listas** paginadas e filtradas no servidor; índices em `(equipamento_id, executada_em)`.
- ~170 serviços/dia é carga leve para um Postgres gerenciado; o gargalo real seria sinal fraco, tratado pela fila offline.

## Limitações atuais / próximos passos
- O app de administração cobre cadastro, etiquetas, histórico e filtro de vencidas. Faltam relatórios e a gestão de funcionários (por ora os usuários são criados no painel do Supabase).
- O técnico precisa abrir a ficha com internet ao menos uma vez antes de registrar offline (pré-carregar a rota do dia resolve).
- Fotos do histórico ainda não são exibidas (guardamos o caminho; falta gerar URL assinada).
- Ícones são provisórios (`scripts/gerar-icones.mjs`).
- Não testado em celular real nem contra um Supabase real: a migração não foi aplicada nesta sessão.

## Identidade visual
Cores e fonte (Poppins, empacotada para funcionar offline) vêm do site da Rede Frio e ficam em `packages/shared/src/estilo.css` (variáveis `--marinho`, `--azul`, …). O logo em `packages/shared/src/Logo.tsx` foi **recriado em SVG a partir de um print**: trocar pelo arquivo oficial. Ícones do PWA: `node scripts/gerar-icones.mjs`.
