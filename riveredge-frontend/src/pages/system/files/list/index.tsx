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
import { ProFormText, ProFormInstance } from '@ant-design/pro-components';
import { App, Button, Space, Modal, Upload, Breadcrumb, Table, Menu, Input, Tooltip, Select, Checkbox, theme } from 'antd';
import { ThemedSegmented } from '../../../../components/themed-segmented';
import { TwoColumnLayout, FormModalTemplate } from '../../../../components/layout-templates';
import {
  MODAL_CONFIG,
} from '../../../../components/layout-templates/constants';
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
  FolderFilled,
  FolderOpenFilled,
  ReloadOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  UpOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  CopyOutlined,
  ScissorOutlined,
  SnippetsOutlined,
  CompressOutlined,
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
  getFileDownloadUrlWithToken,
  backfillImageTiers,
  type File,
  FileUpdate,
  FileListParams,
} from '../../../../services/file';
import FilePreviewModal from '../../../../components/file-preview';
import { useNavigationMenuTreeQuery } from '../../../../hooks/useNavigationMenuTreeQuery';
import { collectNavigationMenuPaths } from '../../../../utils/navigationMenuPaths';
import { 
  FILE_ATTACHMENTS_GROUP_KEY,
  FILE_SYSTEM_FOLDERS_GROUP_KEY,
  FILE_USER_FOLDERS_GROUP_KEY,
  FILE_UNCATEGORIZED_GROUP_KEY,
  collectDocumentAttachmentCategories,
  isDocumentAttachmentCategory,
  isSystemFolderCategory,
  isUserFolderCategory,
  resolveFileUploadCategoryDisplayName,
} from '../../../../core/constants/fileUploadCategories';

/**
 * 判断是否为图片类型（用于图标视图缩略图与预览）
 */
const isImageFile = (file: File): boolean => {
  const type = (file.file_type || '').toLowerCase();
  if (type.startsWith('image/')) return true;
  const ext = (file.file_extension || file.original_name?.split('.').pop() || '').toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'].includes(ext);
};

/** 文件类型筛选（工具栏分段控制器） */
type FileTypeFilter = 'all' | 'image' | 'document' | 'drawing' | 'other';

function classifyFileTypeFilter(file: File): Exclude<FileTypeFilter, 'all'> {
  if (isImageFile(file)) return 'image';
  const ext = (file.file_extension || file.original_name?.split('.').pop() || '').toLowerCase();
  const mime = (file.file_type || '').toLowerCase();
  if (['dwg', 'dxf', 'step', 'stp'].includes(ext)) return 'drawing';
  if (
    ext === 'pdf' ||
    ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'json'].includes(ext) ||
    mime.includes('pdf') ||
    mime.includes('word') ||
    mime.includes('document') ||
    mime.includes('excel') ||
    mime.includes('spreadsheet') ||
    mime.includes('powerpoint') ||
    mime.includes('presentation') ||
    mime.startsWith('text/')
  ) {
    return 'document';
  }
  return 'other';
}

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

type FolderIconKind = 'system' | 'user' | 'uncategorized';

const FILE_TREE_FOLDER_COLORS: Record<FolderIconKind, string> = {
  system: '#0078D4',
  user: '#FDB813',
  uncategorized: '#8c8c8c',
};

function createFolderTreeIcon(kind: FolderIconKind, open = false) {
  const Icon = open ? FolderOpenFilled : FolderFilled;
  return <Icon style={{ color: FILE_TREE_FOLDER_COLORS[kind], fontSize: 16 }} />;
}

type FileFolderNode = DataNode & {
  rawCategory?: string;
  displayTitle?: string;
  folderKind?: 'system-group' | 'user-group' | 'uncategorized' | 'attachments-group' | 'category';
};

const CLIENT_FILTER_TREE_KEYS = new Set([
  FILE_ATTACHMENTS_GROUP_KEY,
  FILE_SYSTEM_FOLDERS_GROUP_KEY,
  FILE_USER_FOLDERS_GROUP_KEY,
]);

function isValidUserFolderName(name: string): boolean {
  return /[\u4e00-\u9fff]/.test(name.trim());
}

/**
 * 缩略图渲染组件 - 抽离到外部避免 Parent Re-render 时物理销毁重建组件（解决闪烁根本原因）
 */
