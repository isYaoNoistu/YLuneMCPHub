# 月弦 Docker 部署

本目录是**对外可用的整套 Compose 部署**。仓库根目录不再放 `docker-compose.yml` / `docker-compose.db.yml`。

本地改代码、看控制台，仍优先在仓库根目录跑 `pnpm backend:dev` + `pnpm frontend:dev`，不必先上 Docker。字段怎么填见 [docs/user-guide.md](../docs/user-guide.md)。

仓库和 `.env` 里不要写真实 Token、生产密码、内网地址或客户名。

---

## 1. 会拉起什么

| 服务 | 容器名 | 作用 |
| --- | --- | --- |
| `postgres` | `ylune-postgres` | **唯一配置库**（服务器、用户、分组、Key、系统设置）。默认镜像 `postgres:16`。智能路由才需要 pgvector。默认**不**把 5432 暴露到宿主机。 |
| `ylune` | `ylune` | 月弦本体。用仓库根目录 `Dockerfile` 现场构建，镜像名 `ylune:local`。 |
| `nginx` | `ylune-nginx` | 可选 HTTP 反代。只有加 `--profile proxy` 才会起。 |
| `nginx-https` | `ylune-nginx-https` | 可选 HTTPS。`.env` 写了域名和证书后加 `--profile https`。 |

数据卷：

| 卷 | 里面是什么 |
| --- | --- |
| `ylune-pg` | 整个月弦：用户、服务器、分组、Key、系统设置、向量索引 |

配置改在控制台里做，写进 Postgres。重建月弦容器不会丢。`docker compose down -v` 或删这个卷才会丢。仓库里的 `mcp_settings.json` 是空种子，不会进镜像（`.dockerignore` 已排除）。详见 [docs/config-and-data.md](../docs/config-and-data.md)。

---

## 2. 本目录文件

| 文件 | 要不要改 | 说明 |
| --- | --- | --- |
| `docker-compose.yml` | 一般不用改 | 正式编排。构建上下文是上一级仓库根目录。`ylune` 固定把 `MCP_MOUNT_DIR` 挂到 `/opt/mcp`。 |
| `.env.example` | 复制后改 | 复制为 `.env`，改口令和端口。 |
| `.env` | 必改，勿提交 | 本机/机房密钥。已被根目录 `.gitignore` 的 `.env` 规则忽略。 |
| `nginx.conf` | 改域名时再动 | 根路径 HTTP 反代。`--profile proxy` 时挂进 Nginx。 |
| `nginx.https.conf.template` | 一般不用改 | HTTPS 模板。`--profile https` 时按 `YLUNE_DOMAIN` 生成配置。 |
| `nginx.subpath.conf.example` | 子路径时用 | 挂 `/ylune` 时复制到 `nginx.conf`，并设 `BASE_PATH=/ylune`。 |
| `README.md` | — | 本文。 |
| `README.en.md` | — | English. |

根目录 **保留** `Dockerfile`、`entrypoint.sh`、`.dockerignore`，构建必须用它们。不要改业务仓里的 Dockerfile。

---

## 3. 前置条件

