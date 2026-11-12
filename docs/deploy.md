# Deploy

Frontend na **Vercel**; API, banco, broker MQTT e proxy HTTPS em **uma VPS** (Serverspace) com Docker Compose (`docker-compose.prod.yml`). O nome público é um subdomínio gratuito do **DuckDNS**: `data-track.duckdns.org`.

```
ESP32 ──MQTT/TLS :8883──▶ Mosquitto ──▶ api ──▶ TimescaleDB
Navegador ──▶ Vercel (web) ──/api/* reescrito──▶ Caddy :443 ──▶ api
                  ambos usam data-track.duckdns.org
```

## Decisões

- **API na VPS, não na Vercel.** A API mantém uma conexão MQTT permanente (assinante), e a Vercel só executa funções sob demanda. O Mosquitto também precisa de uma porta TCP pública. Só o frontend roda na Vercel; use o projeto `apps/web` isolado, **sem** o import multi-serviço (Services).
- **Cookie first-party via proxy.** O navegador só fala com a Vercel: `/api/*` é reescrito (`rewrites` do Next) para a API. Assim o cookie de sessão (`dt_session`, HttpOnly) pertence ao domínio da web e não depende de cookies de terceiros, já que web e `duckdns.org` são sites diferentes. Não há CORS no caminho do navegador.
- **Um hostname só.** API (443) e MQTT (8883) usam portas diferentes, então `data-track.duckdns.org` atende os dois, e o Caddy emite o certificado que o Mosquitto reutiliza.
- **DuckDNS em vez de comprar domínio.** O Let's Encrypt emite certificado para o subdomínio, e a Vercel só aceita chamar uma API com HTTPS válido.
- **VPS pequena basta.** 1 vCPU, 2 GB de RAM e 24 GB de disco dão conta (uso estimado ~1 GB de RAM). O ponto mais pesado é o build da imagem da API; crie 2 GB de swap na VPS antes do primeiro build (passo 2).

## Pré-requisitos

- VPS Serverspace com Ubuntu 24.04 ou superior (testado no 26.04) ou Debian e acesso root, **sem** cPanel. Portas **80, 443 e 8883** liberadas no firewall do painel e na própria VPS.
- Subdomínio `data-track.duckdns.org` apontando para a VPS (passo 1).
- Provedor SMTP real para os alertas (usamos o Resend). O Mailpit só serve em desenvolvimento.

## 1. DuckDNS

Em https://www.duckdns.org/domains, no domínio `data-track`, preencha o campo **ipv4** com o IPv4 público da VPS e salve.

- Se a VPS tiver IPv6, pode preencher o campo **ipv6** também, mas **mantenha o IPv4**: o ESP32 e muitas redes domésticas só usam IPv4, e o Let's Encrypt valida pelo IPv4.
- Confira a resolução: `dig +short data-track.duckdns.org`.
- O IP da VPS é fixo; se o provedor trocar, atualize o registro.

## 2. VPS

### Acesso SSH

Crie uma chave só para este servidor e instale a pública na VPS (no painel da Serverspace ou com `ssh-copy-id`):

```bash
ssh-keygen -t ed25519 -a 100 -C "data-track-vps" -f ~/.ssh/id_data_track
ssh-copy-id -i ~/.ssh/id_data_track.pub root@<IP_DA_VPS>
```

Crie o usuário `deploy` (sudo sem senha, só chave) e teste o login **antes** de desativar o root:

```bash
adduser --disabled-password --gecos "" deploy && usermod -aG sudo deploy
echo "deploy ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/90-deploy && chmod 440 /etc/sudoers.d/90-deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
install -m 600 -o deploy -g deploy /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
```

Alias em `~/.ssh/config` (máquina local):

```
Host data-track
    HostName <IP_DA_VPS>
    User deploy
    IdentityFile ~/.ssh/id_data_track
    IdentitiesOnly yes
```

Com `ssh data-track` funcionando, desative root e senha. O arquivo precisa começar com `00-`: o `sshd` usa o **primeiro** valor encontrado e o `50-cloud-init.conf` da imagem ativa `PasswordAuthentication yes`.

```bash
printf 'PermitRootLogin no\nPasswordAuthentication no\nKbdInteractiveAuthentication no\n' | sudo tee /etc/ssh/sshd_config.d/00-hardening.conf
sudo sshd -t && sudo systemctl reload ssh
sudo sshd -T | grep -E "^(permitrootlogin|passwordauthentication)"   # ambos devem ser "no"
```

### Firewall, swap e Docker

```bash
sudo apt-get update && sudo apt-get install -y ufw fail2ban ca-certificates curl
sudo ufw allow 22/tcp && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw allow 8883/tcp
sudo ufw enable        # libere a 22 ANTES, senão você perde o acesso

sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab
```

