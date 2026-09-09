<div align="center">

<h1>月弦</h1>

<p><b>统一 MCP 网关</b> — 接入 · 分组授权 · 用户 Key · 对外端点</p>

<p><b>简体中文</b> · <a href="README.en.md">English</a></p>

在 **WorkBuddy** 或 **Cursor** 里只配一个 HTTP MCP，就能用上本机或机房里已经接好的全部工具。  
月弦跑在**你们自己的机器**上：管理员在控制台加服务、建组、发用户；智能体只连 `/mcp`。  
凭据留在部署环境，仓库里没有 Token、没有密码、没有真实主机名。

<p>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue?labelColor=1f2937" alt="Apache 2.0"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node-20+-339933?logo=nodedotjs&logoColor=white&labelColor=1f2937" alt="Node 20+"></a>
  <a href="https://modelcontextprotocol.io/"><img src="https://img.shields.io/badge/MCP-HTTP-7c3aed?labelColor=1f2937" alt="MCP HTTP"></a>
  <img src="https://img.shields.io/badge/auth-group%20membership-059669?labelColor=1f2937" alt="group membership">
</p>

<p>
  <b><a href="#快速开始">快速开始</a></b> ·
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
**月弦不重复实现这些工具。** 它把已经编好的 MCP 收进来，按组成员授权，再以一条 HTTP 端点交给智能体。

一个人接 Cursor 时，可以直接跑 DevOpsMCP 的三个二进制。人一多、要按人裁工具、要统一入口时，才上月弦。


| 现场     | 只接 DevOpsMCP                         | 前面再加月弦                                      |
| ------ | ----------------------------------- | -------------------------------------------- |
| 一个人值班  | `mcp.json` 写三个 stdio，本机直连           | 用得上，但不必                      |
| 多人共用   | 每人一份路径和 Token，工具全集都在               | 管理员建组、勾工具、加成员；用户只贴一段 `/mcp` + 自己的 Key        |
| 工具变多   | 客户端工具数容易顶满                            | 默认 `/mcp` 只暴露该用户所属组的并集；也可连 `/mcp/{组}` 只看一组 |
| 新同事入职 | 再抄一份本机配置                              | 控制台建用户，复制生成的 `mcp.json` 即可                   |


## 它做什么

- **统一网关** — 一个进程对外提供 `/mcp`、`/mcp/{组}`、`/mcp/{服务}`、`/mcp/$smart`。上游可以是 stdio、HTTP、SSE、OpenAPI。
- **组成员授权** — 管理员建组、指定成员和组内工具。普通用户默认 `/mcp` = 自己所属组的并集；零组 = 零工具。管理员默认全部已启用服务，不必加入任何组。
- **用户与 Key** — 管理员创建子用户后系统才签发 Token，并给出可复制的 Cursor / WorkBuddy `mcp.json`。系统级 Key 仍可按组 / 服务裁剪，给自动化用。
- **控制台** — 服务器、分组、用户、设置、内置提示词 / 资源、日志与调用记录。私有化部署默认不展示外部市场。
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
  │  控制台 · 分组 · 用户 Key · /mcp        │
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

