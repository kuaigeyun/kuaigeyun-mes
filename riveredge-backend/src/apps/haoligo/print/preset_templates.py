"""好力 GO — 维保/维修完成单打印预设（Jinja2 HTML）。"""

_PRINT_PAGE_STYLE = """
<style>
  @page { size: A4; margin: 14mm 12mm 16mm 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0; padding: 0;
    font-family: "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif;
    font-size: 11pt; line-height: 1.55; color: #1e293b;
  }
  .report { max-width: 186mm; margin: 0 auto; }
  .report-header {
    border-bottom: 2px solid #0f4c81;
    padding-bottom: 10px; margin-bottom: 14px;
    display: flex; justify-content: space-between; align-items: flex-end; gap: 12px;
  }
  .report-company { margin: 0 0 6px; font-size: 14pt; font-weight: 600; color: #334155; letter-spacing: 0.3px; }
  .report-title { margin: 0; font-size: 20pt; font-weight: 700; color: #0f4c81; letter-spacing: 0.5px; }
  .doc-meta { text-align: right; font-size: 9.5pt; color: #475569; }
  .doc-meta strong { display: block; font-size: 11pt; color: #0f172a; margin-bottom: 2px; }
  .section { margin-bottom: 14px; }
  .section-title {
    font-size: 10.5pt; font-weight: 700; color: #0f4c81;
    border-left: 4px solid #0f4c81; padding-left: 8px; margin: 0 0 8px;
  }
  .info-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px;
    border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px 12px; background: #f8fafc;
  }
  .info-item { display: flex; gap: 6px; font-size: 10pt; }
  .info-label { flex: 0 0 88px; color: #64748b; }
  .info-value { flex: 1; color: #0f172a; font-weight: 500; word-break: break-word; }
  .info-item.full { grid-column: 1 / -1; }
  .text-block {
    border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px 12px;
    background: #fff; white-space: pre-wrap; word-break: break-word; min-height: 48px;
  }
  table.data-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  table.data-table th {
    background: #0f4c81; color: #fff; font-weight: 600;
    padding: 7px 8px; text-align: left; border: 1px solid #0f4c81;
  }
  table.data-table td {
    padding: 6px 8px; border: 1px solid #e2e8f0; vertical-align: top;
  }
  table.data-table tbody tr:nth-child(even) td { background: #f8fafc; }
  .badge {
    display: inline-block; padding: 2px 8px; border-radius: 3px;
    font-size: 9pt; font-weight: 600;
  }
  .badge-repair { background: #fef3c7; color: #92400e; }
  .badge-upkeep { background: #dbeafe; color: #1e40af; }
  .badge-pass { background: #dcfce7; color: #166534; }
  .badge-fail { background: #fee2e2; color: #991b1b; }
  .photo-grid { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
  .photo-grid img {
    width: 140px; height: 105px; object-fit: cover;
    border: 1px solid #cbd5e1; border-radius: 4px;
  }
  .photo-caption { font-size: 9pt; color: #64748b; margin: 4px 0 6px; }
  .sign-row {
    margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;
    font-size: 10pt; color: #334155;
  }
  .sign-box { border-top: 1px solid #94a3b8; padding-top: 6px; min-height: 36px; }
  .report-footer {
    margin-top: 18px; padding-top: 8px; border-top: 1px dashed #cbd5e1;
    font-size: 8.5pt; color: #94a3b8; text-align: center;
  }
  .compare-label { font-size: 9pt; color: #64748b; font-weight: 600; margin-top: 10px; }
</style>
"""