- 部署机已装 [Docker Engine](https://docs.docker.com/engine/install/) 和 Compose 插件（`docker compose version` 能出版本）。
- 能访问镜像源（`postgres:16` 或你在 `POSTGRES_IMAGE` 里写的镜像、`nginx:1.27-alpine`）。构建月弦默认走国内 Debian / Node / npm / PyPI，见第 4 节。
- 宿主机空出 `YLUNE_PORT`（默认 3000）。启用 HTTP 反代时再空出 `NGINX_HTTP_PORT`（默认 80）；启用 HTTPS 时还要空出 `NGINX_HTTPS_PORT`（默认 443）。
- 首次构建会编译前后端，机器要有足够内存；构建层会拉依赖，需要出网或已配镜像加速。

Windows 上 Docker Desktop 默认是 **Linux 容器**。容器里跑不了 `.exe`。要把 DevOpsMCP 接进月弦，在 Linux 上跑对方仓库的 `deploy/attach.sh`。

---

## 4. 环境变量

复制 `.env.example` 得到 `.env` 后，按表填写。

| 变量 | 示例 | 必填 | 说明 |
| --- | --- | --- | --- |
| `YLUNE_PORT` | `3000` | 否 | 宿主机访问月弦的端口，映射到容器 3000。 |
| `ADMIN_PASSWORD` | 自己设的强密码 | **是** | 仅在库里还没有管理员时用来创建 `admin`。已经有管理员后，改这个变量**不会**改库里的密码，请在控制台改。 |
| `DB_PASSWORD` | 自己设 | **是** | 容器内 Postgres 口令，同时写进 `DB_URL`。请用字母数字，不要用 `@` `:` `/` `#`，否则连接串会断。 |
| `JWT_SECRET` | 长随机串 | 否 | 登录 JWT 签名。不设则每次启动用临时密钥，重启后要重新登录。生产请设。 |
| `YLUNE_MASTER_KEY` | `openssl rand -base64 32` | 写凭据时是 | 凭据中心 AES-256-GCM 主密钥，只放进程环境。不设时列表仍可读，创建 / 替换 / 试连失败，不会把明文写进库。已有服务器要在 `.env` 里补这项。 |
| `YLUNE_RUNTIME_TOKEN` | 长随机串 | 兑换租约时是 | MCP 运行时调用 `POST /internal/v1/credential-leases/:id/resolve` 的 Bearer。不设则该接口 503。不要提交进 git。 |
| `BASE_PATH` | 留空 或 `/ylune` | 否 | 只有 Nginx / 网关把月弦挂在子路径时才填。填了必须和 Nginx `location` 一致。 |
| `NPM_REGISTRY` | `https://registry.npmmirror.com` | 否 | **构建和运行**都用。构建时传给 Dockerfile；容器启动时 `entrypoint.sh` 再设一次。海外可改回 `https://registry.npmjs.org/` |
| `DEBIAN_MIRROR` | `https://mirrors.aliyun.com/debian` | 否 | 构建时替换 Debian 软件源。海外可改 `https://deb.debian.org/debian` |
| `DEBIAN_SECURITY_MIRROR` | `https://mirrors.aliyun.com/debian-security` | 否 | 构建时 Debian security。海外可改 `https://deb.debian.org/debian-security` |
| `NODE_DIST_MIRROR` | `https://npmmirror.com/mirrors/node` | 否 | 构建时下载 Node 22 官方二进制，不再走 nodesource |
| `PYPI_INDEX` | `https://mirrors.aliyun.com/pypi/simple` | 否 | 构建时 `uv tool install` 用的 PyPI |
| `NGINX_HTTP_PORT` | `80` | 否 | `--profile proxy` 或 `--profile https` 时用。HTTPS 时 80 只做跳转到 443。 |
| `YLUNE_DOMAIN` | `ylune.example.com` | HTTPS 时是 | 对外域名。写了之后控制台、复制的 `mcp.json`、智能体都走 `https://该域名`（见 `INSTALL_BASE_URL`）。 |
| `TLS_CERT_FILE` | `/data/certs/ylune/fullchain.pem` | HTTPS 时是 | 宿主机证书（含中间链）。只挂进 Nginx，不进 git。 |
| `TLS_KEY_FILE` | `/data/certs/ylune/privkey.pem` | HTTPS 时是 | 宿主机私钥。权限收紧，不要提交。 |
| `NGINX_HTTPS_PORT` | `443` | 否 | 仅 `--profile https` 时用。 |
| `YLUNE_BIND` | `127.0.0.1` | 否 | 月弦 3000 绑到哪。启用 HTTPS 后建议 `127.0.0.1`，避免绕过 Nginx 明文访问。 |
| `INSTALL_BASE_URL` | `https://ylune.example.com` | 否 | 智能体和 OAuth 看到的公网根。不填但写了 `YLUNE_DOMAIN` 时，用 `https://该域名`。这个值优先于控制台里以前存的 IP / localhost，复制的 `mcp.json` 和页面上的 MCP 地址都会走域名。 |
| `POSTGRES_IMAGE` | `postgres:16` | 否 | 配置库镜像。默认官方 16。智能路由要向量扩展时用 `pgvector/pgvector:pg16`（**不必 17**）。换大版本不要直接复用 `ylune-pg` 卷。 |
| `MCP_MOUNT_DIR` | `/data/ylune-mcp` | 否 | 宿主机目录，映射到容器 `/opt/mcp`。空目录即可。DevOpsMCP 的 `attach.sh` 往这里写二进制。 |
| `PUBLISH_DB_PORT` | `5432` | 否 | 默认不暴露库端口。要在宿主机连库时，取消 compose 里 `postgres.ports` 注释。 |

未写 `ADMIN_PASSWORD` 或 `DB_PASSWORD` 时，Compose 会直接拒绝启动（`${VAR:?…}`），避免用空口令起来。

需要 HTTP 代理、Better Auth、超时等变量时，在 `docker-compose.yml` 的 `ylune.environment` 里按需加一行，值仍只放 `.env`。根目录 `.env.example` 是给 `pnpm` 本机开发用的，和本目录不是同一份。

---

## 5. 部署步骤

在仓库根目录已经 `git clone` 的前提下操作。

### 5.1 准备环境文件

Linux / macOS：

```bash
cd deploy
cp .env.example .env
```

Windows PowerShell：

```powershell
cd deploy
Copy-Item .env.example .env
```

用编辑器打开 `.env`，把 `ADMIN_PASSWORD` 和 `DB_PASSWORD` 改成自己的。不要用示例里的 `change-me-*` 对内网发布。

### 5.2 构建并启动

仍在 `deploy/` 目录：

```bash
docker compose up -d --build
```

或在仓库根目录：

```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

第一次构建会拉 Debian / Node / pnpm 依赖。默认走阿里云和 npmmirror（见 `.env.example`）。`git pull` 后必须 `--build` 才会用新 Dockerfile。若上一层卡在 `deb.debian.org`，先停掉再重新 `up -d --build`。

```bash
docker compose ps
docker compose logs -f ylune
```

### 5.3 打开控制台

浏览器访问 `http://<宿主机>:<YLUNE_PORT>`（本机即 http://127.0.0.1:3000 ）。

| 项 | 值 |
| --- | --- |
| 账号 | `admin` |
| 密码 | `.env` 里的 `ADMIN_PASSWORD` |
| MCP 端点 | `http://<宿主机>:<YLUNE_PORT>/mcp` |

登录后立刻在控制台改管理员密码。智能体连 MCP 不要连错端口。

### 5.4 验收

1. `GET /health` 返回正常（compose 健康检查也打这个）。
2. 能登录控制台。
3. 管理员改完密码后退出再登，新密码有效。
4. **服务器** 页能打开；此时可以还没有任何 MCP，属正常。
5. 需要 Postgres 时：`docker compose exec postgres pg_isready -U ylune -d ylune` 应成功。

---

## 6. 日常操作

以下命令默认当前目录是 `deploy/`。在仓库根目录执行时补上 `-f deploy/docker-compose.yml --env-file deploy/.env`。

| 目的 | 命令 |
| --- | --- |
| 看状态 | `docker compose ps` |
| 看月弦日志 | `docker compose logs -f ylune` |
| 看库日志 | `docker compose logs -f postgres` |
| 重启月弦 | `docker compose restart ylune` |
| 改镜像代码后重建 | `docker compose up -d --build ylune` |
| 停掉（保留卷） | `docker compose down` |
| 停掉并删卷（**配置和库都没**） | `docker compose down -v` |

备份（迁走只要这一份库）：

```bash
docker compose exec -T postgres pg_dump -U ylune ylune > ylune.sql
```

恢复库（会覆盖，先停业务或确认目标库）：

```bash
docker compose exec -T postgres psql -U ylune -d ylune < ylune.sql
```

升级：`git pull` 后在本目录再执行 `docker compose up -d --build`。卷还在，管理员账号和服务器配置还在。本版起普通用户按用户页勾工具授权；启动时会把还没有 `grants` 的旧用户从分组成员抄一次。发版后打开「用户」核对，再复制 `mcp.json`。

手里还有一份旧 `mcp_settings.json`、库又是空的：本机设 `YLUNE_IMPORT_SETTINGS_FILE` 指向该文件后启动一次，核对控制台后再删文件。不要把这份 JSON 挂进长期运行的容器。步骤见 [docs/config-and-data.md](../docs/config-and-data.md)。

---

## 7. 接 DevOpsMCP

月弦只负责启动，并留挂载点 `/opt/mcp`。编译、灌文件、在控制台注册，都在 DevOpsMCP 仓库：

**[DevOpsMCP/deploy/README.md](https://github.com/isYaoNoistu/DevOpsMCP/blob/main/deploy/README.md)**（本机若两仓都在 `/data`，即 `/data/DevOpsMCP/deploy/README.md`）。

本仓这边仍是一条命令：

```bash
cd /data/YLuneMCPHub/deploy
docker compose up -d --build
```

然后到 DevOpsMCP：

```bash
cd /data/DevOpsMCP/deploy
cp .env.example .env   # 填 Token 和 REGISTER_*
./attach.sh
```

同机的夜莺 / Jenkins / 库，在 DevOpsMCP 的 `.env` 里用 `host.docker.internal`，不要用 `127.0.0.1`。逐步说明见 [docs/linux-deploy.md](../docs/linux-deploy.md)。

---

## 8. 可选 Nginx

`proxy`（HTTP）和 `https` **不要同时开**，两个容器都会占 80。

### 8.1 只反代 HTTP

根路径（默认 `nginx.conf`）：

```bash
docker compose --profile proxy up -d
```

浏览器走 `http://<宿主机>:<NGINX_HTTP_PORT>`。此时仍可直接打 `YLUNE_PORT`；若只想对外暴露 80，把 `.env` 里 `YLUNE_BIND` 设成 `127.0.0.1`。

子路径 `/ylune`：

1. `.env` 设 `BASE_PATH=/ylune`
2. 用 `nginx.subpath.conf.example` 覆盖 `nginx.conf`
3. `docker compose --profile proxy up -d --force-recreate`

### 8.2 HTTPS（域名 + 宿主机证书）

证书放在宿主机，compose 只把文件只读挂进 Nginx。仓库和镜像里不要放私钥。

1. 把证书放到宿主机，例如 `/data/certs/ylune/fullchain.pem` 与 `privkey.pem`。Let's Encrypt 的 `live/*.pem` 常常是软链，请用 `readlink -f` 填真实文件。
2. 在 `deploy/.env` 写：

```bash
YLUNE_DOMAIN=ylune.example.com
TLS_CERT_FILE=/data/certs/ylune/fullchain.pem
TLS_KEY_FILE=/data/certs/ylune/privkey.pem
YLUNE_BIND=127.0.0.1
# 一般不用手写；留空时容器会设成 https://YLUNE_DOMAIN
# INSTALL_BASE_URL=https://ylune.example.com
```

3. DNS 把该域名指到这台机器。防火墙放行 80 / 443。
4. 启动：

```bash
docker compose --profile https up -d --build
```

5. 浏览器打开 `https://ylune.example.com`。`http://` 会 301 到 HTTPS。复制出来的 `mcp.json`、仪表盘和设置里的 MCP 地址都会是 `https://ylune.example.com/mcp`，不要再写 `http://IP:3000/mcp`。以前存在库里的 IP 会被 `.env` 里的域名盖掉。

证书续期后不用重建镜像，重载 Nginx 即可：

```bash
docker compose --profile https exec nginx-https nginx -s reload
```

私钥权限建议仅部署用户可读。不要把 `TLS_KEY_FILE` 指到仓库目录。

---

## 9. 常见问题

**`ADMIN_PASSWORD` / `DB_PASSWORD` 未设置就退出**  
还没有 `deploy/.env`，或变量名为空。按第 5.1 节复制并填写。

**打开 :3000 显示 Frontend not found / 日志 `UI is not available`**  
镜像其实已经编过前端。旧代码只认 `package.json` 名叫 `mcphub` / `@samanhappy/mcphub`，本仓库是 `@ylune/mcphub`，进程找不到包根目录就不挂静态页。拉到识别 `@ylune/mcphub` 的提交后 `docker compose up -d --build`。

**日志里 `mcp_settings.json` ENOENT / Failed to load settings**  
数据库模式下配置在 Postgres，镜像里本来就没有这份 JSON。启动早期还会走一遍 Json DAO，缺失文件只记 debug，不再打成 error。后面有 `Database mode enabled` / `Database connection established` 就算正常。不要为了消日志把 JSON 挂进容器。

**日志里 `extension "vector" is not available`**  
当前用的是官方 `postgres:16`，没有 pgvector。控制台和 `/mcp` 能用；只有 `$smart` 智能路由才需要把 `POSTGRES_IMAGE` 改成 `pgvector/pgvector:pg16`（不要直接拿 16 的数据目录升 17）。

**控制台 502 / 一直不健康**  
`docker compose logs ylune`。常见原因：第一次构建未完成、`/health` 还没起来（`start_period` 60s）、磁盘把卷写挂。

**登录密码不是我后来改的 `ADMIN_PASSWORD`**  
环境变量只用于**首次**创建管理员。之后改密码只走控制台。

**智能路由 / Better Auth 报数据库错误**  
确认 `postgres` 是 `healthy`，且 `DB_PASSWORD` 没有 URL 特殊字符。不要把根目录开发用的 `DB_URL` 和这套容器混用同一端口抢 5432。

**STDIO 服务起不来 / `spawn … ENOENT`**  
`command` 必须是容器内 `/opt/mcp/...`。先在 DevOpsMCP 跑 `./attach.sh --build-only`，再确认 `docker compose exec ylune ls -l /opt/mcp`。

**改了代码容器没变**  
必须 `--build`。默认用的是刚构建的 `ylune:local`，不是 Docker Hub 上的旧镜像。

**`docker compose down -v` 之后账号没了**  
`-v` 会删 `ylune-pg`（全部配置和数据）。只停进程用 `down`，不要带 `-v`。

**子路径静态资源 404**  
`BASE_PATH` 和 Nginx `location` 不一致。两边都改成 `/ylune` 或都改回根路径。

**`--profile https` 起来后 Nginx 立刻退出**  
`.env` 没写 `YLUNE_DOMAIN`，或宿主机上还没有 `TLS_CERT_FILE` / `TLS_KEY_FILE` 指向的文件。按第 8.2 节先放证书再填路径。未写路径时默认找 `/data/certs/ylune/fullchain.pem` 和 `privkey.pem`。

**HTTPS 证书报错 / 浏览器不信任**  
确认 `TLS_CERT_FILE` 是完整链（Let's Encrypt 用 `fullchain.pem`，不要只用 `cert.pem`），私钥和证书是一对，域名和证书 SAN 一致。软链请改成真实路径。

**复制的 mcp.json 仍是 `http://IP:3000`**  
控制台「基础地址」还留着旧 HTTP 地址。改成 `https://你的域名`，或清空后重启月弦，让 `YLUNE_DOMAIN` 自动生成 `INSTALL_BASE_URL`。

**同时开了 `--profile proxy` 和 `--profile https`**  
两个 Nginx 都会抢 80。只用 `https`。

---

## 10. 和本机开发的区别

| | `pnpm` 开发 | 本目录 Docker |
| --- | --- | --- |
| 配置 | 有 `DB_URL` 进 Postgres；否则才是 `data/mcp_settings.dev.json` | 只在 `ylune-pg` |
| 前端 | Vite `5173`，API 代理到 3000 | 已构建进镜像，只开 `YLUNE_PORT` |
| 数据库 | 真用必须自己起 Postgres 并写 `DB_URL` | 默认带 Postgres |
| 管理员密码 | 开发默认 `admin123`，须立刻改 | `.env` 的 `ADMIN_PASSWORD` |

不要同时在本机 `pnpm` 占 3000 又映射同一端口的容器，会冲突。