const FileThumbnail = React.memo(({ file, size }: { file: File; size: number }) => {
  const [error, setError] = useState(false);
  const isImage = isImageFile(file);
  const hasThumb = isImage && file.preview_url && !error;

  if (hasThumb) {
    return (
      <img
        src={file.preview_url}
        alt={file.original_name}
        loading="lazy"
        style={{
          width: size,
          height: size,
          objectFit: 'cover',
          borderRadius: '4px',
          backgroundColor: '#f5f5f5',
        }}
        onError={() => setError(true)}
      />
    );
  }
  return getFileIcon(file.file_type, size * 0.75);
});
FileThumbnail.displayName = 'FileThumbnail';

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
  const [allFiles, setAllFiles] = useState<File[]>([]); // 核心：维护一份全量文件列表用于构建树，避免过滤时树节点消失
  const [nonEmptyAttachmentCategories, setNonEmptyAttachmentCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // 排序（Windows 资源管理器逻辑：默认按名称升序）
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('descend');
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>('all');
  
  // 文件夹树状态
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [filteredTreeData, setFilteredTreeData] = useState<DataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedTreeKeys, setSelectedTreeKeys] = useState<React.Key[]>([]);
  const ROOT_PATH_KEY = 'all';
  const [currentPath, setCurrentPath] = useState<string[]>([ROOT_PATH_KEY]);
  const [treeSearchValue, setTreeSearchValue] = useState<string>('');

  const resolveCategoryDisplayName = useCallback(
    (category?: string): string => resolveFileUploadCategoryDisplayName(category, t),
    [t],
  );

  const { data: navigationMenuTree } = useNavigationMenuTreeQuery();
  const enabledMenuPaths = useMemo(
    () => (navigationMenuTree ? collectNavigationMenuPaths(navigationMenuTree) : undefined),
    [navigationMenuTree],
  );
  
  // Modal 相关状态
  const [uploadVisible, setUploadVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFileList, setUploadFileList] = useState<AntdUploadFile[]>([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameFile, setRenameFile] = useState<File | null>(null);
  const [createFolderVisible, setCreateFolderVisible] = useState(false);
  const createFolderFormRef = useRef<ProFormInstance>();
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [editFolderVisible, setEditFolderVisible] = useState(false);
  const editFolderFormRef = useRef<ProFormInstance>();
  const [editingFolderCategory, setEditingFolderCategory] = useState<string | null>(null);
  const [savingFolderEdit, setSavingFolderEdit] = useState(false);
  const [imageTierBackfillLoading, setImageTierBackfillLoading] = useState(false);
  
  // 右键菜单状态
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuFile, setContextMenuFile] = useState<File | null>(null);
  const [treeContextMenuVisible, setTreeContextMenuVisible] = useState(false);
  const [treeContextMenuPosition, setTreeContextMenuPosition] = useState({ x: 0, y: 0 });
  const [treeContextMenuNode, setTreeContextMenuNode] = useState<FileFolderNode | null>(null);
  const lastSelectedFileUuidRef = useRef<string | null>(null);
  
  // 剪贴板状态（用于复制/剪切）
  const [clipboard, setClipboard] = useState<{ type: 'copy' | 'cut' | null; files: File[] }>({ type: null, files: [] });

  const collectExistingCategories = useCallback((): Set<string> => {
    const categories = new Set<string>();
    allFiles.forEach(file => {
      if (file.category) categories.add(file.category);
    });
    return categories;
  }, [allFiles]);

  /**
   * 加载文件列表
   * @param treeKey undefined / 'all' = 全部；@ 开头 = 虚拟分组；其余 = 指定 category
   */
  const loadFileList = useCallback(async (treeKey?: string) => {
    try {
      setLoading(true);
      const key = treeKey === 'all' ? undefined : treeKey;
      const isClientFilter = Boolean(key && CLIENT_FILTER_TREE_KEYS.has(key));
      const category =
        key === FILE_UNCATEGORIZED_GROUP_KEY
          ? FILE_UNCATEGORIZED_GROUP_KEY
          : key && !isClientFilter
            ? key
            : undefined;

      const params: FileListParams = {
        page: 1,
        page_size: 1000,
        category: isClientFilter ? undefined : category,
        include_preview_url: true,
      };
      const response = await getFileList(params);

      if (response.non_empty_attachment_categories) {
        setNonEmptyAttachmentCategories(response.non_empty_attachment_categories);
      }

      if (!key) {
        setAllFiles(response.items);
        setFileList(response.items);
        return;
      }

      if (isClientFilter) {
        setAllFiles(response.items);
      }

      if (key === FILE_ATTACHMENTS_GROUP_KEY) {
        setFileList(
          response.items.filter(
            file => file.category && isDocumentAttachmentCategory(file.category),
          ),
        );
        return;
      }

      if (key === FILE_SYSTEM_FOLDERS_GROUP_KEY) {
        setFileList(
          response.items.filter(
            file => file.category && isSystemFolderCategory(file.category),
          ),
        );
        return;
      }

      if (key === FILE_USER_FOLDERS_GROUP_KEY) {
        setFileList(
          response.items.filter(
            file => file.category && isUserFolderCategory(file.category),
          ),
        );
        return;
      }

      setFileList(response.items);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.files.loadListFailed'));
    } finally {
      setLoading(false);
    }
  }, [messageApi, t]);

  const reloadCurrentFolder = useCallback(() => {
    const key = selectedTreeKeys[0] as string | undefined;
    if (!key || key === 'all') {
      loadFileList(undefined);
      return;
    }
    loadFileList(key);
  }, [loadFileList, selectedTreeKeys]);

  const resolvePathDisplayName = useCallback(
    (pathKey: string): string => {
      if (pathKey === ROOT_PATH_KEY) return t('pages.system.files.allFiles');
      if (pathKey === FILE_SYSTEM_FOLDERS_GROUP_KEY) return t('pages.system.files.systemFolders');
      if (pathKey === FILE_USER_FOLDERS_GROUP_KEY) return t('pages.system.files.userFolders');
      if (pathKey === FILE_UNCATEGORIZED_GROUP_KEY) return t('pages.system.files.uncategorizedFolder');
      if (pathKey === FILE_ATTACHMENTS_GROUP_KEY) return t('pages.system.files.attachmentsFolder');
      return resolveCategoryDisplayName(pathKey);
    },
    [resolveCategoryDisplayName, t],
  );

  const resolveTreePath = useCallback((key: string): string[] => {
    if (key === 'all') return [ROOT_PATH_KEY];
    if (key === FILE_UNCATEGORIZED_GROUP_KEY) return [ROOT_PATH_KEY, FILE_UNCATEGORIZED_GROUP_KEY];
    if (key === FILE_USER_FOLDERS_GROUP_KEY) return [ROOT_PATH_KEY, FILE_USER_FOLDERS_GROUP_KEY];
    if (key === FILE_SYSTEM_FOLDERS_GROUP_KEY) return [ROOT_PATH_KEY, FILE_SYSTEM_FOLDERS_GROUP_KEY];
    if (key === FILE_ATTACHMENTS_GROUP_KEY) {
      return [ROOT_PATH_KEY, FILE_SYSTEM_FOLDERS_GROUP_KEY, FILE_ATTACHMENTS_GROUP_KEY];
    }
    if (isDocumentAttachmentCategory(key)) {
      return [ROOT_PATH_KEY, FILE_SYSTEM_FOLDERS_GROUP_KEY, FILE_ATTACHMENTS_GROUP_KEY, key];
    }
    if (isUserFolderCategory(key)) return [ROOT_PATH_KEY, FILE_USER_FOLDERS_GROUP_KEY, key];
    if (isSystemFolderCategory(key)) return [ROOT_PATH_KEY, FILE_SYSTEM_FOLDERS_GROUP_KEY, key];
    return [ROOT_PATH_KEY, key];
  }, []);

  /**
   * 初始化文件夹树：仅一个根节点「全部文件」，其他文件夹作为其子节点
   * 优化：基于 allFiles（全量列表）构建，点击分类时不会导致其他文件夹消失
   */
  useEffect(() => {
    const categories = new Set<string>();
    allFiles.forEach(file => {
      if (file.category) {
        categories.add(file.category);
      }
    });
    nonEmptyAttachmentCategories.forEach(category => categories.add(category));

    const makeCategoryNode = (category: string, iconKind: FolderIconKind): FileFolderNode => ({
      title: resolveCategoryDisplayName(category),
      key: category,
      rawCategory: category,
      displayTitle: resolveCategoryDisplayName(category),
      folderKind: 'category',
      icon: createFolderTreeIcon(iconKind),
    });

    const normalizeFolderNode = (node: FileFolderNode): FileFolderNode => {
      const normalizedChildren = node.children?.length
        ? node.children.map(child => normalizeFolderNode(child as FileFolderNode))
        : undefined;
      const hasChildFolders = Boolean(normalizedChildren?.length);
      return {
        ...node,
        children: normalizedChildren,
        isLeaf: node.isLeaf ?? !hasChildFolders,
      };
    };

    const attachmentCategories = collectDocumentAttachmentCategories(categories, enabledMenuPaths);
    const systemCategories: string[] = [];
    const userCategories: string[] = [];
    categories.forEach(category => {
      if (isUserFolderCategory(category)) {
        userCategories.push(category);
      } else if (!isDocumentAttachmentCategory(category)) {
        systemCategories.push(category);
      }
    });

    const attachmentChildren = attachmentCategories
      .map(category => makeCategoryNode(category, 'system'))
      .sort((a, b) => naturalCompare(String(a.displayTitle), String(b.displayTitle)));

    const systemCategoryNodes = systemCategories
      .map(category => makeCategoryNode(category, 'system'))
      .sort((a, b) => naturalCompare(String(a.displayTitle), String(b.displayTitle)));

    const userFolderNodes = userCategories
      .map(category => makeCategoryNode(category, 'user'))
      .sort((a, b) => naturalCompare(String(a.displayTitle), String(b.displayTitle)));

    const systemChildren: FileFolderNode[] = [];
    if (attachmentChildren.length > 0) {
      systemChildren.push({
        title: t('pages.system.files.attachmentsFolder'),
        key: FILE_ATTACHMENTS_GROUP_KEY,
        displayTitle: t('pages.system.files.attachmentsFolder'),
        folderKind: 'attachments-group',
        icon: createFolderTreeIcon('system'),
        children: attachmentChildren,
      });
    }
    systemChildren.push(...systemCategoryNodes);

    const topLevelChildren: FileFolderNode[] = [
      normalizeFolderNode({
        title: t('pages.system.files.systemFolders'),
        key: FILE_SYSTEM_FOLDERS_GROUP_KEY,
        displayTitle: t('pages.system.files.systemFolders'),
        folderKind: 'system-group',
        icon: createFolderTreeIcon('system'),
        children: systemChildren.length > 0 ? systemChildren : undefined,
      }),
      normalizeFolderNode({
        title: t('pages.system.files.userFolders'),
        key: FILE_USER_FOLDERS_GROUP_KEY,
        displayTitle: t('pages.system.files.userFolders'),
        folderKind: 'user-group',
        icon: createFolderTreeIcon('user'),
        children: userFolderNodes.length > 0 ? userFolderNodes : undefined,
      }),
      {
        title: t('pages.system.files.uncategorizedFolder'),
        key: FILE_UNCATEGORIZED_GROUP_KEY,
        displayTitle: t('pages.system.files.uncategorizedFolder'),
        folderKind: 'uncategorized',
        icon: createFolderTreeIcon('uncategorized'),
        isLeaf: true,
      },
    ];

    const allFilesNode = normalizeFolderNode({
      title: t('pages.system.files.allFiles'),
      key: 'all',
      icon: createFolderTreeIcon('system', true),
      children: topLevelChildren.length > 0 ? topLevelChildren : undefined,
    });

    const treeNodes: DataNode[] = [allFilesNode];
    setTreeData(treeNodes);

    if (!treeSearchValue.trim()) {
      setFilteredTreeData(treeNodes);
    }
    if (selectedTreeKeys.length === 0) {
      setSelectedTreeKeys(['all']);
    }
    if (topLevelChildren.length > 0) {
      setExpandedKeys(prev => {
        const next = new Set(prev);
        next.add('all');
        next.add(FILE_SYSTEM_FOLDERS_GROUP_KEY);
        next.add(FILE_USER_FOLDERS_GROUP_KEY);
        if (attachmentChildren.length > 0) {
          next.add(FILE_ATTACHMENTS_GROUP_KEY);
        }
        return Array.from(next);
      });
    }
  }, [allFiles, nonEmptyAttachmentCategories, t, selectedTreeKeys.length, treeSearchValue, resolveCategoryDisplayName, enabledMenuPaths]);

  /**
   * 过滤文件夹树（根据搜索关键词）：递归匹配「全部文件」及其子文件夹
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

    const filterNodes = (nodes: DataNode[]): DataNode[] =>
      nodes.reduce<DataNode[]>((acc, node) => {
        const folderNode = node as FileFolderNode;
        const title = ((node.title as string) || '').toLowerCase();
        const rawCategory = (folderNode.rawCategory || '').toLowerCase();
        const keyStr = String(node.key).toLowerCase();
        const selfMatch =
          title.includes(searchLower) ||
          rawCategory.includes(searchLower) ||
          keyStr.includes(searchLower);

        const childMatches = node.children ? filterNodes(node.children as DataNode[]) : [];

        if (selfMatch) {
          acc.push(node);
        } else if (childMatches.length > 0) {
          acc.push({ ...node, children: childMatches });
        }
        return acc;
      }, []);

    const root = treeData[0];
    const filteredChildren = filterNodes((root.children || []) as DataNode[]);
    const matchesRoot = ((root.title as string) || '').toLowerCase().includes(searchLower);
    const filteredRoot: DataNode = {
      ...root,
      children: filteredChildren.length > 0 ? filteredChildren : undefined,
    };
    const filtered = matchesRoot || filteredChildren.length > 0 ? [filteredRoot] : [];

    setFilteredTreeData(filtered);
    if (filtered.length > 0) {
      setExpandedKeys(prev => {
        const next = new Set(prev);
        next.add('all');
        next.add(FILE_SYSTEM_FOLDERS_GROUP_KEY);
        next.add(FILE_USER_FOLDERS_GROUP_KEY);
        next.add(FILE_ATTACHMENTS_GROUP_KEY);
        return Array.from(next);
      });
    }
  }, [treeData, treeSearchValue]);

  /**
   * 初始加载
   */
  useEffect(() => {
    loadFileList();
  }, [loadFileList]);

  const filteredFileList = useMemo(() => {
    if (fileTypeFilter === 'all') return fileList;
    return fileList.filter(file => classifyFileTypeFilter(file) === fileTypeFilter);
  }, [fileList, fileTypeFilter]);

  /**
   * 排序后的文件列表（Windows 资源管理器逻辑：名称自然排序，支持按大小/类型/日期）
   */
  const sortedFileList = useMemo(() => {
    const list = [...filteredFileList];
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
  }, [filteredFileList, sortField, sortOrder]);

  const displayedFileUuids = useMemo(
    () => sortedFileList.map(file => file.uuid),
    [sortedFileList],
  );

  const isAllDisplayedSelected =
    displayedFileUuids.length > 0 && displayedFileUuids.every(uuid => selectedRowKeys.includes(uuid));

  const isPartialDisplayedSelected =
    selectedRowKeys.length > 0 &&
    !isAllDisplayedSelected &&
    displayedFileUuids.some(uuid => selectedRowKeys.includes(uuid));

  const handleSelectAllChange = useCallback(
    (checked: boolean) => {
      setSelectedRowKeys(checked ? displayedFileUuids : []);
      lastSelectedFileUuidRef.current = null;
    },
    [displayedFileUuids],
  );

  const handleFileCheckboxChange = useCallback((file: File, checked: boolean) => {
    setSelectedRowKeys(prev =>
      checked ? (prev.includes(file.uuid) ? prev : [...prev, file.uuid]) : prev.filter(key => key !== file.uuid),
    );
    lastSelectedFileUuidRef.current = file.uuid;
  }, []);

  const handleFileItemClick = useCallback(
    (file: File, index: number, e: React.MouseEvent) => {
      if (e.shiftKey && lastSelectedFileUuidRef.current) {
        const lastIndex = sortedFileList.findIndex(item => item.uuid === lastSelectedFileUuidRef.current);
        if (lastIndex >= 0) {
          const start = Math.min(lastIndex, index);
          const end = Math.max(lastIndex, index);
          const rangeUuids = sortedFileList.slice(start, end + 1).map(item => item.uuid);
          if (e.ctrlKey || e.metaKey) {
            setSelectedRowKeys(prev => Array.from(new Set([...prev, ...rangeUuids])));
          } else {
            setSelectedRowKeys(rangeUuids);
          }
          lastSelectedFileUuidRef.current = file.uuid;
          return;
        }
      }

      if (e.ctrlKey || e.metaKey) {
        setSelectedRowKeys(prev =>
          prev.includes(file.uuid) ? prev.filter(key => key !== file.uuid) : [...prev, file.uuid],
        );
      } else {
        setSelectedRowKeys([file.uuid]);
      }
      lastSelectedFileUuidRef.current = file.uuid;
    },
    [sortedFileList],
  );

  /**
   * 处理文件夹树选择
   */
  const handleTreeSelect: TreeProps['onSelect'] = (selectedKeys) => {
    if (selectedKeys.length > 0) {
      const key = selectedKeys[0] as string;
      setSelectedTreeKeys(selectedKeys);
      setSelectedRowKeys([]);
      lastSelectedFileUuidRef.current = null;
      setCurrentPath(resolveTreePath(key));
      if (key === 'all') {
        loadFileList(undefined);
      } else {
        loadFileList(key);
      }
    }
  };

  const selectUserFolder = useCallback((category: string) => {
    setSelectedTreeKeys([category]);
    setCurrentPath([ROOT_PATH_KEY, FILE_USER_FOLDERS_GROUP_KEY, category]);
    setExpandedKeys(prev => {
      const next = new Set(prev);
      next.add('all');
      next.add(FILE_USER_FOLDERS_GROUP_KEY);
      return Array.from(next);
    });
    loadFileList(category);
  }, [loadFileList]);

  /**
   * 处理文件上传
   */
  const handleUpload = async () => {
    if (uploadFileList.length === 0) {
      messageApi.warning(t('pages.system.files.selectFilesToUpload'));
      return;
    }
    try {
      setUploading(true);
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
      reloadCurrentFolder();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.files.uploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  /**
   * 处理新建文件夹（由 FormModalTemplate onFinish 调用）
   */
  const handleCreateFolderSubmit = async (values: { folderName?: string }) => {
    const name = (values?.folderName ?? '').trim();
    if (!name) {
      messageApi.warning(t('pages.system.files.enterFolderName'));
      return;
    }
    if (!isValidUserFolderName(name)) {
      messageApi.warning(t('pages.system.files.enterFolderName'));
      return;
    }
    const categories = collectExistingCategories();
    if (categories.has(name)) {
      messageApi.warning(t('pages.system.files.folderNameExists'));
      return;
    }
    try {
      setCreatingFolder(true);
      const placeholderContent = new Blob(['FOLDER_PLACEHOLDER'], { type: 'text/plain' });
      const placeholderFile = new File([placeholderContent], `folder_${name}.txt`, { type: 'text/plain' });
      await uploadFile(placeholderFile, {
        category: name,
        description: t('pages.system.files.folderPlaceholderDesc'),
      });
      messageApi.success(t('pages.system.files.folderCreateSuccess'));
      setCreateFolderVisible(false);
      createFolderFormRef.current?.resetFields();
      await loadFileList(undefined);
      selectUserFolder(name);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.files.folderCreateFailed'));
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleEditFolderSubmit = async (values: { folderName?: string }) => {
    const newName = (values?.folderName ?? '').trim();
    const oldName = editingFolderCategory;
    if (!oldName || !newName) {
      messageApi.warning(t('pages.system.files.enterFolderName'));
      return;
    }
    if (!isValidUserFolderName(newName)) {
      messageApi.warning(t('pages.system.files.enterFolderName'));
      return;
    }
    if (newName === oldName) {
      setEditFolderVisible(false);
      setEditingFolderCategory(null);
      return;
    }
    const categories = collectExistingCategories();
    if (categories.has(newName)) {
      messageApi.warning(t('pages.system.files.folderNameExists'));
      return;
    }
    const filesInFolder = allFiles.filter(file => file.category === oldName);
    if (filesInFolder.length === 0) {
      messageApi.warning(t('pages.system.files.loadListFailed'));
      return;
    }
    try {
      setSavingFolderEdit(true);
      await Promise.all(
        filesInFolder.map(file =>
          updateFile(file.uuid, { category: newName } as FileUpdate),
        ),
      );
      messageApi.success(t('pages.system.files.folderEditSuccess'));
      setEditFolderVisible(false);
      editFolderFormRef.current?.resetFields();
      setEditingFolderCategory(null);
      await loadFileList(undefined);
      selectUserFolder(newName);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.files.folderCreateFailed'));
    } finally {
      setSavingFolderEdit(false);
    }
  };

  const handleDeleteFolder = useCallback((category: string) => {
    const filesInFolder = allFiles.filter(file => file.category === category);
    Modal.confirm({
      title: t('pages.system.files.contextDeleteFolder'),
      content: t('pages.system.files.deleteFolderConfirm'),
      okType: 'danger',
      onOk: async () => {
        if (filesInFolder.length === 0) {
          await loadFileList(undefined);
          return;
        }
        try {
          await batchDeleteFiles(filesInFolder.map(file => file.uuid));
          messageApi.success(t('pages.system.files.folderDeleteSuccess'));
          setSelectedTreeKeys(['all']);
          setCurrentPath([ROOT_PATH_KEY]);
          await loadFileList(undefined);
        } catch (error: any) {
          messageApi.error(error.message || t('pages.system.files.deleteFailed'));
        }
      },
    });
  }, [allFiles, loadFileList, messageApi, t]);

  /**
   * 处理文件预览
   */
  const handlePreview = async (file: File) => {
    setPreviewFile(file);
    setPreviewVisible(true);
  };

  /**
   * 存量图片三档压缩：缩略图 64 / 预览图 512
   */
  const handleBackfillImageTiers = async () => {
    try {
      setImageTierBackfillLoading(true);
      let offset = 0;
      let done = false;
      let totalGenerated = 0;
      const treeKey = selectedTreeKeys[0] as string | undefined;
      const category =
        treeKey &&
        treeKey !== ROOT_PATH_KEY &&
        treeKey !== FILE_UNCATEGORIZED_GROUP_KEY &&
        !CLIENT_FILTER_TREE_KEYS.has(treeKey)
          ? treeKey
          : undefined;

      while (!done) {
        const result = await backfillImageTiers({ limit: 50, offset, category });
        totalGenerated += result.generated;
        done = result.done;
        offset = result.next_offset;
      }
      messageApi.success(
        t('pages.system.files.imageTierBackfillSuccess', { count: totalGenerated }),
      );
      reloadCurrentFolder();
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : t('pages.system.files.imageTierBackfillFailed');
      messageApi.error(msg);
    } finally {
      setImageTierBackfillLoading(false);
    }
  };

  /**
   * 处理文件下载（使用带 token 的 URL，确保生产环境可下载）
   */
  const handleDownload = async (file: File) => {
    try {
      const downloadUrl = await getFileDownloadUrlWithToken(file.uuid);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = file.original_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.files.downloadFailed'));
    }
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
      reloadCurrentFolder();
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
      reloadCurrentFolder();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.files.renameFailed'));
    }
  };

  /**
   * 文件夹树右键菜单
   */
  const handleTreeRightClick: TreeProps['onRightClick'] = ({ event, node }) => {
    event.preventDefault();
    const folderNode = node as FileFolderNode;
    const key = String(node.key);
    const isUserGroup = key === FILE_USER_FOLDERS_GROUP_KEY;
    const isUserFolder = isUserFolderCategory(folderNode.rawCategory || key);
    if (!isUserGroup && !isUserFolder) return;

    setTreeContextMenuNode(folderNode);
    setTreeContextMenuPosition({ x: event.clientX, y: event.clientY });
    setTreeContextMenuVisible(true);
  };

  const treeContextMenuItems: MenuProps['items'] = useMemo(() => {
    if (!treeContextMenuNode) return [];
    const key = String(treeContextMenuNode.key);
    const isUserGroup = key === FILE_USER_FOLDERS_GROUP_KEY;
    const category = treeContextMenuNode.rawCategory || key;

    const items: MenuProps['items'] = [
      {
        key: 'new-folder',
        label: t('pages.system.files.contextNewFolder'),
        icon: <PlusOutlined />,
        onClick: () => {
          setCreateFolderVisible(true);
          setTreeContextMenuVisible(false);
        },
      },
    ];

    if (!isUserGroup && isUserFolderCategory(category)) {
      items.push(
        {
          key: 'edit-folder',
          label: t('pages.system.files.contextEditFolder'),
          icon: <EditOutlined />,
          onClick: () => {
            setEditingFolderCategory(category);
            setEditFolderVisible(true);
            editFolderFormRef.current?.setFieldsValue({ folderName: category });
            setTreeContextMenuVisible(false);
          },
        },
        {
          key: 'delete-folder',
          label: t('pages.system.files.contextDeleteFolder'),
          icon: <DeleteOutlined />,
          danger: true,
          onClick: () => {
            handleDeleteFolder(category);
            setTreeContextMenuVisible(false);
          },
        },
      );
    }

    return items;
  }, [handleDeleteFolder, t, treeContextMenuNode]);

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
        {sortedFileList.map((file, index) => {
          const isSelected = selectedRowKeys.includes(file.uuid);
          return (
            <div
              key={file.uuid}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '12px',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                border: isSelected ? `2px solid ${token.colorPrimary}` : '2px solid transparent',
                backgroundColor: isSelected ? `${token.colorPrimary}10` : 'transparent',
              }}
              onClick={(e) => handleFileItemClick(file, index, e)}
              onDoubleClick={() => handlePreview(file)}
              onContextMenu={(e) => handleContextMenu(e, file)}
            >
              <Checkbox
                checked={isSelected}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => handleFileCheckboxChange(file, e.target.checked)}
                style={{ position: 'absolute', top: 6, left: 6, zIndex: 1 }}
              />
              <div style={{ 
                width: imageThumbSize, 
                height: imageThumbSize, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }}>
                <FileThumbnail file={file} size={imageThumbSize} />
              </div>
              <div
                style={{
                  marginTop: '8px',
                  textAlign: 'center',
                  fontSize: '12px',
                  wordBreak: 'break-word',
                  maxWidth: '100px',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  lineHeight: '1.4',
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
        {sortedFileList.map((file, index) => {
          const isSelected = selectedRowKeys.includes(file.uuid);
          return (
          <div
            key={file.uuid}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              backgroundColor: isSelected ? '#e6f7ff' : 'transparent',
              border: isSelected ? '1px solid #1890ff' : '1px solid transparent',
            }}
            onClick={(e) => handleFileItemClick(file, index, e)}
            onDoubleClick={() => handlePreview(file)}
            onContextMenu={(e) => handleContextMenu(e, file)}
          >
            <Checkbox
              checked={isSelected}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => handleFileCheckboxChange(file, e.target.checked)}
              style={{ marginRight: 12, flexShrink: 0 }}
            />
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
          );
        })}
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
            titleRender: (node) => (
              <span
                style={{
                  display: 'inline-block',
                  maxWidth: '100%',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  verticalAlign: 'bottom',
                }}
                title={(node as FileFolderNode).displayTitle || (node.title as string)}
              >
                {(node as FileFolderNode).displayTitle || (node.title as string)}
              </span>
            ),
            showIcon: true,
            blockNode: true,
            switcherIcon: ({ isLeaf }) => (isLeaf ? false : undefined),
            className: 'file-manager-tree',
            onRightClick: handleTreeRightClick,
          },
        }}
        rightPanel={{
          contentPadding: 0,
          header: {
            left: (
              <Space>
                <Button icon={<ArrowLeftOutlined />} disabled />
                <Button icon={<ArrowRightOutlined />} disabled />
                <Button icon={<UpOutlined />} disabled />
                <Button icon={<ReloadOutlined />} onClick={reloadCurrentFolder} />
              </Space>
            ),
            center: (
              <Breadcrumb
                items={currentPath.map((path, index) => {
                  const displayPath = resolvePathDisplayName(path);
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
                <Checkbox
                  indeterminate={isPartialDisplayedSelected}
                  checked={isAllDisplayedSelected}
                  disabled={sortedFileList.length === 0}
                  onChange={(e) => handleSelectAllChange(e.target.checked)}
                >
                  {t('pages.system.files.selectAll')}
                </Checkbox>
                <div style={{ width: 1, height: 16, backgroundColor: token.colorSplit, margin: '0 4px' }} />
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
                <Button
                  icon={<CompressOutlined />}
                  loading={imageTierBackfillLoading}
                  onClick={() => void handleBackfillImageTiers()}
                >
                  {t('pages.system.files.imageTierBackfillButton')}
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
                <div style={{ width: 1, height: 16, backgroundColor: token.colorSplit, margin: '0 8px' }} />
                <Space>
                  <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>{t('pages.system.files.fileTypeLabel')}</span>
                  <ThemedSegmented
                    surfaceBackground
                    size="middle"
                    value={fileTypeFilter}
                    options={[
                      { label: t('pages.system.files.fileType.all'), value: 'all' },
                      { label: t('pages.system.files.fileType.image'), value: 'image' },
                      { label: t('pages.system.files.fileType.document'), value: 'document' },
                      { label: t('pages.system.files.fileType.drawing'), value: 'drawing' },
                      { label: t('pages.system.files.fileType.other'), value: 'other' },
                    ]}
                    onChange={(value) => setFileTypeFilter(value as FileTypeFilter)}
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
                      onChange: (keys) => {
                        setSelectedRowKeys(keys);
                        lastSelectedFileUuidRef.current =
                          keys.length > 0 ? String(keys[keys.length - 1]) : null;
                      },
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
                  : t('pages.system.files.totalCount', { n: sortedFileList.length })}
              </span>
              <span>{formatFileSize(fileList.reduce((total, file) => total + file.file_size, 0))}</span>
            </>
          ),
        }}
      />

      {/* 上传文件 Modal */}
      <FormModalTemplate
        title={t('pages.system.files.uploadModalTitle')}
        open={uploadVisible}
        onClose={() => {
          setUploadVisible(false);
          setUploadFileList([]);
        }}
        onFinish={async () => { await handleUpload(); }}
        isEdit={false}
        loading={uploading}
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <Upload.Dragger
          fileList={uploadFileList}
          onChange={({ fileList }) => setUploadFileList(fileList)}
          beforeUpload={() => false}
          multiple
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined style={{ fontSize: 48, color: token.colorPrimary }} />
          </p>
          <p className="ant-upload-text">{t('pages.system.files.dragDropHint')}</p>
          <p className="ant-upload-hint">{t('pages.system.files.clickOrDragHint')}</p>
        </Upload.Dragger>
      </FormModalTemplate>

      {/* 文件预览 Modal */}
      <FilePreviewModal
        open={previewVisible}
        onClose={() => {
          setPreviewVisible(false);
          setPreviewFile(null);
        }}
        fileUuid={previewFile?.uuid}
        fileName={previewFile?.original_name}
        fileType={previewFile?.file_type}
        fileExtension={previewFile?.file_extension}
        title={t('pages.system.files.previewModalTitle')}
        width="calc(100vw - 32px)"
        height="calc(100vh - 32px)"
      />

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
      <FormModalTemplate
        title={t('pages.system.files.newFolderModalTitle')}
        open={createFolderVisible}
        onClose={() => {
          setCreateFolderVisible(false);
          createFolderFormRef.current?.resetFields();
        }}
        onFinish={handleCreateFolderSubmit}
        isEdit={false}
        loading={creatingFolder}
        formRef={createFolderFormRef as React.RefObject<ProFormInstance>}
        initialValues={{ folderName: '' }}
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <ProFormText
          name="folderName"
          label={t('pages.system.files.folderNameLabel')}
          placeholder={t('pages.system.files.folderNamePlaceholder')}
          rules={[{ required: true, message: t('pages.system.files.enterFolderName') }]}
          fieldProps={{ autoFocus: true }}
        />
      </FormModalTemplate>

      {/* 编辑文件夹 Modal */}
      <FormModalTemplate
        title={t('pages.system.files.editFolderModalTitle')}
        open={editFolderVisible}
        onClose={() => {
          setEditFolderVisible(false);
          setEditingFolderCategory(null);
          editFolderFormRef.current?.resetFields();
        }}
        onFinish={handleEditFolderSubmit}
        isEdit
        loading={savingFolderEdit}
        formRef={editFolderFormRef as React.RefObject<ProFormInstance>}
        initialValues={{ folderName: editingFolderCategory ?? '' }}
        width={MODAL_CONFIG.SMALL_WIDTH}
      >
        <ProFormText
          name="folderName"
          label={t('pages.system.files.folderNameLabel')}
          placeholder={t('pages.system.files.folderNamePlaceholder')}
          rules={[{ required: true, message: t('pages.system.files.enterFolderName') }]}
          fieldProps={{ autoFocus: true }}
        />
      </FormModalTemplate>

      {/* 文件右键菜单与全屏遮罩 */}
      {contextMenuVisible && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
              backgroundColor: 'transparent',
            }}
            onClick={() => setContextMenuVisible(false)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenuVisible(false);
            }}
          />
          <div
            style={{
              position: 'fixed',
              left: contextMenuPosition.x,
              top: contextMenuPosition.y,
              zIndex: 1000,
              boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            <Menu
              items={contextMenuItems}
              onClick={() => setContextMenuVisible(false)}
              selectable={false}
              style={{ border: 'none', minWidth: '160px' }}
            />
          </div>
        </>
      )}

      {/* 文件夹树右键菜单 */}
      {treeContextMenuVisible && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
              backgroundColor: 'transparent',
            }}
            onClick={() => setTreeContextMenuVisible(false)}
            onContextMenu={(e) => {
              e.preventDefault();
              setTreeContextMenuVisible(false);
            }}
          />
          <div
            style={{
              position: 'fixed',
              left: treeContextMenuPosition.x,
              top: treeContextMenuPosition.y,
              zIndex: 1000,
              boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
              borderRadius: '8px',
              overflow: 'hidden',
            }}
          >
            <Menu
              items={treeContextMenuItems}
              onClick={() => setTreeContextMenuVisible(false)}
              selectable={false}
              style={{ border: 'none', minWidth: '160px' }}
            />
          </div>
        </>
      )}
    </>
  );
};

export default FileListPage;