EQUIPMENT_UPKEEP_COMPLETE_PRINT_CONTENT = (
    _PRINT_PAGE_STYLE
    + """
<div class="report">
  <div class="report-header">
    <div>
      {% if company_name %}<p class="report-company">{{ company_name }}</p>{% endif %}
      <h1 class="report-title">{{ report_title }}</h1>
    </div>
    <div class="doc-meta">
      <strong>{{ sheet_no or '—' }}</strong>
      制单日期：{{ created_at }}<br/>
      打印时间：{{ print_time }}
    </div>
  </div>

  <div class="section">
    <div class="section-title">基本信息</div>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">业务类型</span><span class="info-value">
        {% if service_type == '维修' %}<span class="badge badge-repair">维修</span>{% else %}<span class="badge badge-upkeep">保养</span>{% endif %}
      </span></div>
      <div class="info-item"><span class="info-label">来源维保单</span><span class="info-value">{{ source_order_no }}</span></div>
      <div class="info-item"><span class="info-label">设备代号</span><span class="info-value">{{ equipment_asset_code or '—' }}</span></div>
      <div class="info-item"><span class="info-label">设备名称</span><span class="info-value">{{ equipment_name or '—' }}</span></div>
      <div class="info-item"><span class="info-label">申请人</span><span class="info-value">{{ applicant_name or '—' }}</span></div>
      <div class="info-item"><span class="info-label">申请部门</span><span class="info-value">{{ department_name or '—' }}</span></div>
      {% if service_type == '保养' %}
      <div class="info-item"><span class="info-label">重置累计产量</span><span class="info-value">{{ clear_total_production_label }}</span></div>
      {% endif %}
    </div>
  </div>

  <div class="section">
    <div class="section-title">维保前情况（来源维保单）</div>
    <div class="text-block">{{ source_description or '—' }}</div>
    {% if before_photos %}
    <p class="photo-caption">维保前影像记录</p>
    <div class="photo-grid">
      {% for p in before_photos %}<img src="{{ p.image_url }}" alt="维保前"/>{% endfor %}
    </div>
    {% endif %}
  </div>

  <div class="section">
    <div class="section-title">完修结果</div>
    {% if service_type == '保养' %}
    <div class="info-item full" style="margin-bottom:8px;"><span class="info-label" style="min-width:100px;">保养完成说明</span></div>
    <div class="text-block">{{ completion_content or '—' }}</div>
    {% else %}
    <div class="info-grid" style="margin-bottom:8px;background:#fff;border:none;padding:0;">
      <div class="info-item"><span class="info-label">维修结果</span><span class="info-value">
        {% if repair_result %}<span class="badge badge-pass">{{ repair_result }}</span>{% else %}—{% endif %}
      </span></div>
    </div>
    <div class="info-item full" style="margin-bottom:6px;"><span class="info-label" style="min-width:88px;">维修内容</span></div>
    <div class="text-block">{{ repair_content or '—' }}</div>
    {% endif %}
    {% if after_photos %}
    <p class="compare-label">维保后影像记录</p>
    <div class="photo-grid">
      {% for p in after_photos %}<img src="{{ p.image_url }}" alt="维保后"/>{% endfor %}
    </div>
    {% endif %}
  </div>

  <div class="sign-row">
    <div><div class="sign-box">执行人签字</div></div>
    <div><div class="sign-box">班组长确认</div></div>
    <div><div class="sign-box">设备管理确认</div></div>
  </div>
  <div class="report-footer">本报告由 {{ print_user or '系统' }} 于 {{ print_time }} 打印 · 单据 ID {{ document_id }}</div>
</div>
"""
)

