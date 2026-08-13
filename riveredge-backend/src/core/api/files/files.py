"""
文件管理 API 路由

提供文件的 CRUD 操作、上传、下载、预览等功能。
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File as FastAPIFile, Request, Header, Form
from fastapi.responses import StreamingResponse

from core.schemas.file import (
    FileCreate,
    FileUpdate,
    FileResponse,
    FileListResponse,
    FilePreviewResponse,
    FileUploadResponse,
    ImageTierBackfillResponse,
    FileStorageSettings,
    FileStorageMigrateRequest,
    FileStorageMigrateResponse,
)
from core.services.file.file_service import FileService
from core.services.file.file_preview_service import FilePreviewService
from core.services.file.file_preview_markup_service import FilePreviewMarkupService
from core.services.file.image_tier_service import ImageTierService, IMAGE_TIER_THUMB_SIZE
from core.services.file.storage import (
    get_file_storage_settings,
    save_file_storage_settings,
)
from core.schemas.file_preview_markup import (
    FilePreviewMarkupResponse,
    FilePreviewMarkupSaveRequest,
)
from core.api.deps.deps import get_current_tenant
from core.api.deps.access import AuthContext, require_access
from core.api.deps.file_upload_access import require_file_upload_access
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError
from loguru import logger

router = APIRouter(prefix="/files", tags=["Core - Files"])


@router.post("/upload", response_model=FileUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = FastAPIFile(...),
    category: Optional[str] = Query(None, description="文件分类（可选）"),
    tags: Optional[str] = Query(None, description="文件标签（JSON数组字符串，可选）"),
    description: Optional[str] = Query(None, description="文件描述（可选）"),
    _auth: AuthContext = Depends(require_file_upload_access()),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    上传文件（单文件）
    
    上传单个文件并保存到服务器。
    
    Args:
        file: 上传的文件
        category: 文件分类（可选）
        tags: 文件标签（JSON数组字符串，可选）
        description: 文件描述（可选）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        FileUploadResponse: 上传的文件信息
        
    Raises:
        HTTPException: 当文件上传失败时抛出
    """
    try:
        # 读取文件内容
        file_content = await file.read()
        
        # 处理中文文件名编码
        # FastAPI 的 UploadFile.filename 可能包含 RFC 2231 编码的中文文件名
        # 需要正确解码，确保中文文件名能正确保存
        original_filename = file.filename or "unknown"
        if original_filename:
            # 尝试解码 RFC 2231 格式的文件名（filename*=UTF-8''...）
            from urllib.parse import unquote
            try:
                # 如果文件名是 RFC 2231 格式，提取并解码
                if "filename*=" in original_filename:
                    # 格式：filename*=UTF-8''encoded_name
                    parts = original_filename.split("filename*=", 1)
                    if len(parts) > 1:
                        encoded_part = parts[1].split(";")[0].strip()
                        if encoded_part.startswith("UTF-8''"):
                            encoded_name = encoded_part[7:]  # 移除 "UTF-8''" 前缀
                            original_filename = unquote(encoded_name)
                # 如果文件名包含 URL 编码，尝试解码
                elif "%" in original_filename:
                    original_filename = unquote(original_filename)
            except Exception as e:
                # 如果解码失败，使用原始文件名
                logger.warning(f"文件名解码失败，使用原始文件名: {e}")
        
        # 解析标签（如果是JSON字符串）
        tags_list = None
        if tags:
            import json
            try:
                tags_list = json.loads(tags)
            except json.JSONDecodeError:
                tags_list = [tags]  # 如果不是JSON，当作单个标签
        
        # 保存文件
        file_obj = await FileService.save_uploaded_file(
            tenant_id=tenant_id,
            file_content=file_content,
            original_name=original_filename,
            category=category,
            tags=tags_list,
            description=description,
        )
        
        return FileUploadResponse(
            uuid=file_obj.uuid,
            name=file_obj.name,
            original_name=file_obj.original_name,
            file_size=file_obj.file_size,
            file_type=file_obj.file_type,
            file_extension=file_obj.file_extension,
            file_path=file_obj.file_path,
        )
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文件上传失败: {str(e)}"
        )


