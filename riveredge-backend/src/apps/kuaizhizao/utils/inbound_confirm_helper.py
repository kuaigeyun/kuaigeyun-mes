"""入库/出库确认：解析业务操作人（支持确认时二次选择）。"""

from datetime import datetime
from typing import Awaitable, Callable, Optional, Protocol, Tuple, Union

from core.utils.timezone_utils import coerce_business_datetime_to_utc


class InboundConfirmReceiverPayload(Protocol):
    receiver_id: Optional[int]
    receiver_name: Optional[str]


class OutboundConfirmDelivererPayload(Protocol):
    deliverer_id: Optional[int]
    deliverer_name: Optional[str]


async def resolve_inbound_confirm_receiver(
    *,
    confirmed_by: int,
    confirmation_data: Optional[InboundConfirmReceiverPayload],
    get_user_name: Callable[[int], Awaitable[str]],
) -> Tuple[int, str]:
    """
    确认入库时的业务操作人（入库人/退料人/收货人）。

    若请求体显式传入 receiver_id，则以所选人员为准；否则默认为确认操作人。
    """
    if confirmation_data is not None:
        rid = getattr(confirmation_data, "receiver_id", None)
        if rid is not None and int(rid) > 0:
            receiver_id = int(rid)
            receiver_name = str(getattr(confirmation_data, "receiver_name", None) or "").strip()
            if not receiver_name:
                receiver_name = await get_user_name(receiver_id)
            return receiver_id, receiver_name

    confirmer_name = await get_user_name(confirmed_by)
    return confirmed_by, confirmer_name


async def resolve_outbound_confirm_deliverer(
    *,
    confirmed_by: int,
    confirmation_data: Optional[OutboundConfirmDelivererPayload],
    get_user_name: Callable[[int], Awaitable[str]],
    existing_deliverer_id: Optional[int] = None,
    existing_deliverer_name: Optional[str] = None,
) -> Tuple[int, str]:
    """
    确认出库时的业务出库人。

    优先级：请求体 deliverer_id → 单据已有出库人 → 确认操作人。
    """
    if confirmation_data is not None:
        did = getattr(confirmation_data, "deliverer_id", None)
        if did is not None and int(did) > 0:
            deliverer_id = int(did)
            deliverer_name = str(getattr(confirmation_data, "deliverer_name", None) or "").strip()
            if not deliverer_name:
                deliverer_name = await get_user_name(deliverer_id)
            return deliverer_id, deliverer_name
        name_only = str(getattr(confirmation_data, "deliverer_name", None) or "").strip()
        if name_only:
            if existing_deliverer_id is not None and int(existing_deliverer_id) > 0:
                return int(existing_deliverer_id), name_only
            return confirmed_by, name_only

    if existing_deliverer_id is not None and int(existing_deliverer_id) > 0:
        name = str(existing_deliverer_name or "").strip()
        if not name:
            name = await get_user_name(int(existing_deliverer_id))
        return int(existing_deliverer_id), name

    existing_name = str(existing_deliverer_name or "").strip()
    if existing_name:
        return confirmed_by, existing_name

    confirmer_name = await get_user_name(confirmed_by)
    return confirmed_by, confirmer_name


class OutboundConfirmPickerPayload(Protocol):
    picker_id: Optional[int]
    picker_name: Optional[str]


async def resolve_production_picking_confirm_picker(
    *,
    confirmed_by: int,
    confirmation_data: Optional[OutboundConfirmPickerPayload],
    get_user_name: Callable[[int], Awaitable[str]],
    existing_picker_id: Optional[int] = None,
    existing_picker_name: Optional[str] = None,
) -> Tuple[int, str]:
    """
    确认生产领料时的业务领料人。

    优先级：请求体 picker_id → 单据已有领料人 → 确认操作人。
    """
    if confirmation_data is not None:
        pid = getattr(confirmation_data, "picker_id", None)
        if pid is not None and int(pid) > 0:
            picker_id = int(pid)
            picker_name = str(getattr(confirmation_data, "picker_name", None) or "").strip()
            if not picker_name:
                picker_name = await get_user_name(picker_id)
            return picker_id, picker_name
        name_only = str(getattr(confirmation_data, "picker_name", None) or "").strip()
        if name_only:
            if existing_picker_id is not None and int(existing_picker_id) > 0:
                return int(existing_picker_id), name_only
            return confirmed_by, name_only

    if existing_picker_id is not None and int(existing_picker_id) > 0:
        name = str(existing_picker_name or "").strip()
        if not name:
            name = await get_user_name(int(existing_picker_id))
        return int(existing_picker_id), name

    existing_name = str(existing_picker_name or "").strip()
    if existing_name:
        return confirmed_by, existing_name

    confirmer_name = await get_user_name(confirmed_by)
    return confirmed_by, confirmer_name


def resolve_inbound_confirm_business_time(
    confirmation_data: Optional[object],
    *,
    existing_time: Optional[Union[datetime, str]] = None,
) -> Optional[datetime]:
    """
    确认入库业务时刻（制单/业务日）。

    优先级：请求体 receipt_time → 单据已有业务时刻。
    二者皆空则返回 None，禁止用「此刻」冒充未填的制单日。
    """
    request_time = None
    if confirmation_data is not None:
        request_time = getattr(confirmation_data, "receipt_time", None)
    raw = request_time if request_time is not None else existing_time
    if raw is None or (isinstance(raw, str) and not str(raw).strip()):
        return None
    if isinstance(raw, str):
        from datetime import datetime as _dt

        normalized = raw.strip().replace("Z", "+00:00").replace("z", "+00:00")
        try:
            parsed = _dt.fromisoformat(normalized)
        except ValueError:
            return None
        return coerce_business_datetime_to_utc(parsed)
    return coerce_business_datetime_to_utc(raw)


def resolve_inbound_posting_business_time(
    confirmation_data: Optional[object],
    *,
    existing_time: Optional[Union[datetime, str]] = None,
) -> datetime:
    """
    确认过账用的入库业务时刻。

    优先请求体/单据已有 receipt_time；皆空时使用当前站点业务时刻（即「确认入库」时刻），
    供批号/序列号台账写入 production_date，与「来自入库单确认时间」一致。
    """
    resolved = resolve_inbound_confirm_business_time(
        confirmation_data,
        existing_time=existing_time,
    )
    if resolved is not None:
        return resolved
    from core.utils.timezone_utils import resolve_business_datetime

    return coerce_business_datetime_to_utc(resolve_business_datetime())
