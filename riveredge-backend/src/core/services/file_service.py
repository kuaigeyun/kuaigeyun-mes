"""
文件管理服务模块

提供文件的 CRUD 操作、上传、下载、删除等功能。
"""

import os
import uuid
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

import aiofiles
from tortoise.exceptions import IntegrityError

from core.models.file import File
from core.schemas.file import FileCreate, FileUpdate
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.config.platform_config import platform_settings as settings


class FileService:
    """
    文件管理服务类
    
    提供文件的 CRUD 操作、上传、下载、删除等功能。
    """
    
    # 文件上传目录（从配置读取，默认 ./uploads）
    UPLOAD_DIR = getattr(settings, "FILE_UPLOAD_DIR", "./uploads")
    # 最大文件大小（默认 100MB）
    MAX_FILE_SIZE = getattr(settings, "MAX_FILE_SIZE", 100 * 1024 * 1024)
    
    @staticmethod
    def _get_file_storage_path(tenant_id: int, filename: str) -> str:
        """
        生成文件存储路径
        
        路径格式：/uploads/{tenant_id}/{year}/{month}/{filename}
        
        Args:
            tenant_id: 组织ID
            filename: 文件名（通常是UUID）
            
        Returns:
            str: 文件存储路径（相对路径）
        """
        now = datetime.now()
        year = now.strftime("%Y")
        month = now.strftime("%m")
        
        return f"{tenant_id}/{year}/{month}/{filename}"
    
    @staticmethod
    def _get_file_extension(filename: str) -> str:
        """
        获取文件扩展名
        
        Args:
            filename: 文件名
            
        Returns:
            str: 文件扩展名（不含点号）
        """
        return Path(filename).suffix.lstrip(".")
    
    @staticmethod
    def _get_mime_type(file_extension: str) -> str:
        """
        根据文件扩展名获取 MIME 类型
        
        Args:
            file_extension: 文件扩展名
            
        Returns:
            str: MIME 类型
        """
        mime_types = {
            "pdf": "application/pdf",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "gif": "image/gif",
            "txt": "text/plain",
            "doc": "application/msword",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "xls": "application/vnd.ms-excel",
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "ppt": "application/vnd.ms-powerpoint",
            "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        }
        
        return mime_types.get(file_extension.lower(), "application/octet-stream")
    
    @staticmethod
    async def create_file(
        tenant_id: int,
        original_name: str,
        file_path: str,
        file_size: int,
        file_type: Optional[str] = None,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None,
        description: Optional[str] = None,
    ) -> File:
        """
        创建文件记录
        
        Args:
            tenant_id: 组织ID
            original_name: 原始文件名
            file_path: 文件存储路径
            file_size: 文件大小（字节）
            file_type: 文件类型（MIME类型）
            category: 文件分类
            tags: 文件标签
            description: 文件描述
            
        Returns:
            File: 创建的文件对象
        """
        # 生成文件名（使用UUID）
        file_uuid = str(uuid.uuid4())
        file_extension = FileService._get_file_extension(original_name)
        
        # 如果没有提供文件类型，根据扩展名推断
        if not file_type:
            file_type = FileService._get_mime_type(file_extension)
        
        file = File(
            tenant_id=tenant_id,
            name=file_uuid,  # 存储时使用UUID作为文件名
            original_name=original_name,
            file_path=file_path,
            file_size=file_size,
            file_type=file_type,
            file_extension=file_extension,
            category=category,
            tags=tags or [],
            description=description,
            upload_status="completed",
        )
        await file.save()
        return file
    
    @staticmethod
    async def get_file_by_uuid(
        tenant_id: int,
        uuid: str
    ) -> File:
        """
        根据UUID获取文件
        
        Args:
            tenant_id: 组织ID
            uuid: 文件UUID
            
        Returns:
            File: 文件对象
            
        Raises:
            NotFoundError: 当文件不存在时抛出
        """
        file = await File.filter(
            tenant_id=tenant_id,
            uuid=uuid,
            deleted_at__isnull=True
        ).first()
        
        if not file:
            raise NotFoundError("文件不存在")
        
        return file
    
    @staticmethod
    async def list_files(
        tenant_id: int,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        category: Optional[str] = None,
        file_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        获取文件列表（分页、搜索、筛选）
        
        Args:
            tenant_id: 组织ID
            page: 页码（从1开始）
            page_size: 每页数量
            search: 搜索关键词（搜索文件名、原始文件名）
            category: 文件分类筛选
            file_type: 文件类型筛选
            
        Returns:
            Dict[str, Any]: 包含 items、total、page、page_size 的字典
        """
        query = File.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True
        )
        
        # 搜索条件
        if search:
            query = query.filter(
                name__icontains=search
            ) | query.filter(
                original_name__icontains=search
            )
        
        # 筛选条件
        if category:
            query = query.filter(category=category)
        
        if file_type:
            query = query.filter(file_type=file_type)
        
        # 获取总数
        total = await query.count()
        
        # 分页查询
        offset = (page - 1) * page_size
        files = await query.order_by("-created_at").offset(offset).limit(page_size)
        
        return {
            "items": files,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    
    @staticmethod
    async def update_file(
        tenant_id: int,
        uuid: str,
        data: FileUpdate
    ) -> File:
        """
        更新文件信息
        
        Args:
            tenant_id: 组织ID
            uuid: 文件UUID
            data: 文件更新数据
            
        Returns:
            File: 更新后的文件对象
            
        Raises:
            NotFoundError: 当文件不存在时抛出
        """
        file = await FileService.get_file_by_uuid(tenant_id, uuid)
        
        # 更新字段
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(file, key, value)
        
        await file.save()
        return file
    
    @staticmethod
    async def delete_file(
        tenant_id: int,
        uuid: str
    ) -> None:
        """
        删除文件（软删除）
        
        Args:
            tenant_id: 组织ID
            uuid: 文件UUID
            
        Raises:
            NotFoundError: 当文件不存在时抛出
        """
        file = await FileService.get_file_by_uuid(tenant_id, uuid)
        
        # 软删除
        file.deleted_at = datetime.now()
        await file.save()
        
        # TODO: 可选：物理删除文件（需要确认是否要删除物理文件）
    
    @staticmethod
    async def batch_delete_files(
        tenant_id: int,
        uuids: List[str]
    ) -> int:
        """
        批量删除文件（软删除）
        
        Args:
            tenant_id: 组织ID
            uuids: 文件UUID列表
            
        Returns:
            int: 删除的文件数量
        """
        count = await File.filter(
            tenant_id=tenant_id,
            uuid__in=uuids,
            deleted_at__isnull=True
        ).update(deleted_at=datetime.now())
        
        return count
    
    @staticmethod
    async def save_uploaded_file(
        tenant_id: int,
        file_content: bytes,
        original_name: str,
        category: Optional[str] = None,
        tags: Optional[List[str]] = None,
        description: Optional[str] = None,
    ) -> File:
        """
        保存上传的文件
        
        Args:
            tenant_id: 组织ID
            file_content: 文件内容（字节）
            original_name: 原始文件名
            category: 文件分类
            tags: 文件标签
            description: 文件描述
            
        Returns:
            File: 创建的文件对象
            
        Raises:
            ValidationError: 当文件大小超过限制时抛出
        """
        # 检查文件大小
        file_size = len(file_content)
        if file_size > FileService.MAX_FILE_SIZE:
            raise ValidationError(f"文件大小超过限制（最大 {FileService.MAX_FILE_SIZE / 1024 / 1024}MB）")
        
        # 生成文件名（使用UUID）
        file_uuid = str(uuid.uuid4())
        file_extension = FileService._get_file_extension(original_name)
        storage_filename = f"{file_uuid}.{file_extension}" if file_extension else file_uuid
        
        # 生成存储路径
        storage_path = FileService._get_file_storage_path(tenant_id, storage_filename)
        full_path = os.path.join(FileService.UPLOAD_DIR, storage_path)
        
        # 确保目录存在
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        # 保存文件
        async with aiofiles.open(full_path, "wb") as f:
            await f.write(file_content)
        
        # 获取文件类型
        file_type = FileService._get_mime_type(file_extension)
        
        # 创建文件记录
        file = await FileService.create_file(
            tenant_id=tenant_id,
            original_name=original_name,
            file_path=storage_path,  # 存储相对路径
            file_size=file_size,
            file_type=file_type,
            category=category,
            tags=tags,
            description=description,
        )
        
        return file
    
    @staticmethod
    async def get_file_content(
        tenant_id: int,
        uuid: str
    ) -> bytes:
        """
        获取文件内容
        
        Args:
            tenant_id: 组织ID
            uuid: 文件UUID
            
        Returns:
            bytes: 文件内容
            
        Raises:
            NotFoundError: 当文件不存在时抛出
        """
        file = await FileService.get_file_by_uuid(tenant_id, uuid)
        
        # 构建完整路径
        full_path = os.path.join(FileService.UPLOAD_DIR, file.file_path)
        
        # 检查文件是否存在
        if not os.path.exists(full_path):
            raise NotFoundError("文件不存在")
        
        # 读取文件内容
        async with aiofiles.open(full_path, "rb") as f:
            content = await f.read()
        
        return content

