"""
文件管理服务模块

提供文件的 CRUD 操作、上传、下载、删除等功能。
"""

import os
import uuid
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime
from uuid import UUID

import aiofiles
from tortoise.expressions import Q
from tortoise.exceptions import IntegrityError

from core.models.file import File
from core.schemas.file import FileCreate, FileUpdate
from core.services.file.image_compress import compress_image_content, effective_storage_extension
from core.services.file.image_tier_service import ImageTierService
from infra.exceptions.exceptions import NotFoundError, ValidationError
from infra.config.infra_config import infra_settings as settings
from core.utils.timezone_utils import resolve_business_datetime


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
        "pdf", "dwg", "dxf", "step", "stp", "pcbdoc", "schdoc",  # 物料/SOP附件常用：PDF、2D/3D CAD、Altium PCB/原理图
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
        now = resolve_business_datetime()
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
            "pcbdoc": "application/octet-stream",
            "schdoc": "application/octet-stream",
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
        storage_backend: str = "local",
        storage_connection_uuid: Optional[str] = None,
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
            storage_backend: 存储后端
            storage_connection_uuid: 对象存储连接 UUID
            
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
            storage_backend=storage_backend or "local",
            storage_connection_uuid=storage_connection_uuid,
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
        file.deleted_at = resolve_business_datetime()
        await file.save()
        
        await ImageTierService.delete_tiers_for_file(tenant_id, file)
        
        # 物理删除文件（安全增强：防止已删除记录的文件通过 URL 被执行或访问）
        await FileService.destroy_physical_file(
            file.file_path,
            tenant_id=tenant_id,
            storage_backend=getattr(file, "storage_backend", None) or "local",
            storage_connection_uuid=getattr(file, "storage_connection_uuid", None),
        )
    
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
        from types import SimpleNamespace

        # 先获取文件路径与存储元数据，用于物理删除
        files_to_delete = await File.filter(
            tenant_id=tenant_id,
            uuid__in=uuids,
            deleted_at__isnull=True
        ).values_list("uuid", "file_path", "storage_backend", "storage_connection_uuid")

        if not files_to_delete:
            return 0

        # 执行数据库软删除
        count = await File.filter(
            tenant_id=tenant_id,
            uuid__in=uuids,
            deleted_at__isnull=True
        ).update(deleted_at=resolve_business_datetime())
        
        # 执行物理删除
        for file_uuid, path, storage_backend, storage_connection_uuid in files_to_delete:
            await ImageTierService.delete_tiers_for_file(
                tenant_id,
                SimpleNamespace(
                    uuid=file_uuid,
                    file_path=path,
                    storage_backend=storage_backend or "local",
                    storage_connection_uuid=storage_connection_uuid,
                ),
            )
            await FileService.destroy_physical_file(
                path,
                tenant_id=tenant_id,
                storage_backend=storage_backend or "local",
                storage_connection_uuid=storage_connection_uuid,
            )

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
        
        # 生成存储路径（相对 key）；按租户存储设置写入本地或 COS
        from core.services.file.storage import apply_key_prefix, resolve_storage_for_upload

        storage_path = FileService._get_file_storage_path(tenant_id, storage_filename)
        storage, meta = await resolve_storage_for_upload(tenant_id)
        object_key = apply_key_prefix(meta.get("key_prefix") or "", storage_path)
        file_type = FileService._get_mime_type(file_extension)
        await storage.put(object_key, file_content, content_type=file_type)
        
        # 创建文件记录
        file = await FileService.create_file(
            tenant_id=tenant_id,
            original_name=original_name,
            file_path=object_key,
            file_size=file_size,
            file_type=file_type,
            category=category,
            tags=tags,
            description=description,
            storage_backend=str(meta.get("storage_backend") or "local"),
            storage_connection_uuid=meta.get("storage_connection_uuid"),
        )

        if ImageTierService.is_tier_eligible_image(file_type, file_extension):
            await ImageTierService.ensure_tiers_for_content(
                file.uuid,
                file_content,
                file_type,
                storage,
                key_prefix=str(meta.get("key_prefix") or ""),
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
        from core.services.file.storage import resolve_storage_for_file

        backend_name = str(getattr(file, "storage_backend", None) or "local").strip().lower()
        if backend_name in ("", "local"):
            full_path, corrected_rel = FileService.resolve_physical_file_path(
                tenant_id, file.file_path
            )
            if not full_path:
                raise NotFoundError("文件")

            if corrected_rel and corrected_rel != file.file_path:
                await File.filter(id=file.id).update(file_path=corrected_rel)

            async with aiofiles.open(full_path, "rb") as f:
                return await f.read()

        storage = await resolve_storage_for_file(tenant_id, file)
        return await storage.get(file.file_path)

    @staticmethod
    async def destroy_physical_file(
        file_path: str,
        *,
        tenant_id: Optional[int] = None,
        storage_backend: str = "local",
        storage_connection_uuid: Optional[str] = None,
    ) -> bool:
        """
        删除物理文件（本地磁盘或对象存储）。
        """
        backend_name = str(storage_backend or "local").strip().lower()
        if backend_name in ("", "local"):
            try:
                full_path = os.path.join(FileService.UPLOAD_DIR, file_path)
                if os.path.exists(full_path):
                    os.remove(full_path)
                    return True
            except Exception as e:
                print(f"Failed to delete physical file {file_path}: {e}")
            return False

        if tenant_id is None:
            return False
        try:
            from core.services.file.storage.resolver import (
                SUPPORTED_OBJECT_STORAGE_TYPES,
                load_object_storage,
            )

            if backend_name not in SUPPORTED_OBJECT_STORAGE_TYPES:
                return False
            if not storage_connection_uuid:
                return False
            storage = await load_object_storage(tenant_id, storage_connection_uuid)
            return await storage.delete(file_path)
        except Exception as e:
            print(f"Failed to delete remote file {file_path}: {e}")
            return False

    @staticmethod
    async def _put_local_file_to_object_storage(
        remote,
        dest_key: str,
        abs_path: str,
        content_type: Optional[str],
        target_bucket: Optional[str],
    ) -> int:
        """不分格式、不分大小：从磁盘上传到对象存储，HEAD 校验字节数后才视为成功。"""
        local_size = os.path.getsize(abs_path)
        await remote.put_file(dest_key, abs_path, content_type=content_type)
        remote_size = await remote.head_content_length(dest_key)
        if remote_size is None:
            raise ValidationError(
                f"上传后对象不存在（bucket={target_bucket or '未知'} key={dest_key}）"
            )
        if remote_size != local_size:
            raise ValidationError(
                f"上传后对象大小不一致（bucket={target_bucket or '未知'} key={dest_key} "
                f"本地={local_size} 远端={remote_size}），未删除本地文件"
            )
        return local_size

    @staticmethod
    async def _put_local_file_to_cos(
        cos,
        dest_key: str,
        abs_path: str,
        content_type: Optional[str],
        target_bucket: Optional[str],
    ) -> int:
        """兼容旧名：同 _put_local_file_to_object_storage。"""
        return await FileService._put_local_file_to_object_storage(
            cos, dest_key, abs_path, content_type, target_bucket,
        )

    @staticmethod
    async def _migrate_local_tiers_for_uuid(
        *,
        remote,
        local,
        file_uuid: str,
        key_prefix: str,
        delete_local: bool,
        dry_run: bool,
        target_bucket: Optional[str],
        cos=None,
    ) -> int:
        from core.services.file.image_tier_service import IMAGE_TIER_SIZES
        from core.services.file.storage import apply_key_prefix

        storage = remote if remote is not None else cos
        moved = 0
        for size in IMAGE_TIER_SIZES:
            rel = ImageTierService.tier_relative_key(file_uuid, size)
            if not await local.exists(rel):
                continue
            dest_key = apply_key_prefix(key_prefix, rel)
            abs_path = os.path.join(local.upload_dir, rel)
            if dry_run:
                moved += 1
                continue
            if await storage.exists(dest_key):
                remote_size = await storage.head_content_length(dest_key)
                if remote_size == os.path.getsize(abs_path):
                    if delete_local:
                        await local.delete(rel)
                    moved += 1
                    continue
            content_type = ImageTierService.sniff_local_image_content_type(abs_path)
            await FileService._put_local_file_to_object_storage(
                storage, dest_key, abs_path, content_type, target_bucket,
            )
            if delete_local:
                await local.delete(rel)
            moved += 1
        return moved

    @staticmethod
    async def _migrate_leftover_local_tiers(
        *,
        tenant_id: int,
        remote,
        local,
        key_prefix: str,
        delete_local: bool,
        dry_run: bool,
        target_bucket: Optional[str],
        failures: List[Dict[str, str]],
        cos=None,
    ) -> Tuple[int, int]:
        """已标记对象存储的文件若仍留着本机档位，一并上传后删除。"""
        from core.services.file.storage.resolver import SUPPORTED_OBJECT_STORAGE_TYPES

        storage = remote if remote is not None else cos
        thumb_dir = os.path.join(FileService.UPLOAD_DIR, "thumbnails")
        if not os.path.isdir(thumb_dir):
            return 0, 0

        migrated = 0
        failed = 0
        seen_uuids: set[str] = set()
        names = sorted(os.listdir(thumb_dir))
        for name in names:
            parsed = ImageTierService.parse_local_tier_filename(name)
            if not parsed:
                continue
            file_uuid, _size = parsed
            if file_uuid in seen_uuids:
                continue
            seen_uuids.add(file_uuid)
            row = await File.filter(
                tenant_id=tenant_id,
                uuid=file_uuid,
                deleted_at__isnull=True,
            ).first()
            if not row:
                continue
            backend = str(getattr(row, "storage_backend", None) or "local").strip().lower()
            if backend not in SUPPORTED_OBJECT_STORAGE_TYPES:
                continue
            file_prefix = await ImageTierService.key_prefix_for_file(tenant_id, row)
            prefix = file_prefix or key_prefix
            try:
                moved = await FileService._migrate_local_tiers_for_uuid(
                    remote=storage,
                    local=local,
                    file_uuid=file_uuid,
                    key_prefix=prefix,
                    delete_local=delete_local,
                    dry_run=dry_run,
                    target_bucket=target_bucket,
                )
                migrated += moved
            except Exception as e:
                failed += 1
                failures.append({"uuid": file_uuid, "reason": f"图片档位迁移失败: {str(e)[:180]}"})
        return migrated, failed

    @staticmethod
    async def migrate_local_files_to_object_storage(
        tenant_id: int,
        *,
        connection_uuid: Optional[str] = None,
        dry_run: bool = False,
        cursor: int = 0,
        limit: int = 50,
    ) -> Dict[str, Any]:
        """
        将本租户本地文件分页迁移到所选对象存储连接（腾讯 COS / MinIO）。

        不论格式、不论大小；原文件与同 uuid 的图片档位一并上传。
        HEAD 校验字节数成功后才更新元数据、才删除本地原文件与档位。
        """
        from core.services.file.storage import (
            apply_key_prefix,
            get_file_storage_settings,
        )
        from core.services.file.storage.local import LocalFileStorage
        from core.services.file.storage.resolver import load_object_storage

        cfg = await get_file_storage_settings(tenant_id)
        target_uuid = (connection_uuid or cfg.get("connection_uuid") or "").strip()
        if not target_uuid:
            raise ValidationError("请先在文件存储设置中选择对象存储连接")

        remote = await load_object_storage(tenant_id, target_uuid)
        local = LocalFileStorage()
        key_prefix = cfg.get("key_prefix") or ""
        delete_local = cfg.get("delete_local_after_migrate") is not False
        target_bucket = str((getattr(remote, "config", None) or {}).get("bucket") or "").strip() or None
        target_endpoint = getattr(remote, "base_url", None) or None
        storage_backend_name = str(getattr(remote, "backend_name", None) or "tencent_cos")

        # 首批真实迁移前做写探测，避免「连接测试通过但无写权限 / 桶不一致」仍批跑完
        safe_cursor = max(0, int(cursor or 0))
        if not dry_run and safe_cursor == 0:
            probe_key = apply_key_prefix(key_prefix, f"_riveredge_migrate_probe/{tenant_id}.txt")
            probe_body = b"riveredge-object-storage-migrate-probe"
            await remote.put(probe_key, probe_body, content_type="text/plain")
            if not await remote.exists(probe_key):
                raise ValidationError(
                    f"已写入对象存储但无法通过 HEAD 读回（桶={target_bucket or '未知'}）。"
                    "请核对 Endpoint、Bucket、密钥与写权限。"
                )
            await remote.delete(probe_key)

        local_q = File.filter(
            tenant_id=tenant_id,
            deleted_at__isnull=True,
        ).filter(Q(storage_backend="local") | Q(storage_backend__isnull=True) | Q(storage_backend=""))

        total = await local_q.count()
        safe_limit = max(1, min(int(limit or 50), 100))
        # id 游标：迁移成功后记录离开 local 集合，不可用 offset（会跳过剩余行）
        rows = await local_q.filter(id__gt=safe_cursor).order_by("id").limit(safe_limit).all()

        migrated = 0
        skipped = 0
        failed = 0
        failures: List[Dict[str, str]] = []

        for row in rows:
            try:
                abs_path, corrected = FileService.resolve_physical_file_path(tenant_id, row.file_path)
                source_key = corrected or row.file_path
                if not abs_path:
                    failed += 1
                    failures.append({
                        "uuid": str(row.uuid),
                        "reason": (
                            "本地文件不存在（仅能迁移当前环境磁盘上的文件；"
                            f"UPLOAD_DIR={FileService.UPLOAD_DIR}，path={source_key}）"
                        ),
                    })
                    continue

                dest_key = apply_key_prefix(key_prefix, source_key)
                if dry_run:
                    await FileService._migrate_local_tiers_for_uuid(
                        remote=remote,
                        local=local,
                        file_uuid=str(row.uuid),
                        key_prefix=key_prefix,
                        delete_local=False,
                        dry_run=True,
                        target_bucket=target_bucket,
                    )
                    migrated += 1
                    continue

                await FileService._put_local_file_to_object_storage(
                    remote, dest_key, abs_path, row.file_type, target_bucket,
                )
                await File.filter(id=row.id).update(
                    storage_backend=storage_backend_name,
                    storage_connection_uuid=target_uuid,
                    file_path=dest_key,
                )
                await FileService._migrate_local_tiers_for_uuid(
                    remote=remote,
                    local=local,
                    file_uuid=str(row.uuid),
                    key_prefix=key_prefix,
                    delete_local=delete_local,
                    dry_run=False,
                    target_bucket=target_bucket,
                )
                if delete_local:
                    await local.delete(source_key)
                migrated += 1
            except Exception as e:
                failed += 1
                failures.append({"uuid": str(row.uuid), "reason": str(e)[:200]})

        next_cursor = int(rows[-1].id) if rows else safe_cursor
        originals_exhausted = len(rows) == 0 or len(rows) < safe_limit
        if originals_exhausted:
            leftover_ok, leftover_fail = await FileService._migrate_leftover_local_tiers(
                tenant_id=tenant_id,
                remote=remote,
                local=local,
                key_prefix=key_prefix,
                delete_local=delete_local,
                dry_run=dry_run,
                target_bucket=target_bucket,
                failures=failures,
            )
            migrated += leftover_ok
            failed += leftover_fail

        return {
            "total": total,
            "cursor": safe_cursor,
            "next_cursor": next_cursor,
            "limit": safe_limit,
            "done": originals_exhausted,
            "migrated": migrated,
            "skipped": skipped,
            "failed": failed,
            "failures": failures,
            "dry_run": dry_run,
            "connection_uuid": target_uuid,
            "target_bucket": target_bucket,
            "target_endpoint": target_endpoint,
            "storage_backend": storage_backend_name,
        }

    @staticmethod
    async def migrate_local_files_to_cos(
        tenant_id: int,
        *,
        connection_uuid: Optional[str] = None,
        dry_run: bool = False,
        cursor: int = 0,
        limit: int = 50,
    ) -> Dict[str, Any]:
        """兼容旧名：迁移到所选对象存储连接。"""
        return await FileService.migrate_local_files_to_object_storage(
            tenant_id,
            connection_uuid=connection_uuid,
            dry_run=dry_run,
            cursor=cursor,
            limit=limit,
        )

