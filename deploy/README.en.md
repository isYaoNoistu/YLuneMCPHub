# YLune Docker deploy

This directory is the **supported Compose pack**. There is no `docker-compose.yml` or `docker-compose.db.yml` at the repo root anymore.

For local UI work, prefer `pnpm backend:dev` + `pnpm frontend:dev` at the repo root. Field-level console help: [docs/user-guide.md](../docs/user-guide.md) (Chinese). The longer Chinese runbook is [README.md](README.md).

Do not put real tokens, production passwords, internal hostnames, or customer names in git.

---

## What starts

| Service | Container | Role |
| --- | --- | --- |
| `postgres` | `ylune-postgres` | Config store. Default image `postgres:16`. pgvector is only needed for `$smart`. Port 5432 is **not** published by default. |
| `ylune` | `ylune` | The gateway. Built from the repo-root `Dockerfile` as `ylune:local`. |
| `nginx` | `ylune-nginx` | Optional HTTP reverse proxy. Started only with `--profile proxy`. |
| `nginx-https` | `ylune-nginx-https` | Optional HTTPS. Fill domain + host certs in `.env`, then `--profile https`. |

Volume: `ylune-pg` holds everything. Console edits go to Postgres. Recreating the YLune container does not wipe config; `docker compose down -v` does. The committed `mcp_settings.json` is an empty seed and is excluded from the image. See [docs/config-and-data.md](../docs/config-and-data.md).

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
| `JWT_SECRET` | no | JWT signing key. Unset uses a new random secret each start (sessions die on restart). |
| `BASE_PATH` | no | Set only for a subpath proxy (e.g. `/ylune`). Must match Nginx `location`. |
| `NPM_REGISTRY` | no | Build + runtime. Default `https://registry.npmmirror.com`. |
| `DEBIAN_MIRROR` / `DEBIAN_SECURITY_MIRROR` | no | Build-time apt. Default Aliyun. |
| `NODE_DIST_MIRROR` | no | Node 22 tarball mirror (not NodeSource). |
| `PYPI_INDEX` | no | `uv tool install` index. |
| `NGINX_HTTP_PORT` | no | Used with `--profile proxy` or `--profile https`. With HTTPS, port 80 only redirects to 443. |
| `YLUNE_DOMAIN` | HTTPS | Public hostname. Console, copied `mcp.json`, and agents then use `https://that-host`. |
| `TLS_CERT_FILE` | HTTPS | Host path to the certificate (full chain). Mounted read-only into Nginx. Do not commit it. |
| `TLS_KEY_FILE` | HTTPS | Host path to the private key. |
| `NGINX_HTTPS_PORT` | no | Used with `--profile https`. Default `443`. |
| `YLUNE_BIND` | no | Bind address for port 3000. After HTTPS, set `127.0.0.1` so clients cannot skip Nginx. |
| `INSTALL_BASE_URL` | no | Public root for agents and OAuth. If empty and `YLUNE_DOMAIN` is set, the container uses `https://$YLUNE_DOMAIN`. That value wins over a leftover IP or localhost in Settings, so copied `mcp.json` and on-screen MCP URLs use the domain. |
| `POSTGRES_IMAGE` | no | Default `postgres:16`. For `$smart` use `pgvector/pgvector:pg16` (Postgres 17 is not required). Do not reuse `ylune-pg` across major versions. |
| `MCP_MOUNT_DIR` | no | Host dir mapped to `/opt/mcp`. Default `/data/ylune-mcp`. Empty is fine; DevOpsMCP `attach.sh` writes binaries here. |
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

YLune does not ship Nightingale / Jenkins / PostgreSQL tools. Build them from [DevOpsMCP](https://github.com/isYaoNoistu/DevOpsMCP). DevOpsMCP is **stdio only**; the YLune container **spawns** the binaries.

YLune still starts with `docker compose up -d --build`. The image always mounts `/opt/mcp`. Compile, copy files, and register on the hub with DevOpsMCP `deploy/attach.sh` (see that repo’s [deploy/README.md](https://github.com/isYaoNoistu/DevOpsMCP/blob/main/deploy/README.md)). Chinese walkthrough: [docs/linux-deploy.md](../docs/linux-deploy.md).

```text
/data/DevOpsMCP      # source
/data/YLuneMCPHub    # this repo
/data/ylune-mcp      # mount (binaries, targets, pgpass); not in git
```

```bash
cd /data/YLuneMCPHub/deploy
docker compose up -d --build

cd /data/DevOpsMCP/deploy
cp .env.example .env   # tokens + REGISTER_*
./attach.sh
```

Console `command` is `/opt/mcp/...`. Same-host Jenkins / n9e / DB: `host.docker.internal`, never `127.0.0.1` from inside the container. Windows `.exe` files cannot run in this image.

Regular users only see tools from groups they belong to. Admins do not need to join a group.

---

## Optional Nginx

Do not enable `--profile proxy` and `--profile https` together; both bind port 80.

HTTP only:

```bash
docker compose --profile proxy up -d
```

Root path uses `nginx.conf`. For `/ylune`, set `BASE_PATH=/ylune` and copy `nginx.subpath.conf.example` over `nginx.conf`.

### HTTPS (domain + host certificates)

Certificates stay on the host. Compose mounts them read-only into Nginx. Do not commit keys.

```bash
# deploy/.env
YLUNE_DOMAIN=ylune.example.com
TLS_CERT_FILE=/data/certs/ylune/fullchain.pem
TLS_KEY_FILE=/data/certs/ylune/privkey.pem
YLUNE_BIND=127.0.0.1
```

Point DNS at this machine, open 80/443, then:

```bash
docker compose --profile https up -d --build
```

Open `https://ylune.example.com`. Copied `mcp.json`, the dashboard, and Settings MCP URLs all use `https://ylune.example.com/mcp`. A leftover IP in the database is overridden by the domain in `.env`.

Let's Encrypt `live/*.pem` files are often symlinks; put `readlink -f` paths in `.env`. After renewal: `docker compose --profile https exec nginx-https nginx -s reload`.

---

## Common failures

| Symptom | What to check |
| --- | --- |
| Compose exits mentioning `ADMIN_PASSWORD` / `DB_PASSWORD` | Create `deploy/.env` from the example. |
| Browser shows no UI / log says `UI is not available` | Pull a build that treats `@ylune/mcphub` as the package name, then `docker compose up -d --build`. |
| `mcp_settings.json` ENOENT in logs | Expected in database mode; config lives in Postgres. |
| `vector` extension missing | Expected with `postgres:16`. Only `$smart` needs `pgvector/pgvector:pg16`. |
| Unhealthy / 502 | `docker compose logs ylune`; first boot can take a minute (`start_period` 60s). |
| Env password ignored after first boot | Admin already exists; change it in the console. |
| `spawn … ENOENT` on STDIO | `command` must exist **inside** the container (`/opt/mcp/...`). Run DevOpsMCP `attach.sh` first. |
| Image did not pick up code | You must `--build`. This pack does not pull `samanhappy/mcphub`. |
| Settings gone | You used `down -v`. |
| Subpath 404 | `BASE_PATH` and Nginx `location` disagree. |
| `nginx-https` exits immediately | `YLUNE_DOMAIN` is empty, or the host cert/key files are missing. Defaults are `/data/certs/ylune/fullchain.pem` and `privkey.pem`. |
| Copied `mcp.json` still uses `http://IP:3000` | `YLUNE_DOMAIN` is empty, or the image is old. Rebuild with `--build` after setting the domain. |
