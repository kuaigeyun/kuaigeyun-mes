# 快视觉 Edge Agent

实验室 / 单工位边缘进程：拉取云侧配置与心跳，本地跑厚度或步骤 pipeline，断网缓冲后 batch 续传。

源码位于 `kuaigeyun-pro/backend/apps/kuaivision/edge-agent/`（compose 后对应主仓同路径）。**独立进程**，不参与 backend import。

## 依赖

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## 配置

编辑 `config.yaml`：

| 字段 | 说明 |
|------|------|
| `base_url` | 云侧 API 根，如 `http://192.168.1.100:8100` |
| `device_token` | PC「边缘节点」页复制的入站 Token |
| `heartbeat_interval_seconds` | 心跳周期，默认 15 |
| `config_pull_interval_seconds` | 主动拉配置周期 |
| `mock_thickness_values` | 厚度 POC 循环读数（mm） |
| `mock_step_missing_last` | 步骤 POC 是否故意缺最后一步 |

云侧需先：创建节点 → 相机/发布方案 → 方案 `trigger_mode=interval` → 「使配置生效」。

## 启动

```bash
python agent.py config.yaml
```

## 云侧路径

- `GET /api/v1/apps/kuaivision/edge/{token}/config`
- `POST /api/v1/apps/kuaivision/edge/{token}/heartbeat`
- `POST /api/v1/apps/kuaivision/ingest/{token}`
- `POST /api/v1/apps/kuaivision/ingest/{token}/batch`

写门禁已豁免上述前缀；无需用户 JWT。
