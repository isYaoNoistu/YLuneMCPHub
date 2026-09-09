/* ═══════════════════════════════════════════════════════
   data.js — YLune MCP Hub 数据源（唯一需要替换的 mock 层）
   ─────────────────────────────────────────────────────
   接后端时：把 loadHubData() 改为 fetch 你的接口，
   返回结构保持下方契约即可，渲染层无需改动。

   契约：
   {
     user:    { name: string },
     stats:   [ { label, value, suffix?, note? } ],
     groups:  [ {
       name, id,
       endpoint,
       servers: [ { name, tools, toolsTotal } ],
       serverCount, toolCount,
       context: { used, total }
     } ]
   }
   ═══════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* —— DEMO 数据：静态演示快照，接后端后删除 —— */
  var DEMO = {
    user: { name: "guest" },
    stats: [
      { label: "在线服务器", value: 3,  note: "3 台全部健康" },
      { label: "分组",       value: 2,  note: "2 个活跃分组" },
      { label: "可用工具",   value: 11, note: "跨 2 个分组" },
      { label: "今日调用",   value: 486, note: "较昨日 +12%" }
    ],
    groups: [
      {
        name: "time",
        id: "3f7eec21-b1ee-42ae-89a4-b285d7aa8c26",
        endpoint: "/mcp/time",
        servers: [
          { name: "time", tools: 6, toolsTotal: 6 }
        ],
        serverCount: 1,
        toolCount: 6,
        context: { used: 481, total: 481 }
      },
      {
        name: "fetch",
        id: "12f85aa6-fd53-4675-9445-497cf95285a1",
        endpoint: "/mcp/fetch",
        servers: [
          { name: "fetch", tools: 1, toolsTotal: 1 },
          { name: "time", tools: 3, toolsTotal: 6 },
          { name: "sequential-thinking", tools: 1, toolsTotal: 1 }
        ],
        serverCount: 3,
        toolCount: 5,
        context: { used: 1300, total: 1600 }
      }
    ]
  };

  /* —— 数据加载入口：接后端时改这里 —— */
  window.HubData = {
    load: function () {
      /* 静态演示：直接返回 DEMO。
         后端模式示例：
         return fetch("/api/hub/overview", { credentials: "include" })
           .then(function (r) { return r.json(); });
      */
      return Promise.resolve(DEMO);
    }
  };
})();
