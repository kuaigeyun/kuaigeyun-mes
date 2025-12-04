/**
 * 文件管理列表页面 - Windows 资源管理器风格
 * 
 * 用于系统管理员查看和管理组织内的文件。
 * 支持文件的 CRUD 操作、上传、下载、预览功能。
 */

import React, { useState, useEffect, useCallback } from 'react';
import { App, Button, Space, Modal, Upload, Tree, Breadcrumb, Table, Menu, Input, Tooltip, Divider } from 'antd';
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
  SearchOutlined,
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
  File,
  FileUpdate,
  FileListParams,
  FilePreviewResponse,
} from '../../../../services/file';

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
 * 视图类型
 */
type ViewType = 'icons' | 'list' | 'details';

/**
 * 文件管理列表页面组件
 */
const FileListPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  
  // 视图状态
  const [viewType, setViewType] = useState<ViewType>('details');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [fileList, setFileList] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 文件夹树状态
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [filteredTreeData, setFilteredTreeData] = useState<DataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedTreeKeys, setSelectedTreeKeys] = useState<React.Key[]>([]);
  const [currentPath, setCurrentPath] = useState<string[]>(['全部文件']);
  const [treeSearchValue, setTreeSearchValue] = useState<string>('');
  
  // Modal 相关状态
  const [uploadVisible, setUploadVisible] = useState(false);
  const [uploadFileList, setUploadFileList] = useState<AntdUploadFile[]>([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewInfo, setPreviewInfo] = useState<FilePreviewResponse | null>(null);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameFile, setRenameFile] = useState<File | null>(null);
  
  // 右键菜单状态
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuFile, setContextMenuFile] = useState<File | null>(null);
  
  // 剪贴板状态（用于复制/剪切）
  const [clipboard, setClipboard] = useState<{ type: 'copy' | 'cut' | null; files: File[] }>({ type: null, files: [] });

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
      messageApi.error(error.message || '加载文件列表失败');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  /**
   * 初始化文件夹树
   */
  useEffect(() => {
    // 从文件列表中提取分类，构建文件夹树
    const categories = new Set<string>();
    fileList.forEach(file => {
      if (file.category) {
        categories.add(file.category);
      }
    });
    
    const treeNodes: DataNode[] = [
      {
        title: '全部文件',
        key: 'all',
        icon: <FolderOpenOutlined />,
        isLeaf: false,
      },
      ...Array.from(categories).map(category => ({
        title: category,
        key: category,
        icon: <FolderOutlined />,
        isLeaf: false,
      })),
    ];
    
    setTreeData(treeNodes);
    // 初始化时，如果没有搜索关键词，显示所有节点
    if (!treeSearchValue.trim()) {
      setFilteredTreeData(treeNodes);
    }
    if (selectedTreeKeys.length === 0) {
      setSelectedTreeKeys(['all']);
    }
  }, [fileList, treeSearchValue]);

  /**
   * 过滤文件夹树（根据搜索关键词）
   */
  useEffect(() => {
    if (!treeSearchValue.trim()) {
      setFilteredTreeData(treeData);
      return;
    }

    const searchLower = treeSearchValue.toLowerCase().trim();
    const filtered = treeData.filter(node => {
      const title = (node.title as string) || '';
      return title.toLowerCase().includes(searchLower);
    });

    setFilteredTreeData(filtered);
    
    // 如果有搜索结果，自动展开所有节点
    if (filtered.length > 0) {
      setExpandedKeys(filtered.map(node => node.key));
    }
  }, [treeData, treeSearchValue]);

  /**
   * 初始加载
   */
  useEffect(() => {
    loadFileList();
  }, [loadFileList]);

  /**
   * 处理文件夹树选择
   */
  const handleTreeSelect: TreeProps['onSelect'] = (selectedKeys) => {
    if (selectedKeys.length > 0) {
      const key = selectedKeys[0] as string;
      setSelectedTreeKeys(selectedKeys);
      
      if (key === 'all') {
        setCurrentPath(['全部文件']);
        loadFileList();
      } else {
        setCurrentPath(['全部文件', key]);
        loadFileList(key);
      }
    }
  };

  /**
   * 处理文件上传
   */
  const handleUpload = async () => {
    if (uploadFileList.length === 0) {
      messageApi.warning('请选择要上传的文件');
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
      messageApi.success('上传成功');
      setUploadVisible(false);
      setUploadFileList([]);
      loadFileList(selectedTreeKeys[0] === 'all' ? undefined : selectedTreeKeys[0] as string);
    } catch (error: any) {
      messageApi.error(error.message || '上传失败');
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
      messageApi.error(error.message || '获取预览信息失败');
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
      messageApi.warning('请选择要删除的文件');
      return;
    }
    
    try {
      await batchDeleteFiles(filesToDelete.map(f => f.uuid));
      messageApi.success('删除成功');
      setSelectedRowKeys([]);
      loadFileList(selectedTreeKeys[0] === 'all' ? undefined : selectedTreeKeys[0] as string);
    } catch (error: any) {
      messageApi.error(error.message || '删除失败');
    }
  };

  /**
   * 处理文件重命名
   */
  const handleRename = async () => {
    if (!renameFile || !renameValue.trim()) {
      messageApi.warning('请输入新名称');
      return;
    }
    
    try {
      await updateFile(renameFile.uuid, {
        name: renameValue.trim(),
      } as FileUpdate);
      messageApi.success('重命名成功');
      setRenameVisible(false);
      setRenameFile(null);
      setRenameValue('');
      loadFileList(selectedTreeKeys[0] === 'all' ? undefined : selectedTreeKeys[0] as string);
    } catch (error: any) {
      messageApi.error(error.message || '重命名失败');
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
      label: '打开',
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
      label: '下载',
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
      label: '剪切',
      icon: <ScissorOutlined />,
      onClick: () => {
        const files = contextMenuFile ? [contextMenuFile] : selectedRowKeys.map(key => fileList.find(f => f.uuid === key)).filter(Boolean) as File[];
        setClipboard({ type: 'cut', files });
        setContextMenuVisible(false);
      },
    },
    {
      key: 'copy',
      label: '复制',
      icon: <CopyOutlined />,
      onClick: () => {
        const files = contextMenuFile ? [contextMenuFile] : selectedRowKeys.map(key => fileList.find(f => f.uuid === key)).filter(Boolean) as File[];
        setClipboard({ type: 'copy', files });
        setContextMenuVisible(false);
      },
    },
    {
      key: 'paste',
      label: '粘贴',
      icon: <SnippetsOutlined />,
      disabled: clipboard.type === null || clipboard.files.length === 0,
      onClick: () => {
        // TODO: 实现粘贴功能
        messageApi.info('粘贴功能开发中');
        setContextMenuVisible(false);
      },
    },
    { type: 'divider' },
    {
      key: 'rename',
      label: '重命名',
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
      label: '删除',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => {
        handleDelete(contextMenuFile || undefined);
        setContextMenuVisible(false);
      },
    },
  ];

  /**
   * 表格列定义（详细信息视图）
   */
  const columns: ColumnsType<File> = [
    {
      title: '名称',
      dataIndex: 'original_name',
      key: 'name',
      width: '40%',
      render: (_, record) => (
        <Space>
          {getFileIcon(record.file_type, 20)}
          <span>{record.original_name}</span>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'file_type',
      key: 'type',
      width: '15%',
      render: (_, record) => record.file_type || '未知',
    },
    {
      title: '大小',
      dataIndex: 'file_size',
      key: 'size',
      width: '15%',
      render: (_, record) => formatFileSize(record.file_size),
    },
    {
      title: '修改时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: '20%',
      render: (_, record) => new Date(record.updated_at).toLocaleString('zh-CN'),
    },
  ];

  /**
   * 渲染文件列表（图标视图）
   */
  const renderIconsView = () => {
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
        {fileList.map(file => (
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
                // Ctrl/Cmd 多选
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
            {getFileIcon(file.file_type, 48)}
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
        ))}
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
        {fileList.map(file => (
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
    <div className="file-management-page" style={{ display: 'flex', height: 'calc(100vh - 96px)', padding: 0, margin: 0 }}>
      <style>{`
        .file-manager-tree .ant-tree-node-content-wrapper {
          padding: 4px 8px !important;
        }
        .file-manager-tree .ant-tree-title {
          user-select: none;
        }
      `}</style>
      
      {/* 左侧文件夹树 */}
      <div
        style={{
          width: '250px',
          borderRight: '1px solid #f0f0f0',
          backgroundColor: '#fafafa',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        {/* 搜索栏 */}
        <div style={{ padding: '8px', borderBottom: '1px solid #f0f0f0' }}>
          <Input
            placeholder="搜索文件夹"
            prefix={<SearchOutlined />}
            value={treeSearchValue}
            onChange={(e) => setTreeSearchValue(e.target.value)}
            allowClear
            size="middle"
          />
        </div>
        
        {/* 文件夹树 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
          <Tree
            className="file-manager-tree"
            treeData={filteredTreeData.length > 0 || !treeSearchValue.trim() ? filteredTreeData : treeData}
            selectedKeys={selectedTreeKeys}
            expandedKeys={expandedKeys}
            onSelect={handleTreeSelect}
            onExpand={setExpandedKeys}
            showIcon
            blockNode
          />
        </div>
      </div>

      {/* 右侧主内容区 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: '#fff' }}>
        {/* 顶部工具栏 */}
        <div
          style={{
            borderBottom: '1px solid #f0f0f0',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Space>
            <Button icon={<ArrowLeftOutlined />} disabled />
            <Button icon={<ArrowRightOutlined />} disabled />
            <Button icon={<UpOutlined />} disabled />
            <Button icon={<ReloadOutlined />} onClick={() => loadFileList(selectedTreeKeys[0] === 'all' ? undefined : selectedTreeKeys[0] as string)} />
          </Space>
          
          <Divider type="vertical" />
          
          {/* 地址栏 */}
          <Breadcrumb
            style={{ flex: 1 }}
            items={currentPath.map((path, index) => ({
              title: index === currentPath.length - 1 ? (
                <span style={{ fontWeight: 500 }}>{path}</span>
              ) : (
                <a onClick={() => {
                  // TODO: 实现路径导航
                }}>{path}</a>
              ),
            }))}
          />
          
          <Divider type="vertical" />
          
          {/* 视图切换 */}
          <Space>
            <Tooltip title="图标视图">
              <Button
                type={viewType === 'icons' ? 'primary' : 'default'}
                icon={<AppstoreOutlined />}
                onClick={() => setViewType('icons')}
              />
            </Tooltip>
            <Tooltip title="列表视图">
              <Button
                type={viewType === 'list' ? 'primary' : 'default'}
                icon={<UnorderedListOutlined />}
                onClick={() => setViewType('list')}
              />
            </Tooltip>
            <Tooltip title="详细信息">
              <Button
                type={viewType === 'details' ? 'primary' : 'default'}
                icon={<UnorderedListOutlined />}
                onClick={() => setViewType('details')}
              />
            </Tooltip>
          </Space>
        </div>

        {/* 操作工具栏 */}
        <div
          style={{
            borderBottom: '1px solid #f0f0f0',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={() => setUploadVisible(true)}
          >
            上传
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => messageApi.info('新建文件夹功能开发中')}
          >
            新建文件夹
          </Button>
          <Button
            danger
            disabled={selectedRowKeys.length === 0}
            icon={<DeleteOutlined />}
            onClick={() => handleDelete()}
          >
            删除
          </Button>
        </div>

        {/* 文件列表区域 */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {viewType === 'icons' && renderIconsView()}
          {viewType === 'list' && renderListView()}
          {viewType === 'details' && (
            <Table<File>
              columns={columns}
              dataSource={fileList}
              rowKey="uuid"
              loading={loading}
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

        {/* 底部状态栏 */}
        <div
          style={{
            borderTop: '1px solid #f0f0f0',
            padding: '8px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: '#666',
          }}
        >
          <span>
            {selectedRowKeys.length > 0
              ? `已选择 ${selectedRowKeys.length} 项，共 ${formatFileSize(selectedFilesSize)}`
              : `共 ${fileList.length} 项`}
          </span>
          <span>{formatFileSize(fileList.reduce((total, file) => total + file.file_size, 0))}</span>
        </div>
      </div>

      {/* 上传文件 Modal */}
      <Modal
        title="上传文件"
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
          <Button icon={<UploadOutlined />}>选择文件</Button>
        </Upload>
      </Modal>

      {/* 文件预览 Modal */}
      <Modal
        title="文件预览"
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
            title="文件预览"
          />
        )}
      </Modal>

      {/* 重命名 Modal */}
      <Modal
        title="重命名"
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
          placeholder="请输入新名称"
          onPressEnter={handleRename}
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
    </div>
  );
};

export default FileListPage;
