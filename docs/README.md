# 月弦文档

本目录只放月弦自己的说明。原 MCPHub / Mintlify 文案已经清掉，不要再往这里拷上游文档。

| 文档 | 内容 |
| --- | --- |
| [使用教程.md](使用教程.md) | 控制台每一项怎么填：登录、服务器、用户授权、设置 |
| [配置与数据.md](配置与数据.md) | 配置进 PostgreSQL，迁库就迁走；JSON 不是运行时存储 |
| [仓库 README](../README.md) | 月弦是什么、和 DevOpsMCP 怎么配合、本机怎么启动；带控制台截图 |
| [images/](images/) | README / 使用教程用的界面截图 |
| [Linux 部署](Linux部署.md) | `/data` 两仓：月弦 `compose up`，MCP 用 `attach.sh` |
| [Docker 部署](../deploy/README.md) | Compose、环境变量、验收、反代。English：[deploy/README.en.md](../deploy/README.en.md) |

新文档用 Markdown，写月弦的真实行为（按用户勾 MCP/工具、私有化部署、不写真实凭据）。Compose 约定写在 `deploy/`；`/data` 两仓怎么编、怎么挂，只维护 [Linux部署.md](Linux部署.md)，不要再复制一份会过期的 Docker 说明。
