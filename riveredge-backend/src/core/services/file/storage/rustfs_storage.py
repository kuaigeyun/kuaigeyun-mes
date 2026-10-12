"""
RustFS（S3 兼容）文件存储适配器。

配置字段与应用连接器 rustfs / minio 一致：endpoint / access_key / secret_key /
bucket / region / use_ssl / use_path_style。协议层复用 MinIO SDK。
"""

from __future__ import annotations

from core.services.file.storage.minio_storage import MinioStorage


class RustFsStorage(MinioStorage):
    """RustFS：S3 兼容 API，签名与收发同 MinIO SDK。"""

    backend_name = "rustfs"
