#!/usr/bin/env bash

set -Eeuo pipefail

trap 'echo; echo "SETUP FAILED on line $LINENO"; echo "Command: $BASH_COMMAND"; exit 1' ERR

echo "=== ENVIRONMENT ==="
node --version
npm --version
docker --version
git branch --show-current

echo
echo "=== INSTALL DATABASE PACKAGES ==="

npm install \
  @prisma/client \
  @prisma/adapter-pg \
  pg \
  dotenv \
  server-only

npm install --save-dev \
  prisma \
  tsx \
  @types/pg

echo
echo "=== CREATE DIRECTORIES ==="

mkdir -p \
  prisma \
  src/lib \
  src/app/api/health/database

echo
echo "=== CREATE LOCAL ENVIRONMENT ==="

if [ ! -f .env ]; then
  DB_PASSWORD="$(openssl rand -hex 24)"

  cat > .env <<EOF
POSTGRES_DB=sorvyra_commerce
POSTGRES_USER=sorvyra
POSTGRES_PASSWORD=${DB_PASSWORD}

DATABASE_URL=postgresql://sorvyra:${DB_PASSWORD}@127.0.0.1:5432/sorvyra_commerce?schema=public
DIRECT_URL=postgresql://sorvyra:${DB_PASSWORD}@127.0.0.1:5432/sorvyra_commerce?schema=public
EOF

  echo "Created .env"
else
  echo ".env already exists; leaving it unchanged."
fi

cat > .env.example <<'EOF'
POSTGRES_DB=sorvyra_commerce
POSTGRES_USER=sorvyra
POSTGRES_PASSWORD=replace_with_a_secure_local_password

DATABASE_URL=postgresql://sorvyra:replace_with_a_secure_local_password@127.0.0.1:5432/sorvyra_commerce?schema=public
DIRECT_URL=postgresql://sorvyra:replace_with_a_secure_local_password@127.0.0.1:5432/sorvyra_commerce?schema=public
EOF

echo
echo "=== CREATE POSTGRESQL CONTAINER CONFIGURATION ==="

cat > docker-compose.postgres.yml <<'EOF'
services:
  postgres:
    image: postgres:16-alpine
    container_name: sorvyra-postgres
    restart: unless-stopped

    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}

    ports:
      - "127.0.0.1:5432:5432"

    healthcheck:
      test:
        [
          "CMD-SHELL",
          "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"
        ]
      interval: 5s
      timeout: 3s
      retries: 20

    volumes:
      - sorvyra_postgres_data:/var/lib/postgresql/data

volumes:
  sorvyra_postgres_data:
EOF

echo
echo "=== CREATE PRISMA CONFIGURATION ==="

cat > prisma/schema.prisma <<'EOF'
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}
EOF

cat > prisma.config.ts <<'EOF'
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",

  migrations: {
    path: "prisma/migrations",
  },

  datasource: {
    url: env("DIRECT_URL"),
  },
});
EOF

echo
echo "=== CREATE PRISMA CLIENT ==="

cat > src/lib/prisma.ts <<'EOF'
import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is missing from the server environment.",
    );
  }

  const adapter = new PrismaPg({
    connectionString,
  });

  return new PrismaClient({
    adapter,
  });
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
EOF

echo
echo "=== CREATE DATABASE HEALTH ROUTE ==="

cat > src/app/api/health/database/route.ts <<'EOF'
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "ok",
        database: "connected",
        latencyMs: Date.now() - startedAt,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Database health check failed:", error);

    return NextResponse.json(
      {
        status: "error",
        database: "unavailable",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
EOF

echo
echo "=== ADD NPM DATABASE COMMANDS ==="

npm pkg set \
  scripts.db:up="docker compose -f docker-compose.postgres.yml --env-file .env up -d" \
  scripts.db:down="docker compose -f docker-compose.postgres.yml --env-file .env down" \
  scripts.db:logs="docker compose -f docker-compose.postgres.yml --env-file .env logs -f postgres" \
  scripts.db:validate="prisma validate" \
  scripts.db:generate="prisma generate" \
  scripts.db:migrate="prisma migrate dev" \
  scripts.db:deploy="prisma migrate deploy" \
  scripts.db:studio="prisma studio"

python - <<'PY'
from pathlib import Path

path = Path(".gitignore")
content = path.read_text(encoding="utf-8")

for entry in [
    "/src/generated/prisma",
]:
    if entry not in content:
        content = content.rstrip() + f"\n{entry}\n"

path.write_text(content, encoding="utf-8")
print("Updated .gitignore")
PY

echo
echo "=== START POSTGRESQL ==="

npm run db:up

echo
echo "=== WAIT FOR POSTGRESQL ==="

for attempt in $(seq 1 30); do
  health="$(
    docker inspect \
      --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}starting{{end}}' \
      sorvyra-postgres 2>/dev/null || true
  )"

  echo "Attempt ${attempt}: ${health:-starting}"

  if [ "$health" = "healthy" ]; then
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
echo "=== TEST POSTGRESQL INSIDE CONTAINER ==="

POSTGRES_USER="$(
  grep '^POSTGRES_USER=' .env |
  cut -d= -f2-
)"

POSTGRES_DB="$(
  grep '^POSTGRES_DB=' .env |
  cut -d= -f2-
)"

docker exec sorvyra-postgres \
  psql \
  -U "$POSTGRES_USER" \
  -d "$POSTGRES_DB" \
  -c "SELECT current_database(), current_user;"

echo
echo "=== VALIDATE PRISMA ==="

npm run db:validate
npm run db:generate

echo
echo "=== CHECK APPLICATION ==="

npm run lint
npm run build

echo
echo "=== SETUP COMPLETED ==="
git status --short
