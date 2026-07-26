#!/usr/bin/env bash

set -Eeuo pipefail

SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT
trap 'echo; echo "REPAIR FAILED on line $LINENO"; echo "Command: $BASH_COMMAND"' ERR

echo "=== REPAIR LOCAL DATABASE CREDENTIALS ==="

if [ ! -f .env ]; then
  echo "Missing .env file."
  exit 1
fi

python - <<'PY'
from pathlib import Path
import secrets

path = Path(".env")
lines = path.read_text(encoding="utf-8").splitlines()

values = {}

for line in lines:
    if not line or line.lstrip().startswith("#") or "=" not in line:
        continue

    key, value = line.split("=", 1)
    values[key.strip()] = value.strip()

database = values.get("POSTGRES_DB") or "sorvyra_commerce"
username = values.get("POSTGRES_USER") or "sorvyra"
password = values.get("POSTGRES_PASSWORD") or secrets.token_hex(24)

managed_keys = {
    "POSTGRES_DB",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "DATABASE_URL",
    "DIRECT_URL",
}

preserved = []

for line in lines:
    if "=" not in line:
        preserved.append(line)
        continue

    key = line.split("=", 1)[0].strip()

    if key not in managed_keys:
        preserved.append(line)

connection = (
    f"postgresql://{username}:{password}"
    f"@127.0.0.1:5432/{database}?schema=public"
)

managed = [
    f"POSTGRES_DB={database}",
    f"POSTGRES_USER={username}",
    f"POSTGRES_PASSWORD={password}",
    "",
    f"DATABASE_URL={connection}",
    f"DIRECT_URL={connection}",
]

new_content = "\n".join(managed)

if preserved:
    new_content += "\n\n" + "\n".join(preserved)

path.write_text(new_content.rstrip() + "\n", encoding="utf-8")

print("Synchronized PostgreSQL and Prisma connection settings.")
print(f"Database: {database}")
print(f"User: {username}")
print("Password remains hidden.")
PY

mapfile -t DATABASE_SETTINGS < <(
  python - <<'PY'
from pathlib import Path

values = {}

for line in Path(".env").read_text(encoding="utf-8").splitlines():
    if "=" not in line or line.lstrip().startswith("#"):
        continue

    key, value = line.split("=", 1)
    values[key.strip()] = value.strip()

print(values["POSTGRES_DB"])
print(values["POSTGRES_USER"])
print(values["POSTGRES_PASSWORD"])
PY
)

POSTGRES_DB="${DATABASE_SETTINGS[0]}"
POSTGRES_USER="${DATABASE_SETTINGS[1]}"
POSTGRES_PASSWORD="${DATABASE_SETTINGS[2]}"

echo
echo "=== REMOVE OLD LOCAL DATABASE VOLUME ==="

docker compose \
  -f docker-compose.postgres.yml \
  --env-file .env \
  down \
  --volumes \
  --remove-orphans

echo
echo "=== CREATE FRESH LOCAL DATABASE ==="

docker compose \
  -f docker-compose.postgres.yml \
  --env-file .env \
  up -d

echo
echo "=== WAIT FOR POSTGRESQL ==="

for attempt in $(seq 1 30); do
  HEALTH="$(
    docker inspect \
      --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}starting{{end}}' \
      sorvyra-postgres 2>/dev/null || true
  )"

  echo "Attempt ${attempt}: ${HEALTH:-starting}"

  if [ "$HEALTH" = "healthy" ]; then
    break
  fi

  if [ "$attempt" -eq 30 ]; then
    echo "PostgreSQL failed to become healthy."

    docker compose \
      -f docker-compose.postgres.yml \
      --env-file .env \
      logs postgres

    exit 1
  fi

  sleep 2
done

echo
echo "=== TEST AUTHENTICATED TCP CONNECTION ==="

docker exec \
  -e PGPASSWORD="$POSTGRES_PASSWORD" \
  sorvyra-postgres \
  psql \
  -h 127.0.0.1 \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -c "SELECT current_database(), current_user, 1 AS connection_test;"

echo
echo "=== VALIDATE PRISMA ==="

npm run db:validate
npm run db:generate

echo
echo "=== BUILD APPLICATION ==="

npm run lint
npm run build

echo
echo "=== TEST APPLICATION DATABASE ROUTE ==="

PORT=3101

fuser -k "${PORT}/tcp" 2>/dev/null || true

npm run start -- --hostname 127.0.0.1 --port "$PORT" \
  > /tmp/sorvyra-database-test.log 2>&1 &

SERVER_PID=$!

for attempt in $(seq 1 30); do
  RESPONSE="$(
    curl -s \
      -w '\nHTTP_STATUS:%{http_code}' \
      "http://127.0.0.1:${PORT}/api/health/database" \
      2>/dev/null || true
  )"

  STATUS="$(
    printf '%s\n' "$RESPONSE" |
    sed -n 's/^HTTP_STATUS://p'
  )"

  BODY="$(
    printf '%s\n' "$RESPONSE" |
    sed '/^HTTP_STATUS:/d'
  )"

  if [ "$STATUS" = "200" ]; then
    echo
    echo "=== DATABASE HEALTH RESPONSE ==="
    echo "$BODY"
    echo
    echo "PASS: Next.js successfully connected to PostgreSQL."
    exit 0
  fi

  sleep 1
done

echo
echo "Application database health check failed."
echo
cat /tmp/sorvyra-database-test.log
exit 1
