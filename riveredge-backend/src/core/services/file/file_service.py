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
from tortoise.expressions import Q
from tortoise.exceptions import IntegrityError

from core.models.file import File
from core.schemas.file import FileCreate, FileUpdate
from core.services.file.image_compress import compress_image_content, effective_storage_extension
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.config.infra_config import infra_settings as settings


class FileService:
    """
    文件管理服务类
    
    提供文件的 CRUD 操作、上传、下载、删除等功能。
    """
    
    # 文件上传目录（从配置读取，默认 ./uploads）
    UPLOAD_DIR = getattr(settings, "FILE_UPLOAD_DIR", "./uploads")
    # 最大文件大小（默认 100MB）
    MAX_FILE_SIZE = getattr(settings, "MAX_FILE_SIZE", 100 * 1024 * 1024)
    
    # 安全白名单：只允许常见的非执行类文件
    ALLOWED_EXTENSIONS = {
        "jpg", "jpeg", "png", "gif", "svg", "webp",  # 图片
        "pdf", "dwg", "dxf", "step", "stp",  # 物料/SOP附件常用：PDF、2D/3D CAD
        "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "json", # 文档
        "zip", "rar", "7z", "tar", "gz", # 压缩包
        "mp3", "wav", "mp4", "mov", "avi" # 多媒体
    }

    # 危险黑名单：绝对禁止上传的后缀
    FORBIDDEN_EXTENSIONS = {
        "php", "phtml", "php3", "php4", "php5", "phps", "phar", "asp", "aspx", "jsp", "jspx", "cgi", "sh", "py", "exe", "bat"
    }
    
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
            "dwg": "application/acad",
            "dxf": "image/vnd.dxf",
            "step": "model/step",
            "stp": "model/step",
        }
        
        return mime_types.get(file_extension.lower(), "application/octet-stream")

    @staticmethod
    def _sniff_image_extension(file_content: bytes) -> Optional[str]:
        if len(file_content) >= 3 and file_content[:3] == b"\xff\xd8\xff":
            return "jpeg"
        if len(file_content) >= 8 and file_content[:8] == b"\x89PNG\r\n\x1a\n":
            return "png"
        if len(file_content) >= 6 and file_content[:6] in (b"GIF87a", b"GIF89a"):
            return "gif"
        if len(file_content) >= 12 and file_content[:4] == b"RIFF" and file_content[8:12] == b"WEBP":
            return "webp"
        return None

    @staticmethod
    def resolve_download_media_type(file: File, file_content: bytes) -> str:
        """下载/预览响应 MIME：修正无扩展名上传被记为 octet-stream 的图片。"""
        file_type = (file.file_type or "").strip()
        if file_type.startswith("image/"):
            return file_type
        ext = (file.file_extension or FileService._get_file_extension(file.original_name or "")).lower()
        if ext in ("jpg", "jpeg", "png", "gif", "webp", "bmp"):
            mime = FileService._get_mime_type(ext)
            if mime.startswith("image/"):
                return mime
        sniffed = FileService._sniff_image_extension(file_content)
        if sniffed:
            return FileService._get_mime_type(sniffed)
        return file_type or "application/octet-stream"
    
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
            raise NotFoundError("文件")
        
        return file
    
    @staticmethod
    async def _linked_file_uuids_for_category(tenant_id: int, category: str) -> List[str]:
        """业务表引用的 core_files UUID（历史上传可能未写入 category）。"""
        uuids: set[str] = set()
        if category == "material_images":
            from apps.master_data.models.material import Material

            rows = await Material.filter(tenant_id=tenant_id, deleted_at__isnull=True).only("images")
            for row in rows:
                images = row.images
                if isinstance(images, list):
                    uuids.update(str(item).strip() for item in images if item)
        elif category == "engineering_drawing":
            from apps.master_data.models.drawing import EngineeringDrawing

            rows = await EngineeringDrawing.filter(
                tenant_id=tenant_id, deleted_at__isnull=True
            ).only("file_uuid", "supplementary_file_uuids")
            for row in rows:
                if row.file_uuid:
                    uuids.add(str(row.file_uuid).strip())
                extras = row.supplementary_file_uuids
                if isinstance(extras, list):
                    uuids.update(str(item).strip() for item in extras if item)
        return [u for u in uuids if u]

    UNCATEGORIZED_CATEGORY = "@uncategorized"
    LINKED_ATTACHMENT_CATEGORIES: tuple[str, ...] = ("material_images", "engineering_drawing")

    @staticmethod
    async def collect_all_linked_attachment_file_uuids(tenant_id: int) -> List[str]:
        """业务 attachment 引用的 core_files UUID（category 可能为空）。"""
        uuids: set[str] = set()
        for category in FileService.LINKED_ATTACHMENT_CATEGORIES:
            uuids.update(await FileService._linked_file_uuids_for_category(tenant_id, category))
        return [u for u in uuids if u]

    @staticmethod
    async def collect_nonempty_attachment_categories(tenant_id: int) -> List[str]:
        """有可见文件的 attachment category（含业务表引用但 core_files.category 为空的情况）。"""
        categories: set[str] = set()
        direct_rows = await File.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).exclude(category__isnull=True).exclude(category="").distinct().values_list("category", flat=True)
        for raw in direct_rows:
            if raw and str(raw).strip():
                categories.add(str(raw).strip())

        for category in FileService.LINKED_ATTACHMENT_CATEGORIES:
            if category in categories:
                continue
            linked_uuids = await FileService._linked_file_uuids_for_category(tenant_id, category)
            if not linked_uuids:
                continue
            exists = await File.filter(
                tenant_id=tenant_id,
                deleted_at__isnull=True,
                uuid__in=linked_uuids,
            ).exists()
            if exists:
                categories.add(category)

        return sorted(categories)

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
        if category == FileService.UNCATEGORIZED_CATEGORY:
            linked_uuids = await FileService.collect_all_linked_attachment_file_uuids(tenant_id)
            query = query.filter(Q(category__isnull=True) | Q(category=""))
            if linked_uuids:
                query = query.exclude(uuid__in=linked_uuids)
        elif category:
            linked_uuids = await FileService._linked_file_uuids_for_category(tenant_id, category)
            if linked_uuids:
                query = query.filter(Q(category=category) | Q(uuid__in=linked_uuids))
            else:
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
        
        # 物理删除文件（安全增强：防止已删除记录的文件通过 URL 被执行或访问）
        await FileService.destroy_physical_file(file.file_path)
    
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
        # 先获取文件路径，用于物理删除
        files_to_delete = await File.filter(
            tenant_id=tenant_id,
            uuid__in=uuids,
            deleted_at__isnull=True
        ).values_list("file_path", flat=True)

        if not files_to_delete:
            return 0

        # 执行数据库软删除
        count = await File.filter(
            tenant_id=tenant_id,
            uuid__in=uuids,
            deleted_at__isnull=True
        ).update(deleted_at=datetime.now())
        
        # 执行物理删除
        for path in files_to_delete:
            await FileService.destroy_physical_file(path)

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
        
        # 检查文件后缀安全性
        file_extension = FileService._get_file_extension(original_name).lower()

        if not file_extension:
            sniffed = FileService._sniff_image_extension(file_content)
            if sniffed:
                file_extension = sniffed
                base = (original_name or "").strip()
                if not base or base.lower() in {"unknown", "blob", "file"}:
                    original_name = f"photo.{sniffed if sniffed != 'jpeg' else 'jpg'}"
                elif "." not in base:
                    original_name = f"{base}.{sniffed if sniffed != 'jpeg' else 'jpg'}"
        
        if file_extension in FileService.FORBIDDEN_EXTENSIONS:
            raise ValidationError(f"由于安全原因，禁止上传 {file_extension} 格式的文件")
            
        if file_extension and file_extension not in FileService.ALLOWED_EXTENSIONS:
            raise ValidationError(f"暂不支持上传 {file_extension} 格式的文件，请联系管理员")

        file_content, compressed_ext = compress_image_content(file_content, file_extension)
        file_extension = effective_storage_extension(file_extension, compressed_ext)
        file_size = len(file_content)

        # 生成文件名（使用UUID）
        file_uuid = str(uuid.uuid4())
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
    def resolve_physical_file_path(
        tenant_id: int,
        file_path: str,
    ) -> tuple[Optional[str], Optional[str]]:
        """
        解析磁盘上的物理文件路径。

        跨租户迁移后 core_files.file_path 可能仍带源租户前缀（如 17/2026/06/x.jpg），
        而文件已位于 uploads/{target_tenant_id}/...，此处按目标租户前缀重试。

        Returns:
            (absolute_path, corrected_relative_path)
            corrected_relative_path 仅在命中备用路径时返回，用于回写 DB。
        """
        upload_dir = FileService.UPLOAD_DIR
        primary_abs = os.path.join(upload_dir, file_path)
        if os.path.isfile(primary_abs):
            return primary_abs, None

        if "/" in file_path:
            prefix, rest = file_path.split("/", 1)
            if prefix.isdigit() and int(prefix) != int(tenant_id):
                alt_rel = f"{int(tenant_id)}/{rest}"
                alt_abs = os.path.join(upload_dir, alt_rel)
                if os.path.isfile(alt_abs):
                    return alt_abs, alt_rel

        return None, None

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
        
        full_path, corrected_rel = FileService.resolve_physical_file_path(
            tenant_id, file.file_path
        )
        if not full_path:
            raise NotFoundError("文件")

        if corrected_rel and corrected_rel != file.file_path:
            await File.filter(id=file.id).update(file_path=corrected_rel)
        
        async with aiofiles.open(full_path, "rb") as f:
            content = await f.read()
        
        return content

    @staticmethod
    async def destroy_physical_file(file_path: str) -> bool:
        """
        从磁盘物理删除文件
        
        Args:
            file_path: 相对存储路径
            
        Returns:
            bool: 是否删除成功
        """
        try:
            full_path = os.path.join(FileService.UPLOAD_DIR, file_path)
            if os.path.exists(full_path):
                os.remove(full_path)
                return True
        except Exception as e:
            # 记录日志但不阻塞业务
            print(f"Failed to delete physical file {file_path}: {e}")
        return False

