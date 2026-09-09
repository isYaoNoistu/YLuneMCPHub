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

「服务器」应为已连接。然后：**分组**勾工具并加成员。智能体只连 `http://<机器>:3000/mcp` + 用户 Key。管理员不必入组。

---

## 4. 常见失败

| 现象 | 原因 |
| --- | --- |
| 容器没有 `/opt/mcp` | 还在用旧 compose，或没 `git pull` 月弦 |
| `spawn … ENOENT` | 没跑 `attach.sh`，或 `command` 填了宿主机路径 |
| 登录月弦 API 失败 | 控制台已改密，DevOpsMCP `.env` 没写 `YLUNE_PASSWORD` |
| 普通用户 `/mcp` 没有工具 | 还没进组 |

Compose 约定见 [../deploy/README.md](../deploy/README.md)。配置落库见 [配置与数据.md](配置与数据.md)。
