<div align="center">

<h1>月弦</h1>

<p><b>统一 MCP 网关</b> — 接入 · 按用户授权工具 · 用户 Key · 对外端点</p>

<p><b>简体中文</b> · <a href="README.en.md">English</a></p>

在 **WorkBuddy** 或 **Cursor** 里只配一个 HTTP MCP，就能用上本机或机房里已经接好的全部工具。  
月弦跑在**你们自己的机器**上：管理员用**控制台账号**加服务、建用户、按人勾工具；智能体只用该用户的 **Access Key** 连 `/mcp`。  
库口令等 **Credential** 进凭据中心（加密入库）。仓库里没有 Token、没有密码、没有真实主机名。

<p>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue?labelColor=1f2937" alt="Apache 2.0"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node-20+-339933?logo=nodedotjs&logoColor=white&labelColor=1f2937" alt="Node 20+"></a>
  <a href="https://modelcontextprotocol.io/"><img src="https://img.shields.io/badge/MCP-HTTP-7c3aed?labelColor=1f2937" alt="MCP HTTP"></a>
  <img src="https://img.shields.io/badge/auth-per--user%20tools-059669?labelColor=1f2937" alt="per-user tools">
</p>

<p>
  <b><a href="#快速开始">快速开始</a></b> ·
  <a href="#界面">界面</a> ·
  <a href="#和-devopsmcp">和 DevOpsMCP</a> ·
  <a href="#它做什么">它做什么</a> ·
  <a href="#怎么工作">怎么工作</a> ·
  <a href="#适配的智能体">适配的智能体</a> ·
  <a href="#谁能调用什么">谁能调用什么</a> ·
  <a href="#安全模型">安全</a> ·
  <a href="#测试阶段与免责">测试与免责</a> ·
  <a href="#文档">文档</a>
</p>

</div>

---

