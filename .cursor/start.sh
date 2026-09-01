#!/usr/bin/env bash
# 每次启动时确保 PostgreSQL 集群在线并就绪（幂等）。
# 后端 / Worker / 前端由 environment.json 的 terminals 拉起。
set -euo pipefail

PG_VER="$(ls /etc/postgresql 2>/dev/null | sort -V | tail -1 || echo 16)"
sudo pg_ctlcluster "$PG_VER" main start 2>/dev/null || true

for _ in $(seq 1 30); do
    if pg_isready -h 127.0.0.1 -p 5432 >/dev/null 2>&1; then
        echo "[start] PostgreSQL 已就绪"
        exit 0
    fi
    sleep 1
done

echo "[start] PostgreSQL 未能就绪" >&2
exit 1
