# AC QR — manutenção de ar-condicionado com QR Code

Monorepo com dois PWAs (React + Vite + TypeScript) sobre Supabase.

| Pasta | O que é |
|---|---|
| `apps/tecnico` | Técnicos: escaneiam o QR, veem o histórico, registram manutenção (**funciona offline**) |
| `apps/vendas` | Vendedores: cadastram cliente + equipamento, geram e imprimem a etiqueta QR |
| `packages/shared` | Tipos, login, código/QR, fila offline e sincronização |
| `supabase/migrations` | Banco, índices, RLS por papel (`tecnico`, `vendedor`, `admin`) |

## Como rodar
1. Crie um projeto Supabase e aplique `supabase/migrations/0001_init.sql` e `0002_detalhes_servico.sql`.
2. Crie os usuários em Authentication e uma linha em `perfis` para cada um (nome + papel).
3. `cp .env.example .env` e preencha.
4. `npm install`, depois `npm run dev:tecnico` (porta 5173) ou `npm run dev:vendas` (5174).
5. `npm test` · `npm run typecheck` · `npm run build`

## Decisões para suportar 20 técnicos simultâneos / 5 mil aparelhos
- **QR = URL** `https://<app-tecnico>/e/AC-XXXXXXXX`. O código é aleatório (sem número sequencial adivinhável) e a etiqueta usa correção de erro alta.
- **Offline-first no técnico:** registros vão para uma fila no IndexedDB e sincronizam ao voltar o sinal. Cada registro tem UUID gerado no celular, então reenviar nunca duplica. Fichas dos equipamentos abertos ficam em cache (até 300).
- **Detalhes ao ler o QR:** o técnico edita modelo e local (também offline; o banco bloqueia qualquer outra coluna). Cada manutenção guarda serviço, data e hora (editáveis, padrão agora) e o histórico mostra o nome de quem fez.
- **Histórico imutável:** RLS permite só `insert` em `manutencoes`; técnico só registra em seu próprio nome.
- **Fotos** são reduzidas no celular (~200 KB) e vão para o bucket privado `manutencoes`.
- **Listas** paginadas e filtradas no servidor; índices em `(equipamento_id, executada_em)`.
- ~170 serviços/dia é carga leve para um Postgres gerenciado; o gargalo real seria sinal fraco, tratado pela fila offline.

## Limitações atuais / próximos passos
- Falta o painel web de gestão (relatórios, agenda de vencidas, usuários).
- O técnico precisa abrir a ficha com internet ao menos uma vez antes de registrar offline (pré-carregar a rota do dia resolve).
- Fotos do histórico ainda não são exibidas (guardamos o caminho; falta gerar URL assinada).
- Ícones são provisórios (`scripts/gerar-icones.mjs`).
- Não testado em celular real nem contra um Supabase real: a migração não foi aplicada nesta sessão.
