"""
二维码 API 模块

提供二维码生成和解析的 RESTful API 接口。

Author: Luigi Lu
Date: 2026-01-27
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Annotated
from loguru import logger

from core.api.deps.deps import get_current_user, get_current_tenant
from infra.models.user import User
from core.services.qrcode import QRCodeService
from core.schemas.qrcode import (
    QRCodeGenerateRequest,
    QRCodeGenerateResponse,
    QRCodeParseRequest,
    QRCodeParseResponse,
    MaterialQRCodeGenerateRequest,
    WorkOrderQRCodeGenerateRequest,
    OperationQRCodeGenerateRequest,
    EquipmentQRCodeGenerateRequest,
    EmployeeQRCodeGenerateRequest,
    BoxQRCodeGenerateRequest,
    TraceQRCodeGenerateRequest,
)
from infra.exceptions.exceptions import ValidationError, NotFoundError

router = APIRouter(prefix="/qrcode", tags=["QRCode"])


@router.post("/generate", response_model=QRCodeGenerateResponse, summary="生成二维码")
async def generate_qrcode(
    request: QRCodeGenerateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    生成二维码
    
    支持生成各种类型的二维码（物料码、工单码、工序码、设备码、人员码、装箱码、追溯码）。
    """
    try:
        result = QRCodeService.generate_qrcode(
            data=request.data,
            qrcode_type=request.qrcode_type,
            size=request.size,
            border=request.border,
            error_correction=request.error_correction
        )
        return QRCodeGenerateResponse(**result)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"生成二维码失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成二维码失败: {str(e)}"
        )


@router.post("/parse", response_model=QRCodeParseResponse, summary="解析二维码")
async def parse_qrcode(
    request: QRCodeParseRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    解析二维码
    
    支持从文本或图片中解析二维码内容。
    """
    try:
        if request.qrcode_text:
            result = QRCodeService.parse_qrcode(request.qrcode_text)
        elif request.qrcode_image:
            result = QRCodeService.parse_qrcode_image(request.qrcode_image)
        else:
            raise ValidationError("必须提供qrcode_text或qrcode_image之一")
        
        return QRCodeParseResponse(**result)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"解析二维码失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"解析二维码失败: {str(e)}"
        )


@router.post("/material/generate", response_model=QRCodeGenerateResponse, summary="生成物料二维码")
async def generate_material_qrcode(
    request: MaterialQRCodeGenerateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    生成物料二维码
    
    为物料生成二维码，包含物料UUID、编码、名称等信息。
    """
    try:
        result = QRCodeService.generate_material_qrcode(
            material_uuid=request.material_uuid,
            material_code=request.material_code,
            material_name=request.material_name,
            size=request.size,
            border=request.border,
            error_correction=request.error_correction
        )
        return QRCodeGenerateResponse(**result)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"生成物料二维码失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成物料二维码失败: {str(e)}"
        )


@router.post("/work-order/generate", response_model=QRCodeGenerateResponse, summary="生成工单二维码")
async def generate_work_order_qrcode(
    request: WorkOrderQRCodeGenerateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    生成工单二维码
    
    为工单生成二维码，包含工单UUID、编码、物料编码等信息。
    """
    try:
        result = QRCodeService.generate_work_order_qrcode(
            work_order_uuid=request.work_order_uuid,
            work_order_code=request.work_order_code,
            material_code=request.material_code,
            size=request.size,
            border=request.border,
            error_correction=request.error_correction
        )
        return QRCodeGenerateResponse(**result)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"生成工单二维码失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成工单二维码失败: {str(e)}"
        )


@router.post("/operation/generate", response_model=QRCodeGenerateResponse, summary="生成工序二维码")
async def generate_operation_qrcode(
    request: OperationQRCodeGenerateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    生成工序二维码
    
    为工序生成二维码，包含工序UUID、名称、工单编码等信息。
    """
    try:
        result = QRCodeService.generate_operation_qrcode(
            operation_uuid=request.operation_uuid,
            operation_name=request.operation_name,
            work_order_code=request.work_order_code,
            size=request.size,
            border=request.border,
            error_correction=request.error_correction
        )
        return QRCodeGenerateResponse(**result)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"生成工序二维码失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成工序二维码失败: {str(e)}"
        )


@router.post("/equipment/generate", response_model=QRCodeGenerateResponse, summary="生成设备二维码")
async def generate_equipment_qrcode(
    request: EquipmentQRCodeGenerateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    生成设备二维码
    
    为设备生成二维码，包含设备UUID、编码、名称等信息。
    """
    try:
        result = QRCodeService.generate_equipment_qrcode(
            equipment_uuid=request.equipment_uuid,
            equipment_code=request.equipment_code,
            equipment_name=request.equipment_name,
            size=request.size,
            border=request.border,
            error_correction=request.error_correction
        )
        return QRCodeGenerateResponse(**result)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"生成设备二维码失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成设备二维码失败: {str(e)}"
        )


@router.post("/employee/generate", response_model=QRCodeGenerateResponse, summary="生成人员二维码")
async def generate_employee_qrcode(
    request: EmployeeQRCodeGenerateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    生成人员二维码
    
    为人员生成二维码，包含人员UUID、编码、名称等信息。
    """
    try:
        result = QRCodeService.generate_employee_qrcode(
            employee_uuid=request.employee_uuid,
            employee_code=request.employee_code,
            employee_name=request.employee_name,
            size=request.size,
            border=request.border,
            error_correction=request.error_correction
        )
        return QRCodeGenerateResponse(**result)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"生成人员二维码失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成人员二维码失败: {str(e)}"
        )


@router.post("/box/generate", response_model=QRCodeGenerateResponse, summary="生成装箱二维码")
async def generate_box_qrcode(
    request: BoxQRCodeGenerateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    生成装箱二维码
    
    为装箱生成二维码，包含装箱UUID、编码、物料编码列表等信息。
    """
    try:
        result = QRCodeService.generate_box_qrcode(
            box_uuid=request.box_uuid,
            box_code=request.box_code,
            material_codes=request.material_codes,
            size=request.size,
            border=request.border,
            error_correction=request.error_correction
        )
        return QRCodeGenerateResponse(**result)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"生成装箱二维码失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成装箱二维码失败: {str(e)}"
        )


@router.post("/trace/generate", response_model=QRCodeGenerateResponse, summary="生成追溯二维码")
async def generate_trace_qrcode(
    request: TraceQRCodeGenerateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    tenant_id: Annotated[int, Depends(get_current_tenant)]
):
    """
    生成追溯二维码
    
    为追溯记录生成二维码，包含追溯UUID、编码、追溯数据等信息。
    """
    try:
        result = QRCodeService.generate_trace_qrcode(
            trace_uuid=request.trace_uuid,
            trace_code=request.trace_code,
            trace_data=request.trace_data,
            size=request.size,
            border=request.border,
            error_correction=request.error_correction
        )
        return QRCodeGenerateResponse(**result)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"生成追溯二维码失败: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"生成追溯二维码失败: {str(e)}"
        )