@router.post("/upload/multiple", response_model=List[FileUploadResponse], status_code=status.HTTP_201_CREATED)
async def upload_multiple_files(
    files: List[UploadFile] = FastAPIFile(...),
    category: Optional[str] = Query(None, description="文件分类（可选）"),
    category_from_form: Optional[str] = Form(None, alias="category"),
    _auth: AuthContext = Depends(require_file_upload_access()),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    上传文件（多文件）
    
    上传多个文件并保存到服务器。
    
    Args:
        files: 上传的文件列表
        category: 文件分类（可选）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        List[FileUploadResponse]: 上传的文件信息列表
    """
    results = []
    resolved_category = (category or category_from_form or "").strip() or None
    for file in files:
        try:
            # 读取文件内容
            file_content = await file.read()
            
            # 处理中文文件名编码（与单文件上传保持一致）
            original_filename = file.filename or "unknown"
            if original_filename:
                from urllib.parse import unquote
                try:
                    # 尝试解码 RFC 2231 格式的文件名
                    if "filename*=" in original_filename:
                        parts = original_filename.split("filename*=", 1)
                        if len(parts) > 1:
                            encoded_part = parts[1].split(";")[0].strip()
                            if encoded_part.startswith("UTF-8''"):
                                encoded_name = encoded_part[7:]
                                original_filename = unquote(encoded_name)
                    # 如果文件名包含 URL 编码，尝试解码
                    elif "%" in original_filename:
                        original_filename = unquote(original_filename)
                except Exception as e:
                    logger.warning(f"文件名解码失败，使用原始文件名: {e}")
            
            # 保存文件
            file_obj = await FileService.save_uploaded_file(
                tenant_id=tenant_id,
                file_content=file_content,
                original_name=original_filename,
                category=resolved_category,
            )
            
            results.append(FileUploadResponse(
                uuid=file_obj.uuid,
                name=file_obj.name,
                original_name=file_obj.original_name,
                file_size=file_obj.file_size,
                file_type=file_obj.file_type,
                file_extension=file_obj.file_extension,
                file_path=file_obj.file_path,
            ))
        except Exception as e:
            # 单个文件上传失败，继续处理其他文件
            continue
    
    return results


@router.get("", response_model=FileListResponse)
async def list_files(
    page: int = Query(1, ge=1, description="页码（从1开始）"),
    page_size: int = Query(20, ge=1, le=1000, description="每页数量（最大1000，用于文件管理器一次性加载）"),
    search: Optional[str] = Query(None, description="搜索关键词（搜索文件名、原始文件名）"),
    category: Optional[str] = Query(None, description="文件分类筛选"),
    file_type: Optional[str] = Query(None, description="文件类型筛选"),
    include_preview_url: bool = Query(False, description="是否包含预览URL（缩略图）"),
    _auth: object = Depends(require_access("system.file", "read")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取文件列表（分页、搜索、筛选）
    
    获取当前组织的文件列表，支持分页、搜索和筛选。
    
    Args:
        page: 页码（从1开始）
        page_size: 每页数量（最大100）
        search: 搜索关键词（搜索文件名、原始文件名）
        category: 文件分类筛选
        file_type: 文件类型筛选
        include_preview_url: 是否包含预览URL（缩略图）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        FileListResponse: 文件列表（分页）
    """
    result = await FileService.list_files(
        tenant_id=tenant_id,
        page=page,
        page_size=page_size,
        search=search,
        category=category,
        file_type=file_type,
    )
    
    non_empty_attachment_categories = None
    if category is None:
        non_empty_attachment_categories = await FileService.collect_nonempty_attachment_categories(
            tenant_id=tenant_id,
        )
    
    items = []
    from core.services.file.file_preview_service import FilePreviewService
    for file in result["items"]:
        file_dict = FileResponse.model_validate(file).model_dump()
        if include_preview_url and file.file_type and file.file_type.startswith("image/"):
            # 优化：直接生成预览 URL，避免 get_preview_info 内部再次查询数据库 (N+1问题修复)
            preview_url = await FilePreviewService.generate_simple_preview_url(
                file_uuid=file.uuid,
                tenant_id=tenant_id,
                size=IMAGE_TIER_THUMB_SIZE,
            )
            file_dict["preview_url"] = preview_url
        items.append(file_dict)
    
    return FileListResponse(
        items=items,
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
        non_empty_attachment_categories=non_empty_attachment_categories,
    )


@router.post("/image-tiers/backfill", response_model=ImageTierBackfillResponse)
async def backfill_image_tiers(
    limit: int = Query(50, ge=1, le=200, description="每批处理数量"),
    offset: int = Query(0, ge=0, description="偏移量"),
    category: Optional[str] = Query(None, description="仅处理指定分类"),
    force: bool = Query(False, description="强制重新生成已有档位"),
    _auth: object = Depends(require_access("system.file", "update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    存量图片三档压缩：为已有图片在其所属存储（本地或 COS）生成缩略图(64)与预览图(512)。
    前端可循环调用直至 done=true。
    """
    result = await ImageTierService.backfill_image_tiers(
        tenant_id=tenant_id,
        limit=limit,
        offset=offset,
        category=category,
        force=force,
    )
    return ImageTierBackfillResponse(**result)


@router.get("/storage-settings", response_model=FileStorageSettings)
async def get_storage_settings(
    _auth: object = Depends(require_access("system.file", "read")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取当前租户文件存储位置设置（本环境）。"""
    cfg = await get_file_storage_settings(tenant_id)
    return FileStorageSettings(**cfg)


@router.put("/storage-settings", response_model=FileStorageSettings)
async def put_storage_settings(
    data: FileStorageSettings,
    _auth: object = Depends(require_access("system.file", "update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """保存文件存储位置设置；connection 时须为本租户启用中的对象存储连接（COS / MinIO）。"""
    try:
        cfg = await save_file_storage_settings(tenant_id, data.model_dump())
        return FileStorageSettings(**cfg)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.post("/storage-migrate", response_model=FileStorageMigrateResponse)
async def migrate_storage_to_object_storage(
    data: FileStorageMigrateRequest,
    _auth: object = Depends(require_access("system.file", "update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    将本环境本地文件分页迁移到所选对象存储（腾讯 COS / MinIO，含图片档位）。
    前端循环调用直至 done=true；不跨环境代迁。
    """
    try:
        result = await FileService.migrate_local_files_to_object_storage(
            tenant_id,
            connection_uuid=data.connection_uuid,
            dry_run=data.dry_run,
            cursor=data.cursor,
            limit=data.limit,
        )
        return FileStorageMigrateResponse(**result)
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e


@router.get("/{uuid}", response_model=FileResponse)
async def get_file(
    uuid: str,
    _auth: object = Depends(require_access("system.file", "read")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取文件详情
    
    根据UUID获取文件的详细信息。
    
    Args:
        uuid: 文件UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        FileResponse: 文件对象
        
    Raises:
        HTTPException: 当文件不存在时抛出
    """
    try:
        file = await FileService.get_file_by_uuid(
            tenant_id=tenant_id,
            uuid=uuid
        )
        return FileResponse.model_validate(file)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/{uuid}/download")
async def download_file(
    uuid: str,
    request: Request,
    token: Optional[str] = Query(None, description="预览token（用于权限验证）"),
    access_token: Optional[str] = Query(None, description="标准访问令牌（Bearer Token），用于鉴权"),
    x_tenant_id: Optional[str] = Header(None, alias="X-Tenant-ID"),
    size: Optional[int] = Query(None, ge=16, le=512, description="缩略图边长（像素），仅图片有效，用于头像等场景"),
):
    from loguru import logger
    logger.info(f"🔍 download_file 请求: uuid={uuid}, token={token[:50] if token else 'None'}..., access_token={access_token[:50] if access_token else 'None'}..., x_tenant_id={x_tenant_id}")
    """
    下载文件
    
    根据UUID下载文件。如果提供了token，会验证token权限并从token中提取tenant_id。
    如果没有token，则从请求头获取tenant_id。
    
    Args:
        uuid: 文件UUID
        token: 预览token（用于权限验证，可选）
        access_token: 标准访问令牌（Bearer Token，用于鉴权，可选）
        request: FastAPI Request 对象
        x_tenant_id: 从请求头获取的组织ID（可选）
        
    Returns:
        StreamingResponse: 文件流
        
    Raises:
        HTTPException: 当文件不存在或token无效时抛出
    """
    try:
        # ⚠️ 关键修复：如果提供了token，从token中提取tenant_id
        tenant_id = None
        from loguru import logger
        logger.debug(f"🔍 download_file 调试: token={token[:50] if token else None}..., access_token={access_token[:50] if access_token else None}..., x_tenant_id={x_tenant_id}, uuid={uuid}")

        # 1. 尝试验证标准 access_token
        if access_token:
            from infra.domain.security.security import verify_token
            try:
                payload = verify_token(access_token)
                if payload:
                    tenant_id = payload.get("tenant_id")
                    logger.debug(f"✅ 从 access_token 提取 tenant_id: {tenant_id}")
            except Exception as e:
                logger.error(f"❌ Access Token 验证失败: {e}")

        # 2. 如果没有获取到 tenant_id，尝试验证预览 token
        # 根本解决 403：增强 Token 解析的容错性，处理可能存在的引号或编码问题
        if token:
            token = token.strip().strip('"').strip("'")
            try:
                payload = FilePreviewService.verify_preview_token(token)
                logger.debug(f"✅ Token 验证成功: payload={payload}")
                
                # 1. 提取租户 ID
                tenant_id = payload.get("tenant_id")
                
                # 2. 根本解决：UUID 校验增加大小写容错
                token_uuid = str(payload.get("file_uuid") or "").lower()
                request_uuid = str(uuid).lower()
                
                if token_uuid != request_uuid:
                    logger.error(f"❌ 文件UUID不匹配: token_uuid={token_uuid}, request_uuid={request_uuid}")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="无权限访问该文件"
                    )
            except ValueError as e:
                logger.error(f"❌ Token 验证失败: {e}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=str(e)
                )
        
        # 如果没有token或token中没有tenant_id，从请求头获取
        if tenant_id is None:
            logger.debug("⚠️ Token 中没有 tenant_id，尝试从请求头获取")
            if x_tenant_id:
                try:
                    tenant_id = int(x_tenant_id)
                    logger.debug(f"✅ 从请求头获取 tenant_id: {tenant_id}")
                except ValueError:
                    logger.error(f"❌ 无效的组织ID: {x_tenant_id}")
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="无效的组织ID"
                    )
            else:
                # 如果没有token也没有请求头，抛出错误
                logger.error("❌ 组织上下文未设置：没有token也没有X-Tenant-ID请求头")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="组织上下文未设置（请提供token或X-Tenant-ID请求头）"
                )

        logger.debug(f"🎯 最终 tenant_id: {tenant_id}, 将查询文件 uuid: {uuid}")
        
        # 获取文件
        file = await FileService.get_file_by_uuid(tenant_id, uuid)

        # 图片档位与原文件同一存储后端（本地或 COS），禁止本机 sidecar 旁路 COS。
        if size and ImageTierService.is_tier_eligible_image(file.file_type, file.file_extension):
            tier_response = await ImageTierService.streaming_response_for_tier(
                tenant_id, file, size,
            )
            if tier_response is not None:
                return tier_response

        file_content = await FileService.get_file_content(tenant_id, uuid)
        file_type = FileService.resolve_download_media_type(file, file_content)

        # 处理文件名编码（支持中文文件名）
        # 使用 RFC 5987 格式编码文件名，避免 latin-1 编码错误
        from urllib.parse import quote
        
        # 浏览器可预览的类型用 inline（PDF/文本/音视频/CAD/图片）；其余才 attachment。
        # 同一条 download 也被预览 iframe/fetch 使用，一律 attachment 会导致 PDF/视频无法内嵌。
        previewable = FilePreviewService._is_simple_preview_supported(
            file.file_type, file.file_extension
        )
        disposition_type = "inline" if previewable or file_type.startswith("image/") else "attachment"
        
        # 检查文件名是否包含非 ASCII 字符
        try:
            # 尝试将文件名编码为 latin-1，如果失败说明包含非 ASCII 字符
            file.original_name.encode('latin-1')
            # 如果成功，文件名只包含 ASCII 字符，可以直接使用
            content_disposition = f'{disposition_type}; filename="{file.original_name}"'
        except UnicodeEncodeError:
            # 如果包含非 ASCII 字符，使用 RFC 5987 格式
            encoded_filename = quote(file.original_name, safe='')
            # 对于非 ASCII 文件名，只使用 filename*=UTF-8''... 格式，避免 latin-1 编码错误
            content_disposition = f'{disposition_type}; filename*=UTF-8\'\'{encoded_filename}'
        
        # 返回文件流
        return StreamingResponse(
            iter([file_content]),
            media_type=file_type,
            headers={
                "Content-Disposition": content_disposition,
                "Content-Length": str(len(file_content)),
            }
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/{uuid}/preview", response_model=FilePreviewResponse)
async def get_file_preview(
    uuid: str,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
    for_avatar: bool = Query(False, description="头像场景：返回 128px 缩略图 URL"),
    size: Optional[int] = Query(None, ge=16, le=512, description="缩略图边长（像素），仅图片有效；不传则原图"),
):
    """
    获取文件预览信息
    
    返回带 token 的下载 URL，由浏览器直接预览（图片/PDF/音视频等）。
    for_avatar=True 时为头像场景附加 128px 缩略图；显式 size 优先于 for_avatar。
    
    Args:
        uuid: 文件UUID
        tenant_id: 当前组织ID（依赖注入）
        for_avatar: 是否用于头像展示（128px 缩略图）
        size: 缩略图边长（可选，16–512）
        
    Returns:
        FilePreviewResponse: 预览信息
        
    Raises:
        HTTPException: 当文件不存在时抛出
    """
    try:
        preview_info = await FilePreviewService.get_preview_info(
            file_uuid=uuid,
            tenant_id=tenant_id,
            force_simple_for_image=for_avatar,
            thumbnail_size=size,
        )
        return FilePreviewResponse(**preview_info)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/{uuid}/preview-markup", response_model=FilePreviewMarkupResponse)
async def get_file_preview_markup(
    uuid: str,
    scope: str = Query("default", description="批注视图范围：default / top / bottom"),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """获取文件预览批注（与源 CAD/PCB 文件分离存储）。"""
    try:
        result = await FilePreviewMarkupService.get_markup(
            tenant_id=tenant_id,
            file_uuid=uuid,
            scope=scope,
        )
        return FilePreviewMarkupResponse(**result)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.put("/{uuid}/preview-markup", response_model=FilePreviewMarkupResponse)
async def save_file_preview_markup(
    uuid: str,
    data: FilePreviewMarkupSaveRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """保存文件预览批注（不修改源文件二进制）。"""
    try:
        payload = data.payload.model_dump(by_alias=True)
        result = await FilePreviewMarkupService.save_markup(
            tenant_id=tenant_id,
            file_uuid=uuid,
            payload=payload,
            scope=data.scope,
            updated_by=current_user.id,
        )
        return FilePreviewMarkupResponse(**result)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))


@router.put("/{uuid}", response_model=FileResponse)
async def update_file(
    uuid: str,
    data: FileUpdate,
    _auth: object = Depends(require_access("system.file", "update")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    更新文件信息
    
    更新文件的名称、分类、标签、描述等信息。
    
    Args:
        uuid: 文件UUID
        data: 文件更新数据
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        FileResponse: 更新后的文件对象
        
    Raises:
        HTTPException: 当文件不存在时抛出
    """
    try:
        file = await FileService.update_file(
            tenant_id=tenant_id,
            uuid=uuid,
            data=data
        )
        return FileResponse.model_validate(file)
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.delete("/{uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    uuid: str,
    _auth: object = Depends(require_access("system.file", "delete")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    删除文件（软删除）
    
    根据UUID删除文件（软删除，不会物理删除文件）。
    
    Args:
        uuid: 文件UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Raises:
        HTTPException: 当文件不存在时抛出
    """
    try:
        await FileService.delete_file(
            tenant_id=tenant_id,
            uuid=uuid
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/batch-delete", status_code=status.HTTP_200_OK)
async def batch_delete_files(
    uuids: List[str],
    _auth: object = Depends(require_access("system.file", "delete")),
    current_user: User = Depends(get_current_user),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    批量删除文件（软删除）
    
    根据UUID列表批量删除文件（软删除，不会物理删除文件）。
    
    Args:
        uuids: 文件UUID列表
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        Dict[str, Any]: 删除结果（包含删除数量）
    """
    count = await FileService.batch_delete_files(
        tenant_id=tenant_id,
        uuids=uuids
    )
    return {"deleted_count": count}

