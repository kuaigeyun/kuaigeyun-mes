"""KU-AI 出厂默认 FAQ 预设（RiverEdge / 快制造）。"""

from __future__ import annotations

from typing import TypedDict


class DefaultFaqPreset(TypedDict):
    seed_key: str
    title: str
    question: str
    answer: str


DEFAULT_FAQ_PRESETS: list[DefaultFaqPreset] = [
    {
        "seed_key": "work-order-create",
        "title": "如何创建生产工单",
        "question": "如何创建生产工单？",
        "answer": (
            "路径：快制造 → 生产执行 → 生产工单。\n"
            "1. 点击「新建」创建工单；\n"
            "2. 选择产品物料、计划数量、车间/工作中心；\n"
            "3. 按需关联销售订单（MTO）或按库存生产（MTS）；\n"
            "4. 保存后提交审核/下达（以贵司审批配置为准）。\n"
            "菜单路径：/apps/kuaizhizao/production-execution/work-orders"
        ),
    },
    {
        "seed_key": "reporting",
        "title": "报工在哪里操作",
        "question": "报工在哪里操作？",
        "answer": (
            "路径：快制造 → 生产执行 → 报工记录。\n"
            "在列表中选择对应工单与工序进行报工，填写完成数量、合格/不良数量后提交。\n"
            "车间现场也可使用报工终端（大屏/工位）快速报工。\n"
            "菜单路径：/apps/kuaizhizao/production-execution/reporting"
        ),
    },
    {
        "seed_key": "inventory-query",
        "title": "如何查询物料库存",
        "question": "怎么查询物料库存？",
        "answer": (
            "路径：快制造 → 仓储管理 → 即时库存。\n"
            "可按物料编码/名称、仓库筛选；支持查看各仓库结存数量。\n"
            "也可在 KU-AI 对话中直接询问「某物料还有多少库存」（需有库存查看权限）。\n"
            "菜单路径：/apps/kuaizhizao/warehouse-management/inventory"
        ),
    },
    {
        "seed_key": "production-progress",
        "title": "如何查看生产进度",
        "question": "如何查看生产进度？",
        "answer": (
            "常用方式：\n"
            "1. 生产工单列表/详情：查看状态、完成数量、工序进度；\n"
            "2. 计划管理 → 排程/生产计划：查看计划达成；\n"
            "3. 生产执行 → 报工统计：按工单/工序汇总产出。\n"
            "在 KU-AI 中可提供工单号查询具体进度（需有工单查看权限）。"
        ),
    },
    {
        "seed_key": "outsource-order",
        "title": "如何创建委外单",
        "question": "怎么做委外单？",
        "answer": (
            "路径：快制造 → 生产执行 → 委外管理。\n"
            "1. 新建委外订单，选择供应商、委外物料与数量；\n"
            "2. 审核通过后生成委外工单，跟踪发料与收货；\n"
            "3. 委外完工后按流程入库/检验。\n"
            "菜单路径：/apps/kuaizhizao/production-execution/outsource-management"
        ),
    },
    {
        "seed_key": "sales-order",
        "title": "如何创建销售订单",
        "question": "如何创建销售订单？",
        "answer": (
            "路径：快制造 → 销售管理 → 销售订单。\n"
            "填写客户、交货日期、明细物料与数量、价格等，保存后按配置走审核流程。\n"
            "审核通过后可下推发货通知、销售出库等。\n"
            "菜单路径：/apps/kuaizhizao/sales-management/sales-orders"
        ),
    },
    {
        "seed_key": "purchase-order",
        "title": "如何创建采购订单",
        "question": "如何创建采购订单？",
        "answer": (
            "路径：快制造 → 采购管理 → 采购订单。\n"
            "选择供应商，维护采购明细、交期与价格，保存并提交审核。\n"
            "审核通过后可下推收货通知、采购入库。\n"
            "菜单路径：/apps/kuaizhizao/purchase-management/purchase-orders"
        ),
    },
    {
        "seed_key": "purchase-receipt",
        "title": "采购入库操作",
        "question": "采购入库怎么操作？",
        "answer": (
            "路径：快制造 → 仓储管理 → 入库管理 → 采购入库。\n"
            "可由采购订单下推生成，或手工新建；确认实收数量、批次（若启用）后过账入库。\n"
            "过账后即时库存增加。"
        ),
    },
    {
        "seed_key": "sales-delivery",
        "title": "销售出库操作",
        "question": "销售出库怎么操作？",
        "answer": (
            "路径：快制造 → 仓储管理 → 出库管理 → 销售出库。\n"
            "通常由销售订单或发货通知下推；拣货确认后过账出库，库存扣减。\n"
            "若启用出货检验（OQC），需先完成检验再放行出库。"
        ),
    },
    {
        "seed_key": "production-picking",
        "title": "生产领料",
        "question": "生产领料在哪里做？",
        "answer": (
            "路径：快制造 → 仓储管理 → 出库管理 → 生产领料。\n"
            "按工单领用原材料，确认库位与批次后过账，库存扣减并关联工单。"
        ),
    },
    {
        "seed_key": "finished-goods-receipt",
        "title": "成品入库",
        "question": "成品入库怎么操作？",
        "answer": (
            "路径：快制造 → 仓储管理 → 入库管理 → 成品入库。\n"
            "关联生产工单，填写入库数量；过账后成品库存增加，工单完工数量更新。"
        ),
    },
    {
        "seed_key": "quality-incoming",
        "title": "来料检验",
        "question": "来料检验在哪里？",
        "answer": (
            "路径：快制造 → 质量管理 → 来料检验。\n"
            "针对采购到货进行 IQC 检验，记录合格/不合格数量与处置结论，"
            "检验合格后方可正式入库（视贵司质量策略配置）。"
        ),
    },
    {
        "seed_key": "plan-scheduling",
        "title": "生产计划与排程",
        "question": "生产计划在哪里做？",
        "answer": (
            "路径：快制造 → 计划管理。\n"
            "可进行需求运算、生产计划编制与排程；滚动计划用于日粒度派工。\n"
            "计划审核发布后可下推生产工单。"
        ),
    },
    {
        "seed_key": "kuaiai-intro",
        "title": "KU-AI 助手说明",
        "question": "KU-AI 是什么？能帮我做什么？",
        "answer": (
            "KU-AI 是 RiverEdge 内置 AI 助手（顶栏图标或 F1 打开）。\n"
            "可解答系统操作问题、查询您有权限的业务单据与库存数据。\n"
            "操作类问题优先参考企业知识库；具体单号/数量请让助手实时查询，不要自行编造。"
        ),
    },
    {
        "seed_key": "kuaiai-knowledge",
        "title": "如何维护 AI 知识库",
        "question": "如何让 AI 更懂我们公司？",
        "answer": (
            "路径：KU-AI → 知识库，或请管理员在站点设置配置企业说明。\n"
            "1. 添加 FAQ：录入常见问题与标准答案；\n"
            "2. 上传操作手册（txt/md）；\n"
            "3. 站点设置 → 集成设置：填写「企业系统说明」、开启 RAG。\n"
            "保存后新 FAQ 会自动建立索引供对话检索。"
        ),
    },
]

SEED_TITLE_PREFIX = "[系统默认] "
