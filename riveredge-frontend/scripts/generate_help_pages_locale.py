#!/usr/bin/env python3
"""Generate help-pages locale modules from structured content."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "locales" / "help-pages"

COMMON_ZH = {
    "help.common.catalog": "帮助目录",
    "help.common.faqLabel": "常见问题",
    "help.common.faqTitle": "常见问题",
    "help.common.feedbackQuestion": "这篇文章对您有帮助吗？",
    "components.uniTable.helpHint": "本页帮助内容尚未编写，请联系管理员补充。",
}

COMMON_EN = {
    "help.common.catalog": "Help catalog",
    "help.common.faqLabel": "FAQ",
    "help.common.faqTitle": "Frequently asked questions",
    "help.common.feedbackQuestion": "Was this article helpful?",
    "components.uniTable.helpHint": "Help for this page has not been written yet.",
}

APPLICATION_CENTER_ZH = {
    "help.applicationCenter.overview.label": "1. 概述",
    "help.applicationCenter.overview.title": "1. 概述",
    "help.applicationCenter.overview.p1": "应用中心供系统管理员集中管理已注册应用：安装与卸载、启用与禁用、扫描本地应用、同步菜单，以及查看详情与部分应用的高级配置。",
    "help.applicationCenter.overview.alert": "仅具备应用中心访问权限的管理员可操作。",
    "help.applicationCenter.concepts.label": "2. 核心概念",
    "help.applicationCenter.concepts.title": "2. 核心概念",
    "help.applicationCenter.concepts.p1": "系统应用：如主数据 master-data，为平台运行所需，卡片上不可卸载。",
    "help.applicationCenter.concepts.p2": "基础应用：当前主仓包含快制造 kuaizhizao、快财务 kuaicaiwu、快办公 kuaioa、快 PLM kuaiplm 与主数据 master-data。",
    "help.applicationCenter.concepts.p3": "专业版占位：快报表 kuaireport、快数采 kuaiiot、KU-AI kuaiai 等以占位卡片展示，启用前需有效 License Key；未 compose 入库前不可当作已安装业务应用使用。",
    "help.applicationCenter.guide.label": "3. 操作指南",
    "help.applicationCenter.install.label": "3.1 安装与卸载",
    "help.applicationCenter.install.title": "3.1 应用的安装与卸载",
    "help.applicationCenter.install.p1": "未安装的应用可点击安装；已安装且非系统应用可通过更多操作卸载。",
    "help.applicationCenter.install.p2": "卸载后关联菜单与业务数据可能不可见，操作前请确认影响范围。",
    "help.applicationCenter.install.alert": "系统应用卸载按钮为禁用状态。",
    "help.applicationCenter.enable.label": "3.2 启用与授权",
    "help.applicationCenter.enable.title": "3.2 应用的启用与授权",
    "help.applicationCenter.enable.p1": "通过卡片或列表中的状态开关启用或禁用应用；禁用后普通用户侧栏不再展示该应用菜单。",
    "help.applicationCenter.enable.p2": "启用专业版占位应用时会弹出 License Key 校验；校验通过后方可启用。",
    "help.applicationCenter.scan.label": "3.3 扫描本地应用",
    "help.applicationCenter.scan.title": "3.3 扫描本地应用",
    "help.applicationCenter.scan.p1": "开发环境新增 src/apps 下应用代码后，点击扫描应用将基础清单注册到应用中心。",
    "help.applicationCenter.scan.p2": "扫描成功后请继续执行一键同步菜单，否则侧栏菜单不会更新。",
    "help.applicationCenter.scan.alert": "扫描只更新应用清单，不会自动写入菜单表。",
    "help.applicationCenter.menuSync.label": "3.4 菜单同步",
    "help.applicationCenter.menuSync.title": "3.4 菜单同步管理",
    "help.applicationCenter.menuSync.p1": "一键同步菜单：批量拉取已安装应用最新 manifest，并写入 core_menus，随后刷新侧栏。",
    "help.applicationCenter.menuSync.p2": "单应用同步：在更多操作中选择同步菜单，仅更新该应用菜单。",
    "help.applicationCenter.advanced.label": "3.5 高级配置",
    "help.applicationCenter.advanced.title": "3.5 高级配置与管理",
    "help.applicationCenter.advanced.p1": "查看：打开应用详情抽屉，查看版本与描述等信息。",
    "help.applicationCenter.advanced.p2": "应用配置：修改展示名称、排序等基础参数。",
    "help.applicationCenter.advanced.p3": "重置数据：快制造等应用提供更多操作中重置数据入口，将清空或初始化该应用核心业务数据。",
    "help.applicationCenter.advanced.alert": "重置数据为高危操作，执行前务必确认或联系技术支持。",
    "help.applicationCenter.faq.q1": "Q: 为什么卸载按钮是禁用的？",
    "help.applicationCenter.faq.a1": "A: 该应用为系统应用，为保障平台稳定，不允许卸载。",
    "help.applicationCenter.faq.q2": "Q: 扫描成功但侧栏没有新菜单？",
    "help.applicationCenter.faq.a2": "A: 请再点击一键同步菜单，将 manifest 菜单写入数据库并刷新前端缓存。",
    "help.applicationCenter.faq.q3": "Q: 启用专业版占位为何需要授权？",
    "help.applicationCenter.faq.a3": "A: 快报表、快数采、KU-AI 等属于专业版能力，需 License Key 激活后才可启用。",
}

DOCUMENTS: dict[str, dict[str, str]] = {
    "sales-order": {
        "overview.p1": "销售订单用于记录客户订货、交期与明细行，支持审核、下推需求计算、发货通知、出库与退货等后续流程。",
        "overview.p2": "列表支持按订单头或明细行两种视图查看，并可高亮交期逾期行。",
        "views.p1": "表头视图：按销售订单汇总展示，适合跟单与批量下推。",
        "views.p2": "明细视图：按订单行展示物料、数量与进度，只读查看，可配合库存/BOM 检查。",
        "toolbar.p1": "工具栏支持新建、导入导出、批量删除、批量关单及下推菜单（需求计算、发货通知、销售出库等，以权限与单据状态为准）。",
        "toolbar.p2": "行操作含查看、编辑、审核、打印、下推与关单等，具体以当前状态与权限显示。",
        "lifecycle.p1": "草稿/待审核订单可编辑或提交审核；已审核订单可执行下推与打印。",
        "lifecycle.p2": "关单或退货需满足对应状态与数量校验；下推前可先打开下推预览确认可推数量。",
        "faq.q1": "Q: 为何无法下推？",
        "faq.a1": "A: 请确认订单已审核、行状态允许下推，且目标下游模块权限已授予。",
        "faq.q2": "Q: 明细视图与表头视图数据不一致？",
        "faq.a2": "A: 明细视图按行分页取数，筛选条件与表头视图一致时仅展示维度不同。",
    },
    "purchase-order": {
        "overview.p1": "采购订单用于向供应商采购物料，记录交期、价格与到货进度。",
        "overview.p2": "支持表头/明细视图、审核、收货通知下推及批量关单。",
        "views.p1": "表头视图：按采购订单维度展示。",
        "views.p2": "明细视图：按采购行展示物料、数量与到货进度，只读。",
        "toolbar.p1": "可新建、导入导出、批量操作；工具栏与行操作以下推、审核、打印为主。",
        "toolbar.p2": "开启交期高亮时，逾期订单或行会以醒目样式标记。",
        "lifecycle.p1": "草稿与待审核可编辑；审核后可下推收货通知或入库相关流程。",
        "lifecycle.p2": "关单需满足未完结数量与状态约束。",
        "faq.q1": "Q: 采购订单与收货通知关系？",
        "faq.a1": "A: 已审核采购订单可下推收货通知，后续在仓储模块完成入库。",
        "faq.q2": "Q: 为何不能删除？",
        "faq.a2": "A: 仅草稿或待审核等非执行中状态允许删除，已审核订单需走关单或变更流程。",
    },
    "work-order": {
        "overview.p1": "生产工单承载制造任务，包含工序、计划数量、下达、报工与完工等执行过程。",
        "overview.p2": "列表提供表头、产品树、订单树等视图，便于按产品或销售订单维度查看在制工单。",
        "views.p1": "表头视图：标准工单列表与筛选。",
        "views.p2": "产品树/订单树：按产品或来源订单聚合展示工单，便于追溯。",
        "toolbar.p1": "支持新建、导入、批量下达/冻结/关单等（以页面实际按钮与权限为准）。",
        "toolbar.p2": "行操作含查看、编辑、下达、报工入口、打印与拆分等。",
        "lifecycle.p1": "工单需下达后车间方可报工；完工数量回写后可能触发入库或检验流程。",
        "lifecycle.p2": "冻结工单暂停报工；关单前请确认在制与入库数量。",
        "faq.q1": "Q: 工单无法报工？",
        "faq.a1": "A: 检查是否已下达、是否冻结，以及当前工序是否允许报工。",
        "faq.q2": "Q: 产品树视图为空？",
        "faq.a2": "A: 确认筛选条件与工单状态，树视图仅聚合当前列表范围内的数据。",
    },
}

# Extend DOCUMENTS with templates for remaining doc keys
DOC_LABELS = {
    "sales-contract": "销售合同",
    "quotation": "报价单",
    "sales-forecast": "销售预测",
    "shipment-notice": "发货通知",
    "sales-return": "销售退货",
    "purchase-requisition": "采购申请",
    "purchase-inquiry": "采购询价",
    "receipt-notice": "收货通知",
    "purchase-return": "采购退货",
}

for key, title in DOC_LABELS.items():
    if key not in DOCUMENTS:
        DOCUMENTS[key] = {
            "overview.p1": f"{title}列表用于维护对应业务单据，支持检索、审核与下推等操作（以页面实际按钮为准）。",
            "overview.p2": "可在表头视图与明细视图间切换，明细视图按行展示物料与数量进度。",
            "views.p1": "表头视图：按单据头汇总。",
            "views.p2": "明细视图：按行展示，只读查看。",
            "toolbar.p1": "工具栏提供新建、导入导出及批量操作；具体能力取决于单据类型与权限。",
            "toolbar.p2": "行操作含查看、编辑、审核、打印与下推等。",
            "lifecycle.p1": "草稿/待审核可编辑提交；已审核可执行下推或打印。",
            "lifecycle.p2": "关单、退回等操作需满足状态与数量校验。",
            "faq.q1": f"Q: 为何看不到下推按钮？",
            "faq.a1": "A: 请确认单据已审核且当前用户具备对应下推权限。",
            "faq.q2": "Q: 明细视图用途？",
            "faq.a2": "A: 用于按行核对物料、数量与执行进度，不直接编辑行数据。",
        }

LIST_PAGES = {
    "masterData.plants": ("厂区", "维护工厂/厂区主数据，含编码、名称与启用状态。"),
    "masterData.workshops": ("车间", "维护生产车间，供工单、工艺与仓储引用。"),
    "masterData.workCenters": ("工作中心", "维护产能与报工归属的工作中心。"),
    "masterData.workGroups": ("班组", "维护生产班组信息。"),
    "masterData.productionLines": ("产线", "维护产线及与车间/厂区的关系。"),
    "masterData.workstations": ("工位", "维护工位台账，供现场作业引用。"),
    "masterData.warehouses": ("仓库", "维护仓库主数据及类型。"),
    "masterData.storageAreas": ("库区", "维护仓库下属库区。"),
    "masterData.storageLocations": ("库位", "维护货位编码与所属库区。"),
    "masterData.bom": ("物料清单", "维护产品 BOM，支持成品/半成品/全部 BOM 视图切换。"),
    "system.departments": ("部门", "维护组织部门树，供用户与数据范围引用。"),
    "system.positions": ("岗位", "维护岗位信息并与部门关联。"),
    "system.tenants": ("租户", "平台级租户管理（需相应权限）。"),
    "system.systemParameters": ("系统参数", "查看与维护系统级参数配置。"),
    "system.printTemplates": ("打印模板", "管理打印模板，支持表格/卡片/帮助视图。"),
    "system.printDevices": ("打印设备", "维护打印机或打印代理设备。"),
    "system.integrationConfigs": ("集成配置", "维护外部系统连接器与集成参数。"),
    "system.dataSources": ("数据源", "配置报表或数据集使用的数据源。"),
    "system.approvalInstances": ("审批实例", "查看运行中的审批流程实例。"),
    "system.onlineUsers": ("在线用户", "查看当前在线会话。"),
    "system.dataBackups": ("数据备份", "发起或下载系统备份（以页面按钮为准）。"),
    "personal.tasks": ("我的任务", "查看与处理个人待办任务。"),
}

MODULE_CENTERS = {
    "sales": (
        "销售中心",
        "展示销售相关 KPI、快捷入口与常用事项卡片。",
        "待办/异常/跟进类卡片可点击进入对应列表处理。",
        "快捷入口跳转到销售订单、客户池等高频页面。",
    ),
}


def doc_keys(lang: str, doc_key: str, fields: dict[str, str]) -> dict[str, str]:
    p = f"help.document.{doc_key}"
    title = doc_key.replace("-", " ").title()
    out = {
        f"{p}.overview.label": "1. 概述" if lang == "zh" else "1. Overview",
        f"{p}.overview.title": "1. 概述" if lang == "zh" else "1. Overview",
        f"{p}.views.label": "2. 视图说明" if lang == "zh" else "2. Views",
        f"{p}.views.title": "2. 视图说明" if lang == "zh" else "2. Views",
        f"{p}.guide.label": "3. 操作指南" if lang == "zh" else "3. Operations",
        f"{p}.toolbar.label": "3.1 工具栏与批量" if lang == "zh" else "3.1 Toolbar",
        f"{p}.toolbar.title": "3.1 工具栏与批量" if lang == "zh" else "3.1 Toolbar",
        f"{p}.lifecycle.label": "3.2 状态与流程" if lang == "zh" else "3.2 Lifecycle",
        f"{p}.lifecycle.title": "3.2 状态与流程" if lang == "zh" else "3.2 Lifecycle",
        f"{p}.faq.q1": fields.get("faq.q1", ""),
        f"{p}.faq.a1": fields.get("faq.a1", ""),
        f"{p}.faq.q2": fields.get("faq.q2", ""),
        f"{p}.faq.a2": fields.get("faq.a2", ""),
    }
    for k, v in fields.items():
        if k.startswith("faq."):
            continue
        out[f"{p}.{k}"] = v
    return out


def build_locale(lang: str) -> dict[str, str]:
    common = COMMON_ZH if lang == "zh" else COMMON_EN
    data = dict(common)
    if lang == "zh":
        data.update(APPLICATION_CENTER_ZH)
    else:
        # English application center - abbreviated mirror
        for k, v in APPLICATION_CENTER_ZH.items():
            data[k] = v  # keep zh for now in en stub - will overwrite key ones
        data.update(
            {
                "help.applicationCenter.overview.p1": "Application Center lets admins install/uninstall apps, enable/disable them, scan local apps, sync menus, and open detail or advanced settings.",
                "help.applicationCenter.concepts.p2": "Basic apps in the main catalog include kuaizhizao, kuaicaiwu, kuaioa, kuaiplm, and master-data.",
                "help.applicationCenter.concepts.p3": "Pro placeholders (kuaireport, kuaiiot, kuaiai) require a valid License Key before enable.",
            }
        )

    for doc_key, fields in DOCUMENTS.items():
        if lang == "en":
            en_fields = {k: f"[{doc_key}] {v}" for k, v in fields.items()}
            data.update(doc_keys("en", doc_key, en_fields))
        else:
            data.update(doc_keys("zh", doc_key, fields))

    for page_key, (title, p1) in LIST_PAGES.items():
        p = f"help.listPage.{page_key}"
        if lang == "zh":
            data.update(
                {
                    f"{p}.overview.label": "1. 概述",
                    f"{p}.overview.title": f"1. {title}",
                    f"{p}.overview.p1": p1,
                    f"{p}.overview.p2": "使用顶部搜索与列表工具栏进行查询、新建、导入导出等操作（以页面实际按钮为准）。",
                    f"{p}.operations.label": "2. 常用操作",
                    f"{p}.operations.title": "2. 常用操作",
                    f"{p}.operations.p1": "行操作通常包含查看、编辑、启用/停用；部分台账支持批量删除或导入。",
                    f"{p}.operations.p2": "启用状态以标记展示；停用后主数据在业务单据中不可再被选用。",
                    f"{p}.faq.q1": "Q: 为何无法编辑？",
                    f"{p}.faq.a1": "A: 请确认具备更新权限，且记录未被引用锁定。",
                }
            )
        else:
            data.update(
                {
                    f"{p}.overview.label": "1. Overview",
                    f"{p}.overview.title": f"1. {title}",
                    f"{p}.overview.p1": p1,
                    f"{p}.overview.p2": "Use search and toolbar actions available on this page.",
                    f"{p}.operations.label": "2. Operations",
                    f"{p}.operations.title": "2. Operations",
                    f"{p}.operations.p1": "Row actions typically include view, edit, and activate/deactivate.",
                    f"{p}.operations.p2": "Inactive master data cannot be selected on new documents.",
                    f"{p}.faq.q1": "Q: Why can't I edit?",
                    f"{p}.faq.a1": "A: Check update permission and whether the record is referenced.",
                }
            )

    for mod_key, (title, p1, p2, p3) in MODULE_CENTERS.items():
        p = f"help.moduleCenter.{mod_key}"
        if lang == "zh":
            data.update(
                {
                    f"{p}.overview.label": "1. 概述",
                    f"{p}.overview.title": f"1. {title}",
                    f"{p}.overview.p1": p1,
                    f"{p}.overview.p2": "指标卡展示当前模块关键数量；无数据时不显示空壳卡片。",
                    f"{p}.panels.label": "2. 常用事项",
                    f"{p}.panels.title": "2. 常用事项",
                    f"{p}.panels.p1": p2,
                    f"{p}.panels.p2": "卡片仅在有数据或加载中时挂载；失败时可在卡片内重试。",
                    f"{p}.shortcuts.label": "3. 快捷入口",
                    f"{p}.shortcuts.title": "3. 快捷入口",
                    f"{p}.shortcuts.p1": p3,
                    f"{p}.faq.q1": "Q: 为何某张卡片不显示？",
                    f"{p}.faq.a1": "A: 完全无数据的卡片默认不挂载，避免空白占位。",
                }
            )
        else:
            data.update(
                {
                    f"{p}.overview.label": "1. Overview",
                    f"{p}.overview.title": f"1. {title}",
                    f"{p}.overview.p1": p1,
                    f"{p}.overview.p2": "KPI cards hide when empty.",
                    f"{p}.panels.label": "2. Action panels",
                    f"{p}.panels.title": "2. Action panels",
                    f"{p}.panels.p1": p2,
                    f"{p}.panels.p2": "Panels mount only with data or while loading.",
                    f"{p}.shortcuts.label": "3. Shortcuts",
                    f"{p}.shortcuts.title": "3. Shortcuts",
                    f"{p}.shortcuts.p1": p3,
                    f"{p}.faq.q1": "Q: Why is a card missing?",
                    f"{p}.faq.a1": "A: Empty panels are not mounted.",
                }
            )

    return data


def write_ts(locale: str, data: dict[str, str]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    lines = ["export default {"]
    for k in sorted(data.keys()):
        v = json.dumps(data[k], ensure_ascii=False)
        lines.append(f"  {json.dumps(k, ensure_ascii=False)}: {v},")
    lines.append("};\n")
    (OUT / f"{locale}.ts").write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {locale}.ts ({len(data)} keys)")


if __name__ == "__main__":
    write_ts("zh-CN", build_locale("zh"))
    write_ts("en-US", build_locale("en"))
    # Other locales mirror zh for structure; sync script can refine later
    for loc in ("zh-Hant", "ja-JP", "vi-VN", "lo-LA"):
        write_ts(loc, build_locale("zh"))
