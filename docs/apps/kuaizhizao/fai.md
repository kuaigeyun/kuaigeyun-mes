# FAI 首件检验（自研）

## 落点

快制造 → **质量管理** → **首件检验** → FAI 单  
路径：`/apps/kuaizhizao/quality-management/fai-orders`  
权限：`kuaizhizao:quality-management-fai-orders:*`

不新开独立 FAI 应用。可视化气泡图在 **FAI 单编辑态** 内打开，不另挂菜单。

## 与 OpenFAI 对照

| OpenFAI 能力 | RiverEdge |
|--------------|-----------|
| 零件/图纸 | 物料 + 图纸号/版本；图纸可上传图片（JPG/PNG/WEBP） |
| OCR 气泡 | 气泡图编辑器内「OCR 识别」；走租户 OCR 视觉端点 + 结构化候选（**不拷贝 OpenFAI**） |
| 可视化气泡 | 图纸叠加层：点选放置气泡号、拖动、引线锚点；候选含归一化坐标 `x/y` |
| 检验计划 | 可从质检方案数值步骤导入特性 |
| 测量批次 | FAI 单特性行实测 + 判定 |
| Cp/Cpk | 多样本摘要写入单头 |
| AS9102/PPAP 报告 | 结构化导出（Form1/2/3 字段映射） |
| 审批 | 平台单据 submit/approve/reject |
| 设备/校准 | 特性行量具编码引用，台账留设备管理 |

## 气泡图流程

1. 保存 FAI 草稿后，打开 **气泡图**
2. 上传图纸图片（或沿用已存 `drawing_file_url`：文件 UUID 或直链）
3. **点选放置** 气泡 / **OCR 识别** 生成候选（可再人工校对位置与公差）
4. 保存候选 → **确认为特性**（写入特性明细，带气泡号）

候选 JSON 元素约定（存 `balloon_candidates`）：

- `balloon_no` / `characteristic_name` / `nominal_value` / `upper_tolerance` / `lower_tolerance` / `unit`
- `x` / `y`：气泡中心，相对图纸宽高的 0～1
- `anchor_x` / `anchor_y`：可选引线落点（尺寸标注附近）
- `source`：`manual` | `ocr`

## 许可说明（禁止拷贝）

[OpenFAI](https://gitee.com/openquality/OpenFAI) 使用 **PolyForm Noncommercial**，商业用途须其商业授权。  
本模块**仅参考业务闭环与能力拆分**，使用 RiverEdge 现有技术栈自研，**禁止移植其源码、OCR 配置页或报告模板二进制**。

## 状态与放行

- 单状态：`draft` → `in_progress` → `submitted` → `approved` / `rejected` → `closed`
- 结论：`pending` / `pass` / `fail`
- 组织门禁：`require_fai_before_mass_reporting`；工单已挂 FAI 且无「批准且合格」时，禁止批量报工
- 自动建单：`auto_create_fai_on_work_order` 为真时，工单创建后生成 FAI 草稿

## 与日常检验关系

FAI 不是 `plan_type=fai` 的普通过程检：特性级 FAIR + 放行语义独立；可从质检方案导入步骤生成特性行。不合格仍走不合格台账 / 8D。
