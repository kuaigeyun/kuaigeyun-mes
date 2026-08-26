"""质检模型类名契约（禁止 OqcInspection 等口语别名）。"""

from __future__ import annotations


def test_inspection_model_class_names_follow_acronym_contract():
    from apps.kuaizhizao.models.finished_goods_inspection import FinishedGoodsInspection
    from apps.kuaizhizao.models.incoming_inspection import IncomingInspection
    from apps.kuaizhizao.models.oqc_inspection import OQCInspection
    from apps.kuaizhizao.models.process_inspection import ProcessInspection

    assert OQCInspection.__name__ == "OQCInspection"
    assert FinishedGoodsInspection.__name__ == "FinishedGoodsInspection"
    assert IncomingInspection.__name__ == "IncomingInspection"
    assert ProcessInspection.__name__ == "ProcessInspection"
