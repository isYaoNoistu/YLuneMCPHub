# Linux：月弦 + DevOpsMCP（`/data` 两仓）

月弦怎么启动不变：`deploy/` 里 `docker compose up`。容器里永远有一个挂载点 `/opt/mcp`。

接夜莺 / Jenkins / PostgreSQL 不要手填三个 STDIO 表单，到 **DevOpsMCP** 跑脚本。

```text
/data/YLuneMCPHub     # 月弦
/data/DevOpsMCP       # MCP
/data/ylune-mcp       # 挂载点（不进 git）：二进制、targets、pgpass
```

不要把 Token、口令、真实主机名写进 git。

---

## 1. 起月弦

```bash
cd /data/YLuneMCPHub/deploy
cp .env.example .env
# 改 ADMIN_PASSWORD、DB_PASSWORD
# 本机已有 postgres:16 时，.env 里 POSTGRES_IMAGE=postgres:16（示例里已是这个）
# MCP_MOUNT_DIR 默认 /data/ylune-mcp，一般不用动
docker compose up -d --build
# 构建默认走阿里云 Debian + npmmirror Node/npm；卡在 deb.debian.org 的旧构建请停掉重来
```

浏览器：`http://<机器>:3000`，`admin` + `.env` 里的口令。登录后立刻改密码。

要走 HTTPS：在同一份 `.env` 写 `YLUNE_DOMAIN`、`TLS_CERT_FILE`、`TLS_KEY_FILE`（证书放宿主机，例如 `/data/certs/ylune/`），再：

```bash
# 建议同时 YLUNE_BIND=127.0.0.1，避免再明文开 3000
docker compose --profile https up -d --build
```

之后控制台和智能体都用 `https://你的域名`，`mcp.json` 里是 `https://你的域名/mcp`。步骤见 [deploy/README.md](../deploy/README.md) 第 8.2 节。

---

## 2. 接 DevOpsMCP

```bash
cd /data/DevOpsMCP/deploy
cp .env.example .env
# REGISTER_NIGHTINGALE / JENKINS / POSTGRES 按需 true/false
# 填对应 Token；改过月弦管理员密码后写 YLUNE_PASSWORD
chmod +x attach.sh
./attach.sh
```

脚本会编译 Linux 二进制、写入 `/data/ylune-mcp`、登录月弦 API 注册你打开的那些服务。说明见 [DevOpsMCP deploy/README.md](https://github.com/isYaoNoistu/DevOpsMCP/blob/main/deploy/README.md)。

同机上游用 `host.docker.internal`，不要用 `127.0.0.1`。

---

## 3. 之后在月弦里只做授权

「服务器」应为已连接。然后：**用户**里勾工具并复制 `mcp.json`。智能体只连 `/mcp` + 用户 Key。没开 HTTPS 时是 `http://<机器>:3000/mcp`；写了域名和证书后是 `https://你的域名/mcp`。管理员不必单独授权。

---

## 4. 已有环境重新发版

配置在 Postgres 卷里，重建月弦容器不会丢账号和服务器。必须带 `--build`，否则还是旧镜像。

```bash
cd /data/YLuneMCPHub
git pull
cd deploy
docker compose up -d --build
```

本版起普通用户按「用户」页勾 MCP / 工具授权，不再靠分组。启动时若用户还没有 `grants` 字段，会从旧分组成员抄一次；已经是空清单的不会再覆盖。发版后打开 **用户** 核对授权，再复制 `mcp.json`（可反复复制）。智能体只连 `/mcp` + 该用户 Key。

---

## 5. 常见失败

| 现象 | 原因 |
| --- | --- |
| 容器没有 `/opt/mcp` | 还在用旧 compose，或没 `git pull` 月弦 |
| 打开 :3000 没有控制台 / `UI is not available` | 旧镜像不认 `@ylune/mcphub`。`git pull` 后 `docker compose up -d --build` |
| 日志 `mcp_settings.json` ENOENT | 配置在 Postgres，属正常噪音 |
| 日志没有 vector 扩展 | `postgres:16` 预期如此；`$smart` 才要 `pgvector/pgvector:pg16` |
| `spawn … ENOENT` | 没跑 `attach.sh`，或 `command` 填了宿主机路径 |
| 登录月弦 API 失败 | 控制台已改密，DevOpsMCP `.env` 没写 `YLUNE_PASSWORD` |
| `--profile https` Nginx 起不来 | `.env` 没写域名，或宿主机证书路径不存在 / 仍是 Let's Encrypt 软链 |
| 普通用户 `/mcp` 没有工具 | 还没在用户页勾服务器和工具；或 `git pull` 后没 `--build` |

Compose 约定见 [../deploy/README.md](../deploy/README.md)。配置落库见 [config-and-data.md](config-and-data.md)。
