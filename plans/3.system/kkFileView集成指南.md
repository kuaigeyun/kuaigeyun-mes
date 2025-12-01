# kkFileView 集成指南

## 📋 概述

kkFileView 已选定作为文件预览服务，提供多种文件格式的在线预览功能。

**kkFileView 功能覆盖**：
- ✅ 文件预览（23+ 种格式）
- ✅ 在线编辑（部分格式）
- ✅ 预览权限控制

---

## 🔧 技术选型

### kkFileView 优势

1. **格式支持广泛**
   - Office 文档（Word、Excel、PPT）
   - PDF、图片、音视频
   - 代码文件、压缩包等
   - 共支持 23+ 种文件格式

2. **独立服务**
   - Java 服务，独立部署
   - 不影响主应用性能
   - 易于扩展和维护

3. **预览体验好**
   - 在线预览，无需下载
   - 支持在线编辑（部分格式）
   - 响应速度快

---

## 📦 安装与部署

### 1. kkFileView 服务部署

**方式一：Docker 部署（推荐）**

```bash
docker run -d \
  --name kkfileview \
  -p 8012:8012 \
  keking/kkfileview:latest
```

**方式二：Java 服务部署**

```bash
# 下载 kkFileView JAR 包
wget https://github.com/kekingcn/kkFileView/releases/download/v4.1.0/kkFileView-4.1.0.tar.gz

# 解压并运行
tar -xzf kkFileView-4.1.0.tar.gz
cd kkFileView-4.1.0
java -jar kkFileView-4.1.0.jar
```

### 2. 配置说明

**配置文件**：`application.properties`

```properties
# 服务端口
server.port=8012

# 文件存储路径
file.dir=/tmp/kkfileview

# 预览服务地址（用于生成预览URL）
base.url=http://localhost:8012
```

---

## 🔌 系统集成

### 1. 文件模型扩展

```python
# models/file.py
class File(BaseModel):
    """
    文件模型
    """
    id = fields.IntField(pk=True)
    tenant_id = fields.IntField(null=False, index=True)
    
    # 文件基本信息
    name = fields.CharField(max_length=255)
    path = fields.CharField(max_length=500)
    size = fields.BigIntField()
    mime_type = fields.CharField(max_length=100)
    
    # kkFileView 预览
    preview_url = fields.CharField(max_length=500, null=True)  # 预览URL
    preview_enabled = fields.BooleanField(default=True)  # 是否支持预览
    
    created_at = fields.DatetimeField(auto_now_add=True)
    updated_at = fields.DatetimeField(auto_now=True)
    
    class Meta:
        table = "root_files"
```

### 2. 预览服务集成

```python
# services/file_preview_service.py
import httpx
from soil.config import settings

class FilePreviewService:
    """
    文件预览服务
    """
    
    def __init__(self):
        self.kkfileview_url = settings.KKFILEVIEW_URL  # http://localhost:8012
    
    async def generate_preview_url(
        self,
        file_path: str,
        tenant_id: int,
        file_id: int,
    ) -> str:
        """
        生成文件预览URL
        
        Args:
            file_path: 文件路径
            tenant_id: 组织ID
            file_id: 文件ID
            
        Returns:
            预览URL（包含权限验证token）
        """
        # 生成预览token（包含tenant_id和file_id，用于权限验证）
        token = self._generate_preview_token(tenant_id, file_id)
        
        # 构建预览URL
        preview_url = f"{self.kkfileview_url}/onlinePreview?url={file_path}&token={token}"
        
        return preview_url
    
    def _generate_preview_token(self, tenant_id: int, file_id: int) -> str:
        """
        生成预览token（用于权限验证）
        """
        # 使用JWT生成token，包含tenant_id和file_id
        # ...
```

### 3. 预览权限验证

```python
# api/files.py
@router.get("/files/{file_id}/preview")
async def get_file_preview(
    file_id: int,
    current_user: User = Depends(get_current_user),
):
    """
    获取文件预览URL
    
    验证用户是否有权限预览该文件
    """
    # 查询文件
    file = await File.get(id=file_id, tenant_id=current_user.tenant_id)
    
    if not file:
        raise HTTPException(status_code=404, detail="文件不存在")
    
    # 验证权限（可以根据业务需求扩展）
    if not await check_file_preview_permission(file, current_user):
        raise HTTPException(status_code=403, detail="无权限预览该文件")
    
    # 生成预览URL
    preview_service = FilePreviewService()
    preview_url = await preview_service.generate_preview_url(
        file_path=file.path,
        tenant_id=file.tenant_id,
        file_id=file.id,
    )
    
    return {"preview_url": preview_url}
```

