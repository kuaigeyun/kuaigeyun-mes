# 工作区组装（Source Overlay）

将私有仓中的专业/定制应用链接或复制进主仓 `src/apps/`，使本地与企业部署可运行完整产品，而开源主仓不包含这些源码。

## 一次性准备

1. 将私有仓克隆到主仓**同级**目录（路径可改）：

```text
f:/dev/riveredge           # 主仓 https://gitee.com/kuaigeyun/kuaigeyun
f:/dev/kuaigeyun-pro       # 专业包 https://gitee.com/kuaigeyun/kuaigeyun-pro
f:/dev/kuaigeyun-custom    # 定制包 https://gitee.com/kuaigeyun/kuaigeyun-custom
f:/dev/kuaigeyun-client    # 终端仓 https://gitee.com/kuaigeyun/kuaigeyun-client（不 compose）
```

2. 复制示例配置：

```bash
cp tools/workspace/workspace.example.yaml workspace.yaml
# 按本机路径改 plugins[].repo
```

3. 组装：

```bash
python tools/workspace/compose.py
python tools/workspace/compose.py --status
```

4. 重启后端与前端。

## 命令

| 命令 | 作用 |
|------|------|
| `python tools/workspace/compose.py` | 按 `workspace.yaml` 组装 |
| `python tools/workspace/compose.py --status` | 查看是否已链接 |
| `python tools/workspace/compose.py --remove` | 移除已组装目录 |

`mode: link`（默认）在 Windows 使用 directory junction，无需管理员；`mode: copy` 适合 CI。

## 私有仓目录约定

```text
kuaigeyun-pro/
  backend/apps/{kuaiai,kuaireport,kuaiiot}/
  frontend/apps/{kuaiai,kuaireport,kuaiiot}/

kuaigeyun-custom/
  backend/apps/haoligo/
  frontend/apps/haoligo/
```
