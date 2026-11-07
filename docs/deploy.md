# Deploy

Frontend na **Vercel**; API, banco, broker MQTT e proxy HTTPS em **uma VPS** (Serverspace) com Docker Compose (`docker-compose.prod.yml`). O nome público é um subdomínio gratuito do **DuckDNS**: `data-track.duckdns.org`.

```
ESP32 ──MQTT/TLS :8883──▶ Mosquitto ──▶ api ──▶ TimescaleDB
Navegador ──▶ Vercel (web) ──HTTPS :443──▶ Caddy ──▶ api
                  ambos usam data-track.duckdns.org
```

## Decisões

- **API na VPS, não na Vercel.** A API mantém uma conexão MQTT permanente (assinante), e a Vercel só executa funções sob demanda. O Mosquitto também precisa de uma porta TCP pública. Só o frontend roda na Vercel; use o projeto `apps/web` isolado, **sem** o import multi-serviço (Services).
- **Um hostname só.** API (443) e MQTT (8883) usam portas diferentes, então `data-track.duckdns.org` atende os dois, e o Caddy emite o certificado que o Mosquitto reutiliza.
- **DuckDNS em vez de comprar domínio.** O Let's Encrypt emite certificado para o subdomínio, e a Vercel só aceita chamar uma API com HTTPS válido.
- **VPS pequena basta.** 1 vCPU, 2 GB de RAM e 50 GB de disco dão conta (uso estimado ~1 GB de RAM). O ponto mais pesado é o build da imagem da API; se faltar memória, crie 2 GB de swap na VPS.

## Pré-requisitos

- VPS Serverspace com Ubuntu 24.04 (ou Debian) e acesso root, **sem** cPanel. Portas **80, 443 e 8883** liberadas no firewall do painel e na própria VPS.
- Subdomínio `data-track.duckdns.org` apontando para a VPS (passo 1).
- Provedor SMTP real (Resend, Brevo, SES) para os alertas. O Mailpit só serve em desenvolvimento.

## 1. DuckDNS

Em https://www.duckdns.org/domains, no domínio `data-track`, preencha o campo **ipv4** com o IPv4 público da VPS e salve.

- Se a VPS tiver IPv6, pode preencher o campo **ipv6** também, mas **mantenha o IPv4**: o ESP32 e muitas redes domésticas só usam IPv4, e o Let's Encrypt valida pelo IPv4.
- Confira a resolução: `dig +short data-track.duckdns.org`.
- O IP da VPS é fixo; se o provedor trocar, atualize o registro.

## 2. VPS

Instale o Docker (https://docs.docker.com/engine/install/ubuntu/) e libere as portas:

```bash
sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw allow 8883 && sudo ufw enable
```

Baixe o código e configure:

```bash
git clone <repo> data-track && cd data-track
cp .env.prod.example .env.prod      # troque as senhas e preencha o SMTP
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
curl https://data-track.duckdns.org/health
```

O Caddy emite o certificado de `data-track.duckdns.org` e o Mosquitto o reutiliza. Se o Mosquitto subir antes do certificado existir, reinicie-o depois: `docker compose -f docker-compose.prod.yml --env-file .env.prod restart mosquitto`. Os certificados renovam a cada ~60 dias; agende esse restart mensalmente (cron).

## 3. Vercel (frontend)

1. Importe o repositório como projeto **único** com **Root Directory** `apps/web` e habilite "Include source files outside of the Root Directory" (o app depende de `packages/shared`). Ignore a sugestão de multi-serviço.
2. Variável de ambiente: `NEXT_PUBLIC_API_URL=https://data-track.duckdns.org`.
3. Faça o deploy e coloque a URL final em `WEB_ORIGIN` no `.env.prod` da VPS (CORS), depois rode o `up -d` de novo.

## 4. Firmware (ESP32)

O firmware atual usa `WiFiClient` (sem TLS) e não está preparado para isso. Ajustes necessários em `data-track-firmware`:

- Trocar `WiFiClient` por `WiFiClientSecure` e chamar `setCACert(...)` com a raiz ISRG Root X1 (Let's Encrypt). Para testes, `setInsecure()` funciona, mas não valida o servidor.
- `MQTT_HOST` = `data-track.duckdns.org`, `MQTT_PORT` = `8883`, `MQTT_USER` = `device`, `MQTT_PASS` = a senha criada acima.

## Verificação

```bash
mosquitto_pub -h data-track.duckdns.org -p 8883 --capath /etc/ssl/certs -u device -P '<senha>' \
  -t data-track/esp32-01/temperature -m '{"temp_c":25.0,"ts":1000}'
curl https://data-track.duckdns.org/devices
```

## Pendências conhecidas

- O dashboard não tem login: qualquer pessoa com a URL vê os dados e cria regras.
- Sem backup automático do banco (volume `pg-data`).
- Reiniciar o Mosquitto após cada renovação do certificado.
