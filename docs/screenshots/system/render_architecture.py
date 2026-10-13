"""Render RiverEdge system architecture PNG — primary #000950, large readable type."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).with_name("architecture.png")
W, H = 2000, 2300
FONT_REG = r"C:\Windows\Fonts\msyh.ttc"
FONT_BD = r"C:\Windows\Fonts\msyhbd.ttc"

PRIMARY = (0x00, 0x09, 0x50)  # #000950
PRIMARY_SOFT = (232, 234, 245)
BG = (255, 255, 255)
MUTED = (71, 85, 105)
LINE = (226, 232, 240)
LINE_STRONG = (180, 188, 210)
PANEL = PRIMARY_SOFT
CARD = (255, 255, 255)
MAIN = PRIMARY
PRIVATE = (184, 134, 11)  # 金色徽章 #B8860B

# Explicit sizes — do not shrink below these without user ask
# 最小档 = FS_APP_DESC / FS_CELL_SUB / FS_BODY / FS_RAIL
FS_SECTION = 30
FS_BADGE = 22
FS_CHIP = 24
FS_CELL_TITLE = 26
FS_CELL_SUB = 22
FS_APP_TITLE = 24
FS_APP_DESC = 22
FS_TECH = 24
FS_BODY = 22
FS_RAIL = 22


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BD if bold else FONT_REG, size)


def rounded(draw: ImageDraw.ImageDraw, box, fill, outline=None, width=1, radius=12):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def text_center(draw, xy, text, fnt, fill=PRIMARY):
    bbox = draw.textbbox((0, 0), text, font=fnt)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((xy[0] - tw / 2, xy[1] - th / 2), text, font=fnt, fill=fill)


def text_left(draw, xy, text, fnt, fill=PRIMARY):
    draw.text(xy, text, font=fnt, fill=fill)


def measure(draw, text, fnt):
    bbox = draw.textbbox((0, 0), text, font=fnt)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def badge(draw, x, y, label, kind: str, fnt):
    fill = MAIN if kind == "main" else PRIVATE
    pad_x, pad_y = 14, 8
    tw, th = measure(draw, label, fnt)
    box = (x, y, x + tw + pad_x * 2, y + th + pad_y * 2)
    rounded(draw, box, fill=fill, outline=None, width=0, radius=6)
    draw.text((x + pad_x, y + pad_y - 1), label, font=fnt, fill=BG)
    return box[2] - box[0], box[3] - box[1]


def arrow_down(draw, cx, y0, y1):
    draw.line((cx, y0, cx, y1 - 14), fill=LINE_STRONG, width=3)
    draw.polygon([(cx - 8, y1 - 16), (cx + 8, y1 - 16), (cx, y1)], fill=LINE_STRONG)


def section(draw, x0, y0, x1, y1, title: str):
    rounded(draw, (x0, y0, x1, y1), fill=PANEL, outline=LINE_STRONG, width=1, radius=14)
    draw.rectangle((x0, y0 + 20, x0 + 5, y0 + 58), fill=PRIMARY)
    text_left(draw, (x0 + 22, y0 + 22), title, font(FS_SECTION, True), PRIMARY)
    return y0 + 74


def draw_wrapped(draw, x, y, text, fnt, fill, max_w, line_gap=6):
    """Word/char wrap so subtitle never overflows card width. Returns bottom y."""
    # Prefer breaking on " / "
    parts = text.split(" / ")
    lines: list[str] = []
    cur = ""
    for i, part in enumerate(parts):
        piece = part if not cur else f"{cur} / {part}"
        tw, _ = measure(draw, piece, fnt)
        if tw <= max_w or not cur:
            cur = piece
        else:
            lines.append(cur)
            cur = part
    if cur:
        lines.append(cur)
    # fallback: hard wrap by character if a single segment still too wide
    final: list[str] = []
    for line in lines:
        tw, _ = measure(draw, line, fnt)
        if tw <= max_w:
            final.append(line)
            continue
        buf = ""
        for ch in line:
            trial = buf + ch
            if measure(draw, trial, fnt)[0] <= max_w or not buf:
                buf = trial
            else:
                final.append(buf)
                buf = ch
        if buf:
            final.append(buf)
    th = measure(draw, "字", fnt)[1]
    for i, line in enumerate(final):
        text_left(draw, (x, y + i * (th + line_gap)), line, fnt, fill)
    return y + len(final) * (th + line_gap) - line_gap


def cell(draw, x, y, w, h, title, subtitle=None, mark=None):
    rounded(draw, (x, y, x + w, y + h), fill=CARD, outline=LINE, width=1, radius=10)
    f_t = font(FS_CELL_TITLE, True)
    f_s = font(FS_CELL_SUB)
    f_b = font(FS_BADGE, True)
    ox, oy = x + 18, y + 16
    max_text_w = w - 36
    if mark:
        bw, bh = badge(draw, ox, oy, mark[0], mark[1], f_b)
        text_left(draw, (ox + bw + 14, oy + 4), title, f_t, PRIMARY)
        if subtitle:
            draw_wrapped(draw, ox, oy + bh + 14, subtitle, f_s, MUTED, max_text_w)
    else:
        text_left(draw, (ox, oy), title, f_t, PRIMARY)
        if subtitle:
            draw_wrapped(draw, ox, oy + 36, subtitle, f_s, MUTED, max_text_w)


def wrap_chips(draw, x, y, max_w, labels, fnt, h=48, gap=12, pad_x=18):
    cx, cy = x, y
    for label in labels:
        tw, _ = measure(draw, label, fnt)
        chip_w = tw + pad_x * 2
        if cx + chip_w > x + max_w and cx > x:
            cx = x
            cy += h + gap
        rounded(draw, (cx, cy, cx + chip_w, cy + h), fill=PANEL, outline=LINE, width=1, radius=8)
        text_center(draw, (cx + chip_w / 2, cy + h / 2), label, fnt, PRIMARY)
        cx += chip_w + gap
    return cy + h


def main() -> None:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    f_chip = font(FS_CHIP)
    f_chip_b = font(FS_CHIP, True)
    f_badge = font(FS_BADGE, True)
    f_tech = font(FS_TECH, True)
    f_body = font(FS_BODY)
    f_app_t = font(FS_APP_TITLE, True)
    f_app_d = font(FS_APP_DESC)

    m = 48
    right = W - m
    y = 36
    gap = 28
    cx_mid = W / 2

    legend_items = [("主仓 开源", "main"), ("私仓 专业 / 终端 / 定制", "private")]
    lx = right - 420
    for i, (lab, kind) in enumerate(legend_items):
        badge(draw, lx, y + i * 44, lab, kind, f_badge)

    # ---- 1 用户层 ----
    sh = 150
    content_y = section(draw, m, y, right, y + sh, "用户层")
    users = ["PC", "移动 App", "H5 / 小程序", "企微钉钉飞书", "触屏工位", "TV 看板"]
    uw = (right - m - 48 - 5 * 14) / 6
    for i, t in enumerate(users):
        ux = m + 24 + i * (uw + 14)
        rounded(draw, (ux, content_y, ux + uw, content_y + 56), fill=CARD, outline=LINE, width=1, radius=8)
        text_center(draw, (ux + uw / 2, content_y + 28), t, f_chip, PRIMARY)
    y = y + sh + gap
    arrow_down(draw, cx_mid, y - gap + 2, y - 2)

    # ---- 2 前端层 ----
    sh = 220
    content_y = section(draw, m, y, right, y + sh, "前端层")
    half = (right - m - 48 - 18) / 2
    cell(
        draw,
        m + 24,
        content_y,
        half,
        124,
        "PC Web",
        "React 18 / TypeScript / Vite 5 / Ant Design 6 / UniTable",
        ("主仓", "main"),
    )
    cell(
        draw,
        m + 24 + half + 18,
        content_y,
        half,
        124,
        "kuaigeyun-client",
        "Expo / React Native / Electron 工位 / TV / 小程序 / 办公 H5",
        ("私仓 终端", "private"),
    )
    y = y + sh + gap
    arrow_down(draw, cx_mid, y - gap + 2, y - 2)

    # ---- 3 网关 ----
    sh = 140
    content_y = section(draw, m, y, right, y + sh, "网关层")
    gws = [("Caddy", "反向代理"), ("静态 / 负载", "Web / H5"), ("/api", "后端转发")]
    gw = (right - m - 48 - 28) / 3
    for i, (t, s) in enumerate(gws):
        gx = m + 24 + i * (gw + 14)
        rounded(draw, (gx, content_y, gx + gw, content_y + 62), fill=CARD, outline=LINE, width=1, radius=8)
        text_center(draw, (gx + gw / 2, content_y + 20), t, f_chip_b, PRIMARY)
        text_center(draw, (gx + gw / 2, content_y + 48), s, f_body, MUTED)
    y = y + sh + gap
    arrow_down(draw, cx_mid, y - gap + 2, y - 2)

    # ---- 4 业务层 ----
    biz_y = y
    rail_w = 52
    rx0 = right - 24 - rail_w
    inner_r = rx0 - 16

    by = biz_y + 72
    mains = [
        ("主数据", ["工厂 / 车间建模", "物料 / BOM / 工艺", "客户 / 供应商"]),
        ("快制造", ["销售 / 计划 / 采购", "生产执行 / 报工", "仓储 / 质量 / 设备", "绩效 / 分析看板"]),
        ("快质量", ["来料 / 过程 / 成品检", "检验方案 / 8D", "不合格 / 追溯"]),
        ("快设备", ["点检巡检 / 故障", "维修保养计划", "模具工装 / 备件"]),
        ("平台核心", ["多租户 / RBAC", "审批 / 消息 / 打印", "编码 / 自定义字段", "配置中心 / 审计"]),
    ]
    main_block_h = 440
    cw = (inner_r - m - 60 - 4 * 14) / 5
    card_top = by + 76
    card_h = main_block_h - 100

    pro_by = by + main_block_h + 20
    pro_h = 230
    custom_by = pro_by + pro_h + 16
    custom_h = 76
    runtime_by = custom_by + custom_h + 16

    techs = [
        "Python 3.11",
        "FastAPI",
        "Tortoise ORM",
        "Pydantic 2",
        "Taskiq",
        "Socket.IO",
        "PostgreSQL Cache",
        "渠道写防护",
        "插件 Manifest",
    ]
    runtime_inner_top = 68
    chip_h = 60
    tmp = Image.new("RGB", (10, 10))
    td = ImageDraw.Draw(tmp)
    max_chip_row_w = inner_r - m - 72
    cx, rows = 0, 1
    for label in techs:
        tw, _ = measure(td, label, f_tech)
        chip_w = tw + 36
        if cx + chip_w > max_chip_row_w and cx > 0:
            cx = 0
            rows += 1
        cx += chip_w + 14
    runtime_h = runtime_inner_top + rows * chip_h + (rows - 1) * 14 + 28

    biz_h = (runtime_by - biz_y) + runtime_h + 24

    rounded(draw, (m, biz_y, right, biz_y + biz_h), fill=PANEL, outline=LINE_STRONG, width=1, radius=14)
    draw.rectangle((m, biz_y + 18, m + 5, biz_y + 54), fill=PRIMARY)
    text_left(draw, (m + 22, biz_y + 20), "业务层 插件组装运行", font(FS_SECTION, True), PRIMARY)

    rounded(draw, (rx0, biz_y + 72, rx0 + rail_w, biz_y + biz_h - 24), fill=CARD, outline=LINE, width=1, radius=8)
    ry = biz_y + 120
    for ch in "权限审计渠道":
        text_center(draw, (rx0 + rail_w / 2, ry), ch, font(FS_RAIL, True), MUTED)
        ry += 44

    rounded(draw, (m + 24, by, inner_r, by + main_block_h), fill=CARD, outline=LINE, width=1, radius=10)
    badge(draw, m + 36, by + 18, "主仓 开源", "main", f_badge)
    text_left(draw, (m + 180, by + 22), "kuaigeyun / riveredge-backend / frontend", font(FS_BODY, True), PRIMARY)
    for i, (t, feats) in enumerate(mains):
        cx0 = m + 36 + i * (cw + 14)
        rounded(draw, (cx0, card_top, cx0 + cw, card_top + card_h), fill=PANEL, outline=LINE, width=1, radius=10)
        text_center(draw, (cx0 + cw / 2, card_top + 32), t, f_app_t, PRIMARY)
        draw.line((cx0 + 18, card_top + 60, cx0 + cw - 18, card_top + 60), fill=LINE_STRONG, width=1)
        feat_max_w = cw - 24
        for j, feat in enumerate(feats):
            fy = card_top + 90 + j * 44
            tw, _ = measure(draw, feat, f_app_d)
            if tw <= feat_max_w:
                text_center(draw, (cx0 + cw / 2, fy), feat, f_app_d, MUTED)
            else:
                draw_wrapped(draw, cx0 + 12, fy - 12, feat, f_app_d, MUTED, feat_max_w, line_gap=4)

    rounded(draw, (m + 24, pro_by, inner_r, pro_by + pro_h), fill=CARD, outline=LINE, width=1, radius=10)
    badge(draw, m + 36, pro_by + 18, "私仓 专业", "private", f_badge)
    text_left(draw, (m + 180, pro_by + 22), "kuaigeyun-pro / License / 工作区组装", font(FS_BODY, True), PRIMARY)
    pros = [
        ("快研发", "NPI / 变更 / 知识"),
        ("交付 / 办公", "协同 / 审批办公"),
        ("轻财务", "收付 / 结算 / 发票"),
        ("报表 / 数采", "BI / 设备 IoT"),
        ("连接 / KU-AI", "集成 / AI 助手"),
        ("行业包", "机械 / 注塑 / 电子等"),
    ]
    pcw = (inner_r - m - 60 - 5 * 12) / 6
    for i, (t, s) in enumerate(pros):
        cx0 = m + 36 + i * (pcw + 12)
        rounded(draw, (cx0, pro_by + 76, cx0 + pcw, pro_by + 208), fill=PANEL, outline=LINE, width=1, radius=8)
        text_center(draw, (cx0 + pcw / 2, pro_by + 112), t, font(FS_APP_DESC, True), PRIMARY)
        draw_wrapped(draw, cx0 + 12, pro_by + 146, s, f_app_d, MUTED, pcw - 24, line_gap=4)

    rounded(draw, (m + 24, custom_by, inner_r, custom_by + custom_h), fill=CARD, outline=LINE, width=1, radius=10)
    badge(draw, m + 36, custom_by + 18, "私仓 定制", "private", f_badge)
    text_left(draw, (m + 180, custom_by + 24), "kuaigeyun-custom / 客户专属页 / 插件（可选组装）", font(FS_BODY), PRIMARY)

    rounded(draw, (m + 24, runtime_by, inner_r, runtime_by + runtime_h), fill=CARD, outline=LINE, width=1, radius=10)
    text_left(draw, (m + 36, runtime_by + 18), "运行时（主仓后端）", font(FS_BODY, True), MUTED)
    wrap_chips(
        draw,
        m + 36,
        runtime_by + runtime_inner_top,
        max_chip_row_w,
        techs,
        f_tech,
        h=chip_h,
        gap=14,
        pad_x=18,
    )

    y = biz_y + biz_h + gap
    arrow_down(draw, cx_mid, y - gap + 2, y - 2)

    # ---- 5 数据层 ----
    sh = 200
    content_y = section(draw, m, y, right, y + sh, "数据层")
    datas = [
        (("主仓", "main"), "PostgreSQL 15", "业务库 / 审计 / PG Cache"),
        (("主仓", "main"), "对象存储", "MinIO / 本地 / 附件图纸"),
        (("私仓", "private"), "数采与集成（可选）", "时序 / 连接器凭据"),
    ]
    dw = (right - m - 48 - 28) / 3
    for i, (mark, title, sub) in enumerate(datas):
        dx = m + 24 + i * (dw + 14)
        cell(draw, dx, content_y, dw, 108, title, sub, mark)

    used_bottom = y + sh + 32
    cropped = img.crop((0, 0, W, min(used_bottom, H)))
    cropped.save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT} size={cropped.size} fonts section={FS_SECTION} app={FS_APP_TITLE}/{FS_APP_DESC} tech={FS_TECH}")


if __name__ == "__main__":
    main()
