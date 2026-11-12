#!/usr/bin/env bash
# Deploy na VPS, executado pelo workflow cd.yml via `ssh ... bash -s < scripts/deploy-vps.sh`.
# Atualiza só a API e o Mosquitto; Caddy e TimescaleDB não são tocados.
#
# Variáveis: DRY_RUN=1 só mostra o plano; FORCE=1 redeploya os dois serviços sem olhar o diff.
#
# Como o script chega por stdin, todo o corpo fica numa função (o bash a lê inteira antes de
# executar) e cada comando recebe </dev/null para não consumir o resto do script.
set -euo pipefail

REPO_DIR="${REPO_DIR:-$HOME/data-track}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
API_IMAGE="${API_IMAGE:-data-track-api}"
DRY_RUN="${DRY_RUN:-0}"
FORCE="${FORCE:-0}"

log() { printf '[deploy] %s\n' "$*"; }
die() { printf '[deploy] ERRO: %s\n' "$*" >&2; exit 1; }

# Executa o comando, ou só o mostra quando DRY_RUN=1.
run() {
  if [ "$DRY_RUN" = "1" ]; then
    log "(dry-run) $*"
  else
    "$@" </dev/null
  fi
}

compose() { docker compose -f docker-compose.prod.yml --env-file .env.prod "$@"; }

# Algum dos caminhos mudou entre OLD e NEW?
changed() { [ -n "$(git diff --name-only "$OLD" "$NEW" -- "$@")" ]; }

backup_db() {
  local file="$BACKUP_DIR/pre-${NEW:0:7}.dump"
  if [ "$DRY_RUN" = "1" ]; then
    log "(dry-run) pg_dump -> $file (mantendo os 5 últimos)"
    return
  fi
  mkdir -p "$BACKUP_DIR"
  compose exec -T timescaledb pg_dump -U datatrack -Fc datatrack </dev/null > "$file.tmp"
  mv "$file.tmp" "$file"
  log "backup do banco: $file"
  ls -1t "$BACKUP_DIR"/pre-*.dump 2>/dev/null | tail -n +6 | xargs -r rm -f || true
}

# Espera a API responder pelo domínio público e conectar ao broker (até ~60 s).
healthy() {
  local domain i logs
  domain="$(grep -E '^DOMAIN=' .env.prod | cut -d= -f2-)"
  for i in $(seq 1 30); do
    # Os logs vão para uma variável: `| grep -q` com pipefail daria falso negativo (SIGPIPE).
    logs="$(compose logs api </dev/null 2>&1 || true)"
    if curl -fsS -m 5 "https://$domain/health" </dev/null >/dev/null 2>&1 \
      && grep -q '\[mqtt\] connected' <<<"$logs"; then
      return 0
    fi
    sleep 2
  done
  return 1
}

rollback_api() {
  log "health check falhou; últimas linhas da API:"
  compose logs --tail 30 api </dev/null 2>&1 || true
  if docker image inspect "$API_IMAGE:previous" >/dev/null 2>&1; then
    log "revertendo para a imagem anterior"
    docker tag "$API_IMAGE:previous" "$API_IMAGE:latest"
    compose up -d --no-deps api </dev/null
  else
    log "não há imagem anterior para reverter"
  fi
  die "deploy da API falhou (migrations são só para frente: o rollback é de código)"
}

main() {
  cd "$REPO_DIR"
  [ "$(git branch --show-current)" = "main" ] || die "a VPS precisa estar na branch main"

  local OLD NEW api=0 mosquitto=0
  OLD="$(git rev-parse HEAD)"
  git fetch --quiet origin main </dev/null
  if [ "$DRY_RUN" = "1" ]; then
    NEW="$(git rev-parse origin/main)"
  else
    # ff-only: se alguém editou à mão na VPS, falha em vez de sobrescrever.
    git merge --ff-only origin/main </dev/null
    NEW="$(git rev-parse HEAD)"
  fi
  log "commit: ${OLD:0:7} -> ${NEW:0:7}"

  if [ "$FORCE" = "1" ]; then
    api=1; mosquitto=1
    log "FORCE=1: redeploy de api e mosquitto"
  else
    changed infra/mosquitto && mosquitto=1
    changed apps/api packages/shared pnpm-lock.yaml package.json pnpm-workspace.yaml turbo.json .dockerignore && api=1
    if changed docker-compose.prod.yml; then
      api=1; mosquitto=1
      log "AVISO: docker-compose.prod.yml mudou; só api e mosquitto são recriados (caddy e timescaledb ficam como estão)"
    fi
  fi
  log "escopo: api=$api mosquitto=$mosquitto"

  if [ "$api" = 0 ] && [ "$mosquitto" = 0 ]; then
    log "nada a atualizar na VPS"
    return 0
  fi

  if [ "$api" = 1 ] && changed apps/api/drizzle; then
    log "há migration nova: backup do banco antes"
    backup_db
  fi

  # A config do Mosquitto é bind mount: recriar garante que ele veja os arquivos novos.
  if [ "$mosquitto" = 1 ]; then
    log "atualizando mosquitto"
    run compose up -d --no-deps --force-recreate mosquitto
  fi

  if [ "$api" = 1 ]; then
    log "atualizando api (build na VPS)"
    if docker image inspect "$API_IMAGE:latest" >/dev/null 2>&1; then
      run docker tag "$API_IMAGE:latest" "$API_IMAGE:previous"
    fi
    run compose up -d --build --no-deps api
    if [ "$DRY_RUN" != "1" ]; then
      healthy || rollback_api
      log "API saudável"
    fi
  fi

  run docker image prune -f
  log "concluído: ${OLD:0:7} -> ${NEW:0:7}"
}

main "$@"; exit $?
