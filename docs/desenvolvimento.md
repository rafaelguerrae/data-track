# Desenvolvimento

## Endereços locais

- Dashboard: http://localhost:3000
- API: http://localhost:3001
- E-mails (Mailpit): http://localhost:8025

## Usando o ESP32 de verdade

No `src/config.h` do firmware, coloque `MQTT_HOST` = IP da sua máquina na rede local e a porta `1883`.

## Teste manual sem hardware

```bash
mosquitto_pub -h localhost -t data-track/esp32-01/temperature -m '{"temp_c":31.2,"ts":1000}'
```

## Convenções

- Docs e comentários em português (pt-BR).
- Nomes de arquivos em kebab-case.
- Imports internos usam o alias `#` apontando para `src/` do app (ex.: `#components/temp-chart`, `#db/client`), configurado no `tsconfig.json` de cada app.
- No frontend, `app/` fica na raiz de `apps/web`; o restante (`components/`, `lib/`) fica em `src/`.

## Em produção (não feito ainda)

O Mosquitto de dev é anônimo e sem TLS (como o firmware). Antes de expor: `password_file` + listener TLS no broker, e TLS/credenciais no firmware. Também não há login no dashboard.
