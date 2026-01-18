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
        validate_func: Optional[callable] = None,
        batch_size: int = 100,
        use_bulk: bool = True
    ) -> Dict[str, Any]:
        """
        批量创建记录（优化版，支持批量插入）

        Args:
            tenant_id: 租户ID
            model_class: 模型类
            create_data_list: 创建数据列表
            created_by: 创建人ID
            validate_func: 验证函数（可选）
            batch_size: 批量插入大小（默认100，超过此大小会分批插入）
            use_bulk: 是否使用批量插入（默认True，提升性能）

        Returns:
            Dict: 包含成功和失败记录的字典
        """
        success_records = []
        failed_records = []

        # 预处理数据
        validated_data_list = []
        for index, data in enumerate(create_data_list):
            try:
                # 验证数据（如果提供了验证函数）
                if validate_func:
                    validate_func(data)

                # 添加租户ID和创建人
                data['tenant_id'] = tenant_id
                data['created_by'] = created_by
                
                validated_data_list.append((index, data))
            except Exception as e:
                logger.error(f"数据验证失败，索引 {index}: {e}")
                failed_records.append({
                    "index": index,
                    "data": data,
                    "error": str(e)
                })

        if not validated_data_list:
            return {
                "success_count": 0,
                "failed_count": len(failed_records),
                "success_records": [],
                "failed_records": failed_records
            }

        # 使用批量插入（如果支持且数据量较大）
        if use_bulk and len(validated_data_list) >= batch_size:
            try:
                async with in_transaction():
                    # 分批插入
                    for i in range(0, len(validated_data_list), batch_size):
                        batch = validated_data_list[i:i + batch_size]
                        batch_data = [data for _, data in batch]
                        
                        # 批量创建（Tortoise ORM支持bulk_create）
                        records = await model_class.bulk_create([
                            model_class(**data) for data in batch_data
                        ])
                        
                        # 记录成功
                        for j, record in enumerate(records):
                            original_index = batch[j][0]
                            success_records.append({
                                "index": original_index,
                                "id": record.id,
                                "data": batch_data[j]
                            })
                
                logger.info(f"批量创建成功: {len(success_records)} 条记录")
            except Exception as e:
                logger.error(f"批量插入失败，回退到逐条创建: {e}")
                # 回退到逐条创建
                use_bulk = False

        # 如果不使用批量插入或批量插入失败，使用逐条创建
        if not use_bulk or len(success_records) == 0:
            async with in_transaction():
                for index, data in validated_data_list:
                    try:
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
        validate_func: Optional[callable] = None,
        batch_size: int = 100
    ) -> Dict[str, Any]:
        """
        批量更新记录（优化版，支持批量更新）

        Args:
            tenant_id: 租户ID
            model_class: 模型类
            update_data_list: 更新数据列表（必须包含ID字段）
            updated_by: 更新人ID
            id_field: ID字段名（默认：id）
            validate_func: 验证函数（可选）
            batch_size: 批量更新大小（默认100，超过此大小会分批更新）

        Returns:
            Dict: 包含成功和失败记录的字典
        """
        success_records = []
        failed_records = []

        # 预处理数据
        validated_updates = []
        for index, data in enumerate(update_data_list):
            try:
                # 检查ID字段
                if id_field not in data:
                    raise ValidationError(f"缺少ID字段: {id_field}")

                record_id = data[id_field]
                update_data = {k: v for k, v in data.items() if k != id_field}

                # 验证数据（如果提供了验证函数）
                if validate_func:
                    validate_func(update_data)

                # 添加更新人
                update_data['updated_by'] = updated_by
                
                validated_updates.append((index, record_id, update_data))
            except Exception as e:
                logger.error(f"数据验证失败，索引 {index}: {e}")
                failed_records.append({
                    "index": index,
                    "data": data,
                    "error": str(e)
                })

        if not validated_updates:
            return {
                "success_count": 0,
                "failed_count": len(failed_records),
                "success_records": [],
                "failed_records": failed_records
            }

        # 分批更新
        async with in_transaction():
            for i in range(0, len(validated_updates), batch_size):
                batch = validated_updates[i:i + batch_size]
                
                for index, record_id, update_data in batch:
                    try:
                        # 检查记录是否存在
                        record = await model_class.get_or_none(
                            tenant_id=tenant_id,
                            **{id_field: record_id}
                        )
                        if not record:
                            raise NotFoundError(f"记录不存在: {record_id}")

                        # 更新记录
                        await model_class.filter(
                            tenant_id=tenant_id,
                            **{id_field: record_id}
                        ).update(**update_data)

                        success_records.append({
                            "index": index,
                            "id": record_id,
                            "data": update_data
                        })
                    except Exception as e:
                        logger.error(f"批量更新失败，索引 {index}, ID {record_id}: {e}")
                        failed_records.append({
                            "index": index,
                            "id": record_id,
                            "data": update_data,
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
        validate_func: Optional[callable] = None,
        batch_size: int = 100
    ) -> Dict[str, Any]:
        """
        批量删除记录（优化版，支持批量删除）

        Args:
            tenant_id: 租户ID
            model_class: 模型类
            record_ids: 记录ID列表
            id_field: ID字段名（默认：id）
            soft_delete: 是否软删除（默认：True）
            validate_func: 验证函数（可选，用于检查是否可以删除）
            batch_size: 批量删除大小（默认100，超过此大小会分批删除）

        Returns:
            Dict: 包含成功和失败记录的字典
        """
        success_records = []
        failed_records = []

        # 验证记录是否存在（批量查询）
        valid_ids = []
        invalid_ids = []
        
        # 分批验证
        for i in range(0, len(record_ids), batch_size):
            batch_ids = record_ids[i:i + batch_size]
            records = await model_class.filter(
                tenant_id=tenant_id,
                **{f"{id_field}__in": batch_ids}
            ).all()
            
            valid_id_set = {getattr(r, id_field) for r in records}
            for record_id in batch_ids:
                if record_id in valid_id_set:
                    valid_ids.append(record_id)
                else:
                    invalid_ids.append(record_id)

        # 记录无效ID
        for index, record_id in enumerate(record_ids):
            if record_id in invalid_ids:
                failed_records.append({
                    "index": index,
                    "id": record_id,
                    "error": "记录不存在"
                })

        if not valid_ids:
            return {
                "success_count": 0,
                "failed_count": len(failed_records),
                "success_records": [],
                "failed_records": failed_records
            }

        # 批量删除
        async with in_transaction():
            if soft_delete and hasattr(model_class, 'deleted_at'):
                # 批量软删除
                deleted_count = await model_class.filter(
                    tenant_id=tenant_id,
                    **{f"{id_field}__in": valid_ids}
                ).update(deleted_at=datetime.now())
                
                # 记录成功
                for index, record_id in enumerate(record_ids):
                    if record_id in valid_ids:
                        success_records.append({
                            "index": index,
                            "id": record_id
                        })
            else:
                # 批量硬删除（需要逐条删除，因为可能有外键约束）
                for index, record_id in enumerate(record_ids):
                    if record_id in valid_ids:
                        try:
                            record = await model_class.get(
                                tenant_id=tenant_id,
                                **{id_field: record_id}
                            )
                            
                            # 验证是否可以删除（如果提供了验证函数）
                            if validate_func:
                                validate_func(record)
                            
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