MOLD_MAINTENANCE_COMPLETE_PRINT_CONTENT = (
    _PRINT_PAGE_STYLE
    + """
<div class="report">
  <div class="report-header">
    <div>
      {% if company_name %}<p class="report-company">{{ company_name }}</p>{% endif %}
      <h1 class="report-title">{{ report_title }}</h1>
    </div>
    <div class="doc-meta">
      <strong>{{ sheet_no or '—' }}</strong>
      制单日期：{{ created_at }}<br/>
      打印时间：{{ print_time }}
    </div>
  </div>

  <div class="section">
    <div class="section-title">单据概要</div>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">业务类型</span><span class="info-value">
        {% if service_type == '维修' %}<span class="badge badge-repair">维修</span>{% else %}<span class="badge badge-upkeep">保养</span>{% endif %}
      </span></div>
      <div class="info-item"><span class="info-label">来源维保单</span><span class="info-value">{{ source_order_no }}</span></div>
      <div class="info-item"><span class="info-label">申请人</span><span class="info-value">{{ applicant_name or '—' }}</span></div>
      <div class="info-item"><span class="info-label">申请部门</span><span class="info-value">{{ department_name or '—' }}</span></div>
      {% if service_type == '保养' %}
      <div class="info-item"><span class="info-label">单头重置产量</span><span class="info-value">{{ clear_total_production_label }}</span></div>
      {% endif %}
      {% if is_outsource %}
      <div class="info-item"><span class="info-label">外协单位</span><span class="info-value">{{ outsourced_unit_name or '—' }}</span></div>
      <div class="info-item"><span class="info-label">审核状态</span><span class="info-value">{{ sheet_status or '—' }}</span></div>
      {% endif %}
    </div>
  </div>

  <div class="section">
    <div class="section-title">模具完修明细</div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:36px;">序</th>
          <th style="width:90px;">模具代号</th>
          <th>模具名称</th>
          {% if service_type == '维修' %}
          <th>维修原因</th>
          <th>维修内容</th>
          <th style="width:72px;">结果</th>
          {% else %}
          <th>保养内容/记录摘要</th>
          <th style="width:72px;">重置产量</th>
          {% endif %}
        </tr>
      </thead>
      <tbody>
        {% for line in line_items %}
        <tr>
          <td>{{ loop.index }}</td>
          <td>{{ line.mold_code }}</td>
          <td>{{ line.mold_name or '—' }}</td>
          {% if service_type == '维修' %}
          <td>{{ line.repair_reason or '—' }}</td>
          <td>{{ line.repair_content or '—' }}</td>
          <td>{{ line.repair_result or '—' }}</td>
          {% else %}
          <td>{{ line.upkeep_summary or '—' }}</td>
          <td>{{ line.clear_total_production_label }}</td>
          {% endif %}
        </tr>
        {% endfor %}
      </tbody>
    </table>
  </div>

  {% for line in line_items %}
  {% if line.upkeep_record_lines %}
  <div class="section">
    <div class="section-title">保养记录 · {{ line.mold_code }}</div>
    <table class="data-table">
      <thead><tr><th style="width:36px;">序</th><th>保养项</th><th>要求</th><th>记录值</th></tr></thead>
      <tbody>
        {% for rec in line.upkeep_record_lines %}
        <tr>
          <td>{{ loop.index }}</td>
          <td>{{ rec.param_name }}（{{ rec.param_code }}）</td>
          <td>{{ rec.requirement or '—' }}</td>
          <td>{{ rec.record_value or '—' }}</td>
        </tr>
        {% endfor %}
      </tbody>
    </table>
  </div>
  {% endif %}
  {% endfor %}

  {% if before_photos %}
  <div class="section">
    <div class="section-title">维保前影像（表头）</div>
    <div class="photo-grid">{% for p in before_photos %}<img src="{{ p.image_url }}" alt="维保前"/>{% endfor %}</div>
  </div>
  {% endif %}
  {% if after_photos %}
  <div class="section">
    <div class="section-title">维保后影像（表头）</div>
    <div class="photo-grid">{% for p in after_photos %}<img src="{{ p.image_url }}" alt="维保后"/>{% endfor %}</div>
  </div>
  {% endif %}

  <div class="sign-row">
    <div><div class="sign-box">执行人签字</div></div>
    <div><div class="sign-box">班组长确认</div></div>
    <div><div class="sign-box">模具管理确认</div></div>
  </div>
  <div class="report-footer">本报告由 {{ print_user or '系统' }} 于 {{ print_time }} 打印 · 单据 ID {{ document_id }}</div>
</div>
"""
)

