# 快数采 Edge Agent

现场 Modbus TCP 采集程序，通过 device token 与云侧 Edge Runtime / Ingest API 对接。

源码位于 `riveredge-backend/src/apps/kuaiiot/edge-agent/`（按快数采应用域聚合）。这是**独立 Python 部署包**，使用自有 `requirements.txt` 与 venv，**不参与 backend 进程 import**；现场部署时可将本目录复制到目标机（如 `/opt/riveredge-edge-agent`）单独运行。

源码位于 `riveredge-backend/src/apps/kuaiiot/edge-agent/`（按快数采应用域聚合）。这是**独立 Python 部署包**，使用自有 `requirements.txt` 与 venv，**不参与 backend 进程 import**；现场部署时可将本目录复制到目标机（如 `/opt/riveredge-edge-agent`）单独运行。

源码位于 `riveredge-backend/src/apps/kuaiiot/edge-agent/`（按快数采应用域聚合）。这是**独立 Python 部署包**，使用自有 `requirements.txt` 与 venv，**不参与 backend 进程 import**；现场部署时可将本目录复制到目标机（如 `/opt/riveredge-edge-agent`）单独运行。

## 依赖

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## 配置

复制并编辑 `config.yaml`：

| 字段 | 说明 |
|------|------|
| `base_url` | 云侧 API 根地址，如 `http://192.168.1.100:8100` |
| `device_token` | IoT 设备 token |
| `edge_config_code` | 边缘配置编码 |
| `poll_interval_seconds` | Modbus 轮询间隔，默认 5 |
| `heartbeat_interval_seconds` | 心跳间隔，默认 30 |
| `buffer_db_path` | 断网缓冲 SQLite 路径 |

云侧边缘配置（Modbus TCP）示例：

```json
{
  "host": "192.168.1.10",
  "port": 502,
  "unit_id": 1,
  "registers": [
    { "tag_key": "temp", "address": 0, "data_type": "float32", "scale": 1.0 },
    { "tag_key": "status_code", "address": 2, "data_type": "uint16", "scale": 1.0 }
  ],
  "publish": { "mode": "http_ingest" }
}
```

## 本地联调

终端 1：Modbus 模拟从站

```bash
python tools/modbus_simulator.py --port 5020
```

终端 2：启动 Agent

```bash
python agent.py config.yaml
```

## systemd 示例

```ini
[Unit]
Description=Riveredge KuaiIoT Edge Agent
After=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/riveredge-edge-agent
ExecStart=/opt/riveredge-edge-agent/.venv/bin/python agent.py config.yaml
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## 行为说明

- 启动时拉取 Edge Runtime 配置并连接 Modbus
- 每轮读取 `registers[]`，经 HTTP ingest 上报
- 上报失败写入 SQLite；恢复后通过 batch ingest 续传（带幂等键）
- 心跳上报 `buffer_pending_count`；云侧 `config_changed=true` 时热更新配置
