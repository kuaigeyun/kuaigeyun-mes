"""
OpenAPI / ReDoc 左侧分组命名约定（仅影响 tags，不涉及接口正文 description）。

三层前缀（英文 + 中间点）：
  Platform · …  — 平台级 / infra（租户运营、许可、初始化、平台配置等）
  Core · …      — 系统级 / core（租户内系统能力：用户、权限、文件等）
  App · … · …   — 应用级（产品名 · 功能模块）

新路由请直接使用上述格式的字面量 tags=[...]，或与既有模块保持一致。
"""

from __future__ import annotations

import re
from pathlib import Path


def _space_camel(tag: str) -> str:
    if " " in tag or "&" in tag or "/" in tag:
        return tag
    return re.sub(r"(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])", " ", tag)


_CORE_SPECIAL = {
    "IntegrationConfigs": "Core · Integration Configs",
    "ApplicationConnections": "Core · Application Connections",
    "APIs": "Core · APIs",
    "ApprovalProcesses": "Core · Approval Processes",
    "ApprovalHistories": "Core · Approval Histories",
    "ApprovalInstances": "Core · Approval Instances",
    "PrintTemplates": "Core · Print Templates",
    "OnlineUsers": "Core · Online Users",
    "UserTasks": "Core · User Tasks",
    "MessageTemplates": "Core · Message Templates",
    "TenantInit": "Core · Tenant Init",
    "MessageConfigs": "Core · Message Configs",
    "ScheduledTasks": "Core · Scheduled Tasks",
    "PrintDevices": "Core · Print Devices",
    "OperationLogs": "Core · Operation Logs",
    "LoginLogs": "Core · Login Logs",
    "UserMessages": "Core · User Messages",
    "UserProfile": "Core · User Profile",
    "UserPreferences": "Core · User Preferences",
    "QRCode": "Core · QR Code",
    "ConnectorDefinitions": "Core · Connector Definitions",
    "Files (Public)": "Core · Files (Public)",
    "Scripts": "Core · Scripts",
}


def normalize_openapi_tag(tag: str, rel_posix: str) -> str:
    """根据源码路径将历史 tag 规范为 Platform · / Core · / App · 形式。"""
    if " · " in tag:
        return tag

    if "/infra/api/" in rel_posix:
        return _platform_tag(tag)
    if "/apps/kuaizhizao/" in rel_posix:
        return _app_kuaige_zhizao(tag)
    if "/apps/kuaicaiwu/" in rel_posix:
        return _app_kuaicaiwu(tag)
    if "/apps/master_data/" in rel_posix:
        return _app_master_data(tag)
    if "/apps/kuaireport/" in rel_posix:
        return _app_kuanreport(tag)
    if "/apps/kuaiai/" in rel_posix:
        return _app_kuaiai(tag)
    if "/core/api/" in rel_posix:
        return _core_tag(tag)
    return f"Core · {_space_camel(tag)}"


def _platform_tag(tag: str) -> str:
    m = {
        "Infra Monitoring": "Platform · Monitoring",
        "Platform Version": "Platform · Version",
        "Auth": "Platform · Auth",
        "License Center": "Platform · License",
        "Business Config": "Platform · Business Config",
        "Infra Tenants": "Platform · Tenants",
        "Platform Settings (Public)": "Platform · Settings (Public)",
        "Infra Admin Auth": "Platform · Admin Auth",
        "Industry Templates": "Platform · Industry Templates",
        "Infra Packages": "Platform · Packages",
        "Init Wizard": "Platform · Init Wizard",
        "Public Tenants": "Platform · Tenants (Public)",
        "Saved Searches": "Platform · Saved Searches",
        "Platform Settings": "Platform · Settings",
        "Infra Admin": "Platform · Admin",
    }
    return m.get(tag, f"Platform · {tag}")


def _app_kuaige_zhizao(tag: str) -> str:
    if tag.startswith("Kuaige Zhizao - "):
        return "App · Kuaige Zhizao · " + tag[len("Kuaige Zhizao - ") :]
    if tag.startswith("Kuaige Zhizao "):
        return "App · Kuaige Zhizao · " + tag[len("Kuaige Zhizao ") :]
    extras = {
        "App Management": "App · Kuaige Zhizao · App Management",
        "Dashboard": "App · Kuaige Zhizao · Dashboard",
        "Initial Data Import": "App · Kuaige Zhizao · Initial Data Import",
    }
    return extras.get(tag, f"App · Kuaige Zhizao · {tag}")


def _app_kuaicaiwu(tag: str) -> str:
    if tag.startswith("Kuaicaiwu - "):
        return "App · Kuaicaiwu · " + tag[len("Kuaicaiwu - ") :]
    if tag.startswith("Kuaicaiwu "):
        return "App · Kuaicaiwu · " + tag[len("Kuaicaiwu ") :]
    if tag == "Kuaicaiwu":
        return "App · Kuaicaiwu · Overview"
    return f"App · Kuaicaiwu · {tag}"


def _app_master_data(tag: str) -> str:
    m = {
        "Master Data Management": "App · Master Data · Overview",
        "Material": "App · Master Data · Materials",
        "Process": "App · Master Data · Process",
        "Supply Chain": "App · Master Data · Supply Chain",
        "Batch & Serial Rules": "App · Master Data · Batch & Serial Rules",
        "Warehouse": "App · Master Data · Warehouse",
        "Factory": "App · Master Data · Factory",
        "Product": "App · Master Data · Product",
        "Data Validation": "App · Master Data · Data Validation",
        "Performance": "App · Master Data · Performance",
    }
    return m.get(tag, f"App · Master Data · {tag}")


def _app_kuanreport(tag: str) -> str:
    if tag.startswith("KuanReport - "):
        return "App · KuanReport · " + tag[len("KuanReport - ") :]
    if tag == "KuanReport":
        return "App · KuanReport · Overview"
    return f"App · KuanReport · {tag}"


def _app_kuaiai(tag: str) -> str:
    if tag == "KU-AI Suggestions":
        return "App · KU-AI · Suggestions"
    if tag == "Kuaiai":
        return "App · KU-AI · Overview"
    return f"App · KU-AI · {tag}"


def _core_tag(tag: str) -> str:
    if tag.startswith("Core "):
        return "Core · " + tag[5:]
    if tag in _CORE_SPECIAL:
        return _CORE_SPECIAL[tag]
    return "Core · " + _space_camel(tag)


def migrate_tags_in_tree(src_root: Path) -> int:
    """遍历 src 下 .py，替换 tags=[\"...\"] 为规范形式。返回修改文件数。"""
    pattern = re.compile(r'tags=\[\"([^\"]+)\"\]')
    changed_files = 0
    for path in src_root.rglob("*.py"):
        if "openapi_tags.py" in path.name:
            continue
        text = path.read_text(encoding="utf-8")
        rel = path.as_posix()

        def repl(m: re.Match[str]) -> str:
            old = m.group(1)
            new = normalize_openapi_tag(old, rel)
            return f'tags=["{new}"]'

        new_text, n = pattern.subn(repl, text)
        if n and new_text != text:
            path.write_text(new_text, encoding="utf-8")
            changed_files += 1
    return changed_files


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]  # .../src
    n = migrate_tags_in_tree(root)
    print(f"migrated_tags_in_files={n}")
