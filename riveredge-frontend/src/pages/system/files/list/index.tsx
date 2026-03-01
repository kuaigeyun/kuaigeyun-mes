/**
 * 文件管理列表页面 - Windows 资源管理器风格
 * 
 * 用于系统管理员查看和管理组织内的文件。
 * 支持文件的 CRUD 操作、上传、下载、预览功能。
 *
 * Author: Luigi Lu
 * Date: 2025-12-30
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Button, Space, Modal, Upload, Breadcrumb, Table, Menu, Input, Tooltip, Select, theme } from 'antd';
import { TwoColumnLayout } from '../../../../components/layout-templates';
import { 
  EditOutlined, 
  DeleteOutlined, 
  EyeOutlined, 
  PlusOutlined, 
  DownloadOutlined, 
  UploadOutlined,
  FileOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileExcelOutlined,
  FileWordOutlined,
  FilePptOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  UpOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  CopyOutlined,
  ScissorOutlined,
  SnippetsOutlined,
} from '@ant-design/icons';
import type { DataNode, TreeProps } from 'antd/es/tree';
import type { MenuProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile as AntdUploadFile } from 'antd';
import {
  getFileList,
  uploadFile,
  updateFile,
  batchDeleteFiles,
  getFilePreview,
  getFileDownloadUrl,
  type File,
  FileUpdate,
  FileListParams,
  FilePreviewResponse,
} from '../../../../services/file';

/**
 * 判断是否为图片类型（用于图标视图缩略图与预览）
 */
const isImageFile = (file: File): boolean => {
  const type = (file.file_type || '').toLowerCase();
  if (type.startsWith('image/')) return true;
  const ext = (file.file_extension || file.original_name?.split('.').pop() || '').toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext);
};

/**
 * 根据文件类型获取图标
 */
const getFileIcon = (fileType?: string, size: number = 24) => {
  if (!fileType) return <FileOutlined style={{ fontSize: size }} />;
  
  const type = fileType.toLowerCase();
  if (type.startsWith('image/')) return <FileImageOutlined style={{ fontSize: size, color: '#1890ff' }} />;
  if (type === 'application/pdf') return <FilePdfOutlined style={{ fontSize: size, color: '#ff4d4f' }} />;
  if (type.includes('word') || type.includes('document')) return <FileWordOutlined style={{ fontSize: size, color: '#1890ff' }} />;
  if (type.includes('excel') || type.includes('spreadsheet')) return <FileExcelOutlined style={{ fontSize: size, color: '#52c41a' }} />;
  if (type.includes('powerpoint') || type.includes('presentation')) return <FilePptOutlined style={{ fontSize: size, color: '#faad14' }} />;
  if (type.startsWith('text/')) return <FileTextOutlined style={{ fontSize: size, color: '#1890ff' }} />;
  return <FileOutlined style={{ fontSize: size }} />;
};

/**
 * 格式化文件大小
 */
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Windows 资源管理器风格：名称自然排序（如 文件2 < 文件10），不区分大小写
 */
const naturalCompare = (a: string, b: string): number => {
  const sa = (a || '').toLowerCase();
  const sb = (b || '').toLowerCase();
  return sa.localeCompare(sb, undefined, { numeric: true });
};

/** 排序字段（与表格列 dataIndex 一致，便于表头排序联动） */
type SortField = 'original_name' | 'file_size' | 'file_type' | 'updated_at';
/** 排序方向：与 Ant Design Table 一致 */
type SortOrder = 'ascend' | 'descend' | null;

/**
 * 视图类型
 */
type ViewType = 'icons' | 'list' | 'details';

/**
 * 文件管理列表页面组件
 */
const FileListPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  
  // 视图状态
  const [viewType, setViewType] = useState<ViewType>('icons');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [fileList, setFileList] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  // 排序（Windows 资源管理器逻辑：默认按名称升序）
  const [sortField, setSortField] = useState<SortField>('original_name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('ascend');
  
  // 文件夹树状态
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [filteredTreeData, setFilteredTreeData] = useState<DataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedTreeKeys, setSelectedTreeKeys] = useState<React.Key[]>([]);
  const ROOT_PATH_KEY = 'all';
  const [currentPath, setCurrentPath] = useState<string[]>([ROOT_PATH_KEY]);
  const [treeSearchValue, setTreeSearchValue] = useState<string>('');
  
  // Modal 相关状态
  const [uploadVisible, setUploadVisible] = useState(false);
  const [uploadFileList, setUploadFileList] = useState<AntdUploadFile[]>([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewInfo, setPreviewInfo] = useState<FilePreviewResponse | null>(null);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameFile, setRenameFile] = useState<File | null>(null);
  const [createFolderVisible, setCreateFolderVisible] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  
  // 右键菜单状态
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuFile, setContextMenuFile] = useState<File | null>(null);
  
  // 剪贴板状态（用于复制/剪切）
  const [clipboard, setClipboard] = useState<{ type: 'copy' | 'cut' | null; files: File[] }>({ type: null, files: [] });

  // 图标视图中图片的预览 URL（用于缩略图）
  const [imagePreviewUrls, setImagePreviewUrls] = useState<Record<string, string>>({});
  const [imageLoadFailed, setImageLoadFailed] = useState<Set<string>>(new Set());
  const requestedPreviewRef = useRef<Set<string>>(new Set());

  /**
   * 加载文件列表
   */
  const loadFileList = useCallback(async (category?: string) => {
    try {
      setLoading(true);
      const params: FileListParams = {
        page: 1,
        page_size: 1000, // 加载所有文件
        category: category,
      };
      const response = await getFileList(params);
      setFileList(response.items);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.files.loadListFailed'));
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  /**
   * 初始化文件夹树：仅一个根节点「全部文件」，其他文件夹作为其子节点
   */
  useEffect(() => {
    const categories = new Set<string>();
    fileList.forEach(file => {
      if (file.category) {
        categories.add(file.category);
      }
    });

    const categoryNodes: DataNode[] = Array.from(categories).map(category => ({
      title: category,
      key: category,
      icon: <FolderOutlined />,
      isLeaf: false,
    }));

    const allFilesNode: DataNode = {
      title: t('pages.system.files.allFiles'),
      key: 'all',
      icon: <FolderOpenOutlined />,
      isLeaf: categoryNodes.length === 0,
      children: categoryNodes.length > 0 ? categoryNodes : undefined,
    };

    const treeNodes: DataNode[] = [allFilesNode];
    setTreeData(treeNodes);

    if (!treeSearchValue.trim()) {
      setFilteredTreeData(treeNodes);
    }
    if (selectedTreeKeys.length === 0) {
      setSelectedTreeKeys(['all']);
    }
    // 有子文件夹时默认展开「全部文件」
    if (categoryNodes.length > 0) {
      setExpandedKeys(prev => (prev.includes('all') ? prev : ['all', ...prev]));
    }
  }, [fileList, treeSearchValue]);

  /**
   * 过滤文件夹树（根据搜索关键词）：保留「全部文件」根节点，只过滤其子文件夹
   */
  useEffect(() => {
    if (!treeSearchValue.trim()) {
      setFilteredTreeData(treeData);
      return;
    }

    const searchLower = treeSearchValue.toLowerCase().trim();
    if (treeData.length === 0) {
      setFilteredTreeData([]);
      return;
    }

    const root = treeData[0];
    const children = (root.children || []) as DataNode[];
    const filteredChildren = children.filter(node => {
      const title = (node.title as string) || '';
      return title.toLowerCase().includes(searchLower);
    });

    const filteredRoot: DataNode = {
      ...root,
      children: filteredChildren.length > 0 ? filteredChildren : undefined,
    };
    const matchesRoot = ((root.title as string) || '').toLowerCase().includes(searchLower);
    const filtered = matchesRoot || filteredChildren.length > 0 ? [filteredRoot] : [];

    setFilteredTreeData(filtered);
    if (filtered.length > 0) {
      setExpandedKeys(prev => (prev.includes('all') ? prev : ['all', ...prev]));
    }
  }, [treeData, treeSearchValue]);

  /**
   * 初始加载
   */
  useEffect(() => {
    loadFileList();
  }, [loadFileList]);

  /**
   * 图标视图下为图片文件拉取预览 URL，用于显示缩略图
   */
  useEffect(() => {
    if (viewType !== 'icons') return;
    const imageFiles = fileList.filter(isImageFile);
    imageFiles.forEach((file) => {
      if (requestedPreviewRef.current.has(file.uuid)) return;
      requestedPreviewRef.current.add(file.uuid);
      getFilePreview(file.uuid)
        .then((res) => {
          setImagePreviewUrls((prev) => ({ ...prev, [file.uuid]: res.preview_url }));
        })
        .catch(() => {});
    });
  }, [viewType, fileList]);

  /**
   * 排序后的文件列表（Windows 资源管理器逻辑：名称自然排序，支持按大小/类型/日期）
   */
  const sortedFileList = useMemo(() => {
    const list = [...fileList];
    const asc = sortOrder === 'ascend';
    const cmp = (a: number, b: number) => (asc ? a - b : b - a);
    const cmpStr = (a: string, b: string) => (asc ? naturalCompare(a, b) : naturalCompare(b, a));
    list.sort((a, b) => {
      switch (sortField) {
        case 'original_name':
          return cmpStr(a.original_name || '', b.original_name || '');
        case 'file_size':
          return cmp(a.file_size ?? 0, b.file_size ?? 0);
        case 'file_type': {
          const ta = (a.file_type || a.file_extension || '').toLowerCase();
          const tb = (b.file_type || b.file_extension || '').toLowerCase();
          return cmpStr(ta, tb);
        }
        case 'updated_at': {
          const da = new Date(a.updated_at || 0).getTime();
          const db = new Date(b.updated_at || 0).getTime();
          return cmp(da, db);
        }
        default:
          return 0;
      }
    });
    return list;
  }, [fileList, sortField, sortOrder]);

  /**
   * 处理文件夹树选择
   */
  const handleTreeSelect: TreeProps['onSelect'] = (selectedKeys) => {
    if (selectedKeys.length > 0) {
      const key = selectedKeys[0] as string;
      setSelectedTreeKeys(selectedKeys);
      
      if (key === 'all') {
        setCurrentPath([ROOT_PATH_KEY]);
        loadFileList();
      } else {
        setCurrentPath([ROOT_PATH_KEY, key]);
        loadFileList(key);
      }
    }
  };

  /**
   * 处理文件上传
   */
  const handleUpload = async () => {
    if (uploadFileList.length === 0) {
      messageApi.warning(t('pages.system.files.selectFilesToUpload'));
      return;
    }
    
    try {
      const uploadPromises = uploadFileList.map(file => {
        if (file.originFileObj) {
          return uploadFile(file.originFileObj);
        }
        return Promise.resolve(null);
      });
      
      await Promise.all(uploadPromises);
      messageApi.success(t('pages.system.files.uploadSuccess'));
      setUploadVisible(false);
      setUploadFileList([]);
      loadFileList(selectedTreeKeys[0] === 'all' ? undefined : selectedTreeKeys[0] as string);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.files.uploadFailed'));
    }
  };

  /**
   * 处理新建文件夹
   */
  const handleCreateFolder = async () => {
    if (!folderName.trim()) {
      messageApi.warning(t('pages.system.files.enterFolderName'));
      return;
    }

    // 检查文件夹名称是否已存在
    const categories = new Set<string>();
    fileList.forEach(file => {
      if (file.category) {
        categories.add(file.category);
      }
    });
    
    if (categories.has(folderName.trim())) {
      messageApi.warning(t('pages.system.files.folderNameExists'));
      return;
    }

    try {
      setCreatingFolder(true);
      // 创建一个占位文件来表示文件夹
      // 使用一个包含文件夹标识的文本文件作为占位符
      const placeholderContent = new Blob(['FOLDER_PLACEHOLDER'], { type: 'text/plain' });
      const placeholderFile = new File([placeholderContent], `folder_${folderName.trim()}.txt`, { type: 'text/plain' });
      
      await uploadFile(placeholderFile, {
        category: folderName.trim(),
        description: t('pages.system.files.folderPlaceholderDesc'),
      });
      
      messageApi.success(t('pages.system.files.folderCreateSuccess'));
      setCreateFolderVisible(false);
      setFolderName('');
      // 刷新文件列表
      await loadFileList();
      // 自动选中新创建的文件夹
      setSelectedTreeKeys([folderName.trim()]);
      setCurrentPath([ROOT_PATH_KEY, folderName.trim()]);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.files.folderCreateFailed'));
    } finally {
      setCreatingFolder(false);
    }
  };

  /**
   * 处理文件预览
   */
  const handlePreview = async (file: File) => {
    try {
      const preview = await getFilePreview(file.uuid);
      setPreviewInfo(preview);
      setPreviewVisible(true);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.files.previewFailed'));
    }
  };

  /**
   * 处理文件下载
   */
  const handleDownload = (file: File) => {
    const downloadUrl = getFileDownloadUrl(file.uuid);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = file.original_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * 处理文件删除
   */
  const handleDelete = async (file?: File) => {
    const filesToDelete = file ? [file] : selectedRowKeys.map(key => fileList.find(f => f.uuid === key)).filter(Boolean) as File[];
    
    if (filesToDelete.length === 0) {
      messageApi.warning(t('pages.system.files.selectToDelete'));
      return;
    }
    
    try {
      await batchDeleteFiles(filesToDelete.map(f => f.uuid));
      messageApi.success(t('pages.system.files.deleteSuccess'));
      setSelectedRowKeys([]);
      loadFileList(selectedTreeKeys[0] === 'all' ? undefined : selectedTreeKeys[0] as string);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.files.deleteFailed'));
    }
  };

  /**
   * 处理文件重命名
   */
  const handleRename = async () => {
    if (!renameFile || !renameValue.trim()) {
      messageApi.warning(t('pages.system.files.enterNewName'));
      return;
    }
    
    try {
      await updateFile(renameFile.uuid, {
        name: renameValue.trim(),
      } as FileUpdate);
      messageApi.success(t('pages.system.files.renameSuccess'));
      setRenameVisible(false);
      setRenameFile(null);
      setRenameValue('');
      loadFileList(selectedTreeKeys[0] === 'all' ? undefined : selectedTreeKeys[0] as string);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.files.renameFailed'));
    }
  };

  /**
   * 处理右键菜单
   */
  const handleContextMenu = (e: React.MouseEvent, file?: File) => {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenuFile(file || null);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuVisible(true);
  };

  /**
   * 右键菜单项
   */
  const contextMenuItems: MenuProps['items'] = [
    {
      key: 'open',
      label: t('pages.system.files.contextOpen'),
      icon: <EyeOutlined />,
      onClick: () => {
        if (contextMenuFile) {
          handlePreview(contextMenuFile);
        }
        setContextMenuVisible(false);
      },
    },
    {
      key: 'download',
      label: t('pages.system.files.contextDownload'),
      icon: <DownloadOutlined />,
      onClick: () => {
        if (contextMenuFile) {
          handleDownload(contextMenuFile);
        }
        setContextMenuVisible(false);
      },
    },
    { type: 'divider' },
    {
      key: 'cut',
      label: t('pages.system.files.contextCut'),
      icon: <ScissorOutlined />,
      onClick: () => {
        const files = contextMenuFile ? [contextMenuFile] : selectedRowKeys.map(key => fileList.find(f => f.uuid === key)).filter(Boolean) as File[];
        setClipboard({ type: 'cut', files });
        setContextMenuVisible(false);
      },
    },
    {
      key: 'copy',
      label: t('pages.system.files.contextCopy'),
      icon: <CopyOutlined />,
      onClick: () => {
        const files = contextMenuFile ? [contextMenuFile] : selectedRowKeys.map(key => fileList.find(f => f.uuid === key)).filter(Boolean) as File[];
        setClipboard({ type: 'copy', files });
        setContextMenuVisible(false);
      },
    },
    {
      key: 'paste',
      label: t('pages.system.files.contextPaste'),
      icon: <SnippetsOutlined />,
      disabled: clipboard.type === null || clipboard.files.length === 0,
      onClick: () => {
        // TODO: 实现粘贴功能
        messageApi.info(t('pages.system.files.pasteDeveloping'));
        setContextMenuVisible(false);
      },
    },
    { type: 'divider' },
    {
      key: 'rename',
      label: t('pages.system.files.contextRename'),
      icon: <EditOutlined />,
      onClick: () => {
        if (contextMenuFile) {
          setRenameFile(contextMenuFile);
          setRenameValue(contextMenuFile.original_name);
          setRenameVisible(true);
        }
        setContextMenuVisible(false);
      },
    },
    {
      key: 'delete',
      label: t('pages.system.files.contextDelete'),
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => {
        handleDelete(contextMenuFile || undefined);
        setContextMenuVisible(false);
      },
    },
  ];

  /**
   * 表格列定义（详细信息视图），支持点击表头排序（Windows 资源管理器风格）
   */
  const columns: ColumnsType<File> = [
    {
      title: t('pages.system.files.columnName'),
      dataIndex: 'original_name',
      key: 'name',
      width: '40%',
      sorter: true,
      sortOrder: sortField === 'original_name' ? sortOrder : null,
      render: (_, record) => (
        <Space>
          {getFileIcon(record.file_type, 20)}
          <span>{record.original_name}</span>
        </Space>
      ),
    },
    {
      title: t('pages.system.files.columnType'),
      dataIndex: 'file_type',
      key: 'type',
      width: '15%',
      sorter: true,
      sortOrder: sortField === 'file_type' ? sortOrder : null,
      render: (_, record) => record.file_type || t('pages.system.files.typeUnknown'),
    },
    {
      title: t('pages.system.files.columnSize'),
      dataIndex: 'file_size',
      key: 'size',
      width: '15%',
      sorter: true,
      sortOrder: sortField === 'file_size' ? sortOrder : null,
      render: (_, record) => formatFileSize(record.file_size),
    },
    {
      title: t('pages.system.files.columnModified'),
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: '20%',
      sorter: true,
      sortOrder: sortField === 'updated_at' ? sortOrder : null,
      render: (_, record) => new Date(record.updated_at).toLocaleString('zh-CN'),
    },
  ];

  /**
   * 渲染文件列表（图标视图）：图片格式显示缩略图，单击即可预览
   */
  const renderIconsView = () => {
    const imageThumbSize = 64;
    const thumbUrl = (file: File) => imagePreviewUrls[file.uuid];

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: '16px',
          padding: '16px',
        }}
        onContextMenu={(e) => handleContextMenu(e)}
      >
        {sortedFileList.map(file => {
          const isImage = isImageFile(file);
          const thumbFailed = imageLoadFailed.has(file.uuid);
          const hasThumb = isImage && thumbUrl(file) && !thumbFailed;
          return (
            <div
              key={file.uuid}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '12px',
                borderRadius: '4px',
                cursor: 'pointer',
                border: selectedRowKeys.includes(file.uuid) ? '2px solid #1890ff' : '2px solid transparent',
                backgroundColor: selectedRowKeys.includes(file.uuid) ? '#e6f7ff' : 'transparent',
              }}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  setSelectedRowKeys(prev =>
                    prev.includes(file.uuid)
                      ? prev.filter(key => key !== file.uuid)
                      : [...prev, file.uuid]
                  );
                } else {
                  setSelectedRowKeys([file.uuid]);
                }
              }}
              onDoubleClick={() => handlePreview(file)}
              onContextMenu={(e) => handleContextMenu(e, file)}
            >
              {hasThumb ? (
                <img
                  src={thumbUrl(file)}
                  alt={file.original_name}
                  style={{
                    width: imageThumbSize,
                    height: imageThumbSize,
                    objectFit: 'cover',
                    borderRadius: '4px',
                  }}
                  onError={() => setImageLoadFailed((prev) => new Set(prev).add(file.uuid))}
                />
              ) : (
                getFileIcon(file.file_type, 48)
              )}
              <div
                style={{
                  marginTop: '8px',
                  textAlign: 'center',
                  fontSize: '12px',
                  wordBreak: 'break-word',
                  maxWidth: '100px',
                }}
                title={file.original_name}
              >
                {file.original_name}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /**
   * 渲染文件列表（列表视图）
   */
  const renderListView = () => {
    return (
      <div
        style={{
          padding: '8px',
        }}
        onContextMenu={(e) => handleContextMenu(e)}
      >
        {sortedFileList.map(file => (
          <div
            key={file.uuid}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: selectedRowKeys.includes(file.uuid) ? '#e6f7ff' : 'transparent',
              border: selectedRowKeys.includes(file.uuid) ? '1px solid #1890ff' : '1px solid transparent',
            }}
            onClick={(e) => {
              if (e.ctrlKey || e.metaKey) {
                setSelectedRowKeys(prev =>
                  prev.includes(file.uuid)
                    ? prev.filter(key => key !== file.uuid)
                    : [...prev, file.uuid]
                );
              } else {
                setSelectedRowKeys([file.uuid]);
              }
            }}
            onDoubleClick={() => handlePreview(file)}
            onContextMenu={(e) => handleContextMenu(e, file)}
          >
            <Space style={{ flex: 1, minWidth: 0 }}>
              {getFileIcon(file.file_type, 20)}
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.original_name}
              </span>
              <span style={{ color: '#999', fontSize: '12px' }}>
                {formatFileSize(file.file_size)}
              </span>
              <span style={{ color: '#999', fontSize: '12px', width: '180px' }}>
                {new Date(file.updated_at).toLocaleString('zh-CN')}
              </span>
            </Space>
          </div>
        ))}
      </div>
    );
  };

  /**
   * 计算选中文件的总大小
   */
  const selectedFilesSize = selectedRowKeys.reduce((total: number, key: React.Key) => {
    const file = fileList.find(f => f.uuid === key);
    return total + (file?.file_size || 0);
  }, 0);

  return (
    <>
      <TwoColumnLayout
        leftPanel={{
          search: {
            placeholder: t('pages.system.files.searchFolder'),
            value: treeSearchValue,
            onChange: setTreeSearchValue,
            allowClear: true,
          },
          tree: {
            treeData: filteredTreeData.length > 0 || !treeSearchValue.trim() ? filteredTreeData : treeData,
            selectedKeys: selectedTreeKeys,
            expandedKeys: expandedKeys,
            onSelect: handleTreeSelect,
            onExpand: setExpandedKeys,
            showIcon: true,
            blockNode: true,
            className: 'file-manager-tree',
          },
        }}
        rightPanel={{
          header: {
            left: (
              <Space>
                <Button icon={<ArrowLeftOutlined />} disabled />
                <Button icon={<ArrowRightOutlined />} disabled />
                <Button icon={<UpOutlined />} disabled />
                <Button icon={<ReloadOutlined />} onClick={() => loadFileList(selectedTreeKeys[0] === 'all' ? undefined : selectedTreeKeys[0] as string)} />
              </Space>
            ),
            center: (
              <Breadcrumb
                items={currentPath.map((path, index) => {
                  const displayPath = path === ROOT_PATH_KEY ? t('pages.system.files.allFiles') : path;
                  return {
                    title: index === currentPath.length - 1 ? (
                      <span style={{ fontWeight: 500 }}>{displayPath}</span>
                    ) : (
                      <a onClick={() => {}}>{displayPath}</a>
                    ),
                  };
                })}
              />
            ),
            right: (
              <Space>
                <Tooltip title={t('pages.system.files.viewIcons')}>
                  <Button
                    type={viewType === 'icons' ? 'primary' : 'default'}
                    icon={<AppstoreOutlined />}
                    onClick={() => setViewType('icons')}
                  />
                </Tooltip>
                <Tooltip title={t('pages.system.files.viewList')}>
                  <Button
                    type={viewType === 'list' ? 'primary' : 'default'}
                    icon={<UnorderedListOutlined />}
                    onClick={() => setViewType('list')}
                  />
                </Tooltip>
                <Tooltip title={t('pages.system.files.viewDetails')}>
                  <Button
                    type={viewType === 'details' ? 'primary' : 'default'}
                    icon={<UnorderedListOutlined />}
                    onClick={() => setViewType('details')}
                  />
                </Tooltip>
              </Space>
            ),
          },
          content: (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* 操作工具栏 */}
              <div
                style={{
                  borderBottom: `1px solid ${token.colorBorder}`,
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <Button
                  type="primary"
                  icon={<UploadOutlined />}
                  onClick={() => setUploadVisible(true)}
                >
                  {t('pages.system.files.uploadButton')}
                </Button>
                <Button
                  icon={<PlusOutlined />}
                  onClick={() => setCreateFolderVisible(true)}
                >
                  {t('pages.system.files.newFolderButton')}
                </Button>
                <Button
                  danger
                  disabled={selectedRowKeys.length === 0}
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete()}
                >
                  {t('pages.system.files.deleteButton')}
                </Button>
                <div style={{ width: 1, height: 16, backgroundColor: token.colorSplit, margin: '0 8px' }} />
                <Space>
                  <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>{t('pages.system.files.sortLabel')}</span>
                  <Select
                    value={`${sortField}-${sortOrder ?? 'ascend'}`}
                    onChange={(v) => {
                      const [f, o] = v.split('-') as [SortField, 'ascend' | 'descend'];
                      setSortField(f);
                      setSortOrder(o);
                    }}
                    options={[
                      { value: 'original_name-ascend', label: t('pages.system.files.sortNameAsc') },
                      { value: 'original_name-descend', label: t('pages.system.files.sortNameDesc') },
                      { value: 'file_size-ascend', label: t('pages.system.files.sortSizeAsc') },
                      { value: 'file_size-descend', label: t('pages.system.files.sortSizeDesc') },
                      { value: 'file_type-ascend', label: t('pages.system.files.sortTypeAsc') },
                      { value: 'file_type-descend', label: t('pages.system.files.sortTypeDesc') },
                      { value: 'updated_at-descend', label: t('pages.system.files.sortModifiedDesc') },
                      { value: 'updated_at-ascend', label: t('pages.system.files.sortModifiedAsc') },
                    ]}
                    style={{ width: 160 }}
                    size="middle"
                  />
                </Space>
              </div>

              {/* 文件列表区域 */}
              <div style={{ flex: 1, overflow: 'auto' }}>
                {viewType === 'icons' && renderIconsView()}
                {viewType === 'list' && renderListView()}
                {viewType === 'details' && (
                  <Table<File>
                    columns={columns}
                    dataSource={sortedFileList}
                    rowKey="uuid"
                    loading={loading}
                    onChange={(_pagination, _filters, sorter) => {
                      const o = Array.isArray(sorter) ? sorter[0] : sorter;
                      if (o?.field != null) {
                        setSortField(o.field as SortField);
                        setSortOrder((o.order as SortOrder) ?? 'ascend');
                      }
                    }}
                    rowSelection={{
                      selectedRowKeys,
                      onChange: setSelectedRowKeys,
                    }}
                    onRow={(record) => ({
                      onDoubleClick: () => handlePreview(record),
                      onContextMenu: (e) => handleContextMenu(e, record),
                    })}
                    pagination={false}
                    size="small"
                  />
                )}
              </div>
            </div>
          ),
          footer: (
            <>
              <span>
                {selectedRowKeys.length > 0
                  ? t('pages.system.files.selectedCount', { n: selectedRowKeys.length, size: formatFileSize(selectedFilesSize) })
                  : t('pages.system.files.totalCount', { n: fileList.length })}
              </span>
              <span>{formatFileSize(fileList.reduce((total, file) => total + file.file_size, 0))}</span>
            </>
          ),
        }}
      />

      {/* 上传文件 Modal */}
      <Modal
        title={t('pages.system.files.uploadModalTitle')}
        open={uploadVisible}
        onCancel={() => {
          setUploadVisible(false);
          setUploadFileList([]);
        }}
        onOk={handleUpload}
        width={600}
      >
        <Upload
          fileList={uploadFileList}
          onChange={({ fileList }) => setUploadFileList(fileList)}
          beforeUpload={() => false}
          multiple
        >
          <Button icon={<UploadOutlined />}>{t('pages.system.files.selectFiles')}</Button>
        </Upload>
      </Modal>

      {/* 文件预览 Modal */}
      <Modal
        title={t('pages.system.files.previewModalTitle')}
        open={previewVisible}
        onCancel={() => {
          setPreviewVisible(false);
          setPreviewInfo(null);
        }}
        footer={null}
        width="90%"
        style={{ top: 20 }}
      >
        {previewInfo && (
          <iframe
            src={previewInfo.preview_url}
            style={{
              width: '100%',
              height: 'calc(100vh - 200px)',
              border: 'none',
            }}
            title={t('pages.system.files.previewModalTitle')}
          />
        )}
      </Modal>

      {/* 重命名 Modal */}
      <Modal
        title={t('pages.system.files.renameModalTitle')}
        open={renameVisible}
        onCancel={() => {
          setRenameVisible(false);
          setRenameFile(null);
          setRenameValue('');
        }}
        onOk={handleRename}
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          placeholder={t('pages.system.files.renamePlaceholder')}
          onPressEnter={handleRename}
        />
      </Modal>

      {/* 新建文件夹 Modal */}
      <Modal
        title={t('pages.system.files.newFolderModalTitle')}
        open={createFolderVisible}
        onCancel={() => {
          setCreateFolderVisible(false);
          setFolderName('');
        }}
        onOk={handleCreateFolder}
        confirmLoading={creatingFolder}
      >
        <Input
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          placeholder={t('pages.system.files.folderNamePlaceholder')}
          onPressEnter={handleCreateFolder}
          autoFocus
        />
      </Modal>

      {/* 右键菜单 */}
      {contextMenuVisible && (
        <div
          style={{
            position: 'fixed',
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
            zIndex: 1000,
          }}
          onClick={() => setContextMenuVisible(false)}
        >
          <Menu
            items={contextMenuItems}
            onClick={() => setContextMenuVisible(false)}
          />
        </div>
      )}
    </>
  );
};

export default FileListPage;
