# syntax=docker/dockerfile:1.7

# 作用：构建月弦后端、前端和生产依赖，并输出默认精简镜像或可选完整工具镜像。
# 运行主机：Docker 构建机 / Jenkins Agent / 部署机。
# 调用方：deploy/docker-compose.yml、docker build 或 CI 流水线。
# 大概流程：
# 1) runtime-base 安装 Node、Python、uvx 与进程管理所需的最小运行包
# 2) build 安装一次开发依赖并编译后端/前端
# 3) prod-deps 只导出生产依赖
# 4) runtime 只复制运行产物；full 再叠加浏览器、Rust 与 Docker 工具
# 5) default 指回 runtime，保证不指定 target 时得到精简镜像
# 勿放密钥：数据库口令、主密钥、Token 只通过运行时环境变量或凭据注入。

ARG PYTHON_IMAGE=python:3.13-slim-trixie

FROM ${PYTHON_IMAGE} AS runtime-base

# 构建默认走国内镜像；海外环境可用 build args 切回官方源。
ARG DEBIAN_MIRROR=https://mirrors.aliyun.com/debian
ARG DEBIAN_SECURITY_MIRROR=https://mirrors.aliyun.com/debian-security
ARG NODE_VERSION=22.20.0
ARG NODE_DIST_MIRROR=https://npmmirror.com/mirrors/node
ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG PYPI_INDEX=https://mirrors.aliyun.com/pypi/simple

ENV NPM_REGISTRY=${NPM_REGISTRY} \
  UV_DEFAULT_INDEX=${PYPI_INDEX} \
  UV_INDEX_URL=${PYPI_INDEX} \
  UV_TOOL_BIN_DIR=/usr/local/bin \
  UV_TOOL_DIR=/opt/uv-tools

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# procps 提供 ps，tree-kill 依赖它回收 stdio 子进程。
RUN set -eux; \
  if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
    sed -i -E \
      -e "s|https?://deb.debian.org/debian-security|${DEBIAN_SECURITY_MIRROR}|g" \
      -e "s|https?://deb.debian.org/debian|${DEBIAN_MIRROR}|g" \
      /etc/apt/sources.list.d/debian.sources; \
  fi; \
  if [ -f /etc/apt/sources.list ]; then \
    sed -i -E \
      -e "s|https?://deb.debian.org/debian-security|${DEBIAN_SECURITY_MIRROR}|g" \
      -e "s|https?://deb.debian.org/debian|${DEBIAN_MIRROR}|g" \
      /etc/apt/sources.list; \
  fi; \
  apt-get update; \
  apt-get install -y --no-install-recommends ca-certificates curl procps; \
  arch="$(uname -m)"; \
  case "$arch" in \
    x86_64) node_arch=x64 ;; \
    aarch64) node_arch=arm64 ;; \
    *) echo "unsupported arch: $arch" >&2; exit 1 ;; \
  esac; \
  curl -fsSL "${NODE_DIST_MIRROR}/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.gz" \
    | tar -xz -C /usr/local --strip-components=1; \
  npm config set registry "${NPM_REGISTRY}"; \
  uv tool install mcp-server-fetch; \
  node --version; \
  npm --version; \
  npx --version; \
  uv --version; \
  uvx --version; \
  apt-get clean; \
  rm -rf /var/lib/apt/lists/* /root/.cache

FROM runtime-base AS build

ARG NPM_REGISTRY=https://registry.npmmirror.com
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
  COREPACK_NPM_REGISTRY=${NPM_REGISTRY}

RUN set -eux; \
  apt-get update; \
  apt-get install -y --no-install-recommends build-essential git; \
  corepack enable; \
  corepack prepare pnpm@10.12.4 --activate; \
  pnpm config set registry "${NPM_REGISTRY}"; \
  apt-get clean; \
  rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm config set store-dir /pnpm/store \
  && pnpm fetch --frozen-lockfile
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm config set store-dir /pnpm/store \
  && pnpm install --frozen-lockfile --offline

COPY . .

# 市场索引下载失败时继续使用仓库内置版本，避免外部站点阻断发版。
RUN curl -s -f --connect-timeout 10 https://mcpm.sh/api/servers.json -o servers.json \
  || echo "Failed to download servers.json, using bundled version"
RUN pnpm build

FROM build AS prod-deps

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm config set store-dir /pnpm/store \
  && pnpm --filter @ylune/mcphub deploy --prod --legacy /prod/app

FROM runtime-base AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=prod-deps /prod/app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/bin ./bin
COPY --from=build /app/dist ./dist
COPY --from=build /app/frontend/dist ./frontend/dist
COPY --from=build /app/locales ./locales
COPY --from=build /app/servers.json ./servers.json
COPY --from=build /app/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh \
  && mkdir -p /opt/mcp

EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=10 \
  CMD curl -fsS http://127.0.0.1:3000/health || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/index.js"]

FROM runtime AS full

# 完整变体供确实需要本地浏览器、Rust 工具链或容器内 Docker 的部署使用。
ENV RUSTUP_HOME=/usr/local/rustup \
  CARGO_HOME=/usr/local/cargo \
  PATH=/usr/local/cargo/bin:$PATH

RUN set -eux; \
  apt-get update; \
  apt-get install -y --no-install-recommends ca-certificates curl iptables; \
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --no-modify-path --profile minimal; \
  install -m 0755 -d /etc/apt/keyrings; \
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc; \
  chmod a+r /etc/apt/keyrings/docker.asc; \
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list; \
  apt-get update; \
  apt-get install -y --no-install-recommends docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin; \
  if [ "$(uname -m)" = "x86_64" ]; then \
    npx -y playwright install --with-deps chrome firefox; \
  else \
    echo "Skipping Chrome and Firefox installation on non-amd64 architecture"; \
  fi; \
  cargo --version; \
  rustc --version; \
  docker --version; \
  apt-get clean; \
  rm -rf /var/lib/apt/lists/* /root/.cache

# Docker 默认产物使用精简运行时；完整变体必须显式指定 --target full。
FROM runtime AS default
