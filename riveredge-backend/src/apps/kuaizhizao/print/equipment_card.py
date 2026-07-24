"""快制造 — 设备卡打印 HTML 模板。"""

EQUIPMENT_CARD_PRINT_CONTENT = """
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    margin: 0; padding: 0;
    font-family: "Microsoft YaHei", "PingFang SC", "Helvetica Neue", Arial, sans-serif;
    font-size: 11pt; color: #000;
  }
  .card-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8mm;
  }
  .equipment-card {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  table.eq-card {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    border: 1.5px solid #000;
  }
  table.eq-card th,
  table.eq-card td {
    border: 1px solid #000;
    padding: 5px 8px;
    vertical-align: middle;
  }
  table.eq-card .card-title {
    text-align: center;
    font-size: 16pt;
    font-weight: 700;
    letter-spacing: 2px;
    padding: 8px 6px;
  }
  table.eq-card .label {
    width: 18%;
    text-align: center;
    font-size: 10.5pt;
    white-space: nowrap;
  }
  table.eq-card .value {
    width: 42%;
    text-align: center;
    font-size: 10.5pt;
    word-break: break-word;
  }
  table.eq-card .qr-cell {
    width: 40%;
    text-align: center;
    padding: 6px;
  }
  table.eq-card .qr-cell img {
    width: 118px;
    height: 118px;
    display: block;
    margin: 0 auto;
  }
</style>
<div class="card-grid">
  {% for item in items %}
  <div class="equipment-card">
    <table class="eq-card">
      <tr>
        <th class="card-title" colspan="3">{{ card_title or "设备卡" }}</th>
      </tr>
      <tr>
        <td class="label">编号</td>
        <td class="value">{{ item.code or "—" }}</td>
        <td class="qr-cell" rowspan="7">
          {% if item.qrcode_image %}
          <img src="{{ item.qrcode_image }}" alt="QR" />
          {% endif %}
        </td>
      </tr>
      <tr>
        <td class="label">名称</td>
        <td class="value">{{ item.name or "—" }}</td>
      </tr>
      <tr>
        <td class="label">型号</td>
        <td class="value">{{ item.model or "—" }}</td>
      </tr>
      <tr>
        <td class="label">类型</td>
        <td class="value">{{ item.type or "—" }}</td>
      </tr>
      <tr>
        <td class="label">所属</td>
        <td class="value">{{ item.affiliation or "—" }}</td>
      </tr>
      <tr>
        <td class="label">购买</td>
        <td class="value">{{ item.purchase_date or "—" }}</td>
      </tr>
      <tr>
        <td class="label">启用</td>
        <td class="value">{{ item.installation_date or "—" }}</td>
      </tr>
    </table>
  </div>
  {% endfor %}
</div>
"""

EQUIPMENT_CARD_PRINT_PRESET = {
    "name": "设备卡",
    "code": "EQUIPMENT_CARD_PRINT",
    "type": "html",
    "description": "设备台账标识卡（表格+二维码），支持批量打印",
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
