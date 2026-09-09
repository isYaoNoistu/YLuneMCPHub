/* ═══════════════════════════════════════════════════════
   main.js — YLune MCP Hub 控制台
   职责：数据加载与渲染 / 视图切换 / 顶栏时钟 /
         端点复制 / 占位动作提示
   ═══════════════════════════════════════════════════════ */
(function () {
  "use strict";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ───────── 1. 顶栏时钟 ───────── */
  var clock = document.getElementById("clock");
  function tickClock() {
    var d = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    clock.textContent = p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }
  if (clock) { tickClock(); window.setInterval(tickClock, 1000); }

  /* ───────── 2. Toast ───────── */
  var toast = document.getElementById("toast");
  var toastTimer = null;
  function showToast(text) {
    toast.textContent = text;
    toast.classList.add("is-show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toast.classList.remove("is-show"); }, 1800);
  }

  /* ───────── 3. 渲染：统计带 ───────── */
  function renderStats(stats) {
    var grid = document.getElementById("statGrid");
    grid.innerHTML = "";
    stats.forEach(function (s) {
      var card = el("div", "stat-card");
      var num = el("p", "stat-num");
      num.appendChild(document.createTextNode(String(s.value)));
      if (s.suffix) num.appendChild(el("i", null, s.suffix));
      card.appendChild(num);
      card.appendChild(el("p", "stat-label", s.label));
      if (s.note) card.appendChild(el("p", "stat-note", s.note));
      grid.appendChild(card);
    });
  }

  /* ───────── 4. 渲染：分组卡片 ───────── */
  function buildGroupCard(g, compact) {
    var card = el("article", "group-card");

    /* 头部：名称 + ID + 操作 */
    var head = el("div", "group-card-head");
    head.appendChild(el("span", "group-name", g.name));
    head.appendChild(el("span", "group-id mono", g.id));
    if (!compact) {
      var acts = el("div", "group-card-acts");
      [["⟳", "刷新"], ["✎", "编辑"], ["⧉", "复制配置"]].forEach(function (pair) {
        var b = el("button", "icon-btn", pair[0]);
        b.type = "button";
        b.title = pair[1];
        b.setAttribute("aria-label", pair[1] + " " + g.name);
        b.addEventListener("click", function () {
          showToast("// 静态演示：" + pair[1] + " 动作待接入后端");
        });
        acts.appendChild(b);
      });
      head.appendChild(acts);
    }
    card.appendChild(head);

    /* 主体：服务器芯片 + 端点框 */
    var body = el("div", "group-card-body");
    var srvList = el("div", "srv-list");
    g.servers.forEach(function (s) {
      var chip = el("div", "srv-chip");
      chip.appendChild(el("span", "dot"));
      chip.appendChild(el("span", null, s.name));
      chip.appendChild(el("span", "srv-tools mono", s.tools + "/" + s.toolsTotal + " tools"));
      srvList.appendChild(chip);
    });
    body.appendChild(srvList);

    var ep = el("div", "endpoint");
    ep.appendChild(el("span", "endpoint-label mono", "ENDPOINT"));
    ep.appendChild(el("span", "endpoint-path", g.endpoint));
    var copyBtn = el("button", "copy-btn", "⧉ COPY");
    copyBtn.type = "button";
    copyBtn.setAttribute("aria-label", "复制 " + g.name + " 端点地址");
    copyBtn.addEventListener("click", function () {
      var done = function () {
        copyBtn.classList.add("is-copied");
        copyBtn.textContent = "✓ COPIED";
        showToast("// 端点已复制：" + g.endpoint);
        window.setTimeout(function () {
          copyBtn.classList.remove("is-copied");
          copyBtn.textContent = "⧉ COPY";
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(g.endpoint).then(done, function () { showToast("// 复制失败，请手动复制"); });
      } else {
        showToast("// 当前环境不支持自动复制");
      }
    });
    ep.appendChild(copyBtn);
    body.appendChild(ep);
    card.appendChild(body);

    /* 底部：汇总 + Configure Tools */
    var foot = el("div", "group-card-foot");
    var summary = el("div");
    summary.appendChild(el("span", null, g.serverCount + " servers · " + g.toolCount + " tools"));
    summary.appendChild(document.createElement("br"));
    summary.appendChild(el("span", "mono",
      "CONTEXT FOOTPRINT: " + g.context.used + "/" + g.context.total));
    foot.appendChild(summary);
    if (!compact) {
      var cfg = el("a", "cfg-link", "Configure Tools →");
      cfg.href = "#";
      cfg.addEventListener("click", function (e) {
        e.preventDefault();
        showToast("// 静态演示：Configure Tools 待接入后端");
      });
      foot.appendChild(cfg);
    }
    card.appendChild(foot);

    return card;
  }

  function renderGroups(groups) {
    var grid = document.getElementById("groupGrid");
    var dash = document.getElementById("dashGroups");
    grid.innerHTML = "";
    dash.innerHTML = "";
    groups.forEach(function (g) {
      grid.appendChild(buildGroupCard(g, false));
      dash.appendChild(buildGroupCard(g, true));
    });
    document.getElementById("groupsSub").textContent = groups.length + " groups";
    document.getElementById("navGroupCount").textContent = groups.length;
  }

  /* ───────── 5. 视图切换 ───────── */
  var crumbHere = document.getElementById("crumbHere");
  var VIEW_TITLES = { dashboard: "Dashboard", groups: "Groups" };
  function switchView(name) {
    document.querySelectorAll(".view").forEach(function (v) {
      v.classList.toggle("is-active", v.id === "view-" + name);
    });
    document.querySelectorAll(".side-link[data-nav]").forEach(function (l) {
      l.classList.toggle("is-active", l.getAttribute("data-nav") === name);
    });
    crumbHere.textContent = VIEW_TITLES[name] || name;
  }
  document.querySelectorAll(".side-link[data-nav]").forEach(function (l) {
    l.addEventListener("click", function (e) {
      e.preventDefault();
      var name = l.getAttribute("data-nav");
      switchView(name);
      if (history.replaceState) history.replaceState(null, "", "#" + name);
    });
  });
  /* SOON 项：阻止跳转并提示 */
  document.querySelectorAll(".side-link.is-soon").forEach(function (l) {
    l.addEventListener("click", function (e) {
      e.preventDefault();
      showToast("// 该模块即将上线");
    });
  });

  /* ───────── 6. 占位动作 ───────── */
  ["btnImport", "btnExportTpl", "btnAdd", "btnAddCard"].forEach(function (id) {
    var b = document.getElementById(id);
    if (b) b.addEventListener("click", function () {
      showToast("// 静态演示：该动作待接入后端");
    });
  });

  /* ───────── 7. 启动：加载数据并渲染 ───────── */
  window.HubData.load().then(function (data) {
    document.getElementById("sideUser").textContent = data.user.name;
    renderStats(data.stats);
    renderGroups(data.groups);
    /* 支持 #hash 直达视图 */
    var hash = (location.hash || "").replace("#", "");
    switchView(VIEW_TITLES[hash] ? hash : "dashboard");
  }).catch(function () {
    showToast("// 数据加载失败");
  });
})();
