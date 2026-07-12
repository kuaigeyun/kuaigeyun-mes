"""快制造 — 设备卡打印 HTML 模板。"""

from apps.kuaizhizao.print.styles import PRINT_STYLE_A4

EQUIPMENT_CARD_PRINT_CONTENT = (
    PRINT_STYLE_A4
    + """
<style>
  .card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
  .equipment-card {
    border: 2px solid #0f4c81; border-radius: 6px; padding: 10px 12px; break-inside: avoid;
  }
  .card-title {
    text-align: center; font-size: 14pt; font-weight: 700; color: #0f4c81;
    border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 8px;
  }
  .card-body { display: flex; gap: 10px; align-items: flex-start; }
  .card-info { flex: 1; font-size: 9.5pt; }
  .card-row { display: flex; gap: 6px; margin-bottom: 4px; }
  .card-label { flex: 0 0 36px; color: #64748b; }
  .card-value { flex: 1; font-weight: 500; word-break: break-word; }
  .card-qr { flex: 0 0 88px; text-align: center; }
  .card-qr img { width: 88px; height: 88px; }
  .scan-hint { font-size: 8pt; color: #64748b; margin-top: 4px; }
</style>
<div class="report">
  <div class="report-header">
    <div><h1 class="report-title">设备标识卡</h1></div>
    <div class="doc-meta">打印时间：{{ print_time or "—" }}</div>
  </div>
  <div class="card-grid">
    {% for item in items %}
    <div class="equipment-card">
      <div class="card-title">设备标识卡</div>
      <div class="card-body">
        <div class="card-info">
          <div class="card-row"><span class="card-label">编号</span><span class="card-value">{{ item.code or "—" }}</span></div>
          <div class="card-row"><span class="card-label">名称</span><span class="card-value">{{ item.name or "—" }}</span></div>
          <div class="card-row"><span class="card-label">类型</span><span class="card-value">{{ item.type or "—" }}</span></div>
          <div class="card-row"><span class="card-label">车间</span><span class="card-value">{{ item.workshop_name or "—" }}</span></div>
          <div class="card-row"><span class="card-label">状态</span><span class="card-value">{{ item.status or "—" }}</span></div>
        </div>
        <div class="card-qr">
          {% if item.qrcode_image %}
          <img src="{{ item.qrcode_image }}" alt="QR" />
          {% endif %}
          <div class="scan-hint">扫码查看设备</div>
        </div>
      </div>
    </div>
    {% endfor %}
  </div>
</div>
"""
)

EQUIPMENT_CARD_PRINT_PRESET = {
    "name": "设备标识卡",
    "code": "EQUIPMENT_CARD_PRINT",
    "type": "html",
    "description": "快制造设备台账标识卡（含二维码），支持批量打印",
    "content": EQUIPMENT_CARD_PRINT_CONTENT,
    "config": {
        "document_type": "equipment_card",
        "engine": "jinja2",
        "strict_variables": False,
        "page": {"size": "A4", "orientation": "portrait", "margin": "10mm"},
    },
    "is_active": True,
    "is_default": True,
}
