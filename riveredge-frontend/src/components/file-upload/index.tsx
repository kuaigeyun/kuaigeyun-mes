/**
 * 通用文件上传组件
 * 
 * 基于文件管理模块的统一文件上传组件，供业务模块使用。
 * 支持单文件和多文件上传，自动关联文件管理。
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Button, message, UploadProps, UploadFile } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { uploadFile, uploadMultipleFiles, FileUploadResponse } from '../../services/file';
import { App } from 'antd';

export interface FileUploadComponentProps {
  /**
   * 文件分类（可选）
   */
  category?: string;
  
  /**
   * 文件标签（可选）
   */
  tags?: string[];
  
  /**
   * 文件描述（可选）
   */
  description?: string;
  
  /**
   * 是否支持多文件上传
   */
  multiple?: boolean;
  
  /**
   * 最大文件数量（多文件上传时）
   */
  maxCount?: number;
  
  /**
   * 接受的文件类型（MIME 类型或文件扩展名）
   */
  accept?: string;
  
  /**
   * 文件大小限制（字节）
   */
  maxSize?: number;
  
  /**
   * 上传成功回调
   */
  onSuccess?: (file: FileUploadResponse | FileUploadResponse[]) => void;
  
  /**
   * 上传失败回调
   */
  onError?: (error: Error) => void;
  
  /**
   * 文件列表变化回调
   */
  onChange?: (fileList: UploadFile[]) => void;
  
  /**
   * 初始文件列表
   */
  defaultFileList?: UploadFile[];
  
  /**
   * 是否显示文件列表
   */
  showUploadList?: boolean | UploadProps['showUploadList'];
  
  /**
   * 自定义上传按钮文本
   */
  buttonText?: string;
  
  /**
   * 自定义上传按钮图标
   */
  buttonIcon?: React.ReactNode;
  
  /**
   * 是否禁用
   */
  disabled?: boolean;
}

/**
 * 通用文件上传组件
 */
const FileUploadComponent: React.FC<FileUploadComponentProps> = ({
  category,
  tags,
  description,
  multiple = false,
  maxCount,
  accept,
  maxSize,
  onSuccess,
  onError,
  onChange,
  defaultFileList = [],
  showUploadList = true,
  buttonText = '选择文件',
  buttonIcon = <UploadOutlined />,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [fileList, setFileList] = useState<UploadFile[]>(defaultFileList);
  const [uploading, setUploading] = useState(false);

  /**
   * 处理文件上传
   */
  const handleUpload: UploadProps['customRequest'] = async (options) => {
    const { file, onSuccess: onUploadSuccess, onError: onUploadError } = options;
    
    try {
      setUploading(true);
      
      // 检查文件大小
      if (maxSize && file.size > maxSize) {
        throw new Error(t('components.fileUpload.sizeExceeded', { size: (maxSize / 1024 / 1024).toFixed(2) }));
      }
      
      if (multiple) {
        // 多文件上传
        const files = Array.isArray(file) ? file : [file];
        const response = await uploadMultipleFiles(
          files as File[],
          { category }
        );
        
        // 更新文件列表
        const newFileList: UploadFile[] = response.map((fileInfo) => ({
          uid: fileInfo.uuid,
          name: fileInfo.original_name,
          status: 'done',
          url: undefined, // 可以通过 getFilePreview 获取预览 URL
        }));
        
        setFileList(newFileList);
        onChange?.(newFileList);
        onUploadSuccess?.(response);
        onSuccess?.(response);
        messageApi.success(t('components.fileUpload.uploadMultiSuccess', { count: response.length }));
      } else {
        // 单文件上传
        const response = await uploadFile(file as File, {
          category,
          tags,
          description,
        });
        
        // 更新文件列表
        const newFileList: UploadFile[] = [{
          uid: response.uuid,
          name: response.original_name,
          status: 'done',
          url: undefined, // 可以通过 getFilePreview 获取预览 URL
        }];
        
        setFileList(newFileList);
        onChange?.(newFileList);
        onUploadSuccess?.(response);
        onSuccess?.(response);
        messageApi.success(t('components.fileUpload.uploadSuccess'));
      }
    } catch (error: any) {
      onUploadError?.(error);
      onError?.(error);
      messageApi.error(error.message || t('components.fileUpload.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  /**
   * 处理文件列表变化
   */
  const handleChange: UploadProps['onChange'] = (info) => {
    setFileList(info.fileList);
    onChange?.(info.fileList);
  };

  /**
   * 处理文件删除
   */
  const handleRemove: UploadProps['onRemove'] = (file) => {
    const newFileList = fileList.filter((item) => item.uid !== file.uid);
    setFileList(newFileList);
    onChange?.(newFileList);
  };

  /**
   * 文件上传前验证
   */
  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    // 检查文件大小
    if (maxSize && file.size > maxSize) {
      messageApi.error(t('components.fileUpload.sizeExceeded', { size: (maxSize / 1024 / 1024).toFixed(2) }));
      return Upload.LIST_IGNORE;
    }
    
    // 检查文件数量（多文件上传时）
    if (multiple && maxCount && fileList.length >= maxCount) {
      messageApi.error(t('components.fileUpload.maxCountExceeded', { count: maxCount }));
      return Upload.LIST_IGNORE;
    }
    
    // 返回 false 阻止自动上传，使用 customRequest
    return false;
  };

  return (
    <Upload
      customRequest={handleUpload}
      fileList={fileList}
      onChange={handleChange}
      onRemove={handleRemove}
      beforeUpload={beforeUpload}
      multiple={multiple}
      accept={accept}
      showUploadList={showUploadList}
      disabled={disabled || uploading}
    >
      <Button icon={buttonIcon} loading={uploading} disabled={disabled}>
        {buttonText}
      </Button>
    </Upload>
  );
};

export default FileUploadComponent;

