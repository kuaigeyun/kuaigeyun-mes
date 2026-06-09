"""
文件管理 API 路由

提供文件的 CRUD 操作、上传、下载、预览等功能。
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File as FastAPIFile, Request, Header, Form
from fastapi.responses import FileResponse, StreamingResponse

from core.schemas.file import (
    FileCreate,
    FileUpdate,
    FileResponse,
    FileListResponse,
    FilePreviewResponse,
    FileUploadResponse,
)
from core.services.file.file_service import FileService
from core.services.file.file_preview_service import FilePreviewService
from core.api.deps.deps import get_current_tenant
from core.api.deps.access import AuthContext, require_access
from core.api.deps.file_upload_access import require_file_upload_access
from infra.api.deps.deps import get_current_user
from infra.models.user import User
from infra.exceptions.exceptions import NotFoundError, ValidationError
from loguru import logger

router = APIRouter(prefix="/files", tags=["Core · Files"])


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
                size=128, # 使用 128px 缩略图加速加载
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
        
        # 获取文件内容
        file_content = await FileService.get_file_content(tenant_id, uuid)
        
        # 缩略图：仅图片且指定 size 时，返回缩放后的图片
        # PNG 透明图保留透明通道输出 PNG，避免白底；其他输出 JPEG
        file_type = file.file_type or "application/octet-stream"
        # 缩略图：仅图片且指定 size 时，通过磁盘缓存或实时生成返回缩放后的图片
        if size and file_type.startswith("image/"):
            try:
                from io import BytesIO
                from PIL import Image
                import os
                
                # 磁盘缓存路径逻辑
                thumb_cache_dir = os.path.join(FS.UPLOAD_DIR, "thumbnails")
                os.makedirs(thumb_cache_dir, exist_ok=True)
                thumb_cache_path = os.path.join(thumb_cache_dir, f"{uuid}_{size}.bin")
                
                # 1. 尝试命中缓存
                if os.path.exists(thumb_cache_path):
                    with open(thumb_cache_path, "rb") as f:
                        thumb_bytes = f.read()
                    # 根据原始类型决定返回格式（简单起见，缓存中存原始 bytes，输出头保持一致）
                    is_png = file_type == "image/png"
                    return StreamingResponse(
                        iter([thumb_bytes]),
                        media_type="image/png" if is_png else "image/jpeg",
                        headers={
                            "Content-Disposition": f"inline; filename=\"thumb_{size}.{'png' if is_png else 'jpg'}\"",
                            "Content-Length": str(len(thumb_bytes)),
                            "Cache-Control": "public, max-age=86400",
                            "X-Cache": "HIT" # 标记命中缓存
                        },
                    )

                # 2. 缓存未命中，实时生成
                img = Image.open(BytesIO(file_content))
                has_alpha = img.mode in ("RGBA", "LA", "P")
                if has_alpha:
                    img = img.convert("RGBA")
                    img.thumbnail((size, size), Image.Resampling.LANCZOS)
                    buf = BytesIO()
                    img.save(buf, format="PNG", optimize=True)
                    thumb_bytes = buf.getvalue()
                    # 写入缓存
                    with open(thumb_cache_path, "wb") as f:
                        f.write(thumb_bytes)
                    return StreamingResponse(
                        iter([thumb_bytes]),
                        media_type="image/png",
                        headers={
                            "Content-Disposition": "inline; filename=\"thumb.png\"",
                            "Content-Length": str(len(thumb_bytes)),
                            "Cache-Control": "public, max-age=86400",
                            "X-Cache": "MISS"
                        },
                    )
                else:
                    if img.mode == "P":
                        img = img.convert("RGB")
                    elif img.mode not in ("RGB", "L"):
                        img = img.convert("RGB")
                    img.thumbnail((size, size), Image.Resampling.LANCZOS)
                    buf = BytesIO()
                    img.save(buf, format="JPEG", quality=85, optimize=True)
                    thumb_bytes = buf.getvalue()
                    # 写入缓存
                    with open(thumb_cache_path, "wb") as f:
                        f.write(thumb_bytes)
                    return StreamingResponse(
                        iter([thumb_bytes]),
                        media_type="image/jpeg",
                        headers={
                            "Content-Disposition": "inline; filename=\"thumb.jpg\"",
                            "Content-Length": str(len(thumb_bytes)),
                            "Cache-Control": "public, max-age=86400",
                            "X-Cache": "MISS"
                        },
                    )
            except Exception as e:
                logger.warning(f"缩略图生成失败，回退原图: {e}")
                pass
        
        # 构建完整路径（用于获取文件类型）
        import os
        from core.services.file.file_service import FileService as FS
        full_path = os.path.join(FS.UPLOAD_DIR, file.file_path)
        
        # 处理文件名编码（支持中文文件名）
        # 使用 RFC 5987 格式编码文件名，避免 latin-1 编码错误
        from urllib.parse import quote
        
        # 根据文件类型决定是预览（inline）还是下载（attachment）
        # 图片文件使用 inline，让浏览器直接预览；其他文件使用 attachment，触发下载
        disposition_type = "inline" if file_type.startswith("image/") else "attachment"
        
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
                "Content-Length": str(file.file_size),
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

