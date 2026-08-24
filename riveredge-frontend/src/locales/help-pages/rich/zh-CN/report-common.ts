/**
 * 快制造/UniReport 通用报表帮助（zh-CN）
 * 所有 KuaizhizaoReport / UniReport 页面共用，无需逐页编写。
 */
export default {
  'help.report.common.overview.label': '1. 概述',
  'help.report.common.overview.title': '1. 系统报表概述',
  'help.report.common.overview.p1':
    '本页属于快制造系统自带账表报表，用于查询、汇总与分析业务数据。报表采用中国式严肃账表风格：筛选条件集中在工具栏，明细表通常一行一物料，汇总表展示笔数、金额与占比等统计指标。',
  'help.report.common.overview.p2':
    '不同菜单下的报表列字段与统计口径由后端报表服务定义；切换报表视图或统计期间后会重新取数。右上角可在「表格」与「帮助」视图间切换，本帮助适用于全部系统报表页。',
  'help.report.common.overview.b1': '明细报表：头表字段（单号、日期、客户等）在行上重复，一行对应一条行项目或明细记录。',
  'help.report.common.overview.b2': '汇总报表：按客户、物料、供应商等维度聚合，展示笔数、数量、金额与占比。',
  'help.report.common.overview.b3': '跟踪类报表：展示执行进度、已完/未完数量、逾期天数等执行态信息，进度以文本百分比呈现。',
  'help.report.common.overview.b4': '顶部指标卡（若有）反映当前筛选条件下的汇总快照，点击部分卡片可能带入筛选条件。',

  'help.report.common.filter.label': '2. 筛选与查询',
  'help.report.common.filter.title': '2. 筛选与查询',
  'help.report.common.filter.p1': '报表筛选集中在表格上方工具栏，不会单独占用整行搜索区。按下列顺序组合条件可快速缩小结果范围。',
  'help.report.common.filter.s1': '设置统计期间：使用期间筛选控件选择起止日期，这是多数报表的默认时间范围。',
  'help.report.common.filter.s2': '输入关键词：在工具栏搜索框模糊匹配单号、编码、名称等主字段（具体可搜字段因报表而异）。',
  'help.report.common.filter.s3': '展开高级搜索：按客户、物料、状态等扩展条件进一步过滤（以当前页已配置项为准）。',
  'help.report.common.filter.s4': '列头排序与筛选：点击列头可排序；部分列支持表头筛选，与服务端分页联动。',
  'help.report.common.filter.b1': '报表视图切换：若功能区提供 Segmented 切换（如汇总/明细、不同统计口径），切换后会重新请求数据。',
  'help.report.common.filter.b2': '重置：清空搜索与列筛选后恢复默认期间与全量结果（仍受权限数据范围约束）。',
  'help.report.common.filter.b3': '分页：大数据量报表采用服务端分页，翻页不会丢失当前筛选条件。',
  'help.report.common.filter.b4': '权限：无权限的菜单不可见；数据范围由角色与数据权限决定，不同用户可见行可能不同。',
  'help.report.common.filter.b5': '期间与业务日期均按站点时区展示，格式为 YYYY-MM-DD HH:MM:SS。',

  'help.report.common.read.label': '3. 解读与导出',
  'help.report.common.read.title': '3. 解读与导出',
  'help.report.common.read.p1': '阅读报表时注意区分「查询快照」与「实时库存/单据状态」：报表取数有服务端计算时点，极端并发下可能与单据页略有差异。',
  'help.report.common.read.p2': '金额列通常带币种符号；数量与单位分列展示；逾期、进度等字段以汉字或文本百分比呈现，不使用彩色流程徽章。',
  'help.report.common.read.b1': '单号列：仅展示文本，不提供复制图标，也不挂关联单据抽屉链接（账表只读）。',
  'help.report.common.read.b2': '状态列：展示业务状态汉字或后端枚举文案，筛选下拉与列表取值一致。',
  'help.report.common.read.b3': '合计行：表底固定合计与当前页或全局汇总对齐，金额列格式与表体一致。',
  'help.report.common.read.b4': '列宽与省略：长编码自动省略，可通过列设置调整显示列与顺序（列持久化按页面保存）。',
  'help.report.common.read.b5': '内部 id 字段不会展示给用户，导出文件亦不应包含无业务含义的技术主键。',
  'help.report.common.read.b6': '单位列展示物料主数据单位名称，不使用缺失的字典占位。',
  'help.report.common.read.exportTitle': '3.1 导出与打印',
  'help.report.common.read.exportP1': '工具栏提供导出与打印（以权限与页面配置为准），导出内容遵循当前筛选条件与可见列。',
  'help.report.common.read.exportB1': '导出：生成表格文件，适合二次分析或存档；大量数据导出可能耗时，请耐心等待完成提示。',
  'help.report.common.read.exportB2': '打印：按当前筛选结果排版输出，打印前建议先确认期间与列筛选是否正确。',
  'help.report.common.read.exportB3': '导出不会触发业务写操作，也不会改变源单据状态。',

  'help.report.common.faq.label': '4. 常见问题',
  'help.report.common.faq.title': '4. 常见问题',
  'help.report.common.faq.q1': 'Q: 为什么报表单号不能点击打开详情？',
  'help.report.common.faq.a1':
    'A: 系统报表为只读账表，单号故意不提供抽屉链接与复制按钮，避免与业务列表混淆。需要处理单据请从对应业务菜单进入。',
  'help.report.common.faq.q2': 'Q: 切换统计期间后数据没变化？',
  'help.report.common.faq.a2':
    'A: 确认已触发查询（部分页面修改期间后自动刷新）；检查是否仍有列头筛选或关键词残留；若仍异常请联系管理员核对报表后端配置。',
  'help.report.common.faq.q3': 'Q: 合计行与明细行对不上？',
  'help.report.common.faq.a3':
    'A: 合计可能为全量汇总而表体为分页明细；或部分列不参与合计。请以导出全量或报表说明中的统计口径为准。',
  'help.report.common.faq.q4': 'Q: 看不到某张报表菜单？',
  'help.report.common.faq.a4':
    'A: 需角色分配对应菜单与 read 权限；应用须已安装并启用快制造；菜单同步后刷新浏览器。',
  'help.report.common.faq.q5': 'Q: 列头筛选为何选项不全？',
  'help.report.common.faq.a5':
    'A: 列头筛选项通常基于当前结果集或后端 facet 接口生成，大数据量下可能只展示高频值；可先用期间与关键词缩小范围。',
  'help.report.common.faq.q6': 'Q: 每张报表都要单独看帮助吗？',
  'help.report.common.faq.a6':
    'A: 不需要。全部系统报表共用本帮助；具体列含义请参考表头与菜单名称，特殊口径以该报表业务定义为准。',
};
