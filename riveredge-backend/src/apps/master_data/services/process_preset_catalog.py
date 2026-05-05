"""
行业化工序预设目录（中国常见制造业细分 + 常见工序 + 工序常见不良）。

仅作静态配置供 preset-preview / load-preset 使用；业务编码由编码规则生成，不在此写死。
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, TypedDict


class DefectPresetDict(TypedDict, total=False):
    name: str
    category: str
    description: str


class OperationPresetDict(TypedDict):
    preset_key: str
    name: str
    sort_order: int
    defect_presets: List[DefectPresetDict]


class IndustryPresetDict(TypedDict):
    id: str
    name: str
    description: str
    operations: List[OperationPresetDict]


def _op(
    preset_key: str,
    name: str,
    sort_order: int,
    defects: List[DefectPresetDict],
) -> OperationPresetDict:
    return {
        "preset_key": preset_key,
        "name": name,
        "sort_order": sort_order,
        "defect_presets": defects,
    }


def _d(name: str, category: str = "", description: str = "") -> DefectPresetDict:
    out: DefectPresetDict = {"name": name}
    if category:
        out["category"] = category
    if description:
        out["description"] = description
    return out


# 全局唯一 preset_key：{industry_id}__{slug}
INDUSTRY_PRESETS: List[IndustryPresetDict] = [
    {
        "id": "machining",
        "name": "机械加工",
        "description": "切削、磨削、钻攻等减材与精密加工常见工序",
        "operations": [
            _op(
                "machining__blanking",
                "下料",
                10,
                [_d("尺寸超差", "尺寸"), _d("毛刺过大", "外观"), _d("划伤碰伤", "外观")],
            ),
            _op(
                "machining__cnc_milling",
                "数控铣削",
                20,
                [_d("刀纹/振纹", "表面质量"), _d("位置度超差", "尺寸"), _d("过切", "尺寸")],
            ),
            _op(
                "machining__cnc_turning",
                "数控车削",
                30,
                [_d("椭圆度超差", "尺寸"), _d("表面粗糙度不良", "表面质量"), _d("螺纹不良", "功能")],
            ),
            _op(
                "machining__drill_tap",
                "钻攻",
                40,
                [_d("孔径超差", "尺寸"), _d("断钻/崩刃", "设备"), _d("攻牙烂牙", "功能")],
            ),
            _op(
                "machining__grinding",
                "磨削",
                50,
                [_d("烧伤", "表面质量"), _d("圆度/圆柱度超差", "尺寸"), _d("砂轮印", "外观")],
            ),
            _op(
                "machining__heat_treat",
                "热处理",
                60,
                [_d("硬度不合格", "性能"), _d("变形", "尺寸"), _d("表面氧化/脱碳", "外观")],
            ),
            _op(
                "machining__surface_finish",
                "表面处理",
                70,
                [_d("镀层起泡/脱落", "外观"), _d("色差", "外观"), _d("盐雾不合格", "性能")],
            ),
            _op(
                "machining__inspect",
                "检验",
                80,
                [_d("漏检", "流程"), _d("误判", "流程"), _d("记录不全", "流程")],
            ),
        ],
    },
    {
        "id": "injection_molding",
        "name": "注塑成型",
        "description": "注塑、调机、模具与后处理常见工序",
        "operations": [
            _op(
                "injection_molding__material_prep",
                "烘料/配料",
                10,
                [_d("含水率异常", "材料"), _d("混料错误", "材料"), _d("色差", "外观")],
            ),
            _op(
                "injection_molding__mold_setup",
                "上模/装模",
                20,
                [_d("模具碰伤", "模具"), _d("定位不良", "模具"), _d("螺栓未打紧", "安全")],
            ),
            _op(
                "injection_molding__trial_run",
                "试模/调机",
                30,
                [_d("短射", "成型缺陷"), _d("飞边/批锋", "成型缺陷"), _d("缩水/缩痕", "成型缺陷")],
            ),
            _op(
                "injection_molding__injection",
                "注塑",
                40,
                [
                    _d("熔接线明显", "外观"),
                    _d("困气/烧焦", "外观"),
                    _d("尺寸超差", "尺寸"),
                    _d("重量不稳", "工艺"),
                ],
            ),
            _op(
                "injection_molding__de_gate",
                "去水口/修剪",
                50,
                [_d("修剪残留", "外观"), _d("缺料/缺肉", "外观"), _d("二次损伤", "外观")],
            ),
            _op(
                "injection_molding__deburr",
                "去毛刺",
                60,
                [_d("毛刺残留", "外观"), _d("抛光不均", "外观")],
            ),
            _op(
                "injection_molding__inspect_pack",
                "检验包装",
                70,
                [_d("外观不良", "外观"), _d("包装破损", "包装"), _d("标签错误", "包装")],
            ),
        ],
    },
    {
        "id": "sheet_metal",
        "name": "钣金",
        "description": "下料、成型、焊接与表面处理常见工序",
        "operations": [
            _op(
                "sheet_metal__laser_cut",
                "激光下料",
                10,
                [_d("割缝过大", "尺寸"), _d("挂渣", "外观"), _d("板材划伤", "外观")],
            ),
            _op(
                "sheet_metal__punch_nc",
                "数控冲/冲压",
                20,
                [_d("毛刺", "外观"), _d("孔位偏移", "尺寸"), _d("模具磨损印", "外观")],
            ),
            _op(
                "sheet_metal__bend",
                "折弯",
                30,
                [_d("折弯角度超差", "尺寸"), _d("表面压痕", "外观"), _d("开裂", "材料")],
            ),
            _op(
                "sheet_metal__weld",
                "焊接",
                40,
                [_d("虚焊/漏焊", "焊接质量"), _d("气孔夹渣", "焊接质量"), _d("变形", "尺寸")],
            ),
            _op(
                "sheet_metal__grind_polish",
                "打磨抛光",
                50,
                [_d("焊缝余高不良", "外观"), _d("抛光痕", "外观")],
            ),
            _op(
                "sheet_metal__powder_coat",
                "喷涂/喷粉",
                60,
                [_d("流挂", "外观"), _d("颗粒/缩孔", "外观"), _d("膜厚不合格", "性能")],
            ),
            _op(
                "sheet_metal__assembly",
                "装配",
                70,
                [_d("紧固力矩不足", "装配"), _d("错装漏装", "装配"), _d("划伤", "外观")],
            ),
        ],
    },
    {
        "id": "electronics_assembly",
        "name": "电子组装",
        "description": "SMT、插件、测试与包装常见工序",
        "operations": [
            _op(
                "electronics_assembly__smt_print",
                "锡膏印刷",
                10,
                [_d("少锡/多锡", "SMT"), _d("偏移", "SMT"), _d("连锡", "SMT")],
            ),
            _op(
                "electronics_assembly__smt_place",
                "贴片",
                20,
                [_d("立碑", "SMT"), _d("偏移/反贴", "SMT"), _d("缺件", "SMT")],
            ),
            _op(
                "electronics_assembly__reflow",
                "回流焊",
                30,
                [_d("虚焊", "焊接"), _d("桥连", "焊接"), _d("墓碑", "焊接")],
            ),
            _op(
                "electronics_assembly__dip_wave",
                "插件/波峰焊",
                40,
                [_d("连锡", "焊接"), _d("透锡不良", "焊接"), _d("助焊剂残留", "外观")],
            ),
            _op(
                "electronics_assembly__coating",
                "三防涂覆",
                50,
                [_d("厚度不均", "工艺"), _d("气泡", "外观"), _d("遮蔽不良", "外观")],
            ),
            _op(
                "electronics_assembly__ict_fct",
                "ICT/FCT 测试",
                60,
                [_d("开路/短路", "电气"), _d("功能不良", "电气"), _d("误判", "测试")],
            ),
            _op(
                "electronics_assembly__burn_in",
                "老化",
                70,
                [_d("早期失效", "可靠性"), _d("温升异常", "可靠性")],
            ),
            _op(
                "electronics_assembly__pack",
                "包装出货",
                80,
                [_d("混料", "流程"), _d("标签错误", "包装"), _d("ESD 损伤", "流程")],
            ),
        ],
    },
    {
        "id": "die_casting",
        "name": "压铸",
        "description": "压铸、去毛刺与后加工常见工序",
        "operations": [
            _op(
                "die_casting__alloy_prep",
                "合金熔炼/保温",
                10,
                [_d("成分偏差", "材料"), _d("含气量高", "材料"), _d("渣滓", "材料")],
            ),
            _op(
                "die_casting__die_cast",
                "压铸",
                20,
                [_d("冷隔", "铸造缺陷"), _d("流纹/水纹", "外观"), _d("气孔疏松", "铸造缺陷")],
            ),
            _op(
                "die_casting__trim",
                "切边/整形",
                30,
                [_d("缺肉", "尺寸"), _d("变形", "尺寸"), _d("批锋残留", "外观")],
            ),
            _op(
                "die_casting__shot_blast",
                "抛丸/喷砂",
                40,
                [_d("表面粗糙不均", "外观"), _d("变形", "尺寸")],
            ),
            _op(
                "die_casting__cnc_finish",
                "机加后处理",
                50,
                [_d("加工余量不足", "尺寸"), _d("刀纹", "表面质量")],
            ),
            _op(
                "die_casting__inspect",
                "检验",
                60,
                [_d("气密不良", "功能"), _d("尺寸超差", "尺寸")],
            ),
        ],
    },
    {
        "id": "general_assembly",
        "name": "机械装配与总装",
        "description": "部装、总装、调试与终检包装",
        "operations": [
            _op(
                "general_assembly__sub_assembly",
                "部装",
                10,
                [_d("错装漏装", "装配"), _d("紧固力矩不合格", "装配"), _d("干涉异响", "功能")],
            ),
            _op(
                "general_assembly__final_assembly",
                "总装",
                20,
                [_d("管线干涉", "装配"), _d("密封不良", "功能"), _d("外观划伤", "外观")],
            ),
            _op(
                "general_assembly__commissioning",
                "调试/试车",
                30,
                [_d("参数不达标", "功能"), _d("泄漏", "功能"), _d("噪音振动异常", "功能")],
            ),
            _op(
                "general_assembly__paint",
                "涂装",
                40,
                [_d("流挂颗粒", "外观"), _d("附着力不良", "性能")],
            ),
            _op(
                "general_assembly__final_inspect",
                "终检",
                50,
                [_d("漏检", "流程"), _d("记录不全", "流程")],
            ),
            _op(
                "general_assembly__pack_ship",
                "包装发运",
                60,
                [_d("包装破损", "包装"), _d("标识错误", "包装")],
            ),
        ],
    },
    {
        "id": "wire_harness",
        "name": "线束与连接器",
        "description": "汽车/工控线束：下线压接、焊接、组装与电测常见工序",
        "operations": [
            _op(
                "wire_harness__cut_strip",
                "下线剥皮",
                10,
                [_d("剥皮长度超差", "尺寸"), _d("芯线损伤", "外观"), _d("断铜丝", "材料")],
            ),
            _op(
                "wire_harness__crimp",
                "端子压接",
                20,
                [_d("拉力不足", "电气"), _d("喇叭口不良", "外观"), _d("压接高度超差", "尺寸")],
            ),
            _op(
                "wire_harness__ultrasonic_weld",
                "超声波焊接",
                30,
                [_d("焊接不牢", "焊接质量"), _d("线芯变色", "外观"), _d("过焊损伤", "外观")],
            ),
            _op(
                "wire_harness__assembly",
                "线束组装",
                40,
                [_d("错装漏装", "装配"), _d("分支方向错误", "装配"), _d("卡扣断裂", "外观")],
            ),
            _op(
                "wire_harness__taping_wrap",
                "缠胶带/包管",
                50,
                [_d("褶皱/起翘", "外观"), _d("间距不均", "工艺"), _d("漏缠", "装配")],
            ),
            _op(
                "wire_harness__continuity_hipot",
                "导通/耐压测试",
                60,
                [_d("开路", "电气"), _d("短路", "电气"), _d("耐压击穿", "电气")],
            ),
            _op(
                "wire_harness__pack_ship",
                "检验包装",
                70,
                [_d("标签错误", "包装"), _d("混料", "流程"), _d("外观划伤", "外观")],
            ),
        ],
    },
    {
        "id": "powder_metallurgy",
        "name": "粉末冶金",
        "description": "压制成形、烧结与后处理常见工序",
        "operations": [
            _op(
                "powder_metallurgy__powder_mix",
                "混粉配料",
                10,
                [_d("配比错误", "材料"), _d("粒度/松装异常", "材料"), _d("异物混入", "材料")],
            ),
            _op(
                "powder_metallurgy__compaction",
                "成形压制",
                20,
                [_d("密度不均", "工艺"), _d("裂纹分层", "外观"), _d("重量超差", "尺寸")],
            ),
            _op(
                "powder_metallurgy__sintering",
                "烧结",
                30,
                [_d("尺寸收缩异常", "尺寸"), _d("过烧/欠烧", "工艺"), _d("变形翘曲", "尺寸")],
            ),
            _op(
                "powder_metallurgy__sizing",
                "整形/复压",
                40,
                [_d("整形量不足", "尺寸"), _d("表面拉伤", "外观"), _d("崩边缺角", "外观")],
            ),
            _op(
                "powder_metallurgy__impregnation",
                "浸渗/浸油",
                50,
                [_d("渗漏", "功能"), _d("浸渗剂残留", "外观")],
            ),
            _op(
                "powder_metallurgy__finish_machining",
                "机加后处理",
                60,
                [_d("孔径超差", "尺寸"), _d("同轴度不良", "尺寸")],
            ),
            _op(
                "powder_metallurgy__inspect",
                "检验",
                70,
                [_d("硬度不合格", "性能"), _d("金相不合格", "性能")],
            ),
        ],
    },
    {
        "id": "forging",
        "name": "锻造",
        "description": "热模锻、切边与热处理、探伤常见工序",
        "operations": [
            _op(
                "forging__heating",
                "加热",
                10,
                [_d("过烧/过热", "工艺"), _d("温度不均", "工艺"), _d("氧化皮过厚", "外观")],
            ),
            _op(
                "forging__preform",
                "制坯/辊锻",
                20,
                [_d("折叠", "锻造缺陷"), _d("粗晶", "工艺"), _d("制坯尺寸不足", "尺寸")],
            ),
            _op(
                "forging__hot_forging",
                "模锻",
                30,
                [_d("缺肉/未充满", "锻造缺陷"), _d("裂纹", "锻造缺陷"), _d("错模", "尺寸")],
            ),
            _op(
                "forging__trim_punch",
                "切边冲孔",
                40,
                [_d("批锋残留", "外观"), _d("变形", "尺寸"), _d("孔位偏移", "尺寸")],
            ),
            _op(
                "forging__heat_treat",
                "热处理",
                50,
                [_d("硬度不合格", "性能"), _d("变形", "尺寸")],
            ),
            _op(
                "forging__shot_peen",
                "抛丸/表面清理",
                60,
                [_d("覆盖率不足", "工艺"), _d("表面碰伤", "外观")],
            ),
            _op(
                "forging__ndt_inspect",
                "探伤/检验",
                70,
                [_d("内部缺陷", "无损检测"), _d("磁粉/渗透显示", "无损检测"), _d("漏检", "流程")],
            ),
        ],
    },
    {
        "id": "rubber_molding",
        "name": "橡胶模压与硫化",
        "description": "密封件、减震件等橡胶制品常见工序",
        "operations": [
            _op(
                "rubber_molding__mixing",
                "炼胶",
                10,
                [_d("门尼/硬度偏差", "材料"), _d("焦烧", "工艺"), _d("分散不良", "材料")],
            ),
            _op(
                "rubber_molding__preform",
                "预成型/裁切",
                20,
                [_d("重量不均", "工艺"), _d("裁切毛边", "外观")],
            ),
            _op(
                "rubber_molding__vulcanization",
                "硫化成型",
                30,
                [
                    _d("缺胶/欠硫", "外观"),
                    _d("飞边过大", "外观"),
                    _d("气泡/杂质", "外观"),
                    _d("尺寸超差", "尺寸"),
                ],
            ),
            _op(
                "rubber_molding__post_cure",
                "二段硫化",
                40,
                [_d("过硫", "工艺"), _d("变形", "尺寸"), _d("喷霜", "外观")],
            ),
            _op(
                "rubber_molding__deflashing",
                "修边/冷冻去毛边",
                50,
                [_d("毛边残留", "外观"), _d("撕裂/缺肉", "外观")],
            ),
            _op(
                "rubber_molding__inspect_pack",
                "检验包装",
                60,
                [_d("外观不良", "外观"), _d("硬度/弹性不合格", "性能")],
            ),
        ],
    },
    {
        "id": "pcb_fabrication",
        "name": "PCB 裸板制造",
        "description": "多层板制程中钻孔、电镀、蚀刻与电测等常见工序",
        "operations": [
            _op(
                "pcb_fabrication__panel_prep",
                "开料/烘板",
                10,
                [_d("板厚超差", "尺寸"), _d("板曲翘", "尺寸"), _d("铜箔氧化", "材料")],
            ),
            _op(
                "pcb_fabrication__drilling",
                "钻孔",
                20,
                [_d("孔径/孔位超差", "尺寸"), _d("堵孔/断钻", "工艺"), _d("披锋", "外观")],
            ),
            _op(
                "pcb_fabrication__plating",
                "电镀/孔铜",
                30,
                [_d("孔铜不足", "电气"), _d("镀层粗糙", "外观"), _d("镀层分离", "可靠性")],
            ),
            _op(
                "pcb_fabrication__etch_outer",
                "外层蚀刻",
                40,
                [_d("线宽线距超差", "尺寸"), _d("残铜", "电气"), _d("开路", "电气")],
            ),
            _op(
                "pcb_fabrication__solder_mask",
                "阻焊/字符",
                50,
                [_d("油墨上焊盘", "外观"), _d("显影不净", "外观"), _d("字符错误", "流程")],
            ),
            _op(
                "pcb_fabrication__routing",
                "成型/V 割",
                60,
                [_d("外形超差", "尺寸"), _d("毛刺", "外观")],
            ),
            _op(
                "pcb_fabrication__e_test",
                "飞针/电测",
                70,
                [_d("开路短路", "电气"), _d("误判", "测试"), _d("漏测", "流程")],
            ),
        ],
    },
    {
        "id": "wood_panel",
        "name": "板式家具与木制品",
        "description": "开料、封边、钻孔与喷漆常见工序",
        "operations": [
            _op(
                "wood_panel__cutting",
                "数控开料",
                10,
                [_d("尺寸超差", "尺寸"), _d("崩边崩角", "外观"), _d("纹理错向", "材料")],
            ),
            _op(
                "wood_panel__edge_banding",
                "封边",
                20,
                [_d("开胶/脱边", "外观"), _d("胶线明显", "外观"), _d("色差", "外观")],
            ),
            _op(
                "wood_panel__drilling",
                "排钻/五面钻",
                30,
                [_d("孔位偏移", "尺寸"), _d("孔崩", "外观"), _d("漏孔", "装配")],
            ),
            _op(
                "wood_panel__sanding",
                "砂光",
                40,
                [_d("砂穿", "外观"), _d("波浪纹", "表面质量")],
            ),
            _op(
                "wood_panel__painting",
                "底漆/面漆",
                50,
                [_d("流挂颗粒", "外观"), _d("色差", "外观"), _d("附着力不良", "性能")],
            ),
            _op(
                "wood_panel__assembly_pack",
                "组装包装",
                60,
                [_d("错装漏装", "装配"), _d("五金漏装", "装配"), _d("包装破损", "包装")],
            ),
        ],
    },
]


def get_industry_by_id(industry_id: str) -> Optional[IndustryPresetDict]:
    for ind in INDUSTRY_PRESETS:
        if ind["id"] == industry_id:
            return ind
    return None


def list_preset_keys_for_industry(industry_id: str) -> List[str]:
    ind = get_industry_by_id(industry_id)
    if not ind:
        return []
    return [op["preset_key"] for op in ind["operations"]]


def get_operation_preset_by_key(preset_key: str) -> Optional[OperationPresetDict]:
    for ind in INDUSTRY_PRESETS:
        for op in ind["operations"]:
            if op["preset_key"] == preset_key:
                return op
    return None


def preset_catalog_for_api() -> Dict[str, Any]:
    """供 GET preset-preview：不含业务 code，仅展示结构。"""
    industries: List[Dict[str, Any]] = []
    for ind in INDUSTRY_PRESETS:
        industries.append(
            {
                "id": ind["id"],
                "name": ind["name"],
                "description": ind["description"],
                "operations": [
                    {
                        "presetKey": op["preset_key"],
                        "name": op["name"],
                        "sortOrder": op["sort_order"],
                        "defectPresets": [
                            {
                                "name": d["name"],
                                **({"category": d["category"]} if d.get("category") else {}),
                                **({"description": d["description"]} if d.get("description") else {}),
                            }
                            for d in op["defect_presets"]
                        ],
                    }
                    for op in ind["operations"]
                ],
            }
        )
    return {"industries": industries}