值班要查告警、发版、数据库时，工具本身在 [DevOpsMCP](https://github.com/isYaoNoistu/DevOpsMCP) 里：夜莺、Jenkins、PostgreSQL 三个只读 stdio 进程。  
**月弦不重复实现这些工具。** 它把已经编好的 MCP 收进来，按用户勾选工具，再以一条 HTTP 端点交给智能体。

一个人接 Cursor 时，可以直接跑 DevOpsMCP 的三个二进制。人一多、要按人裁工具、要统一入口时，才上月弦。

## 界面

控制台是黑底 + 月光青。按功能看一眼就知道月弦管什么。

### 登录

内部入口，没有公开注册。**只有控制台账号能登录**；MCP 用户只拿 Access Key。同一来源短时间失败太多次会被暂时拒绝。智能体不走这页。

![登录](docs/images/login.jpg)

### 仪表盘

网关只读总览：在线服务、工具数、智能体 / 普通用户的调用，以及用户 Token 剩余时间、最近调用和创建时间。管理员还能看到故障提示、到期中心，并导出配置备份。不是管理员自己在调工具。本页不复制 mcp.json、不授权、不加服务器。

![仪表盘](docs/images/dashboard.png)

### 用户权限

管理员按人勾 MCP 和 **具体 tools**。勾选时有权限预览。不勾则这个 Access Key 连 `/mcp` 看不到任何工具。MCP 用户不能登录控制台。仅后台管理员能登录，默认不签发 Key。Key 过期只挡住智能体，不影响后台。侧栏还有凭据中心、资源绑定、调试台和操作审计。

![用户权限：按人勾选服务器和工具](docs/images/add-user.png)

### 调用日志

每次工具调用一条记录：谁、哪个服务、哪个工具、成功或失败、耗时、来源 IP。点详情可再看入参出参（若设置里打开了存储调用内容；Token 等密钥会脱敏）。

![调用日志](docs/images/activity.png)


| 现场     | 只接 DevOpsMCP                         | 前面再加月弦                                      |
| ------ | ----------------------------------- | -------------------------------------------- |
| 一个人值班  | `mcp.json` 写三个 stdio，本机直连           | 用得上，但不必                      |
| 多人共用   | 每人一份路径和 Token，工具全集都在               | 管理员建用户、按人勾工具；用户只贴一段 `/mcp` + 自己的 Key        |
| 工具变多   | 客户端工具数容易顶满                            | 默认 `/mcp` 只暴露该用户勾过的工具 |
| 新同事入职 | 再抄一份本机配置                              | 控制台建用户，复制生成的 `mcp.json` 即可                   |


## 它做什么

- **统一网关** — 一个进程对外提供 `/mcp`、`/mcp/{服务}`、`/mcp/$smart`。上游可以是 stdio、HTTP、SSE、OpenAPI。
- **按用户授权** — 管理员在用户页勾该用户能用的 MCP 和 tools。普通用户默认 `/mcp` = 自己的授权清单；空清单 = 零工具。管理员默认全部已启用服务。
- **用户与 Access Key** — 创建 MCP 用户后系统才签发 Access Key。用户列表和编辑页随时可以再复制 Cursor / WorkBuddy `mcp.json`，也可以轮换 Key。仅后台管理员没有 Key。
- **控制台** — 服务器、用户、凭据中心、调试台、操作审计、设置、内置提示词 / 资源、日志与调用记录。私有化部署默认不展示外部市场。
- **凭据中心** — 加密保存你自定义的变量名和密文，不按 PostgreSQL / Token 等固定表单。可从已接入 MCP 自动带出需要的变量名；凭据要绑到对应 MCP，创建用户时再给该用户选一条。调用时覆盖该 MCP 的环境变量（Jenkins / 夜莺这类读 env 的进程）。主密钥是 `YLUNE_MASTER_KEY`。列表只显示变量名和「已配置」，没有「查看明文」。Targets 同样是自定义配置；资源组仍用于多 Target。命中绑定后工具参数会带上短时一次性 `credentialLeaseId`（不含密文）。
- **可选能力** — 智能路由（`$smart` + pgvector）、工具结果压缩、OAuth 2.0 授权服务器、Better Auth 第三方登录、PostgreSQL 配置库、CLI。

不是再写一套夜莺 / Jenkins / PostgreSQL 客户端，也不是 CMDB。具体只读工具在 DevOpsMCP；月弦负责收口、授权、对外。

## 和 DevOpsMCP

```
  值班同学
       │
       ▼
  WorkBuddy · Cursor · …
       │  一段 HTTP MCP：url + Bearer
       ▼
  ┌─────────────────────────────────────┐
  │  月弦（本仓库）                         │
  │  控制台 · 用户授权 · 用户 Key · /mcp        │
  └─────────────────────────────────────┘
         │  stdio / HTTP 拉起上游
         ▼
  ┌─────────────────────────────────────┐
  │  DevOpsMCP（独立仓库）                  │
  │  nightingale · jenkins · postgres    │
  │  只读工具，编一次，路径写进月弦「添加服务器」   │
  └─────────────────────────────────────┘
         │              │               │
         ▼              ▼               ▼
    夜莺 API        Jenkins REST      PostgreSQL
```

1. 按 [DevOpsMCP](https://github.com/isYaoNoistu/DevOpsMCP) 编出三个二进制（`deploy/pack-linux.sh` 或 `pack-windows.cmd`），本机验收 `command` / `env` 能通。
2. 在月弦控制台把它们加成服务器（类型 STDIO，`command` 填月弦进程能看见的绝对路径）。Docker 月弦用 DevOpsMCP 的 `deploy/attach.sh` 自动注册。
3. 在用户页给普通用户勾需要的服务器和工具。
4. 用户把控制台给出的 `mcp.json` 贴进 Cursor / WorkBuddy，只连月弦。

Linux 上若目录是 `/data/DevOpsMCP` + `/data/YLuneMCPHub`：月弦 `docker compose up`，再 `DevOpsMCP/deploy/attach.sh`。见 [docs/linux-deploy.md](docs/linux-deploy.md)。

DevOpsMCP 的凭据约定仍然成立：仓库和文档不写 Token；Jenkins / 夜莺 Token、PostgreSQL 口令只放运行环境或 `${ENV}`。

## 怎么工作

- **配置在 PostgreSQL。** 仓库里的 `mcp_settings.json` 是空种子。本机没有 `DB_URL` 时，开发模式才写 `data/mcp_settings.dev.json`（不进 git）。生产必须设 `DB_URL`，迁走只迁库。见 [配置与数据](docs/config-and-data.md)。
- **热更新**：控制台改服务器、用户授权、开关后即时生效，不必为加一个工具重启网关。
- **调用权看该用户勾过的工具，不看「公开」标签。** 服务可见性只影响控制台谁能改配置；要让 `test` 调 Jenkins，必须在用户页给 `test` 勾 Jenkins 的工具。
- **系统 Key** 的 `all` / `groups` / `servers` / `custom` 不跟成员名单走，继续给流水线和机器人用。

## 适配的智能体

月弦对外是 **HTTP MCP**（`url` + `Authorization: Bearer`），和 DevOpsMCP 的本机 stdio 不是同一种接法。


| 客户端              | 配置放哪                         | 怎么接                                                                 |
| ---------------- | ---------------------------- | ------------------------------------------------------------------- |
| **WorkBuddy**    | 用户级或项目 `mcp.json`            | 用控制台「复制 mcp.json」，或手写 `url` + `headers.Authorization`           |
| **Cursor**       | `~/.cursor/mcp.json` 或项目级    | 同一份 JSON。保存后在 MCP 面板确认该服务是绿的                                      |
| **Codex**        | `~/.codex/config.toml`       | 写成 HTTP MCP：`url` + bearer，不是 `command`                             |
| **Claude Code**  | 用户级 MCP JSON                  | 同一套 `url` + Header                                                 |
| **其它 MCP 客户端**   | 以该产品文档为准                     | 只要支持远程 / HTTP MCP，指向月弦的 `/mcp` 即可                                  |


**通的是网关后面的工具，不是对话框习惯。** 查夜莺 / Jenkins / 库时，仍建议沿用 DevOpsMCP 仓库里的 Skill 顺序（先列表后详情，未明确要求则不写）。

## 快速开始

需要 **Node 20+** 与 **pnpm**。

```bash
git clone https://github.com/isYaoNoistu/YLuneMCPHub.git
cd YLuneMCPHub
pnpm install
```

Windows 请拆开跑：

```bash
pnpm backend:dev
pnpm frontend:dev
```

浏览器打开 http://127.0.0.1:5173 。后端 API 与 MCP 在 http://127.0.0.1:3000 。  
开发默认账号 `admin` / `admin123`，**登录后立刻改密码**。没有 `DB_URL` 时配置才写在 `data/mcp_settings.dev.json`。真用请接 Postgres。

要用 Docker 整套拉起（Postgres + 月弦），见 [deploy/README.md](deploy/README.md)。仓库根目录不再放 compose。两仓都在 `/data`、还要挂 DevOpsMCP 时，见 [docs/linux-deploy.md](docs/linux-deploy.md)。

第一次把 Jenkins 给普通用户用：

1. 管理员登录 → **服务器** → 添加 STDIO 服务，`command` 指向 DevOpsMCP 编好的 `jenkins-mcp-server.exe`（或 Linux 二进制），环境变量按 [DevOpsMCP Jenkins README](https://github.com/isYaoNoistu/DevOpsMCP/blob/main/jenkins-mcp-server/README.md) 填。
2. **用户** → 创建 `test`（不要勾管理员），勾 Jenkins 需要的工具。系统会签发 Key。
3. 在用户列表随时 **复制 mcp.json** 交给对方。对方的 `/mcp` 只有勾过的工具。

字段怎么填、其它页签怎么用：见 [使用教程](docs/user-guide.md)。

## 谁能调用什么


| 身份            | 默认 `/mcp`              | 改授权      |
| ------------- | ---------------------- | ------------- |
| 管理员           | 全部已启用服务                | 可以            |
| 普通用户（用户 Key）  | 该用户勾过的工具；空清单则没有工具       | 不可以           |
| 系统 Key `all`  | 全部                     | 不可以           |


## 安全模型

```
控制台账号登录后台、改授权、改服务
        +
Access Key 只能调 /mcp，且只看到该用户勾过的工具
        +
Credential 加密进库，控制台永不回显明文
        +
仓库禁止 Token / 密码 / 真实主机名
```

- 开发默认密码只用于本机。对内发布前改掉，并关掉「免登录」。
- 环境变量用 `${JENKINS_API_TOKEN}` 这类占位，值放运行环境，不要写进 git。
- 智能路由、Better Auth、OAuth 服务器都是可选；用不到就保持关闭。

## 测试阶段与免责

本仓库尚在**测试阶段**：用户授权、控制台字段、默认端点语义都可能改。按 [Apache License 2.0](LICENSE) 以「按现状」提供，**不构成对任何生产环境的承诺或担保**。

你自行部署、接入真实 MCP 与真实平台之后，因误授权、凭据配错、Agent 幻觉、上游变更或网络故障导致的影响，**由使用者自行承担**。上线前用只读上游账号验收；先查月弦用户授权、用户 Key 和上游 MCP，而不是默认是仓库的锅。

## 什么时候用 · 什么时候不用

**适合**：已经有一份或几份 MCP（尤其是 DevOpsMCP）；希望多人共用一个入口；要按人裁工具；智能体只支持 HTTP MCP，或不想在每台电脑上维护三套 stdio。

**不适合**：还没有任何 MCP 可接（先去做 DevOpsMCP 或其它上游）；只要一个人在本机查夜莺 / Jenkins / 库（直接 stdio 更简单）；需要月弦去点「立即构建」或改告警（月弦不提供这些写操作，上游 DevOpsMCP 默认也没有写工具）。

## 文档


| 先看这个                                      | 再往下                                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| [使用教程](docs/user-guide.md)                      | 登录、加服务器、用户授权、设置里每一项怎么填                                                                    |
| [配置与数据](docs/config-and-data.md)                    | 配置进 PostgreSQL；JSON 不是运行时存储                                                           |
| [和 DevOpsMCP](#和-devopsmcp)               | [DevOpsMCP 仓库](https://github.com/isYaoNoistu/DevOpsMCP) · 夜莺 / Jenkins / PostgreSQL 怎么编、怎么拿凭据 |
| [适配的智能体](#适配的智能体)                         | 控制台用户页给出的 `mcp.json`                                                                         |
| [Docker 部署](deploy/README.md)             | Compose、环境变量、验收、反代；Linux 两仓示例：[docs/linux-deploy.md](docs/linux-deploy.md) |


## 仓库布局

```text
src/           网关与管理 API
frontend/      控制台（黑底 + 月光青）
hub/           控制台视觉标尺（静态）
login/         登录页视觉标尺（静态）
locales/       文案
docs/user-guide.md  字段级操作说明
docs/images/   控制台截图（README 用）
docs/config-and-data.md 配置进库、迁库
docs/linux-deploy.md  /data 两仓：月弦 compose + DevOpsMCP attach
deploy/        Docker Compose 整包与部署流程
examples/      配置样例（无真实凭据）
README.md      中文（GitHub 默认）
README.en.md   English
```

## 许可证

仓库整体为 [Apache License 2.0](LICENSE)。第三方来源见 [NOTICE](NOTICE)。请不要提交生产 Token、密码、内网地址或客户名。
