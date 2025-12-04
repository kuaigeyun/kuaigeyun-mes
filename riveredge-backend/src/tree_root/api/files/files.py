"""
文件管理 API 路由

提供文件的 CRUD 操作、上传、下载、预览等功能。
"""

from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File as FastAPIFile
from fastapi.responses import FileResponse, StreamingResponse

from tree_root.schemas.file import (
    FileCreate,
    FileUpdate,
    FileResponse,
    FileListResponse,
    FilePreviewResponse,
    FileUploadResponse,
)
from tree_root.services.file_service import FileService
from tree_root.services.file_preview_service import FilePreviewService
from tree_root.api.deps.deps import get_current_tenant
from soil.exceptions.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/files", tags=["Files"])


@router.post("/upload", response_model=FileUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = FastAPIFile(...),
    category: Optional[str] = Query(None, description="文件分类（可选）"),
    tags: Optional[str] = Query(None, description="文件标签（JSON数组字符串，可选）"),
    description: Optional[str] = Query(None, description="文件描述（可选）"),
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
            original_name=file.filename or "unknown",
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
    for file in files:
        try:
            # 读取文件内容
            file_content = await file.read()
            
            # 保存文件
            file_obj = await FileService.save_uploaded_file(
                tenant_id=tenant_id,
                file_content=file_content,
                original_name=file.filename or "unknown",
                category=category,
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
    
    return FileListResponse(
        items=[FileResponse.model_validate(file) for file in result["items"]],
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
    )


@router.get("/{uuid}", response_model=FileResponse)
async def get_file(
    uuid: str,
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
    token: Optional[str] = Query(None, description="预览token（用于权限验证）"),
    tenant_id: int = Depends(get_current_tenant),
):
    """
    下载文件
    
    根据UUID下载文件。如果提供了token，会验证token权限。
    
    Args:
        uuid: 文件UUID
        token: 预览token（用于权限验证，可选）
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        StreamingResponse: 文件流
        
    Raises:
        HTTPException: 当文件不存在或token无效时抛出
    """
    try:
        # 如果提供了token，验证token
        if token:
            try:
                payload = await FilePreviewService.verify_preview_token(token)
                # 验证文件UUID和组织ID是否匹配
                if payload.get("file_uuid") != uuid or payload.get("tenant_id") != tenant_id:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="无权限访问该文件"
                    )
            except ValueError as e:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=str(e)
                )
        
        # 获取文件
        file = await FileService.get_file_by_uuid(tenant_id, uuid)
        
        # 获取文件内容
        file_content = await FileService.get_file_content(tenant_id, uuid)
        
        # 构建完整路径（用于获取文件类型）
        import os
        from tree_root.services.file_service import FileService as FS
        full_path = os.path.join(FS.UPLOAD_DIR, file.file_path)
        
        # 返回文件流
        return StreamingResponse(
            iter([file_content]),
            media_type=file.file_type or "application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{file.original_name}"',
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
    tenant_id: int = Depends(get_current_tenant),
):
    """
    获取文件预览信息
    
    根据配置返回简单预览或 kkFileView 预览URL。
    
    Args:
        uuid: 文件UUID
        tenant_id: 当前组织ID（依赖注入）
        
    Returns:
        FilePreviewResponse: 预览信息
        
    Raises:
        HTTPException: 当文件不存在时抛出
    """
    try:
        preview_info = await FilePreviewService.get_preview_info(
            file_uuid=uuid,
            tenant_id=tenant_id,
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


@router.get("/kkfileview/health")
async def check_kkfileview_health(
    tenant_id: int = Depends(get_current_tenant),
):
    """
    检查 kkFileView 服务健康状态（支持多实例）
    
    检查 kkFileView 预览服务是否正常运行，支持多个服务实例的健康检查。
    
    Returns:
        Dict[str, Any]: 健康检查结果
        {
            "overall_healthy": bool,  # 整体是否健康
            "services": [...],  # 各个服务的健康状态
            "healthy_count": int,  # 健康服务数量
            "total_count": int  # 总服务数量
        }
    """
    health_status = await FilePreviewService.check_kkfileview_health(tenant_id=tenant_id)
    return health_status

