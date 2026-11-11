# Desenvolvimento

```bash
cp .env.example .env
pnpm install
pnpm infra:up                            # mosquitto, timescaledb, mailpit (e-mails em http://localhost:8025)
pnpm --filter @data-track/api db:migrate
pnpm --filter @data-track/api create-admin --email voce@exemplo.com --name "Seu Nome" --team "Minha Equipe"
pnpm dev                                 # api (3001) + web (3000)
pnpm simulate                            # leituras falsas, sem o hardware
```

## Primeiro acesso

O cadastro é só por convite, então o `create-admin` cria a equipe e o primeiro admin. A senha vem de `ADMIN_PASSWORD` ou de um prompt. Entre em http://localhost:3000, abra **Equipe**, vincule o sensor pelo ID (por exemplo o `device` do `pnpm simulate`, que precisa já ter enviado uma leitura) e convide outros usuários: o e-mail com o link cai no Mailpit, e o link também aparece na tela.

## Notas

- O browser fala só com a web: `/api/*` é reescrito para a API (`API_URL`, padrão `http://localhost:3001`).
- O Mosquitto de dev é anônimo e sem TLS.
- Depois de mudar `apps/api/src/db/schema.ts`: `pnpm --filter @data-track/api db:generate`. Se a migration mexer em dados existentes, edite o SQL gerado (veja a `0002`, que faz backfill da equipe "Padrão").
