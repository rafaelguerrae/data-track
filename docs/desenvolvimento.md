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

## Dados de exemplo

`pnpm seed` cria sensores `sensor-1..N` com leituras sintéticas (ciclo diário, oscilação de compressor, ruído e picos de "porta aberta") e os vincula a uma equipe, para ver o dashboard com volume:

```bash
pnpm seed --team "Minha Equipe"                    # 3 sensores, 7 dias, 1 leitura a cada 30s (~20 mil por sensor)
pnpm seed --team "Minha Equipe" --days 30 --interval 5 --sensors 4
```

| Opção | Padrão | O que faz |
|---|---|---|
| `--team` | (única equipe, se só houver uma) | Equipe que recebe os sensores; obrigatória com várias equipes |
| `--days` | 7 | Janela de histórico |
| `--interval` | 30 | Segundos entre leituras (o firmware envia a cada 5) |
| `--sensors` | 3 | De 1 a 4: Câmara fria, Freezer, Sala de armazenamento e Estufa (esta fica offline) |

O comando é idempotente: apaga **todas** as leituras de `sensor-1..N` e recria. Só roda em banco local (recusa qualquer outro host em `DATABASE_URL`). Os dados não passam pelo MQTT, então não disparam alertas.

## Notas

- O browser fala só com a web: `/api/*` é reescrito para a API (`API_URL`, padrão `http://localhost:3001`).
- O Mosquitto de dev é anônimo e sem TLS.
- Depois de mudar `apps/api/src/db/schema.ts`: `pnpm --filter @data-track/api db:generate`. Se a migration mexer em dados existentes, edite o SQL gerado (veja a `0002`, que faz backfill da equipe "Padrão").
