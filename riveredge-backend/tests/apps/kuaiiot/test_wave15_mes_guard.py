"""MES 写回护栏与状态归一化单元测试。"""



import pytest



from apps.kuaiiot.services.status_mapper import normalize_equipment_status





class TestNormalizeEquipmentStatus:

    def test_allowed_status_passthrough(self):

        assert normalize_equipment_status("运行中") == "运行中"

        assert normalize_equipment_status("待机") == "待机"



    def test_alias_mapping(self):

        assert normalize_equipment_status("running") == "运行中"

        assert normalize_equipment_status("idle") == "待机"

        assert normalize_equipment_status("fault") == "故障"



    def test_unknown_defaults_to_standby(self):

        assert normalize_equipment_status("unknown_state") == "待机"

        assert normalize_equipment_status("") == "待机"

        assert normalize_equipment_status(None) == "待机"





@pytest.mark.asyncio

async def test_prepare_mes_payload_blocked_without_telemetry():

    from unittest.mock import AsyncMock, patch



    from apps.kuaiiot.services.mes_guard_service import MesGuardService



    equipment = AsyncMock()

    equipment.id = 1

    equipment.status = "停用"



    with patch(

        "apps.kuaiiot.services.mes_guard_service.EquipmentService.get_equipment_by_uuid",

        new=AsyncMock(return_value=equipment),

    ), patch(

        "apps.kuaiiot.services.mes_guard_service.MesGuardService._is_status_writeback_blocked",

        new=AsyncMock(return_value=True),

    ):

        result = await MesGuardService.prepare_mes_payload(

            tenant_id=1,

            equipment_uuid="eq-1",

            mes_payload={"status": "运行中", "is_online": True},

        )

        assert result is None





@pytest.mark.asyncio

async def test_prepare_mes_payload_blocked_with_telemetry():

    from unittest.mock import AsyncMock, patch



    from apps.kuaiiot.services.mes_guard_service import MesGuardService



    equipment = AsyncMock()

    equipment.id = 1

    equipment.status = "故障"



    with patch(

        "apps.kuaiiot.services.mes_guard_service.EquipmentService.get_equipment_by_uuid",

        new=AsyncMock(return_value=equipment),

    ), patch(

        "apps.kuaiiot.services.mes_guard_service.MesGuardService._is_status_writeback_blocked",

        new=AsyncMock(return_value=True),

    ), patch(

        "apps.kuaiiot.services.mes_guard_service.EquipmentStatusMonitorService"

    ) as monitor_cls:

        monitor_cls.return_value.get_latest_status = AsyncMock(return_value=None)

        result = await MesGuardService.prepare_mes_payload(

            tenant_id=1,

            equipment_uuid="eq-1",

            mes_payload={"status": "运行中", "temperature": 36.5},

        )

        assert result is not None

        assert result["status"] == "故障"

        assert result["temperature"] == 36.5





@pytest.mark.asyncio

async def test_prepare_mes_payload_missing_status_uses_equipment_status():

    from unittest.mock import AsyncMock, patch



    from apps.kuaiiot.services.mes_guard_service import MesGuardService



    equipment = AsyncMock()

    equipment.id = 1

    equipment.status = "正常"



    with patch(

        "apps.kuaiiot.services.mes_guard_service.EquipmentService.get_equipment_by_uuid",

        new=AsyncMock(return_value=equipment),

    ), patch(

        "apps.kuaiiot.services.mes_guard_service.MesGuardService._is_status_writeback_blocked",

        new=AsyncMock(return_value=False),

    ):

        result = await MesGuardService.prepare_mes_payload(

            tenant_id=1,

            equipment_uuid="eq-1",

            mes_payload={"temperature": 20},

        )

        assert result is not None

        assert result["status"] == "正常"

