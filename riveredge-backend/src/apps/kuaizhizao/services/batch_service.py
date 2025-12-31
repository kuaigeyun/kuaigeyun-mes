"""
批量操作服务模块

提供业务单据的批量创建、更新、删除功能。

Author: Luigi Lu
Date: 2025-01-01
"""

from typing import List, Dict, Any, Optional, Type
from datetime import datetime
from tortoise.transactions import in_transaction
from loguru import logger

from infra.exceptions.exceptions import NotFoundError, ValidationError, BusinessLogicError


class BatchOperationService:
    """批量操作服务"""

    async def batch_create(
        self,
        tenant_id: int,
        model_class: Type,
        create_data_list: List[Dict[str, Any]],
        created_by: int,
        validate_func: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        批量创建记录

        Args:
            tenant_id: 租户ID
            model_class: 模型类
            create_data_list: 创建数据列表
            created_by: 创建人ID
            validate_func: 验证函数（可选）

        Returns:
            Dict: 包含成功和失败记录的字典
        """
        success_records = []
        failed_records = []

        async with in_transaction():
            for index, data in enumerate(create_data_list):
                try:
                    # 验证数据（如果提供了验证函数）
                    if validate_func:
                        validate_func(data)

                    # 添加租户ID和创建人
                    data['tenant_id'] = tenant_id
                    data['created_by'] = created_by

                    # 创建记录
                    record = await model_class.create(**data)
                    success_records.append({
                        "index": index,
                        "id": record.id,
                        "data": data
                    })
                except Exception as e:
                    logger.error(f"批量创建失败，索引 {index}: {e}")
                    failed_records.append({
                        "index": index,
                        "data": data,
                        "error": str(e)
                    })

        return {
            "success_count": len(success_records),
            "failed_count": len(failed_records),
            "success_records": success_records,
            "failed_records": failed_records
        }

    async def batch_update(
        self,
        tenant_id: int,
        model_class: Type,
        update_data_list: List[Dict[str, Any]],
        updated_by: int,
        id_field: str = "id",
        validate_func: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        批量更新记录

        Args:
            tenant_id: 租户ID
            model_class: 模型类
            update_data_list: 更新数据列表（必须包含ID字段）
            updated_by: 更新人ID
            id_field: ID字段名（默认：id）
            validate_func: 验证函数（可选）

        Returns:
            Dict: 包含成功和失败记录的字典
        """
        success_records = []
        failed_records = []

        async with in_transaction():
            for index, data in enumerate(update_data_list):
                try:
                    # 检查ID字段
                    if id_field not in data:
                        raise ValidationError(f"缺少ID字段: {id_field}")

                    record_id = data[id_field]
                    del data[id_field]  # 从更新数据中移除ID

                    # 验证数据（如果提供了验证函数）
                    if validate_func:
                        validate_func(data)

                    # 检查记录是否存在
                    record = await model_class.get_or_none(
                        tenant_id=tenant_id,
                        **{id_field: record_id}
                    )
                    if not record:
                        raise NotFoundError(f"记录不存在: {record_id}")

                    # 添加更新人
                    data['updated_by'] = updated_by

                    # 更新记录
                    await model_class.filter(
                        tenant_id=tenant_id,
                        **{id_field: record_id}
                    ).update(**data)

                    success_records.append({
                        "index": index,
                        "id": record_id,
                        "data": data
                    })
                except Exception as e:
                    logger.error(f"批量更新失败，索引 {index}: {e}")
                    failed_records.append({
                        "index": index,
                        "data": data,
                        "error": str(e)
                    })

        return {
            "success_count": len(success_records),
            "failed_count": len(failed_records),
            "success_records": success_records,
            "failed_records": failed_records
        }

    async def batch_delete(
        self,
        tenant_id: int,
        model_class: Type,
        record_ids: List[int],
        id_field: str = "id",
        soft_delete: bool = True,
        validate_func: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        批量删除记录

        Args:
            tenant_id: 租户ID
            model_class: 模型类
            record_ids: 记录ID列表
            id_field: ID字段名（默认：id）
            soft_delete: 是否软删除（默认：True）
            validate_func: 验证函数（可选，用于检查是否可以删除）

        Returns:
            Dict: 包含成功和失败记录的字典
        """
        success_records = []
        failed_records = []

        async with in_transaction():
            for index, record_id in enumerate(record_ids):
                try:
                    # 检查记录是否存在
                    record = await model_class.get_or_none(
                        tenant_id=tenant_id,
                        **{id_field: record_id}
                    )
                    if not record:
                        raise NotFoundError(f"记录不存在: {record_id}")

                    # 验证是否可以删除（如果提供了验证函数）
                    if validate_func:
                        validate_func(record)

                    # 删除记录
                    if soft_delete and hasattr(record, 'deleted_at'):
                        # 软删除
                        await model_class.filter(
                            tenant_id=tenant_id,
                            **{id_field: record_id}
                        ).update(deleted_at=datetime.now())
                    else:
                        # 硬删除
                        await record.delete()

                    success_records.append({
                        "index": index,
                        "id": record_id
                    })
                except Exception as e:
                    logger.error(f"批量删除失败，索引 {index}, ID {record_id}: {e}")
                    failed_records.append({
                        "index": index,
                        "id": record_id,
                        "error": str(e)
                    })

        return {
            "success_count": len(success_records),
            "failed_count": len(failed_records),
            "success_records": success_records,
            "failed_records": failed_records
        }

