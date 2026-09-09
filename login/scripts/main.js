/* ═══════════════════════════════════════════════════════
   main.js — YLune MCP Hub 登录页
   职责：入场序列 / 顶栏时钟 / 密码可见性 / 表单校验与提交
   ═══════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ───────── 1. 入场序列 ───────── */
  window.addEventListener("load", function () {
    requestAnimationFrame(function () { document.body.classList.add("loaded"); });
  });
  /* 兜底：load 未触发时 800ms 后强制入场 */
  window.setTimeout(function () { document.body.classList.add("loaded"); }, 800);

  /* ───────── 2. 顶栏时钟 ───────── */
  var clock = document.getElementById("clock");
  function tickClock() {
    var d = new Date();
    function p(n) { return (n < 10 ? "0" : "") + n; }
    clock.textContent = p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }
  if (clock) { tickClock(); window.setInterval(tickClock, 1000); }

  /* ───────── 3. 密码可见性切换 ───────── */
  var pwInput = document.getElementById("password");
  var pwToggle = document.getElementById("pwToggle");
  pwToggle.addEventListener("click", function () {
    var show = pwInput.type === "password";
    pwInput.type = show ? "text" : "password";
    pwToggle.textContent = show ? "HIDE" : "SHOW";
    pwToggle.setAttribute("aria-pressed", String(show));
    pwToggle.setAttribute("aria-label", show ? "隐藏密码" : "显示密码");
    pwInput.focus({ preventScroll: true });
  });

  /* ───────── 4. 表单校验与提交 ───────── */
  var form = document.getElementById("loginForm");
  var msg = document.getElementById("formMsg");
  var btn = document.getElementById("btnLogin");
  var userInput = document.getElementById("username");

  function setMsg(text, isInfo) {
    msg.textContent = text || "";
    msg.classList.toggle("is-info", !!isInfo);
  }
  function shake() {
    if (reduceMotion) return;
    form.classList.remove("shake");
    void form.offsetWidth; /* 重触发动画 */
    form.classList.add("shake");
  }
  function setBusy(busy) {
    btn.disabled = busy;
    btn.classList.toggle("is-busy", busy);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (btn.disabled) return;

    var username = userInput.value.trim();
    var password = pwInput.value;

    /* 客户端校验 */
    if (!username) { setMsg("// 请输入用户名"); shake(); userInput.focus(); return; }
    if (!password) { setMsg("// 请输入密码"); shake(); pwInput.focus(); return; }

    setMsg("");
    setBusy(true);

    var endpoint = form.getAttribute("data-endpoint");
    var redirect = form.getAttribute("data-redirect") || "./";

    if (endpoint) {
      /* 已配置后端：POST JSON 提交 */
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: username, password: password })
      }).then(function (res) {
        if (res.ok) {
          setMsg("// 认证通过，正在进入", true);
          window.setTimeout(function () { window.location.href = redirect; }, 300);
          return null;
        }
        return res.json().catch(function () { return {}; }).then(function (data) {
          throw new Error((data && data.message) || "用户名或密码错误");
        });
      }).catch(function (err) {
        setBusy(false);
        setMsg("// " + (err.message || "网络异常，请稍后重试"));
        shake();
      });
    } else {
      /* 静态演示模式：未配置 data-endpoint */
      window.setTimeout(function () {
        setBusy(false);
        setMsg("// 静态演示：请在 <form> 上配置 data-endpoint 接入后端", true);
      }, 900);
    }
  });

  /* 输入时清除错误提示 */
  [userInput, pwInput].forEach(function (el) {
    el.addEventListener("input", function () { setMsg(""); });
  });
})();
