"""
批量操作工具模块

提供统一的批量导入、导出和处理功能，支持并发处理、错误重试、进度跟踪等。
"""

import asyncio
import csv
import io
import os
import tempfile
from typing import List, Dict, Any, Optional, Callable, Awaitable, TypeVar, Generic
from datetime import datetime
from pathlib import Path
from loguru import logger

T = TypeVar('T')


class BatchImportResult:
    """批量导入结果"""
    
    def __init__(self):
        self.total = 0
        self.success_count = 0
        self.failure_count = 0
        self.errors: List[Dict[str, Any]] = []
        self.success_items: List[Any] = []
        self.failure_items: List[Any] = []
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "success": self.failure_count == 0,
            "message": "导入完成",
            "total": self.total,
            "success_count": self.success_count,
            "failure_count": self.failure_count,
            "errors": self.errors,
        }


class BatchOperationService:
    """
    批量操作服务类
    
    提供统一的批量导入、导出和处理功能。
    """
    
    # 默认并发数
    DEFAULT_CONCURRENCY = 5
    
    # 默认重试次数
    DEFAULT_RETRY_COUNT = 3
    
    @staticmethod
    async def batch_import(
        items: List[Dict[str, Any]],
        import_func: Callable[[Dict[str, Any], int], Awaitable[Any]],
        concurrency: int = DEFAULT_CONCURRENCY,
        retry_count: int = DEFAULT_RETRY_COUNT,
        on_progress: Optional[Callable[[int, int, int, int], None]] = None
    ) -> BatchImportResult:
        """
        批量导入数据（支持并发和重试）
        
        Args:
            items: 待导入的数据项列表
            import_func: 导入函数（接收数据项和索引，返回导入结果）
            concurrency: 并发数（默认5）
            retry_count: 重试次数（默认3）
            on_progress: 进度回调函数（current, total, success, fail）
            
        Returns:
            BatchImportResult: 导入结果
        """
        result = BatchImportResult()
        result.total = len(items)
        
        if not items:
            return result
        
        # 创建信号量控制并发
        semaphore = asyncio.Semaphore(concurrency)
        
        async def import_with_retry(
            item: Dict[str, Any],
            index: int
        ) -> tuple[bool, Any, Optional[str]]:
            """带重试的导入函数"""
            last_error = None
            
            for attempt in range(retry_count):
                try:
                    async with semaphore:
                        imported_item = await import_func(item, index)
                        return True, imported_item, None
                except Exception as e:
                    last_error = str(e)
                    if attempt < retry_count - 1:
                        await asyncio.sleep(0.5 * (attempt + 1))  # 指数退避
                    else:
                        logger.warning(f"导入失败（第{index + 1}行，尝试{attempt + 1}次）: {last_error}")
            
            return False, None, last_error
        
        # 并发执行导入
        tasks = [
            import_with_retry(item, index)
            for index, item in enumerate(items)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 处理结果
        for index, task_result in enumerate(results):
            if isinstance(task_result, Exception):
                result.failure_count += 1
                result.errors.append({
                    "row": index + 1,
                    "error": str(task_result)
                })
                result.failure_items.append(items[index])
            else:
                success, imported_item, error = task_result
                if success:
                    result.success_count += 1
                    result.success_items.append(imported_item)
                else:
                    result.failure_count += 1
                    result.errors.append({
                        "row": index + 1,
                        "error": error or "未知错误"
                    })
                    result.failure_items.append(items[index])
            
            # 调用进度回调
            if on_progress:
                try:
                    on_progress(
                        index + 1,
                        result.total,
                        result.success_count,
                        result.failure_count
                    )
                except Exception as e:
                    logger.warning(f"进度回调执行失败: {e}")
        
        return result
    
    @staticmethod
    async def batch_export_to_csv(
        items: List[Dict[str, Any]],
        headers: List[str],
        field_mapping: Dict[str, str],
        filename_prefix: str = "export"
    ) -> str:
        """
        批量导出数据到 CSV 文件
        
        Args:
            items: 待导出的数据项列表
            headers: CSV 表头列表
            field_mapping: 字段映射（数据字段名 -> CSV 列名）
            filename_prefix: 文件名前缀
            
        Returns:
            str: CSV 文件路径
        """
        # 创建导出目录
        export_dir = Path(tempfile.gettempdir()) / "riveredge_exports"
        export_dir.mkdir(exist_ok=True)
        
        # 生成文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{filename_prefix}_{timestamp}.csv"
        file_path = export_dir / filename
        
        # 写入 CSV 文件
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            
            for item in items:
                row = {}
                for header in headers:
                    # 从字段映射中获取数据字段名
                    field_name = field_mapping.get(header, header)
                    value = item.get(field_name, '')
                    
                    # 处理复杂类型（列表、字典等）
                    if isinstance(value, (list, dict)):
                        value = str(value)
                    elif value is None:
                        value = ''
                    
                    row[header] = value
                
                writer.writerow(row)
        
        logger.info(f"导出完成: {file_path}, 共 {len(items)} 条数据")
        return str(file_path)
    
    @staticmethod
    async def batch_export_stream(
        query_func: Callable[[int, int], Awaitable[tuple[List[Any], int]]],
        headers: List[str],
        field_mapping: Dict[str, str],
        filename_prefix: str = "export",
        page_size: int = 1000
    ) -> str:
        """
        流式导出大数据量数据（分页查询，避免内存溢出）
        
        Args:
            query_func: 查询函数（接收 page, page_size，返回 (items, total)）
            headers: CSV 表头列表
            field_mapping: 字段映射（数据字段名 -> CSV 列名）
            filename_prefix: 文件名前缀
            page_size: 每页大小（默认1000）
            
        Returns:
            str: CSV 文件路径
        """
        # 创建导出目录
        export_dir = Path(tempfile.gettempdir()) / "riveredge_exports"
        export_dir.mkdir(exist_ok=True)
        
        # 生成文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{filename_prefix}_{timestamp}.csv"
        file_path = export_dir / filename
        
        # 写入 CSV 文件（流式写入）
        with open(file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=headers)
            writer.writeheader()
            
            page = 1
            total_exported = 0
            
            while True:
                # 分页查询
                items, total = await query_func(page, page_size)
                
                if not items:
                    break
                
                # 写入数据
                for item in items:
                    row = {}
                    for header in headers:
                        # 从字段映射中获取数据字段名
                        field_name = field_mapping.get(header, header)
                        value = item.get(field_name, '') if isinstance(item, dict) else getattr(item, field_name, '')
                        
                        # 处理复杂类型
                        if isinstance(value, (list, dict)):
                            value = str(value)
                        elif value is None:
                            value = ''
                        
                        row[header] = value
                    
                    writer.writerow(row)
                    total_exported += 1
                
                # 如果已导出所有数据，退出循环
                if total_exported >= total or len(items) < page_size:
                    break
                
                page += 1
        
        logger.info(f"流式导出完成: {file_path}, 共 {total_exported} 条数据")
        return str(file_path)
    
    @staticmethod
    async def batch_process(
        items: List[Any],
        process_func: Callable[[Any, int], Awaitable[Any]],
        concurrency: int = DEFAULT_CONCURRENCY,
        on_progress: Optional[Callable[[int, int, int, int], None]] = None
    ) -> Dict[str, Any]:
        """
        批量处理数据（支持批量删除、批量更新等）
        
        Args:
            items: 待处理的数据项列表
            process_func: 处理函数（接收数据项和索引，返回处理结果）
            concurrency: 并发数（默认5）
            on_progress: 进度回调函数（current, total, success, fail）
            
        Returns:
            Dict[str, Any]: 处理结果
        """
        total = len(items)
        success_count = 0
        failure_count = 0
        errors: List[Dict[str, Any]] = []
        
        if not items:
            return {
                "success": True,
                "total": 0,
                "success_count": 0,
                "failure_count": 0,
                "errors": []
            }
        
        # 创建信号量控制并发
        semaphore = asyncio.Semaphore(concurrency)
        
        async def process_item(item: Any, index: int) -> tuple[bool, Optional[str]]:
            """处理单个数据项"""
            try:
                async with semaphore:
                    await process_func(item, index)
                    return True, None
            except Exception as e:
                error_msg = str(e)
                logger.warning(f"处理失败（索引{index}）: {error_msg}")
                return False, error_msg
        
        # 并发执行处理
        tasks = [
            process_item(item, index)
            for index, item in enumerate(items)
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 处理结果
        for index, task_result in enumerate(results):
            if isinstance(task_result, Exception):
                failure_count += 1
                errors.append({
                    "index": index,
                    "error": str(task_result)
                })
            else:
                success, error = task_result
                if success:
                    success_count += 1
                else:
                    failure_count += 1
                    errors.append({
                        "index": index,
                        "error": error or "未知错误"
                    })
            
            # 调用进度回调
            if on_progress:
                try:
                    on_progress(
                        index + 1,
                        total,
                        success_count,
                        failure_count
                    )
                except Exception as e:
                    logger.warning(f"进度回调执行失败: {e}")
        
        return {
            "success": failure_count == 0,
            "total": total,
            "success_count": success_count,
            "failure_count": failure_count,
            "errors": errors,
        }

