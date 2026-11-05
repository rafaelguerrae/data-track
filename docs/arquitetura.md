# Arquitetura

```
ESP32 ──MQTT──▶ Mosquitto ──▶ apps/api (Fastify) ──▶ TimescaleDB
                                 │  └─ alertas → SMTP (Mailpit em dev)
                                 └─ REST ◀── apps/web (Next.js + Tailwind)
```

- `apps/api`: assina os tópicos MQTT, grava as leituras, avalia regras de alerta e expõe a API REST (porta 3001)
- `apps/web`: dashboard com gráfico e tela de alertas (porta 3000)
- `packages/shared`: schemas zod e tipos compartilhados (payload, tópicos, DTOs)
- `infra/mosquitto`: config do broker; `scripts/simulate-device.ts`: simula o ESP32

## Como o MQTT funciona aqui

O Mosquitto é só o "correio": o ESP32 **publica** em tópicos e a API **assina**. O firmware (`data-track-firmware`) publica:

| Tópico | Conteúdo |
|---|---|
| `data-track/<device>/temperature` | `{"temp_c":23.47,"ts":123456}` a cada 5s (`ts` = uptime em ms) |
| `data-track/<device>/temperature/status` | `online` / `offline` (retido; `offline` é o LWT, enviado pelo broker se o ESP cair) |
| `data-track/<device>/temperature/fault` | código de falha do MAX31865, ex. `0x04` |

A API assina `data-track/+/temperature/#` (pega os três) e carimba o horário de chegada, já que o `ts` do firmware não é um horário real. Dispositivos novos são cadastrados automaticamente. A telemetria é QoS 0, então pode haver buracos quando o WiFi cai.

## Alertas

Regras (tela **Alertas**): temperatura acima/abaixo de um limite, dispositivo offline, falha do sensor. Cada regra tem um intervalo mínimo (cooldown) entre e-mails.
