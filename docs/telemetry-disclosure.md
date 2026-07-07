# 可选实例统计披露（Telemetry Disclosure）

> Build provenance transparency · optional instance telemetry  
> 构建来源透明 · 可选统计

本文说明快格云制造（RiverEdge）在自托管部署中**可选**上报的实例元数据。该机制**不是**激活码、DRM 或功能门禁；关闭或登记失败**不影响**任何业务功能。

## 1. 目的

- 在界面展示当前部署的 **commit** 与 **git remote** 构建来源
- 向官方统计自托管实例规模，便于发布**安全公告**
- 收集非官方 fork 的 **git remote 线索**（自述信息，可能被伪造）

**不含**：业务单据、用户数据、数据库内容、文件上传内容。

## 2. 上报字段

| 字段 | 说明 |
|------|------|
| `install_instance_id` | 部署时生成的 UUID（`.env`） |
| `git_commit` | 短 commit |
| `build_time` | 构建/部署时间（ISO UTC） |
| `build_git_remote` | `git remote get-url origin` |
| `build_git_branch` | 当前分支 |
| `app_version` | 应用版本 |
| `provenance_status` | 构建来源判定状态 |
| `host_hint` | 可选，前端可传主机提示 |
| 请求 IP | 服务端记录，用于滥用限流 |

## 3. 频率

- **首次进入主界面**时尝试 `POST` 一次（非持续心跳）
- 成功后在浏览器 `localStorage` 标记，同一浏览器不重复发送

## 4. 如何关闭

在 `riveredge-backend/.env` 中设置：

```env
INSTALL_TELEMETRY_ENABLED=false
```

修改后**重启后端**。关闭后：

- 不写入 `infra_install_registrations` 表
- 前端不发送登记请求
- `GET /api/v1/infra/platform/provenance` 仍返回 `telemetry_enabled: false`

## 5. 不阻断承诺

- 未登记、登记失败、网络不可达：**不**影响登录、API、打印、审核等任何功能
- `provenance_status` 为「未验证」时：仅 UI 提示 + 官方链接，**不**锁定系统

## 6. 官方源码与自托管

从以下仓库免费拉取并自行部署，**无需**登记即可全功能使用：

- Gitee: https://gitee.com/kuaigeyun/kuaigeyun
- GitHub: https://github.com/kuaigeyun/kuaigeyun

## 7. git remote 免责声明

`build_git_remote` 为实例**自述**信息，部署脚本从本机 `git remote` 读取；恶意方可伪造或删除登记逻辑。该字段**仅作调查线索**，不构成法律意义上的「盗版证明」。

## 8. 相关 API

| 方法 | 路径 | 认证 |
|------|------|------|
| GET | `/api/v1/infra/platform/provenance` | 公开 |
| POST | `/api/v1/infra/install/register` | 公开（telemetry 开启时） |
| GET | `/api/v1/infra/install/repo-summary` | 平台超管（**仅 kuaigeyun.com 官方 SaaS**，需 `INSTALL_REPO_SUMMARY_ADMIN_ENABLED=true`） |

## 9. Apache 2.0 合规说明

本可选统计：

- 不附加许可文件未授予的限制
- 可完全关闭（`INSTALL_TELEMETRY_ENABLED=false`）
- 已在本文件与产品 UI 中公开披露
- Fork 方可删除遥测代码；这不违反 Apache License 2.0

---

**维护方**：无锡快格信息技术有限公司  
**官网**：https://kuaigeyun.com
