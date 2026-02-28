# 传统部署问题排查

## 后端一直重启

在服务器上查看日志：

```bash
sudo journalctl -u riveredge-backend -n 100 -f
```

**常见原因：**

1. **缺少 INNGEST 密钥**：`.env` 必须包含 `INNGEST_EVENT_KEY` 和 `INNGEST_SIGNING_KEY`（可用 `openssl rand -hex 32` 生成）
2. **数据库密码错误**：`DB_PASSWORD` 需与 Postgres 中 riveredge 用户密码一致
3. **数据库未就绪**：首次启动时 postgres 可能较慢，可稍等 1–2 分钟后重启 backend
4. **未执行迁移**：首次部署需在 backend 目录执行 `uv run aerich upgrade`

## Inngest 无法启动

```bash
sudo journalctl -u riveredge-inngest -n 100 -f
```

**常见原因：**

1. **缺少 INNGEST_POSTGRES_URI、INNGEST_REDIS_URI**：在 `.env` 中配置，格式见 `env.prod.example`
2. **inngest 二进制未安装或路径错误**：从 [GitHub Releases](https://github.com/inngest/inngest/releases) 下载，置于 `/usr/local/bin/inngest` 或修改 service 中的 `ExecStart` 路径
3. **后端未就绪**：Inngest 需连接 `http://127.0.0.1:8200/api/inngest`，确保 riveredge-backend 已启动

## Caddy 无法访问静态或 API

1. **静态 404**：确认 `/opt/riveredge/frontend-dist` 存在且包含 `index.html`，前端构建后需执行 `cp -r riveredge-frontend/src/dist/* /opt/riveredge/frontend-dist/`
2. **API 502**：确认 riveredge-backend 监听 `127.0.0.1:8200`，且 Caddyfile 中 `reverse_proxy` 指向正确

## 目录结构要求

```
/opt/riveredge/
├── .env
├── frontend-dist/          # 前端构建产物（Caddy 静态根目录）
├── riveredge-backend/
├── riveredge-frontend/
└── deploy/
    ├── Caddyfile
    ├── env.prod.example
    ├── deploy.sh
    ├── TRADITIONAL_DEPLOY.md
    └── postgres/
        └── init-inngest.sql
```
