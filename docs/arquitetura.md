# Arquitetura

```
ESP32 ──MQTT──▶ Mosquitto ──▶ apps/api (Fastify) ──▶ TimescaleDB
                                 │  └─ alertas → SMTP (Mailpit em dev)
                                 └─ REST ◀── apps/web (Next.js + Tailwind)
```

- `apps/api`: assina os tópicos MQTT, grava as leituras, avalia regras de alerta e expõe a API REST (porta 3001)
- `apps/web`: login, dashboard com gráfico, tela de alertas e gestão da equipe (porta 3000)
- `packages/shared`: schemas zod e tipos compartilhados (payload, tópicos, DTOs)
- `infra/mosquitto`: config do broker; `scripts/simulate-device.ts`: simula o ESP32

## Como o MQTT funciona aqui

O Mosquitto é só o "correio": o ESP32 **publica** em tópicos e a API **assina**. O firmware (`data-track-firmware`) publica:

| Tópico | Conteúdo |
|---|---|
| `data-track/<device>/temperature` | `{"temp_c":23.47,"ts":123456}` a cada 5s (`ts` = uptime em ms) |
| `data-track/<device>/temperature/status` | `online` / `offline` (retido; `offline` é o LWT, enviado pelo broker se o ESP cair) |
| `data-track/<device>/temperature/fault` | código de falha do MAX31865, ex. `0x04` |

A API assina `data-track/+/temperature/#` (pega os três) e carimba o horário de chegada, já que o `ts` do firmware não é um horário real. Dispositivos novos são cadastrados automaticamente, sem equipe, e ficam invisíveis até uma equipe reivindicá-los. A telemetria é QoS 0, então pode haver buracos quando o WiFi cai.

## Alertas

Regras (tela **Alertas**): temperatura acima/abaixo de um limite, dispositivo offline, falha do sensor. Cada regra tem um intervalo mínimo (cooldown) entre e-mails.

## Usuários e equipes

- Todo usuário pertence a **uma equipe**, com papel `admin` ou `member`. Sensores, regras e histórico de alertas são da equipe: todos os membros veem os mesmos dados.
- **Sem cadastro aberto.** O primeiro admin é criado por script (`create-admin`, ver [desenvolvimento](desenvolvimento.md)); os demais entram por link de convite (7 dias) gerado na página **Equipe**.
- **Sensor por reivindicação.** O device nasce sem equipe (`devices.team_id` nulo). Um admin informa o ID na página Equipe para vinculá-lo; vinculado a outra equipe, responde 404. Admins também renomeiam o sensor (`PATCH /team/devices/:id`; o ID vem do firmware e não muda). Desvincular apaga as regras de alerta do sensor.
- Só admins convidam, removem membros, renomeiam a equipe (`PATCH /team`) e vinculam/desvinculam sensores. Membros veem tudo e criam regras de alerta.
- **Sessão.** Login em `POST /auth/login` (senha com scrypt) cria uma sessão no banco; o cookie `dt_session` (HttpOnly, SameSite=Lax, Secure em produção) guarda um token cujo hash SHA-256 é o id da sessão. Validade de 14 dias com renovação deslizante, 401 limpa o cookie.
- **Proxy.** O navegador só chama `/api/*` na própria web, que o Next reescreve para a API (ver `next.config.ts`); por isso o cookie é first-party e não há CORS. O `proxy.ts` do Next só redireciona por presença do cookie; quem valida a sessão é a API.
- Tabelas: `users`, `teams`, `memberships`, `sessions`, `invites`; `devices.team_id` e `alert_rules.team_id`. A ingestão MQTT não conhece usuários.