EQUIPMENT_SPOT_CHECK_PRINT_CONTENT = (
    _PRINT_PAGE_STYLE
    + """
<div class="report">
  <div class="report-header">
    <div>
      {% if company_name %}<p class="report-company">{{ company_name }}</p>{% endif %}
      <h1 class="report-title">{{ report_title }}</h1>
    </div>
    <div class="doc-meta">
      <strong>{{ sheet_no or '—' }}</strong>
      点检时间：{{ recorded_at }}<br/>
      打印时间：{{ print_time }}
    </div>
  </div>

  <div class="section">
    <div class="section-title">基本信息</div>
    <div class="info-grid">
      <div class="info-item"><span class="info-label">设备代号</span><span class="info-value">{{ equipment_asset_code or '—' }}</span></div>
      <div class="info-item"><span class="info-label">设备名称</span><span class="info-value">{{ equipment_name or '—' }}</span></div>
      <div class="info-item"><span class="info-label">点检方案</span><span class="info-value">{{ inspection_param_set_label or '—' }}</span></div>
      <div class="info-item"><span class="info-label">点检项数</span><span class="info-value">{{ line_count }} 项（异常 {{ abnormal_count }} 项）</span></div>
      <div class="info-item"><span class="info-label">调整后状态</span><span class="info-value">{{ applied_operational_status_label or '—' }}</span></div>
      <div class="info-item"><span class="info-label">是否上报</span><span class="info-value">{{ report_enabled_label }}</span></div>
      {% if abnormal_description %}
      <div class="info-item full"><span class="info-label">异常说明</span><span class="info-value">{{ abnormal_description }}</span></div>
      {% endif %}
    </div>
  </div>

  <div class="section">
    <div class="section-title">点检明细</div>
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:36px;">序</th>
          <th style="width:72px;">编号</th>
          <th style="width:120px;">点检项</th>
          <th>点检要求</th>
          <th style="width:88px;">实测值</th>
          <th style="width:48px;">单位</th>
          <th style="width:64px;">结果</th>
          <th style="width:100px;">备注</th>
        </tr>
      </thead>
      <tbody>
        {% for line in line_items %}
        <tr>
          <td>{{ loop.index }}</td>
          <td>{{ line.param_code }}</td>
          <td>{{ line.param_name }}</td>
          <td>{{ line.param_requirement or '—' }}</td>
          <td>{{ line.measured_value or '—' }}{% if line.numeric_range %}<br/><span style="font-size:8.5pt;color:#64748b;">{{ line.numeric_range }}</span>{% endif %}</td>
          <td>{{ line.unit or '—' }}</td>
          <td>
            {% if line.result == 'abnormal' %}<span class="badge badge-fail">{{ line.result_label }}</span>
            {% elif line.result == 'normal' %}<span class="badge badge-pass">{{ line.result_label }}</span>
            {% else %}{{ line.result_label }}{% endif %}
          </td>
          <td>{{ line.remark or '—' }}</td>
        </tr>
        {% endfor %}
      </tbody>
    </table>
  </div>

  <div class="sign-row">
    <div><div class="sign-box">点检人签字</div></div>
    <div><div class="sign-box">班组长确认</div></div>
    <div><div class="sign-box">设备管理确认</div></div>
  </div>
  <div class="report-footer">本报告由 {{ print_user or '系统' }} 于 {{ print_time }} 打印 · 单据 ID {{ document_id }}</div>
</div>
"""
)

HAOLIGO_PRESET_PRINT_TEMPLATES = [
    {
        "name": "设备点检报告",
        "code": "HAOLIGO_EQUIPMENT_SPOT_CHECK_PRINT",
        "type": "html",
        "description": "设备点检单专业报告（A4）；含点检方案明细与实测结果",
        "content": EQUIPMENT_SPOT_CHECK_PRINT_CONTENT,
        "config": {
            "document_type": "equipment_spot_check",
            "engine": "jinja2",
            "strict_variables": False,
            "page": {"size": "A4", "orientation": "portrait", "margin": "14mm 12mm"},
        },
        "is_active": True,
    },
    {
        "name": "设备维保完成报告",
        "code": "HAOLIGO_EQUIPMENT_UPKEEP_COMPLETE_PRINT",
        "type": "html",
        "description": "设备维修/保养完成单专业报告（A4）；变量见 print-variables API",
        "content": EQUIPMENT_UPKEEP_COMPLETE_PRINT_CONTENT,
        "config": {
            "document_type": "equipment_upkeep_complete",
            "engine": "jinja2",
            "strict_variables": False,
            "page": {"size": "A4", "orientation": "portrait", "margin": "14mm 12mm"},
        },
        "is_active": True,
    },
    {
        "name": "模具维保完成报告",
        "code": "HAOLIGO_MOLD_MAINTENANCE_COMPLETE_PRINT",
        "type": "html",
        "description": "模具厂内维修/保养完修单专业报告（A4）；含模具明细与保养记录",
        "content": MOLD_MAINTENANCE_COMPLETE_PRINT_CONTENT,
        "config": {
            "document_type": "mold_maintenance_complete",
            "engine": "jinja2",
            "strict_variables": False,
            "page": {"size": "A4", "orientation": "portrait", "margin": "14mm 12mm"},
        },
        "is_active": True,
    },
    {
        "name": "模具外协维保完成报告",
        "code": "HAOLIGO_MOLD_OUTSOURCE_MAINTENANCE_COMPLETE_PRINT",
        "type": "html",
        "description": "模具外协维修完修单专业报告（A4）；含外协单位与费用",
        "content": MOLD_MAINTENANCE_COMPLETE_PRINT_CONTENT,
        "config": {
            "document_type": "mold_outsource_maintenance_complete",
            "engine": "jinja2",
            "strict_variables": False,
            "page": {"size": "A4", "orientation": "portrait", "margin": "14mm 12mm"},
        },
        "is_active": True,
    },
]
