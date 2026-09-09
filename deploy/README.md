# 月弦 Docker 部署

本目录是**对外可用的整套 Compose 部署**。仓库根目录不再放 `docker-compose.yml` / `docker-compose.db.yml`。

本地改代码、看控制台，仍优先在仓库根目录跑 `pnpm backend:dev` + `pnpm frontend:dev`，不必先上 Docker。字段怎么填见 [docs/使用教程.md](../docs/使用教程.md)。

仓库和 `.env` 里不要写真实 Token、生产密码、内网地址或客户名。

---

## 1. 会拉起什么

| 服务 | 容器名 | 作用 |
| --- | --- | --- |
| `postgres` | `ylune-postgres` | **唯一配置库**（服务器、用户、分组、Key、系统设置）+ pgvector。默认**不**把 5432 暴露到宿主机。 |
| `ylune` | `ylune` | 月弦本体。用仓库根目录 `Dockerfile` 现场构建，镜像名 `ylune:local`。 |
| `nginx` | `ylune-nginx` | 可选反代。只有加 `--profile proxy` 才会起。 |

数据卷：

| 卷 | 里面是什么 |
| --- | --- |
| `ylune-pg` | 整个月弦：用户、服务器、分组、Key、系统设置、向量索引 |

配置改在控制台里做，写进 Postgres。重建月弦容器不会丢。`docker compose down -v` 或删这个卷才会丢。仓库里的 `mcp_settings.json` 是空种子，不会进镜像（`.dockerignore` 已排除）。详见 [docs/配置与数据.md](../docs/配置与数据.md)。

---

## 2. 本目录文件

| 文件 | 要不要改 | 说明 |
| --- | --- | --- |
| `docker-compose.yml` | 一般不用改 | 正式编排。构建上下文是上一级仓库根目录。 |
| `.env.example` | 复制后改 | 复制为 `.env`，改口令和端口。 |
| `.env` | 必改，勿提交 | 本机/机房密钥。已被根目录 `.gitignore` 的 `.env` 规则忽略。 |
| `nginx.conf` | 改域名时再动 | 根路径反代。`--profile proxy` 时挂进 Nginx。 |
| `nginx.subpath.conf.example` | 子路径时用 | 挂 `/ylune` 时复制到 `nginx.conf`，并设 `BASE_PATH=/ylune`。 |
| `README.md` | — | 本文。 |
| `README.en.md` | — | English. |

根目录 **保留** `Dockerfile`、`entrypoint.sh`、`.dockerignore`，构建必须用它们。不要改业务仓里的 Dockerfile。

---

## 3. 前置条件

