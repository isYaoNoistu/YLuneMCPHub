# YLune Docker deploy

This directory is the **supported Compose pack**. There is no `docker-compose.yml` or `docker-compose.db.yml` at the repo root anymore.

For local UI work, prefer `pnpm backend:dev` + `pnpm frontend:dev` at the repo root. Field-level console help: [docs/使用教程.md](../docs/使用教程.md) (Chinese). The longer Chinese runbook is [README.md](README.md).

Do not put real tokens, production passwords, internal hostnames, or customer names in git.

---

## What starts

| Service | Container | Role |
| --- | --- | --- |
| `postgres` | `ylune-postgres` | **The** config store (servers, users, groups, keys, system settings) plus pgvector. Port 5432 is **not** published by default. |
| `ylune` | `ylune` | The gateway. Built from the repo-root `Dockerfile` as `ylune:local`. |
| `nginx` | `ylune-nginx` | Optional reverse proxy. Started only with `--profile proxy`. |

Volume: `ylune-pg` holds everything. Console edits go to Postgres. Recreating the YLune container does not wipe config; `docker compose down -v` does. The committed `mcp_settings.json` is an empty seed and is excluded from the image. See [docs/配置与数据.md](../docs/配置与数据.md).

Root `Dockerfile`, `entrypoint.sh`, and `.dockerignore` stay where they are; the image build needs them.

---

## Env file

```bash
cd deploy
cp .env.example .env   # Windows: Copy-Item .env.example .env
```

| Variable | Required | Notes |
| --- | --- | --- |
| `YLUNE_PORT` | no | Host port → container 3000. Default `3000`. |
| `ADMIN_PASSWORD` | **yes** | Used only when no admin exists yet. Changing it later does **not** change the password in the DB; use the console. |
| `DB_PASSWORD` | **yes** | Postgres password, also interpolated into `DB_URL`. Use alphanumerics; avoid `@` `:` `/` `#`. |
| `BASE_PATH` | no | Set only for a subpath proxy (e.g. `/ylune`). Must match Nginx `location`. |
| `NPM_REGISTRY` | no | Applied by `entrypoint.sh` at start. |
| `NGINX_HTTP_PORT` | no | Used with `--profile proxy`. |
| `DEVOPSMCP_BIN_DIR` | no | Linux binaries only; also uncomment the volume in compose. |
| `PUBLISH_DB_PORT` | no | Uncomment `postgres.ports` if you need host access to the DB. |

Compose fails fast if `ADMIN_PASSWORD` or `DB_PASSWORD` is unset (`${VAR:?…}`).

---

## Start

```bash
cd deploy
docker compose up -d --build
# or from repo root:
# docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

Wait until both services are `healthy` (`docker compose ps`). Open `http://<host>:<YLUNE_PORT>`, sign in as `admin` with `ADMIN_PASSWORD`, **change the password immediately**. MCP URL is `http://<host>:<YLUNE_PORT>/mcp`.

Check `GET /health`, console login, and `docker compose exec postgres pg_isready -U ylune -d ylune`.

---

## Day-to-day

From `deploy/`:

```bash
docker compose ps
docker compose logs -f ylune
docker compose restart ylune
docker compose up -d --build ylune
docker compose down          # keep the database volume
docker compose down -v       # wipe all config and data
docker compose exec -T postgres pg_dump -U ylune ylune > ylune.sql
```

---

## DevOpsMCP

YLune does not ship Nightingale / Jenkins / PostgreSQL tools. Build them from [DevOpsMCP](https://github.com/isYaoNoistu/DevOpsMCP).

The image is Linux. **Windows `.exe` files cannot run inside the container.** Prefer running those MCPs on a host that can reach the real APIs, then add them in the console as HTTP/SSE. For in-container STDIO, mount Linux binaries (`DEVOPSMCP_BIN_DIR`) and point `command` at the **container** path (e.g. `/opt/devopsmcp/jenkins-mcp-server`). Put tokens in env, not in git.

Regular users only see tools from groups they belong to. Admins do not need to join a group.

---

## Optional Nginx

```bash
docker compose --profile proxy up -d
```

Root path uses `nginx.conf`. For `/ylune`, set `BASE_PATH=/ylune` and copy `nginx.subpath.conf.example` over `nginx.conf`. Terminate TLS in front of this proxy; do not commit certificates here.

---

## Common failures

| Symptom | What to check |
| --- | --- |
| Compose exits mentioning `ADMIN_PASSWORD` / `DB_PASSWORD` | Create `deploy/.env` from the example. |
| Unhealthy / 502 | `docker compose logs ylune`; first boot can take a minute (`start_period` 60s). |
| Env password ignored after first boot | Admin already exists; change it in the console. |
| `spawn … ENOENT` on STDIO | Path must exist **inside** the Linux container. |
| Image did not pick up code | You must `--build`. This pack does not pull `samanhappy/mcphub`. |
| Settings gone | You used `down -v`. |
| Subpath 404 | `BASE_PATH` and Nginx `location` disagree. |
