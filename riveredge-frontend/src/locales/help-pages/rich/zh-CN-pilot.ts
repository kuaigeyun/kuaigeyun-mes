/**
 * 试点页富文本帮助（覆盖 help-pages/zh-CN.ts 中的简版条目）
 * 当前范围：应用中心、销售订单
 */
export default {
  // ── 应用中心 ─────────────────────────────────────────
  'help.applicationCenter.overview.p1':
    '应用中心是系统管理员维护组织内全部业务应用的入口。在这里可以完成应用的发现与注册、安装与卸载、启用与禁用、菜单同步，以及查看详情、修改展示参数或执行部分应用的高级操作（如重置业务数据）。',
  'help.applicationCenter.overview.p2':
    '建议把应用中心理解为「应用生命周期控制台」：新应用上线、菜单变更、临时停用某模块，都应先在这里完成，再通知业务用户刷新使用。',
  'help.applicationCenter.concepts.p1':
    '下列概念对应卡片/列表上的标签与按钮行为，弄懂后再操作可减少误卸载、误停用。',
  'help.applicationCenter.concepts.b1':
    '系统应用：如主数据 master-data，为平台底座，卡片上卸载按钮禁用，不可卸载。',
  'help.applicationCenter.concepts.b2':
    '基础应用：主仓已 compose 的业务包，含快制造 kuaizhizao、快财务 kuaicaiwu、快办公 kuaioa、快 PLM kuaiplm 与主数据 master-data，安装后可在侧栏看到对应菜单。',
  'help.applicationCenter.concepts.b3':
    '专业版占位：快报表 kuaireport、快数采 kuaiiot、KU-AI kuaiai 等以占位卡片展示；首次启用需输入有效 License Key，未入库 compose 前不可当作已安装应用使用。',
  'help.applicationCenter.concepts.b4':
    '应用清单 Manifest：描述应用编码、版本、菜单树与权限码；菜单同步即把 manifest 中的菜单写入 core_menus 表，侧栏才会更新。',
  'help.applicationCenter.concepts.b5':
    '专用应用分类：「专用应用」Tab 用于组织级定制应用绑定，与标准基础应用卡片分区展示。',
  'help.applicationCenter.layout.label': '3. 页面与分类',
  'help.applicationCenter.layout.title': '3. 页面与分类',
  'help.applicationCenter.layout.p1': '应用中心顶部提供分类切换与全局操作，主体可在卡片视图与列表视图间切换。',
  'help.applicationCenter.layout.b1':
    '分类 Tab：基础应用 / 专业版 / 专用应用，切换后仅展示该分类下的应用卡片或列表行。',
  'help.applicationCenter.layout.b2':
    '卡片视图：适合浏览应用图标、版本与快捷操作（安装、启停、更多操作）。',
  'help.applicationCenter.layout.b3':
    '列表视图：适合批量对比状态、排序与检索，行内同样提供启停与更多操作。',
  'help.applicationCenter.layout.b4':
    '顶部按钮：扫描应用（注册本地代码）、一键同步菜单（全量写入菜单并刷新侧栏），是开发/运维最高频组合操作。',
  'help.applicationCenter.guide.label': '4. 操作指南',
  'help.applicationCenter.install.label': '4.1 安装与卸载',
  'help.applicationCenter.install.title': '4.1 应用的安装与卸载',
  'help.applicationCenter.install.p1': '安装会把应用注册到当前组织并出现在侧栏（启用状态下）；卸载会移除应用注册，关联菜单与业务入口可能不可见。',
  'help.applicationCenter.install.s1': '在目标应用卡片或列表行确认当前为「未安装」。',
  'help.applicationCenter.install.s2': '点击安装（或下载图标），等待成功提示。',
  'help.applicationCenter.install.s3': '若侧栏未出现菜单，继续执行「一键同步菜单」。',
  'help.applicationCenter.install.s4': '卸载：在已安装且非系统应用上打开更多操作，选择卸载并确认影响范围。',
  'help.applicationCenter.enable.label': '4.2 启用与授权',
  'help.applicationCenter.enable.title': '4.2 应用的启用与授权',
  'help.applicationCenter.enable.p1':
    '启用/禁用控制普通用户是否能在侧栏看到该应用；禁用不会卸载，数据仍保留，适合临时维护窗口。',
  'help.applicationCenter.enable.b1': '基础应用：直接切换状态开关即可启停。',
  'help.applicationCenter.enable.b2': '专业版占位：首次启用弹出 License Key 对话框，校验通过后写入授权并启用。',
  'help.applicationCenter.enable.b3': '禁用后：已登录用户可能需要刷新页面或重新登录后菜单才会消失。',
  'help.applicationCenter.scan.label': '4.3 扫描本地应用',
  'help.applicationCenter.scan.title': '4.3 扫描本地应用',
  'help.applicationCenter.scan.p1':
    '开发人员在仓库 src/apps 下新增应用代码后，需扫描才能把 manifest 注册到应用中心数据库。',
  'help.applicationCenter.scan.s1': '确认后端已部署包含新应用的代码并重启服务（如需要）。',
  'help.applicationCenter.scan.s2': '点击顶部「扫描应用」，等待返回注册数量。',
  'help.applicationCenter.scan.s3': '扫描成功后立即点击「一键同步菜单」。',
  'help.applicationCenter.scan.s4': '刷新浏览器，检查侧栏与权限矩阵是否出现新菜单。',
  'help.applicationCenter.scan.alert':
    '扫描只更新应用清单表，不会自动写入 core_menus。跳过同步菜单是「扫描成功但侧栏无入口」的首要原因。',
  'help.applicationCenter.menuSync.label': '4.4 菜单同步',
  'help.applicationCenter.menuSync.title': '4.4 菜单同步管理',
  'help.applicationCenter.menuSync.p1':
    '菜单顺序与权限码以各应用 manifest.json 为准；同步会把最新 manifest 菜单全量写入 core_menus，并刷新前端导航缓存。',
  'help.applicationCenter.menuSync.b1':
    '一键同步菜单：适合批量升级、扫描后首次上线、不确定哪些应用有菜单变更时使用。',
  'help.applicationCenter.menuSync.b2':
    '单应用同步：在某一应用卡片的更多操作中选择「同步菜单」，仅更新该应用菜单，影响面更小。',
  'help.applicationCenter.menuSync.b3':
    '同步完成后若侧栏仍异常，请确认该应用已安装且处于启用状态，并检查当前账号角色是否分配了新菜单权限。',
  'help.applicationCenter.advanced.label': '4.5 高级配置',
  'help.applicationCenter.advanced.title': '4.5 高级配置与管理',
  'help.applicationCenter.advanced.p1': '更多操作菜单中的进阶能力，操作前请确认影响范围。',
  'help.applicationCenter.advanced.b1': '查看：打开右侧详情抽屉，阅读版本号、描述、客户端发布包等信息。',
  'help.applicationCenter.advanced.b2': '应用配置：修改系统内展示名称、排序等参数，不改变业务数据。',
  'help.applicationCenter.advanced.b3': '重置数据：快制造等应用提供，将清空或初始化该应用核心业务数据，仅限测试环境或经审批的生产维护。',
  'help.applicationCenter.advanced.b4': '专用应用绑定：在专用应用分类中维护组织定制应用与租户/环境的绑定关系。',
  'help.applicationCenter.advanced.alert':
    '重置数据为不可逆高危操作，执行前务必确认环境、备份与业务停机窗口，必要时联系技术支持。',
  'help.applicationCenter.faq.q1': 'Q: 为什么卸载按钮是灰色的？',
  'help.applicationCenter.faq.a1':
    'A: 该应用为系统应用（如主数据），为保障平台稳定禁止卸载。若需隐藏菜单，请使用「禁用」而非卸载。',
  'help.applicationCenter.faq.q2': 'Q: 扫描成功但侧栏没有新菜单？',
  'help.applicationCenter.faq.a2':
    'A: 扫描只注册应用清单。请继续点击「一键同步菜单」，并确认应用已安装、已启用，且您的角色已分配新菜单权限。',
  'help.applicationCenter.faq.q3': 'Q: 启用快报表/快数采/KU-AI 为何要求 License？',
  'help.applicationCenter.faq.a3':
    'A: 这些属于专业版占位能力，需向供应商获取 License Key 激活；未激活前卡片可展示但不可作为正式业务应用启用。',
  'help.applicationCenter.faq.q4': 'Q: 禁用和卸载有什么区别？',
  'help.applicationCenter.faq.a4':
    'A: 禁用仅隐藏菜单，应用仍安装、数据保留，可随时重新启用；卸载移除应用注册，菜单与入口消失，恢复需重新安装并同步菜单。',
  'help.applicationCenter.faq.q5': 'Q: 一键同步菜单会改业务数据吗？',
  'help.applicationCenter.faq.a5':
    'A: 不会。同步只更新菜单与权限注册信息，不修改订单、库存等业务表；但菜单结构变化可能影响用户可见入口，建议在低峰期操作。',
  'help.applicationCenter.faq.q6': 'Q: 列表视图和卡片视图操作有差异吗？',
  'help.applicationCenter.faq.a6':
    'A: 能力一致，均支持安装、启停、更多操作；卡片适合逐个处理，列表适合对比状态与批量浏览。',

  // ── 销售订单 ─────────────────────────────────────────
  'help.document.sales-order.overview.p1':
    '销售订单是销售业务的源头单据，记录客户、交期、价格条款与行项目明细。审核后的订单可下推需求计算、生产工单、发货通知、销售出库、销售发票与退货等下游单据，贯穿订单履约全链路。',
  'help.document.sales-order.overview.p2':
    '本页面向销售内勤、跟单与计划人员：既要看订单整体进度，也要按行核对物料、交期与下推执行情况。',
  'help.document.sales-order.overview.b1': '记录客户正式订货承诺，作为发货与对账依据。',
  'help.document.sales-order.overview.b2': '通过下推把需求传递给计划、生产、仓储与财务模块。',
  'help.document.sales-order.overview.b3': '配合指标卡快速发现逾期、待审核、未履约订单。',
  'help.document.sales-order.overview.b4': '支持从报价单、销售合同、订单评审取单，减少重复录入。',
  'help.document.sales-order.workflow.label': '2. 典型业务流程',
  'help.document.sales-order.workflow.title': '2. 典型业务流程',
  'help.document.sales-order.workflow.p1': '以下为最常见的 MTO 销售履约路径，具体节点是否启用取决于组织配置与权限。',
  'help.document.sales-order.workflow.s1': '创建销售订单：空白新建，或从报价单/销售合同/订单评审取单带入头行信息。',
  'help.document.sales-order.workflow.s2': '维护行项目：确认物料、数量、交期、价格类型与费用明细，保存为草稿或提交审核。',
  'help.document.sales-order.workflow.s3': '审核通过：订单进入执行态，行状态与生命周期列展示当前阶段（如待发货、部分出库）。',
  'help.document.sales-order.workflow.s4': '按需下推：计划侧下推需求计算或工单；物流侧下推发货通知再销售出库；财务侧下推销售发票。',
  'help.document.sales-order.workflow.s5': '跟单与变更：交期逾期可开启高亮；需改价改量可走销售订单变更；异常可走退货。',
  'help.document.sales-order.workflow.s6': '关单：全部发运或业务终止后批量关单，冻结后续下推。',
  'help.document.sales-order.layout.label': '3. 页面布局',
  'help.document.sales-order.layout.title': '3. 页面布局',
  'help.document.sales-order.layout.p1': '页面自上而下分为指标区、工具栏与列表区；右上角可切换表头/明细/帮助视图。',
  'help.document.sales-order.layout.b1':
    '指标卡：交期逾期、今日新增、待审核（启用审核时）、未履约等；部分卡片可点击自动带入筛选并刷新列表。',
  'help.document.sales-order.layout.b2':
    '工具栏左侧：新建/取单、下推（需先选中一条订单）；右侧：批量删除、批量审核、关单/重开、跟进、打印、导入导出等。',
  'help.document.sales-order.layout.b3':
    '交期逾期高亮开关：开启后，交期已过且未完成的订单或行以警告底色标记，便于跟单。',
  'help.document.sales-order.layout.b4':
    '列表列：单号叠列客户、交期进度条、下推进度、审核信息、右侧固定生命周期状态与行操作。',
  'help.document.sales-order.search.label': '4. 查询与筛选',
  'help.document.sales-order.search.title': '4. 查询与筛选',
  'help.document.sales-order.search.p1': '表头视图与明细视图共用同一套筛选条件，切换视图不会丢失已填条件。',
  'help.document.sales-order.search.b1': '关键词：模糊匹配单号、客户名称等（具体字段以搜索栏为准）。',
  'help.document.sales-order.search.b2': '单号、客户、销售人员、合同号：精确或下拉检索。',
  'help.document.sales-order.search.b3': '订单日期范围：按业务日期过滤。',
  'help.document.sales-order.search.b4': '生命周期/状态：筛选草稿、待审核、执行中、已关单等阶段。',
  'help.document.sales-order.search.b5': '高级搜索：展开更多条件（如自定义字段，若已配置）。',
  'help.document.sales-order.search.b6': '点击指标卡：快速跳转到对应状态集合（如待审核、交期逾期）。',
  'help.document.sales-order.guide.label': '5. 操作指南',
  'help.document.sales-order.create.label': '5.1 新建与取单',
  'help.document.sales-order.create.title': '5.1 新建与取单',
  'help.document.sales-order.create.p1': '推荐优先使用取单，保证与上游报价/合同/评审数据一致。',
  'help.document.sales-order.create.s1': '点击新建旁下拉，选择「从报价单取单」「从销售合同取单」或「从订单评审取单」。',
  'help.document.sales-order.create.s2': '在取单弹窗中筛选并勾选来源单据，确认带入头行。',
  'help.document.sales-order.create.s3': '在表单中补全交期、价格类型、发运方式等必填项，检查行数量与单位。',
  'help.document.sales-order.create.s4': '保存草稿供后续修改，或提交审核进入待审队列。',
  'help.document.sales-order.create.b1': '空白新建：适用于无上游单据的零星订单。',
  'help.document.sales-order.create.b2': '导入：按模板批量创建，导入前请确认物料与客户编码已在主数据存在。',
  'help.document.sales-order.create.b3': '取单后仍可编辑草稿字段，已审核订单需走变更单修改。',
  'help.document.sales-order.views.label': '5.2 表头视图与明细视图',
  'help.document.sales-order.views.title': '5.2 表头视图与明细视图',
  'help.document.sales-order.views.p1': '两种视图服务不同工作场景，可随时切换对比。',
  'help.document.sales-order.views.orderTitle': '表头视图（默认）',
  'help.document.sales-order.views.orderP1': '一行一张销售订单，适合批量审核、下推、关单与跟单。',
  'help.document.sales-order.views.orderB1': '可展开行查看行项目摘要。',
  'help.document.sales-order.views.orderB2': '支持多选批量操作与工具栏下推（选中单条时）。',
  'help.document.sales-order.views.orderB3': '生命周期、下推进度、出库进度在订单级展示。',
  'help.document.sales-order.views.detailTitle': '明细视图',
  'help.document.sales-order.views.detailP1': '一行一条订单行，适合计划/仓储按物料核对交期与剩余数量。',
  'help.document.sales-order.views.detailB1': '只读查看，不可在此视图直接编辑行。',
  'help.document.sales-order.views.detailB2': '无行勾选，批量操作请切回表头视图。',
  'help.document.sales-order.views.detailB3': '分页按行计数，与表头视图总数可能不同属正常现象。',
  'help.document.sales-order.batch.label': '5.3 工具栏与批量操作',
  'help.document.sales-order.batch.title': '5.3 工具栏与批量操作',
  'help.document.sales-order.batch.p1': '批量按钮是否可用取决于选中行状态与您的权限码；灰色按钮悬停可查看原因。',
  'help.document.sales-order.batch.b1': '批量删除：仅允许删除草稿等未执行订单，已审核订单通常不可删。',
  'help.document.sales-order.batch.b2': '批量审核：提交、撤回、通过、驳回（以组织审核配置为准）。',
  'help.document.sales-order.batch.b3': '批量关单/重开：终止或恢复执行，关单前请确认无未完成下推。',
  'help.document.sales-order.batch.b4': '批量打印：选中单条订单后打印模板单据。',
  'help.document.sales-order.batch.b5': '跟进：选中单条后快速创建跟进记录，关联当前订单。',
  'help.document.sales-order.batch.b6': '导出：导出当前列表筛选结果；导入在新建菜单或工具栏导入入口。',
  'help.document.sales-order.push.label': '5.4 下推与下游单据',
  'help.document.sales-order.push.title': '5.4 下推与下游单据',
  'help.document.sales-order.push.p1':
    '下推入口位于工具栏「下推」按钮（需选中恰好一条订单）或行内下推菜单。系统会先校验状态、剩余数量与模块是否启用。',
  'help.document.sales-order.push.p2': '多数下推会先打开预览窗，展示可推数量与目标单据类型，确认后再生成下游单据。',
  'help.document.sales-order.push.b1': '需求计算：把订单需求送入计划侧运算（模块启用且订单已审核）。',
  'help.document.sales-order.push.b2': '生产工单：按订单行生成制造任务（需工单创建权限）。',
  'help.document.sales-order.push.b3': '发货通知：通知仓库备货发运，后续再销售出库。',
  'help.document.sales-order.push.b4': '销售出库：直接生成出库单（通常在前序发货流程之后）。',
  'help.document.sales-order.push.b5': '销售发票：生成开票依据，供财务模块处理。',
  'help.document.sales-order.push.b6': '销售退货：处理退货业务，冲减已发数量。',
  'help.document.sales-order.push.b7': '销售订单变更：已审核订单改价改量改交期的正式通道。',
  'help.document.sales-order.push.b8': '回填销售合同/撤回需求计算：特殊场景使用，按钮仅在满足 capability 时出现。',
  'help.document.sales-order.push.alert':
    '下推按钮置灰时，将鼠标悬停可查看具体原因（未审核、模块未启用、无权限、无可推数量等）。',
  'help.document.sales-order.lifecycle.label': '5.5 状态与审核',
  'help.document.sales-order.lifecycle.title': '5.5 状态与审核',
  'help.document.sales-order.lifecycle.p1': '右侧「生命周期」列展示订单当前阶段及子阶段，与行内审核按钮联动。',
  'help.document.sales-order.lifecycle.auditTitle': '审核相关',
  'help.document.sales-order.lifecycle.auditP1': '是否启用多级审核由组织配置决定；行内按钮可能显示提交、通过、驳回、撤回等。',
  'help.document.sales-order.lifecycle.auditB1': '草稿：可编辑、可删除（有权限时）。',
  'help.document.sales-order.lifecycle.auditB2': '待审核：等待审批人处理，通常不可直接下推。',
  'help.document.sales-order.lifecycle.auditB3': '已审核：可下推、可打印，修改需走变更单。',
  'help.document.sales-order.lifecycle.closeTitle': '关单与重开',
  'help.document.sales-order.lifecycle.closeP1': '关单表示业务终止或已全部履约完毕，关单后不可再下推。',
  'help.document.sales-order.lifecycle.closeB1': '批量关单前请确认无进行中的发货/出库/工单。',
  'help.document.sales-order.lifecycle.closeB2': '误关单且业务允许时，可使用批量重开恢复执行态。',
  'help.document.sales-order.detail.label': '5.6 详情抽屉与行操作',
  'help.document.sales-order.detail.title': '5.6 详情抽屉与行操作',
  'help.document.sales-order.detail.p1': '点击行内「查看」或单号区域打开详情抽屉，集中阅读头信息、行项目、协作与跟踪信息。',
  'help.document.sales-order.detail.b1': '查看：只读打开详情，可复制单号、查看下推链路。',
  'help.document.sales-order.detail.b2': '编辑：草稿或允许修改的状态下打开表单弹窗。',
  'help.document.sales-order.detail.b3': '审核/打印/下推：与工具栏能力互补，适合单笔处理。',
  'help.document.sales-order.detail.b4': '抽屉内可刷新单据，审核或下推成功后列表与抽屉数据会同步更新。',
  'help.document.sales-order.faq.q1': 'Q: 为什么下推按钮是灰的？',
  'help.document.sales-order.faq.a1':
    'A: 常见原因：未选中订单、选中多条、订单未审核、目标模块未启用、无下推权限、行已无可推数量。请悬停按钮查看系统给出的具体原因。',
  'help.document.sales-order.faq.q2': 'Q: 明细视图和表头视图数量对不上？',
  'help.document.sales-order.faq.a2':
    'A: 表头视图按订单分页，明细视图按行分页；同一筛选条件下总业务数据一致，只是展示粒度不同。批量操作请在表头视图进行。',
  'help.document.sales-order.faq.q3': 'Q: 已审核订单如何改交期或价格？',
  'help.document.sales-order.faq.a3':
    'A: 请使用「销售订单变更」下推生成变更单，不要直接编辑已审核订单；是否允许变更取决于订单状态与组织规则。',
  'help.document.sales-order.faq.q4': 'Q: 交期逾期高亮是怎么判定的？',
  'help.document.sales-order.faq.a4':
    'A: 开启工具栏「交期逾期高亮」后，系统按行交期与执行进度标记尚未完成且已过交期的订单或行；具体规则与审核配置有关。',
  'help.document.sales-order.faq.q5': 'Q: 导入失败常见原因？',
  'help.document.sales-order.faq.a5':
    'A: 客户/物料编码不存在、单位不匹配、必填日期为空、价格类型不合法等。请先维护主数据，并下载最新导入模板对照字段说明。',
  'help.document.sales-order.faq.q6': 'Q: 需求计算下推后能否撤回？',
  'help.document.sales-order.faq.a6':
    'A: 若订单 capability 允许，下推菜单中会出现「撤回需求计算」；是否可撤回取决于下游是否已被引用，悬停可查看限制原因。',
};
