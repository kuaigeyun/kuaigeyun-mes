# 工作区组装（Source Overlay）

将私有仓中的专业/定制应用链接或复制进主仓 `src/apps/`，使本地与企业部署可运行完整产品，而开源主仓不包含这些源码。

本目录位于 `fast-deploy/tools/workspace/`（由部署脚本与本地开发共用）。

## 行业包从哪来

| 层 | 私仓 | 组装方式 |
|----|------|----------|
| **专业 APP** | `kuaigeyun-pro` | `generate_workspace.py` → `compose.py` |
| **行业包**（`ind-*` / `spoke-wheel`） | **同一专业仓** `kuaigeyun-pro` | **与专业 APP 一并组装**（扫描仓内 `frontend/apps` + `backend/apps`） |
| **定制** | `kuaigeyun-custom` | 仅 `CUSTOM_PROJECTS` 列出的项目 |

应用中心报「后端包未部署…请先 workspace compose」时：对行业包执行

```bash
./fast-deploy/deploy.sh pro-apps pro
```

即可重新生成 `workspace.yaml`（含行业包）并组装，不必单独装「行业仓」。

## 一次性准备

1. 将私有仓克隆到主仓**同级**目录（路径可改）；**分支一律 `develop`**（与主仓一致）：

```text
f:/dev/riveredge           # 主仓 https://gitee.com/kuaigeyun/kuaigeyun  (develop)
f:/dev/kuaigeyun-pro       # 专业包 https://gitee.com/kuaigeyun/kuaigeyun-pro  (develop)
f:/dev/kuaigeyun-custom    # 定制包 https://gitee.com/kuaigeyun/kuaigeyun-custom  (develop)
f:/dev/kuaigeyun-client    # 终端仓 https://gitee.com/kuaigeyun/kuaigeyun-client（不 compose，develop）
```

2. 复制示例配置：

```bash
cp fast-deploy/tools/workspace/workspace.example.yaml fast-deploy/tools/workspace/workspace.yaml
# 按本机路径改 plugins[].repo（路径相对主仓根）
```

3. 组装：

```bash
python fast-deploy/tools/workspace/compose.py
python fast-deploy/tools/workspace/compose.py --status
```

4. 重启后端与前端。

## 命令

| 命令 | 作用 |
|------|------|
| `python fast-deploy/tools/workspace/compose.py` | 按 `workspace.yaml` 组装 |
| `python fast-deploy/tools/workspace/compose.py --status` | 查看是否已链接 |
| `python fast-deploy/tools/workspace/compose.py --remove` | 移除已组装目录 |

`mode: link`（默认）在 Windows 使用 directory junction，无需管理员；`mode: copy` 适合 CI。

## 私有仓目录约定

```text
kuaigeyun-pro/
  backend/apps/{kuaipd,kuaiplm,...,ind_relay,ind_foreign_trade,spoke_wheel}/
  frontend/apps/{kuaipd,kuaiplm,...,ind-relay,ind-foreign-trade,spoke-wheel}/

kuaigeyun-custom/
  projects/registry.yaml          # 定制项目注册（部署 CUSTOM_PROJECTS 真源）
  backend/apps/{haoligo,funide_oa}/
  frontend/apps/{haoligo,funide-oa}/
```

## 定制项目（必配）

启用定制仓时**必须**在 `fast-deploy/config/deploy.env` 设置：

```env
CUSTOM_ENABLED=1
CUSTOM_PROJECTS=funide-oa
```

仅组装 registry 中声明的项目，避免把其它客户定制包装进本机。向导「配置定制仓」或 `deploy.sh pro-apps custom` 会读取该变量并生成 `workspace.yaml`。

**仅更新专业包**（菜单 [4]→专业包）时：若 `CUSTOM_ENABLED=1` 但未写 `CUSTOM_PROJECTS`，脚本会优先从已有 `workspace.yaml` 回填到 `deploy.env`，并保留定制包链接，不再阻断专业包组装。

**移动端 H5**（`kuaigeyun-client`）不走 `workspace.yaml`，只需 `CLIENT_*` / `CLIENT_GIT_TOKEN`（可共用 `PRO_GIT_TOKEN`），与 `CUSTOM_PROJECTS` 无关。
