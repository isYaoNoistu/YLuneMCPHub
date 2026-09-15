# 凭据预检与 Dashboard 视觉收敛设计

## 目标

- 让管理员可以为任意 MCP 选择任意凭据执行真实连接预检，凭据不要求预先绑定。
- 让已绑定凭据参与服务器启动与重载，避免声明 `${ENV}` 的 stdio MCP 因 Hub 进程环境缺值而直接退出。
- 重构 Dashboard 的信息层级和 7 日趋势图，使其符合月弦现有的克制、低饱和、紧凑运维控制台风格。
- 保持现有 API 与用户级凭据授权语义兼容，不新增默认凭据字段或数据库迁移。

## 凭据预检

### 管理端交互

服务器操作菜单中的“ENV 预检”升级为“连接预检”。弹窗包含两个模式：

1. “运行环境”保留现有 `${ENV}` 是否已解析的检查。
2. “凭据验证”列出全部凭据，标明是否已绑定到当前 MCP，并展示所需键的覆盖情况。

管理员选择凭据后执行真实 MCP 探测：解密凭据、覆盖服务器配置、创建临时连接并调用 `listTools`。响应只返回成功状态、工具数量和脱敏错误，不返回凭据字段值。未绑定凭据验证成功后可直接绑定到当前 MCP。

### 后端数据流

复用现有 `POST /servers/:name/test-credential` 与 `probeServerWithCredential`，扩展返回信息和错误语义，不复用仅检查可解密性的 `/credentials/:id/test`。

`buildEnvPreflight` 支持可选凭据字段并标注解析来源：

- `process_env`
- `credential`
- `missing`

服务器启动或重载先保持现有无凭据连接方式；如果缺失环境变量或连接失败，则按 `credentialId` 排序后尝试该服务器已绑定的凭据。首个真实探测成功的凭据用于建立该服务器的发现连接。用户 `/mcp` 工具调用仍按用户授权中选定的凭据创建隔离客户端，不改变现有权限模型。

### 安全与错误处理

- 只有具备服务器配置权限的管理员可以查看预检和选择全部凭据。
- 预检响应、活动日志和异常日志不得包含明文字段。
- 单条凭据失败不阻断后续已绑定凭据尝试；全部失败时保留最后的脱敏错误和离线状态。
- 未配置 `YLUNE_MASTER_KEY` 时明确返回凭据不可解密，不回退为明文存储。
- 未绑定凭据只有管理员主动确认后才写入服务器绑定关系。

## Dashboard

### 信息架构

页面采用三层结构：

1. 顶部：四张紧凑指标卡，展示服务器、在线状态、今日调用和近 7 日调用。
2. 中部：运行快照与 7 日趋势并列；窄屏改为单列。
3. 底部：工具排行、用户排行和最近失败，使用一致的卡片标题、间距与条形表达。

不新增后端统计接口，继续使用现有 Dashboard 数据，避免视觉重构扩大服务端范围。

### 7 日趋势

- 图高控制在 120–140px，移动端进一步压缩。
- 使用细直线或单调折线，不再使用放大波动感的三次贝塞尔。
- 调用线使用月光青，错误线使用危险色虚线；线宽与全站 1px 边框尺度协调。
- 面积填充移除或降到极低透明度，网格线和坐标文字降低对比度。
- 纵轴保留合理顶部余量，并正确处理全零、单峰和错误量接近调用量的数据。
- tooltip 使用现有卡片边框、背景与等宽数字样式，支持鼠标、触摸和键盘选点。

### 主题与响应式

复用 `hub/styles/tokens.css` 和现有 `--hub-*` 映射，不引入新的品牌色或字体。浅色保持纸感背景与白色表面，深色保持近黑背景与低亮边框。

在 900px 以下将中部和排行区改为单列；在 640px 以下压缩卡片内边距、隐藏非必要坐标标签，同时保留趋势摘要和可访问名称。

## 主要修改边界

- `frontend/src/components/ServerCard.tsx`
- `frontend/src/components/server-card/ActionsMenu.tsx`
- 新增 `frontend/src/components/server-card/ConnectionPreflightDialog.tsx`
- `frontend/src/services/opsService.ts`
- `frontend/src/services/credentialService.ts`
- `src/controllers/serverController.ts`
- `src/controllers/credentialBindingController.ts`
- `src/utils/envPreflight.ts`
- `src/services/mcpService.ts`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/components/UsageLineChart.tsx`
- `frontend/src/styles/ylune-shell.css`
- 中英文 locale 与对应用户/部署文档

## 验收标准

- 已绑定和未绑定凭据都可被管理员选中并执行真实 MCP 预检。
- 测试成功的未绑定凭据可由管理员确认后绑定。
- 仅依赖绑定凭据的 stdio MCP 在启动和重载后可以建立发现连接，不再因 `${ENV}` 为空退出。
- 普通用户仍只能使用其授权中选择的凭据。
- API、日志和 UI 中不出现凭据明文。
- Dashboard 在浅色、深色、桌面和移动布局下层级统一，趋势图不再占据主要视觉重量。
- 全零、单峰和错误量数据均可正确渲染；鼠标、触摸和键盘均可读取每日值。
- 相关单元测试、前后端构建、ESLint 和现有全量测试通过。
