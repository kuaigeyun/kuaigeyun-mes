"""
二维码生成和解析服务模块

提供二维码生成、解析、验证等功能。

Author: Luigi Lu
Date: 2026-01-27
"""

import json
import base64
from io import BytesIO
from typing import Dict, Any, Optional, List
from loguru import logger

try:
    import qrcode
    from qrcode.image.pil import PilImage
    QRCODE_AVAILABLE = True
except ImportError:
    QRCODE_AVAILABLE = False
    logger.warning("qrcode库未安装，二维码生成功能将不可用。请运行: pip install qrcode[pil]")

try:
    from pyzbar.pyzbar import decode as pyzbar_decode
    from PIL import Image
    PYZBAR_AVAILABLE = True
except ImportError:
    PYZBAR_AVAILABLE = False
    logger.warning("pyzbar库未安装，二维码解析功能将不可用。请运行: pip install pyzbar")

from infra.exceptions.exceptions import ValidationError, NotFoundError


# 二维码类型常量
QRCODE_TYPE_MAT = "MAT"  # 物料码
QRCODE_TYPE_WO = "WO"  # 工单码
QRCODE_TYPE_OP = "OP"  # 工序码
QRCODE_TYPE_EQ = "EQ"  # 设备码
QRCODE_TYPE_EMP = "EMP"  # 人员码
QRCODE_TYPE_BOX = "BOX"  # 装箱码
QRCODE_TYPE_TRACE = "TRACE"  # 追溯码

VALID_QRCODE_TYPES = [
    QRCODE_TYPE_MAT,
    QRCODE_TYPE_WO,
    QRCODE_TYPE_OP,
    QRCODE_TYPE_EQ,
    QRCODE_TYPE_EMP,
    QRCODE_TYPE_BOX,
    QRCODE_TYPE_TRACE,
]


