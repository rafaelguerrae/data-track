# Deploy

Frontend na **Vercel**; API, banco, broker MQTT e proxy HTTPS em **uma VPS** com Docker Compose (`docker-compose.prod.yml`).

```
ESP32 ──MQTT/TLS :8883──▶ Mosquitto ──▶ api ──▶ TimescaleDB
Navegador ──▶ Vercel (web) ──HTTPS──▶ Caddy ──▶ api
```

## Pré-requisitos

- Uma VPS (Ubuntu) com Docker e portas **80, 443 e 8883** abertas no firewall.
- Dois registros DNS apontando para o IP da VPS: `api.seudominio.com` e `mqtt.seudominio.com`.
- Um provedor SMTP real (SES, Resend, etc.) para os alertas.

## 1. VPS

```bash
git clone <repo> data-track && cd data-track
cp .env.prod.example .env.prod      # preencha domínios, senhas e SMTP
```

Crie os usuários do broker (`device` para o ESP32, `api` para a API) e o ACL:

```bash
cp infra/mosquitto/acl.example infra/mosquitto/acl
docker run --rm -v "$PWD/infra/mosquitto:/c" eclipse-mosquitto:2 mosquitto_passwd -c -b /c/passwords api '<MQTT_API_PASSWORD do .env.prod>'
docker run --rm -v "$PWD/infra/mosquitto:/c" eclipse-mosquitto:2 mosquitto_passwd -b /c/passwords device '<senha-do-esp32>'
```

Suba tudo (a API aplica as migrations ao iniciar):

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
curl https://api.seudominio.com/health
```

O Caddy emite o certificado de `mqtt.seudominio.com` e o Mosquitto o reutiliza. Se o Mosquitto subir antes do certificado existir, reinicie-o depois: `docker compose -f docker-compose.prod.yml --env-file .env.prod restart mosquitto`. Os certificados renovam a cada ~60 dias; agende esse restart mensalmente (cron).

## 2. Vercel (frontend)

1. Importe o repositório na Vercel com **Root Directory** `apps/web` e habilite "Include source files outside of the Root Directory" (o app depende de `packages/shared`).
2. Variável de ambiente: `NEXT_PUBLIC_API_URL=https://api.seudominio.com`.
3. Faça o deploy e coloque a URL final em `WEB_ORIGIN` no `.env.prod` da VPS (CORS), depois rode o `up -d` de novo.

## 3. Firmware (ESP32)

O firmware atual usa `WiFiClient` (sem TLS) e não está preparado para isso. Ajustes necessários em `data-track-firmware`:

- Trocar `WiFiClient` por `WiFiClientSecure` e chamar `setCACert(...)` com a raiz ISRG Root X1 (Let's Encrypt). Para testes, `setInsecure()` funciona, mas não valida o servidor.
- `MQTT_HOST` = `mqtt.seudominio.com`, `MQTT_PORT` = `8883`, `MQTT_USER` = `device`, `MQTT_PASS` = a senha criada acima.

## Verificação

```bash
mosquitto_pub -h mqtt.seudominio.com -p 8883 --capath /etc/ssl/certs -u device -P '<senha>' \
  -t data-track/esp32-01/temperature -m '{"temp_c":25.0,"ts":1000}'
curl https://api.seudominio.com/devices
```

## Pendências conhecidas

- O dashboard não tem login: qualquer pessoa com a URL vê os dados e cria regras.
- Sem backup automático do banco (volume `pg-data`).