Instale o Docker pelo repositório oficial (https://docs.docker.com/engine/install/ubuntu/; o Ubuntu 26.04 `resolute` é suportado) e adicione o usuário ao grupo: `sudo usermod -aG docker deploy` (reconecte em seguida). Esse grupo equivale a root na máquina.

### Código e segredos

```bash
git clone <repo> data-track && cd data-track
cp .env.prod.example .env.prod && chmod 600 .env.prod
```

Gere as senhas com `openssl rand -hex 24` e preencha o `.env.prod` (`POSTGRES_PASSWORD`, `MQTT_API_PASSWORD`, `SMTP_PASS`, `WEB_ORIGIN` sem barra no final). Não cole chaves em chats nem commits.

**SMTP (Resend):** `SMTP_HOST=smtp.resend.com`, porta `587`, usuário `resend`, senha = API key. O Resend não aceita remetente `gmail.com`/`outlook.com`: sem domínio próprio verificado, use `MAIL_FROM=onboarding@resend.dev`, que só entrega para o e-mail da conta Resend. O `duckdns.org` não serve para verificar domínio (você não controla o DNS dele).

Crie os usuários do broker (`device` para o ESP32, `api` para a API) e o ACL. O arquivo de senhas e o ACL precisam ser do usuário `mosquitto` (uid 1883), senão o broker não consegue abri-los:

```bash
cp infra/mosquitto/acl.example infra/mosquitto/acl
docker run --rm -v "$PWD/infra/mosquitto:/c" eclipse-mosquitto:2 mosquitto_passwd -c -b /c/passwords api '<MQTT_API_PASSWORD do .env.prod>'
docker run --rm -v "$PWD/infra/mosquitto:/c" eclipse-mosquitto:2 mosquitto_passwd -b /c/passwords device '<senha-do-esp32>'
sudo chown 1883:1883 infra/mosquitto/passwords infra/mosquitto/acl && sudo chmod 600 infra/mosquitto/passwords infra/mosquitto/acl
```

Guarde a senha do ESP32 num arquivo seguro (`chmod 600`) para colocar no firmware.

### Subir

A API aplica as migrations ao iniciar:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
curl https://data-track.duckdns.org/health
```

O Caddy emite o certificado de `data-track.duckdns.org` e o Mosquitto o reutiliza. O volume do Caddy guarda o certificado em `caddy/certificates/...`, e o Mosquitto roda com `user root` no `mosquitto.prod.conf` porque o certificado só é legível por root. Se o Mosquitto subir antes do certificado existir, reinicie-o: `docker compose -f docker-compose.prod.yml --env-file .env.prod restart mosquitto`.

### Renovação do certificado (cron)

O Caddy renova a cada ~60 dias, mas o Mosquitto só relê o certificado ao reiniciar. Agende um restart mensal (`crontab -e` como `deploy`):

```
0 4 1 * * cd /home/deploy/data-track && docker compose -f docker-compose.prod.yml --env-file .env.prod restart mosquitto >> /home/deploy/mosquitto-restart.log 2>&1
```

### Acesso ao banco (DBeaver)

O TimescaleDB só escuta no loopback da VPS (`127.0.0.1:5432`), nunca na internet. Acesse por túnel SSH.

No DBeaver: nova conexão **PostgreSQL** → Host `localhost`, porta `5432`, banco `datatrack`, usuário `datatrack`, senha = `POSTGRES_PASSWORD` do `.env.prod` da VPS. Na aba **SSH**, marque *Use SSH Tunnel*: host `<IP_DA_VPS>`, porta `22`, usuário `deploy`, *Authentication Method* = *Public Key* com a chave `~/.ssh/id_data_track`.

Alternativa pelo terminal (o DBeaver então conecta em `localhost:5432` sem a aba SSH):

```bash
ssh -N -L 5432:localhost:5432 data-track
```

Um shell SQL direto, sem túnel nem senha:

```bash
ssh -t data-track 'cd data-track && docker compose -f docker-compose.prod.yml --env-file .env.prod exec timescaledb psql -U datatrack datatrack'
```

## 3. Vercel (frontend)

1. Importe o repositório como projeto **único** com **Root Directory** `apps/web` e habilite "Include source files outside of the Root Directory" (o app depende de `packages/shared`). Ignore a sugestão de multi-serviço.
2. Variável de ambiente (só no servidor): `API_URL=https://data-track.duckdns.org`. Ela alimenta o rewrite de `/api/*`.
3. Faça o deploy e coloque a URL final em `WEB_ORIGIN` no `.env.prod` da VPS, depois rode o `up -d` de novo (sem barra no final da URL). Ela vira o `WEB_URL` dos links de convite e o `CORS_ORIGIN`.

### Primeiro administrador

O cadastro é só por convite, então crie o primeiro admin (e a equipe) na VPS. A senha vem de `ADMIN_PASSWORD` ou de um prompt:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm -e ADMIN_PASSWORD='<senha>' api \
  node dist/scripts/create-admin.js --email voce@exemplo.com --name "Seu Nome" --team "Nome da Equipe"
```

Dados anteriores à autenticação (sensores e regras) são migrados para uma equipe chamada **Padrão**. Para herdá-los, use `--team "Padrão"`. Depois, no app, a página **Equipe** convida os demais usuários e vincula sensores pelo ID.

## 4. Firmware (ESP32)

O firmware atual usa `WiFiClient` (sem TLS) e não está preparado para isso. Ajustes necessários em `data-track-firmware`:

- Trocar `WiFiClient` por `WiFiClientSecure` e chamar `setCACert(...)` com a raiz ISRG Root X1 (Let's Encrypt). Para testes, `setInsecure()` funciona, mas não valida o servidor.
- `MQTT_HOST` = `data-track.duckdns.org`, `MQTT_PORT` = `8883`, `MQTT_USER` = `device`, `MQTT_PASS` = a senha criada acima.

## 5. CI/CD (GitHub Actions)

- **CI** (`.github/workflows/ci.yml`, em todo PR para `main`): `pnpm typecheck`, `pnpm build`, checagem de que `schema.ts` não mudou sem migration (`db:generate` não pode gerar arquivos novos), build da imagem da API e validação do `docker-compose.prod.yml`.
- **CD** (`.github/workflows/cd.yml`, no push em `main`): roda o CI como portão e, se passar, executa `scripts/deploy-vps.sh` na VPS por SSH. Só dispara quando o commit toca API, `packages/shared`, `infra/mosquitto`, o compose, o lockfile ou `turbo.json`; merges só de `apps/web` ou `docs/` não fazem deploy (o frontend é da Vercel).

O script atualiza **só a API e o Mosquitto**. Caddy, TimescaleDB, `.env.prod`, `infra/mosquitto/passwords`/`acl` e o cron do certificado continuam manuais. Se um merge adicionar variável nova ao `.env.prod.example`, edite o `.env.prod` da VPS **antes** do merge.

O que o script faz:

1. `git merge --ff-only origin/main` (falha, em vez de sobrescrever, se a VPS tiver edição manual) e calcula o escopo pelo diff do commit.
2. Se `apps/api/drizzle/` mudou, faz `pg_dump` em `~/backups/pre-<sha>.dump` (mantém os 5 últimos).
3. Recria o Mosquitto (`--force-recreate`, porque a config é bind mount) e reconstrói a API na VPS com `--no-deps`.
4. Health check de até ~60 s: `https://<DOMAIN>/health` e `[mqtt] connected` no log da API. Se falhar, volta para a imagem anterior (`data-track-api:previous`) e o job fica vermelho. Migrations só andam para frente: o rollback é de código.

### Configuração (uma vez)

Crie uma chave **só para o CD**, sem passphrase (não reutilize a `id_data_track`), e autorize-a na VPS com `restrict` (sem pty nem forwarding):

```bash
ssh-keygen -t ed25519 -N "" -C "github-actions-deploy" -f ~/.ssh/gh_deploy
ssh data-track "echo 'restrict $(cat ~/.ssh/gh_deploy.pub)' >> ~/.ssh/authorized_keys"
```

No repositório GitHub, crie o Environment `production` (Settings → Environments) e cadastre os secrets nele. Para o `VPS_KNOWN_HOSTS`, confira a impressão digital com `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` na VPS antes de confiar:

```bash
gh secret set VPS_SSH_KEY --env production < ~/.ssh/gh_deploy
gh secret set VPS_HOST --env production --body "data-track.duckdns.org"
gh secret set VPS_USER --env production --body "deploy"
ssh-keyscan -t ed25519 data-track.duckdns.org | gh secret set VPS_KNOWN_HOSTS --env production
rm ~/.ssh/gh_deploy ~/.ssh/gh_deploy.pub     # a cópia do GitHub basta
```

Em Settings → Branches, proteja a `main` exigindo os checks `ci` e `docker` antes do merge.

### Uso

- **Deploy manual / ensaio:** Actions → CD → *Run workflow*. Com `dry_run` marcado, o log mostra o escopo e os comandos sem alterar a VPS. Sem `dry_run`, redeploya os dois serviços.
- **Reverter à mão** (quando o rollback automático não bastar): `docker tag data-track-api:previous data-track-api:latest && docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --no-deps api`. Para voltar dados, restaure o dump com `SELECT timescaledb_pre_restore();` antes do `pg_restore` e `SELECT timescaledb_post_restore();` depois.

## Verificação

```bash
mosquitto_pub -h data-track.duckdns.org -p 8883 --capath /etc/ssl/certs -u device -P '<senha>' \
  -t data-track/esp32-01/temperature -m '{"temp_c":25.0,"ts":1000}'
curl https://data-track.duckdns.org/devices
```

## Pendências conhecidas

- Sem recuperação de senha nem troca de senha pelo app: um admin remove o usuário e convida de novo.
- Sensores continuam criados por qualquer mensagem MQTT autenticada com a senha `device`; a equipe só os vê depois de vinculá-los pelo ID.
- O backup do banco só acontece antes de migrations (CD, últimos 5 em `~/backups`); não há backup periódico do volume `pg-data`.
- O restart do Mosquitto que recarrega o certificado é mensal (cron): uma renovação logo após o restart só é carregada no mês seguinte, ainda dentro da validade de 90 dias.