class QRCodeService:
    """
    二维码生成和解析服务类
    
    提供二维码生成、解析、验证等功能。
    """
    
    @staticmethod
    def generate_qrcode(
        data: Dict[str, Any],
        qrcode_type: str,
        size: int = 10,
        border: int = 4,
        error_correction: str = "M"
    ) -> Dict[str, Any]:
        """
        生成二维码
        
        Args:
            data: 二维码数据（字典格式）
            qrcode_type: 二维码类型（MAT/WO/OP/EQ/EMP/BOX/TRACE）
            size: 二维码大小（每个模块的像素数，默认10）
            border: 边框大小（默认4）
            error_correction: 错误纠正级别（L/M/Q/H，默认M）
            
        Returns:
            dict: 包含二维码图片（base64编码）和二维码内容
        """
        if not QRCODE_AVAILABLE:
            raise ValidationError("二维码生成功能不可用，请安装qrcode库: pip install qrcode[pil]")
        
        if qrcode_type not in VALID_QRCODE_TYPES:
            raise ValidationError(f"无效的二维码类型: {qrcode_type}")
        
        # 构建二维码内容（JSON格式）
        qrcode_content = {
            "type": qrcode_type,
            "data": data,
        }
        qrcode_text = json.dumps(qrcode_content, ensure_ascii=False)
        
        # 配置二维码参数
        error_correction_map = {
            "L": qrcode.constants.ERROR_CORRECT_L,
            "M": qrcode.constants.ERROR_CORRECT_M,
            "Q": qrcode.constants.ERROR_CORRECT_Q,
            "H": qrcode.constants.ERROR_CORRECT_H,
        }
        error_correction_level = error_correction_map.get(error_correction, qrcode.constants.ERROR_CORRECT_M)
        
        # 创建二维码
        qr = qrcode.QRCode(
            version=1,
            error_correction=error_correction_level,
            box_size=size,
            border=border,
        )
        qr.add_data(qrcode_text)
        qr.make(fit=True)
        
        # 生成二维码图片
        img = qr.make_image(fill_color="black", back_color="white")
        
        # 转换为base64编码
        buffer = BytesIO()
        img.save(buffer, format="PNG")
        img_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
        
        return {
            "qrcode_type": qrcode_type,
            "qrcode_text": qrcode_text,
            "qrcode_image": f"data:image/png;base64,{img_base64}",
            "size": size,
            "border": border,
            "error_correction": error_correction,
        }
    
    @staticmethod
    def parse_qrcode(qrcode_text: str) -> Dict[str, Any]:
        """
        解析二维码内容
        
        Args:
            qrcode_text: 二维码文本内容（JSON格式）
            
        Returns:
            dict: 解析后的二维码数据
        """
        try:
            # 解析JSON格式的二维码内容
            qrcode_content = json.loads(qrcode_text)
            
            qrcode_type = qrcode_content.get("type")
            data = qrcode_content.get("data", {})
            
            if qrcode_type not in VALID_QRCODE_TYPES:
                raise ValidationError(f"无效的二维码类型: {qrcode_type}")
            
            return {
                "qrcode_type": qrcode_type,
                "data": data,
                "valid": True,
            }
        except json.JSONDecodeError as e:
            raise ValidationError(f"二维码格式错误: {str(e)}")
        except Exception as e:
            logger.error(f"解析二维码失败: {str(e)}")
            raise ValidationError(f"解析二维码失败: {str(e)}")
    
    @staticmethod
    def parse_qrcode_image(image_base64: str) -> Dict[str, Any]:
        """
        从图片中解析二维码
        
        Args:
            image_base64: 二维码图片（base64编码）
            
        Returns:
            dict: 解析后的二维码数据
        """
        if not PYZBAR_AVAILABLE:
            raise ValidationError("二维码解析功能不可用，请安装pyzbar库: pip install pyzbar")
        
        try:
            # 解码base64图片
            if image_base64.startswith("data:image"):
                # 移除data URI前缀
                image_base64 = image_base64.split(",")[1]
            
            image_data = base64.b64decode(image_base64)
            image = Image.open(BytesIO(image_data))
            
            # 使用pyzbar解析二维码
            decoded_objects = pyzbar_decode(image)
            
            if not decoded_objects:
                raise ValidationError("未检测到二维码")
            
            # 获取第一个二维码的内容
            qrcode_text = decoded_objects[0].data.decode("utf-8")
            
            # 解析二维码内容
            return QRCodeService.parse_qrcode(qrcode_text)
        except Exception as e:
            logger.error(f"从图片解析二维码失败: {str(e)}")
            raise ValidationError(f"从图片解析二维码失败: {str(e)}")
    
    @staticmethod
    def generate_material_qrcode(
        material_uuid: str,
        material_code: str,
        material_name: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        生成物料二维码
        
        Args:
            material_uuid: 物料UUID
            material_code: 物料编码
            material_name: 物料名称
            **kwargs: 其他参数（size, border, error_correction等）
            
        Returns:
            dict: 二维码信息
        """
        data = {
            "material_uuid": material_uuid,
            "material_code": material_code,
            "material_name": material_name,
        }
        return QRCodeService.generate_qrcode(data, QRCODE_TYPE_MAT, **kwargs)
    
    @staticmethod
    def generate_work_order_qrcode(
        work_order_uuid: str,
        work_order_code: str,
        material_code: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        生成工单二维码
        
        Args:
            work_order_uuid: 工单UUID
            work_order_code: 工单编码
            material_code: 物料编码
            **kwargs: 其他参数
            
        Returns:
            dict: 二维码信息
        """
        data = {
            "work_order_uuid": work_order_uuid,
            "work_order_code": work_order_code,
            "material_code": material_code,
        }
        return QRCodeService.generate_qrcode(data, QRCODE_TYPE_WO, **kwargs)
    
    @staticmethod
    def generate_operation_qrcode(
        operation_uuid: str,
        operation_name: str,
        work_order_code: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        生成工序二维码
        
        Args:
            operation_uuid: 工序UUID
            operation_name: 工序名称
            work_order_code: 工单编码
            **kwargs: 其他参数
            
        Returns:
            dict: 二维码信息
        """
        data = {
            "operation_uuid": operation_uuid,
            "operation_name": operation_name,
            "work_order_code": work_order_code,
        }
        return QRCodeService.generate_qrcode(data, QRCODE_TYPE_OP, **kwargs)
    
    @staticmethod
    def generate_equipment_qrcode(
        equipment_uuid: str,
        equipment_code: str,
        equipment_name: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        生成设备二维码
        
        Args:
            equipment_uuid: 设备UUID
            equipment_code: 设备编码
            equipment_name: 设备名称
            **kwargs: 其他参数
            
        Returns:
            dict: 二维码信息
        """
        data = {
            "equipment_uuid": equipment_uuid,
            "equipment_code": equipment_code,
            "equipment_name": equipment_name,
        }
        return QRCodeService.generate_qrcode(data, QRCODE_TYPE_EQ, **kwargs)
    
    @staticmethod
    def generate_employee_qrcode(
        employee_uuid: str,
        employee_code: str,
        employee_name: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        生成人员二维码
        
        Args:
            employee_uuid: 人员UUID
            employee_code: 人员编码
            employee_name: 人员名称
            **kwargs: 其他参数
            
        Returns:
            dict: 二维码信息
        """
        data = {
            "employee_uuid": employee_uuid,
            "employee_code": employee_code,
            "employee_name": employee_name,
        }
        return QRCodeService.generate_qrcode(data, QRCODE_TYPE_EMP, **kwargs)
    
    @staticmethod
    def generate_box_qrcode(
        box_uuid: str,
        box_code: str,
        material_codes: List[str],
        **kwargs
    ) -> Dict[str, Any]:
        """
        生成装箱二维码
        
        Args:
            box_uuid: 装箱UUID
            box_code: 装箱编码
            material_codes: 物料编码列表
            **kwargs: 其他参数
            
        Returns:
            dict: 二维码信息
        """
        data = {
            "box_uuid": box_uuid,
            "box_code": box_code,
            "material_codes": material_codes,
        }
        return QRCodeService.generate_qrcode(data, QRCODE_TYPE_BOX, **kwargs)
    
    @staticmethod
    def generate_trace_qrcode(
        trace_uuid: str,
        trace_code: str,
        trace_data: Dict[str, Any],
        **kwargs
    ) -> Dict[str, Any]:
        """
        生成追溯二维码
        
        Args:
            trace_uuid: 追溯UUID
            trace_code: 追溯编码
            trace_data: 追溯数据
            **kwargs: 其他参数
            
        Returns:
            dict: 二维码信息
        """
        data = {
            "trace_uuid": trace_uuid,
            "trace_code": trace_code,
            "trace_data": trace_data,
        }
        return QRCodeService.generate_qrcode(data, QRCODE_TYPE_TRACE, **kwargs)