- 部署机已装 [Docker Engine](https://docs.docker.com/engine/install/) 和 Compose 插件（`docker compose version` 能出版本）。
- 能访问镜像源（`pgvector/pgvector:pg17`、`nginx:1.27-alpine`，以及构建时的 Node / Python 基座）。
- 宿主机空出 `YLUNE_PORT`（默认 3000）。启用反代时再空出 `NGINX_HTTP_PORT`（默认 80）。
- 首次构建会编译前后端，机器要有足够内存；构建层会拉依赖，需要出网或已配镜像加速。

Windows 上 Docker Desktop 默认是 **Linux 容器**。容器里跑不了 `.exe`。Windows 上编的 DevOpsMCP 二进制不要直接挂进容器，见第 7 节。

---

## 4. 环境变量

复制 `.env.example` 得到 `.env` 后，按表填写。

| 变量 | 示例 | 必填 | 说明 |
| --- | --- | --- | --- |
| `YLUNE_PORT` | `3000` | 否 | 宿主机访问月弦的端口，映射到容器 3000。 |
| `ADMIN_PASSWORD` | 自己设的强密码 | **是** | 仅在库里还没有管理员时用来创建 `admin`。已经有管理员后，改这个变量**不会**改库里的密码，请在控制台改。 |
| `DB_PASSWORD` | 自己设 | **是** | 容器内 Postgres 口令，同时写进 `DB_URL`。请用字母数字，不要用 `@` `:` `/` `#`，否则连接串会断。 |
| `BASE_PATH` | 留空 或 `/ylune` | 否 | 只有 Nginx / 网关把月弦挂在子路径时才填。填了必须和 Nginx `location` 一致。 |
| `NPM_REGISTRY` | `https://registry.npmjs.org/` | 否 | 容器启动时 `entrypoint.sh` 会 `npm config set registry`。国内可改镜像。 |
| `NGINX_HTTP_PORT` | `80` | 否 | 仅 `--profile proxy` 时用。 |
| `DEVOPSMCP_BIN_DIR` | `/opt/devopsmcp` | 否 | 要挂 Linux 二进制时，还要取消 compose 里对应 `volumes` 注释。 |
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

第一次构建可能要十几分钟。看到两个容器 `healthy` 再继续。

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

升级：`git pull` 后在本目录再执行 `docker compose up -d --build`。卷还在，管理员账号和服务器配置还在。

手里还有一份旧 `mcp_settings.json`、库又是空的：本机设 `YLUNE_IMPORT_SETTINGS_FILE` 指向该文件后启动一次，核对控制台后再删文件。不要把这份 JSON 挂进长期运行的容器。步骤见 [docs/配置与数据.md](../docs/配置与数据.md)。

---

## 7. 接 DevOpsMCP

月弦不内置夜莺 / Jenkins / PostgreSQL 工具。二进制在 [DevOpsMCP](https://github.com/isYaoNoistu/DevOpsMCP) 编，控制台里加成 **STDIO** 或 **HTTP** 服务器。凭据只放运行环境，不要写进本仓库。

### 7.1 推荐：上游跑在宿主机或另一台机器（HTTP）

容器是 Linux，宿主机若是 Windows，STDIO 挂 `.exe` 会失败。更稳的做法：

1. 在能访问夜莺 / Jenkins / 库的机器上按 DevOpsMCP 文档把三个服务跑起来（或只跑你需要的）。
2. 若上游只提供 stdio，先在那台机器用任意 HTTP-MCP 封装，或继续本机 `pnpm` 跑月弦、不要用这套容器接 Windows 二进制。
3. 月弦控制台 → **服务器** → 类型选 HTTP / SSE，URL 填上游地址，Header 按上游要求。

### 7.2 容器内 STDIO（仅 Linux 二进制）

1. 在 Linux 上编好 `nightingale-mcp-server`、`jenkins-mcp-server`、`postgres-mcp-server`。
2. `.env` 写 `DEVOPSMCP_BIN_DIR=/绝对路径`。
3. 取消 `docker-compose.yml` 里 `ylune` 的那行 volume 注释。
4. `docker compose up -d` 后，控制台 STDIO 的 `command` 填容器内路径，例如 `/opt/devopsmcp/jenkins-mcp-server`。
5. 环境变量按各 MCP 的 README 填，值用 `${JENKINS_API_TOKEN}` 这类引用，真正的 Token 加到 compose 的 `environment` 或容器 env，不要写进 git。

管理员建组、加成员后，普通用户才能在默认 `/mcp` 里看到对应工具。管理员不必入组。细节见使用教程。

---

## 8. 可选 Nginx

根路径（默认 `nginx.conf`）：

```bash
docker compose --profile proxy up -d
```

浏览器走 `http://<宿主机>:<NGINX_HTTP_PORT>`。此时仍可直接打 `YLUNE_PORT`；若只想对外暴露 80，把 `ylune.ports` 那一段删掉或改成只绑定 `127.0.0.1`。

子路径 `/ylune`：

1. `.env` 设 `BASE_PATH=/ylune`
2. 用 `nginx.subpath.conf.example` 覆盖 `nginx.conf`
3. `docker compose --profile proxy up -d --force-recreate`

TLS 请在这层 Nginx 前面再挂你们现有的证书终结，或自行把本示例改成 443。本仓库不放证书和私钥。

---

## 9. 常见问题

**`ADMIN_PASSWORD` / `DB_PASSWORD` 未设置就退出**  
还没有 `deploy/.env`，或变量名为空。按第 5.1 节复制并填写。

**控制台 502 / 一直不健康**  
`docker compose logs ylune`。常见原因：第一次构建未完成、`/health` 还没起来（`start_period` 60s）、磁盘把卷写挂。

**登录密码不是我后来改的 `ADMIN_PASSWORD`**  
环境变量只用于**首次**创建管理员。之后改密码只走控制台。

**智能路由 / Better Auth 报数据库错误**  
确认 `postgres` 是 `healthy`，且 `DB_PASSWORD` 没有 URL 特殊字符。不要把根目录开发用的 `DB_URL` 和这套容器混用同一端口抢 5432。

**STDIO 服务起不来 / `spawn … ENOENT`**  
`command` 必须是**容器内**存在的 Linux 可执行文件。Windows `.exe`、只存在于宿主机的路径都会失败。改用第 7.1 节。

**改了代码容器没变**  
必须 `--build`。默认用的是刚构建的 `ylune:local`，不是 Docker Hub 上的旧镜像。

**`docker compose down -v` 之后账号没了**  
`-v` 会删 `ylune-pg`（全部配置和数据）。只停进程用 `down`，不要带 `-v`。

**子路径静态资源 404**  
`BASE_PATH` 和 Nginx `location` 不一致。两边都改成 `/ylune` 或都改回根路径。

---

## 10. 和本机开发的区别

| | `pnpm` 开发 | 本目录 Docker |
| --- | --- | --- |
| 配置 | 有 `DB_URL` 进 Postgres；否则才是 `data/mcp_settings.dev.json` | 只在 `ylune-pg` |
| 前端 | Vite `5173`，API 代理到 3000 | 已构建进镜像，只开 `YLUNE_PORT` |
| 数据库 | 真用必须自己起 Postgres 并写 `DB_URL` | 默认带 Postgres |
| 管理员密码 | 开发默认 `admin123`，须立刻改 | `.env` 的 `ADMIN_PASSWORD` |

不要同时在本机 `pnpm` 占 3000 又映射同一端口的容器，会冲突。