---

## 🎨 前端集成

### 1. 文件预览组件

```typescript
// components/FilePreview/index.tsx
import React from 'react';
import { Modal } from 'antd';

interface FilePreviewProps {
  visible: boolean;
  previewUrl: string;
  fileName: string;
  onClose: () => void;
}

export const FilePreview: React.FC<FilePreviewProps> = ({
  visible,
  previewUrl,
  fileName,
  onClose,
}) => {
  return (
    <Modal
      title={fileName}
      open={visible}
      onCancel={onClose}
      footer={null}
      width="90%"
      style={{ top: 20 }}
    >
      <iframe
        src={previewUrl}
        style={{
          width: '100%',
          height: 'calc(100vh - 200px)',
          border: 'none',
        }}
      />
    </Modal>
  );
};
```

### 2. 文件列表中使用

```typescript
// pages/files/index.tsx
import { FilePreview } from '@/components/FilePreview';

const FileList: React.FC = () => {
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewFileName, setPreviewFileName] = useState('');

  const handlePreview = async (file: File) => {
    // 获取预览URL
    const response = await apiRequest(`/api/files/${file.id}/preview`);
    setPreviewUrl(response.preview_url);
    setPreviewFileName(file.name);
    setPreviewVisible(true);
  };

  return (
    <>
      <UniTable
        columns={columns}
        // ...
      />
      
      <FilePreview
        visible={previewVisible}
        previewUrl={previewUrl}
        fileName={previewFileName}
        onClose={() => setPreviewVisible(false)}
      />
    </>
  );
};
```

---

## 🔐 多租户支持

### 1. 预览URL包含组织信息

```python
# 预览URL包含tenant_id，用于权限验证
preview_url = f"{kkfileview_url}/onlinePreview?url={file_path}&tenant_id={tenant_id}&token={token}"
```

### 2. kkFileView 权限验证中间件

```python
# kkFileView 需要配置权限验证中间件
# 验证请求中的tenant_id和token
# 确保用户只能预览自己组织的文件
```

### 3. 预览日志记录

```python
# 记录预览日志（按组织隔离）
class FilePreviewLog(BaseModel):
    id = fields.IntField(pk=True)
    tenant_id = fields.IntField(null=False, index=True)
    file_id = fields.IntField()
    user_id = fields.IntField()
    preview_time = fields.DatetimeField(auto_now_add=True)
    
    class Meta:
        table = "root_file_preview_logs"
```

---

## 📊 支持的文件格式

### Office 文档
- Word (.doc, .docx)
- Excel (.xls, .xlsx)
- PowerPoint (.ppt, .pptx)

### 其他文档
- PDF (.pdf)
- 文本文件 (.txt, .md, .log等)
- 代码文件 (.js, .py, .java等)

### 图片
- JPG, PNG, GIF, BMP, WebP等

### 音视频
- MP3, MP4, AVI, MOV等

### 压缩包
- ZIP, RAR, 7Z等

**完整列表**：参考 [kkFileView 官方文档](https://kkfileview.keking.cn/)

---

## 🚀 最佳实践

### 1. 预览服务配置

```python
# config/kkfileview_config.py
class KKFileViewConfig:
    """
    kkFileView 配置
    """
    URL = "http://localhost:8012"  # 预览服务地址
    TIMEOUT = 30  # 预览超时时间（秒）
    CACHE_ENABLED = True  # 是否启用缓存
    CACHE_TTL = 3600  # 缓存时间（秒）
```

### 2. 预览URL生成策略

```python
# 策略1：直接使用文件路径（文件在可访问的网络位置）
preview_url = f"{kkfileview_url}/onlinePreview?url={file_url}"

# 策略2：通过代理（文件在私有存储）
preview_url = f"{kkfileview_url}/onlinePreview?url={proxy_url}&token={token}"
```

### 3. 预览性能优化

```python
# 1. 预览结果缓存
# 2. 预览服务负载均衡
# 3. 大文件分片预览
# 4. 预览服务健康检查
```

---

## 📚 相关文档

- [kkFileView 官方文档](https://kkfileview.keking.cn/)
- [kkFileView GitHub](https://github.com/kekingcn/kkFileView)
- [kkFileView Docker 部署](https://kkfileview.keking.cn/zh-cn/docs/deploy.html)

---

**最后更新**：2025-01-XX

