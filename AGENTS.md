# AGENTS.md

Monorepo Turborepo + pnpm, tudo em TypeScript. Recebe leituras de temperatura (ESP32 + PT100, repo irmão `../data-track-firmware`) via MQTT, grava no TimescaleDB, mostra gráficos e envia alertas por e-mail.

## Estrutura

- `apps/api`: Fastify. Assina o MQTT, grava leituras, avalia alertas, expõe REST (porta 3001)
- `apps/web`: Next.js (App Router) + Tailwind. Dashboard e tela de alertas (porta 3000)
- `packages/shared`: schemas zod, parser de tópicos e DTOs usados por api e web (precisa de `pnpm build` para gerar `dist/`)
- `infra/mosquitto`: config do broker; `docker-compose.yml`: mosquitto, timescaledb, mailpit
- `scripts/simulate-device.ts`: simula o firmware
- `docs/`: arquitetura e guia de desenvolvimento

## Comandos

```bash
pnpm infra:up                            # sobe mosquitto, timescaledb e mailpit
pnpm --filter @data-track/api db:migrate # aplica as migrations
pnpm dev                                 # api + web
pnpm simulate                            # leituras falsas
pnpm build && pnpm typecheck && pnpm test
pnpm --filter @data-track/api db:generate  # gera migration após mudar src/db/schema.ts
```

## Convenções (obrigatórias)

- Docs e comentários em português (pt-BR).
- Nomes de arquivos em kebab-case.
- Imports internos usam o alias `#` apontando para `src/` do app (ex.: `#db/client`, `#components/temp-chart`), definido no `tsconfig.json` de cada app. Sem extensão `.js` nos imports.
- No `apps/web`, `app/` fica na raiz do app e **fora** de `src/`; `components/` e `lib/` ficam em `src/`.
- Frontend: Next.js + Tailwind. Backend: Fastify.

## Pontos de atenção

- Contrato MQTT (definido pelo firmware): `data-track/<device>/temperature` (JSON `{"temp_c","ts"}`), `.../status` (`online`/`offline`, retido, LWT) e `.../fault` (ex. `0x04`). A API assina `data-track/+/temperature/#`. O parser fica em `packages/shared/src/index.ts`.
- O `ts` do firmware é uptime em ms, não horário real: a API carimba o horário de chegada.
- `readings` é uma hypertable do TimescaleDB, criada na migration `0001_hypertable.sql` (SQL manual). Consultas de série usam `time_bucket`.
- Funções puras de alerta ficam em `apps/api/src/alerts/rules.ts` (testáveis sem env/banco); `engine.ts` faz o I/O.
- Variáveis de ambiente validadas com zod em `apps/api/src/env.ts`; modelo em `.env.example`.
- Mosquitto de dev é anônimo e sem TLS, e não há login no dashboard (ver `docs/desenvolvimento.md`).
