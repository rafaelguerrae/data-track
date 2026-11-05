# data-track

Monorepo que recebe as leituras de sensores de temperatura via MQTT, guarda no banco, mostra gráficos e envia alertas por e-mail.

## Comandos

```bash
cp .env.example .env
pnpm install
pnpm infra:up                            # mosquitto, timescaledb, mailpit
pnpm --filter @data-track/api db:migrate
pnpm dev                                 # api + web
pnpm simulate                            # leituras falsas, sem o hardware
pnpm build | typecheck | test            # verificações
```

Mais detalhes em [docs/](docs/): [arquitetura](docs/arquitetura.md) e [desenvolvimento](docs/desenvolvimento.md).