1. 按 [DevOpsMCP](https://github.com/isYaoNoistu/DevOpsMCP) 编出三个二进制，本机验收 `command` / `env` 能通。
2. 在月弦控制台把它们加成服务器（类型 STDIO，`command` 填绝对路径）。
3. 建组（例如 `jenkins-readonly`），勾需要的工具，把普通用户加进成员。
4. 用户把控制台给出的 `mcp.json` 贴进 Cursor / WorkBuddy，只连月弦。

DevOpsMCP 的凭据约定仍然成立：仓库和文档不写 Token；Jenkins / 夜莺 Token、PostgreSQL 口令只放运行环境或 `${ENV}`。

## 怎么工作

- **配置在 PostgreSQL。** 仓库里的 `mcp_settings.json` 是空种子。本机没有 `DB_URL` 时，开发模式才写 `data/mcp_settings.dev.json`（不进 git）。生产必须设 `DB_URL`，迁走只迁库。见 [配置与数据](docs/配置与数据.md)。
- **热更新**：控制台改服务器、分组、开关后即时生效，不必为加一个工具重启网关。
- **调用权看组成员，不看「公开」标签。** 服务可见性只影响控制台谁能改配置；要让 `test` 调 Jenkins，必须把 `test` 加进包含 Jenkins 的组。
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

要用 Docker 整套拉起（Postgres + 月弦），见 [deploy/README.md](deploy/README.md)。仓库根目录不再放 compose。

第一次把 Jenkins 给普通用户用：

1. 管理员登录 → **服务器** → 添加 STDIO 服务，`command` 指向 DevOpsMCP 编好的 `jenkins-mcp-server.exe`（或 Linux 二进制），环境变量按 [DevOpsMCP Jenkins README](https://github.com/isYaoNoistu/DevOpsMCP/blob/main/jenkins-mcp-server/README.md) 填。
2. **用户** → 创建 `test`（不要勾管理员）。系统会签发 Key 并给出 `mcp.json`。
3. **分组** → 新建组，勾 Jenkins 需要的工具，把 `test` 加进成员。管理员不用加。
4. 把 `test` 的 `mcp.json` 交给对方。此时对方的 `/mcp` 只有该组工具。

字段怎么填、其它页签怎么用：见 [使用教程](docs/使用教程.md)。

## 谁能调用什么


| 身份            | 默认 `/mcp`              | `/mcp/{组}`     | 改组 / 改成员      |
| ------------- | ---------------------- | -------------- | ------------- |
| 管理员           | 全部已启用服务                | 可以             | 可以            |
| 普通用户（用户 Key）  | 所属组的工具并集；零组则没有工具       | 必须是该组成员        | 不可以           |
| 系统 Key `all`  | 全部（不受成员名单限制）           | 按 Key 范围       | 不可以           |


## 安全模型

```
管理员改组、改成员、改服务
        +
普通用户只能调用被加入的组
        +
用户 Key 跟随该用户的成员身份
        +
仓库禁止 Token / 密码 / 真实主机名
```

- 开发默认密码只用于本机。对内发布前改掉，并关掉「免登录」。
- 环境变量用 `${JENKINS_API_TOKEN}` 这类占位，值放运行环境，不要写进 git。
- 智能路由、Better Auth、OAuth 服务器都是可选；用不到就保持关闭。

## 测试阶段与免责

本仓库尚在**测试阶段**：分组授权、控制台字段、默认端点语义都可能改。按 [Apache License 2.0](LICENSE) 以「按现状」提供，**不构成对任何生产环境的承诺或担保**。

你自行部署、接入真实 MCP 与真实平台之后，因误授权、凭据配错、Agent 幻觉、上游变更或网络故障导致的影响，**由使用者自行承担**。上线前用只读上游账号验收；先查月弦分组、用户 Key 和上游 MCP，而不是默认是仓库的锅。

## 什么时候用 · 什么时候不用

**适合**：已经有一份或几份 MCP（尤其是 DevOpsMCP）；希望多人共用一个入口；要按人裁工具；智能体只支持 HTTP MCP，或不想在每台电脑上维护三套 stdio。

**不适合**：还没有任何 MCP 可接（先去做 DevOpsMCP 或其它上游）；只要一个人在本机查夜莺 / Jenkins / 库（直接 stdio 更简单）；需要月弦去点「立即构建」或改告警（月弦不提供这些写操作，上游 DevOpsMCP 默认也没有写工具）。

## 文档


| 先看这个                                      | 再往下                                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| [使用教程](docs/使用教程.md)                      | 登录、加服务器、分组、用户、设置里每一项怎么填                                                                    |
| [配置与数据](docs/配置与数据.md)                    | 配置进 PostgreSQL；JSON 不是运行时存储                                                           |
| [和 DevOpsMCP](#和-devopsmcp)               | [DevOpsMCP 仓库](https://github.com/isYaoNoistu/DevOpsMCP) · 夜莺 / Jenkins / PostgreSQL 怎么编、怎么拿凭据 |
| [适配的智能体](#适配的智能体)                         | 控制台用户页给出的 `mcp.json`                                                                         |
| [Docker 部署](deploy/README.md)             | Compose、环境变量、验收、反代、接 DevOpsMCP；English: [deploy/README.en.md](deploy/README.en.md) |


## 仓库布局

```text
src/           网关与管理 API
frontend/      控制台（黑底 + 月光青）
hub/           控制台视觉标尺（静态）
login/         登录页视觉标尺（静态）
locales/       文案
docs/使用教程.md  字段级操作说明
docs/配置与数据.md 配置进库、迁库
deploy/        Docker Compose 整包与部署流程
examples/      配置样例（无真实凭据）
README.md      中文（GitHub 默认）
README.en.md   English
```

## 许可证

仓库整体为 [Apache License 2.0](LICENSE)。第三方来源见 [NOTICE](NOTICE)。请不要提交生产 Token、密码、内网地址或客户名。
