import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 工程图纸管理页面（两栏：左导航树 + 右表/预览）
 */

import React, { lazy, startTransition, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Dropdown, Grid, Input, Modal, Popconfirm, Segmented, Space, Spin, Tag, Timeline, Tooltip, theme } from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  ExpandOutlined,
  FilterOutlined,
  FolderOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PartitionOutlined,
  PlusOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import { UniTable, type UniTableRequestMeta} from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import {
  TwoColumnLayout,
  LIST_PAGE_TABLE_SCROLL,
  TWO_COLUMN_LAYOUT,
} from '../../../../../components/layout-templates';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { ProcessMasterDetailDrawer } from '../shared/processMasterDetailDrawer';
import { DetailDrawerActions } from '../../../../../components/layout-templates/DetailDrawerActions';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { DrawingFormModal } from '../../../components/DrawingFormModal';
import { StepBomImportWizard } from '../../../components/StepBomImportWizard';
import FilePreviewModal from '../../../../../components/file-preview';
import { CadPreviewLoading } from '../../../../../components/cad-preview/CadPreviewLoading';
import { materialApi } from '../../../services/material';
import { processRouteApi, unwrapProcessPagedList } from '../../../services/process';
import {
  drawingApi,
  normalizeFileBrief,
  type DrawingListView,
  type DrawingSecurityLevel,
  type DrawingStatus,
  type DrawingType,
  type EngineeringDrawing,
  type EngineeringDrawingRevisionBrief,
  type FileBrief,
} from '../../../services/drawing';
import {
  DRAWING_TREE_ALL_KEY,
  parseDrawingTreeKey,
  type DrawingPaneMode,
  type DrawingTreeFilter,
  type DrawingTreeNavItem,
} from './drawingTreeData';
import {
  DRAWING_NAV_MODES,
  buildDrawingNavTree,
  buildDrawingVaultTree,
  folderUuidFromTreeKey,
  inferNavModeFromTreeKey,
  isVaultTreeKey,
  treeKeyBelongsToMode,
  type DrawingNavMode,
} from './drawingTreeNav';
import { drawingFolderApi, type DrawingFolder } from '../../../services/drawingFolder';
import {
  DrawingFolderFormModal,
  DrawingMoveFolderModal,
} from './drawingFolderModals';
import { isStepFile } from '../../../../../utils/filePreviewKind';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import { alignProColumns } from '../../../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';
import { MASTER_DATA_LIST_FIELD_RANK } from '../../../utils/masterListCore';
import { masterCrudCreatedUpdatedColumns } from '../../../utils/masterListCore';
import { getAntdModal } from '../../../../../utils/antdAppApis';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { useCurrentUser } from '../../../../../hooks/useCurrentUser';
import { buildDrawingChangeCreateUrl } from '../../../../kuaiplm/services/master-data-links';
import { buildListPageHelpViewConfig } from '../../../../../components/page-help-wiki';
const DRAWING_PERMISSION = 'master-data:process:drawing';

const STATUS_COLOR: Record<DrawingStatus, string> = {
  Draft: 'default',
  Editing: 'processing',
  Pending: 'warning',
  Released: 'success',
  Obsolete: 'error',
};

function canImportStepBom(record: EngineeringDrawing): boolean {
  if (record.status !== 'Editing') return false;
  if (record.drawingType !== 'assembly') return false;
  if (!record.file) return false;
  return isStepFile({
    fileName: record.file.originalName,
    fileExtension: record.file.fileExtension,
  });
}

function bomDesignerPath(materialId: number, version: string): string {
  return `/apps/master-data/process/engineering-bom/designer?materialId=${materialId}&version=${encodeURIComponent(version)}`;
}

const LazyDrawingInlinePreview = lazy(() =>
  import('../../../components/DrawingInlinePreview').then((m) => ({ default: m.DrawingInlinePreview })),
);

type InlinePreviewPaneProps = {
  file: FileBrief | null;
  activeDrawing: EngineeringDrawing | null;
  previewPending: boolean;
  onOpenLargePreview: () => void;
  onOpenStepBom: (drawing: EngineeringDrawing) => void;
};

const InlinePreviewPane = React.memo(function InlinePreviewPane({
  file,
  activeDrawing,
  previewPending,
  onOpenLargePreview,
  onOpenStepBom,
}: InlinePreviewPaneProps) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const showStepBom = activeDrawing && canImportStepBom(activeDrawing);
  const showLarge = !!activeDrawing?.file?.uuid;

  return (
    <div
      className="drawings-inline-preview-pane"
      style={{
        flex: '1 1 0',
        minWidth: 280,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: `1px solid ${token.colorBorder}`,
        background: token.colorFillAlter,
        overflow: 'hidden',
      }}
    >
      <div
        className="drawings-inline-preview-header"
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          height: TWO_COLUMN_LAYOUT.PANEL_HEADER_HEIGHT,
          padding: '8px 12px',
          boxSizing: 'border-box',
          borderBottom: `1px solid ${token.colorBorder}`,
          background: token.colorFillAlter,
        }}
      >
        {(showStepBom || showLarge) && (
          <Space.Compact style={{ flexShrink: 0 }}>
            {showStepBom && (
              <Button icon={<PartitionOutlined />} onClick={() => onOpenStepBom(activeDrawing!)}>
                {t('app.master-data.drawings.importStepBom')}
              </Button>
            )}
            {showLarge && (
              <Button icon={<ExpandOutlined />} onClick={onOpenLargePreview}>
                {t('app.master-data.drawings.openLargePreview')}
              </Button>
            )}
          </Space.Compact>
        )}
      </div>
      <div
        className="drawings-inline-preview-body"
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          contain: 'layout paint style',
          background: token.colorBgContainer,
        }}
      >
        {previewPending && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'color-mix(in srgb, var(--ant-color-bg-container) 72%, transparent)',
              pointerEvents: 'none',
            }}
          >
            <CadPreviewLoading text={t('app.master-data.drawings.stepPreviewLoading')} />
          </div>
        )}
        <Suspense
          fallback={
            <CadPreviewLoading text={t('app.master-data.drawings.stepPreviewLoading')} minHeight="100%" />
          }
        >
          <LazyDrawingInlinePreview
            fileUuid={file?.uuid}
            fileName={file?.originalName}
            fileExtension={file?.fileExtension}
            height="100%"
            chromeless
          />
        </Suspense>
      </div>
    </div>
  );
});

function formatAssociationLabels(
  items: Array<{ code?: string; mainCode?: string; name: string }> | undefined,
): string {
  if (!items?.length) return '-';
  return items.map((item) => `${item.mainCode ?? item.code ?? ''} - ${item.name}`).join('; ');
}

const DrawingsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { message: messageApi } = App.useApp();
  const currentUser = useCurrentUser();
  const { canCreate, canUpdate, canDelete, canPrint, canAction } = useResourcePermissions(DRAWING_PERMISSION);
  const changePerms = useResourcePermissions('kuaiplm.change');
  const canSubmit = !!canAction?.('submit');
  const canApprove = !!canAction?.('approve');
  const canReject = !!canAction?.('reject');
  const canRevoke = !!canAction?.('revoke');
  const canObsolete = !!canAction?.('obsolete');

  const openDrawingPrint = useCallback(async (record: EngineeringDrawing) => {
    try {
      const data = await drawingApi.getPrintData(record.uuid);
      const escapeHtml = (value: string) =>
        value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${escapeHtml(data.code)}</title>
<style>
body{font-family:sans-serif;padding:24px;}
.watermark{position:fixed;top:40%;left:10%;font-size:48px;color:rgba(200,0,0,.15);transform:rotate(-25deg);pointer-events:none;z-index:0;}
.content{position:relative;z-index:1;}
h1{font-size:20px;margin:0 0 8px;}
.meta{color:#666;font-size:13px;margin-bottom:16px;}
img{max-width:100%;}
</style></head><body>
<div class="watermark">${escapeHtml(data.watermark)}</div>
<div class="content">
<h1>${escapeHtml(data.name)}</h1>
<div class="meta">${escapeHtml(`${data.code}-${data.revision}`)} ${escapeHtml(t(`app.master-data.drawings.securityLevel.${data.securityLevel}`))}</div>
${data.previewUrl ? `<img src="${escapeHtml(data.previewUrl)}" alt="${escapeHtml(data.fileName || data.code)}"/>` : ''}
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
      const w = window.open('', '_blank');
      if (!w) return;
      w.document.write(html);
      w.document.close();
    } catch (e) {
      messageApi.error(getApiErrorMessage(e) || t('common.operationFailed'));
    }
  }, [messageApi, t]);
  const isCheckoutOwner = useCallback(
    (record: EngineeringDrawing) =>
      record.status === 'Editing' && record.checkedOutBy != null && record.checkedOutBy === currentUser?.id,
    [currentUser?.id],
  );
  const screens = Grid.useBreakpoint();
  const showInlinePreview = !!screens.lg;

  const actionRef = useRef<ActionType>(null);
  const treeFilterRef = useRef<DrawingTreeFilter>({});

  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [paneMode, setPaneMode] = useState<DrawingPaneMode>('vault');
  const [navMode, setNavMode] = useState<DrawingNavMode>('type');
  const [treeSearch, setTreeSearch] = useState('');
  const [selectedTreeKeys, setSelectedTreeKeys] = useState<React.Key[]>([DRAWING_TREE_ALL_KEY]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [materialsNav, setMaterialsNav] = useState<DrawingTreeNavItem[]>([]);
  const [routesNav, setRoutesNav] = useState<DrawingTreeNavItem[]>([]);
  const [materialsLoaded, setMaterialsLoaded] = useState(false);
  const [routesLoaded, setRoutesLoaded] = useState(false);
  const [folders, setFolders] = useState<DrawingFolder[]>([]);
  const [treeFilter, setTreeFilter] = useState<DrawingTreeFilter>({});
  const [folderForm, setFolderForm] = useState<{
    open: boolean;
    mode: 'create' | 'rename';
    parentUuid?: string | null;
    folderUuid?: string | null;
    initialName?: string;
  }>({ open: false, mode: 'create' });
  const [moveFolder, setMoveFolder] = useState<{
    open: boolean;
    drawingUuid: string | null;
    currentFolderUuid?: string | null;
  }>({ open: false, drawingUuid: null });
  const [folderCtx, setFolderCtx] = useState<{
    x: number;
    y: number;
    uuid: string;
    name: string;
  } | null>(null);

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detail, setDetail] = useState<EngineeringDrawing | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRetryUuidRef = useRef<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  const {
    customFields,
    generateCustomFieldColumns,
    enrichRecordsWithCustomFields,
    customFieldValues,
    loadFieldValuesForDetail,
    resetDetailFieldValues,
  } = useCustomFieldsForList<EngineeringDrawing>({ tableName: 'apps_master_data_engineering_drawings' });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileBrief | null>(null);
  const [largePreviewOpen, setLargePreviewOpen] = useState(false);

  const [selectedRowUuid, setSelectedRowUuid] = useState<string | null>(null);
  const [inlinePreviewFile, setInlinePreviewFile] = useState<FileBrief | null>(null);
  const [selectedDrawing, setSelectedDrawing] = useState<EngineeringDrawing | null>(null);
  const [stepBomOpen, setStepBomOpen] = useState(false);
  const [stepBomDrawing, setStepBomDrawing] = useState<EngineeringDrawing | null>(null);
  const [listView, setListView] = useState<DrawingListView>('current');
  const [revisions, setRevisions] = useState<EngineeringDrawingRevisionBrief[]>([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);

  const showPreviewPane = showInlinePreview && !!inlinePreviewFile?.uuid;

  treeFilterRef.current = treeFilter;

  const typeLabel = (type: DrawingType) => t(`app.master-data.drawings.type.${type}`);
  const statusLabel = (status: DrawingStatus) => t(`app.master-data.drawings.status.${status}`);

  const loadMaterialsNav = useCallback(async () => {
    if (materialsLoaded) return;
    setTreeLoading(true);
    try {
      const materialsRes = await materialApi.list({ limit: 500 });
      setMaterialsNav(
        (materialsRes?.items ?? []).map((m) => ({
          uuid: m.uuid,
          code: m.mainCode || m.code || '',
          name: m.name,
        })),
      );
      setMaterialsLoaded(true);
    } catch {
      /* non-blocking */
    } finally {
      setTreeLoading(false);
    }
  }, [materialsLoaded]);

  const loadRoutesNav = useCallback(async () => {
    if (routesLoaded) return;
    setTreeLoading(true);
    try {
      const routesRes = await processRouteApi.list({ limit: 500 });
      setRoutesNav(
        unwrapProcessPagedList(routesRes).map((r) => ({
          uuid: r.uuid,
          code: r.code,
          name: r.name,
        })),
      );
      setRoutesLoaded(true);
    } catch {
      /* non-blocking */
    } finally {
      setTreeLoading(false);
    }
  }, [routesLoaded]);

  const loadFolders = useCallback(async () => {
    setTreeLoading(true);
    try {
      setFolders(await drawingFolderApi.tree());
    } catch {
      setFolders([]);
    } finally {
      setTreeLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    if (paneMode === 'filter' && navMode === 'material') void loadMaterialsNav();
    if (paneMode === 'filter' && navMode === 'route') void loadRoutesNav();
  }, [paneMode, navMode, loadMaterialsNav, loadRoutesNav]);

  const treeData: DataNode[] = useMemo(
    () =>
      paneMode === 'vault'
        ? buildDrawingVaultTree(t, folders, treeSearch)
        : buildDrawingNavTree(navMode, t, materialsNav, routesNav, treeSearch),
    [paneMode, t, folders, treeSearch, navMode, materialsNav, routesNav],
  );

  const handlePaneModeChange = useCallback((mode: DrawingPaneMode) => {
    setPaneMode(mode);
    setTreeSearch('');
    const currentKey = String(selectedTreeKeys[0] ?? DRAWING_TREE_ALL_KEY);
    const keep = mode === 'vault' ? isVaultTreeKey(currentKey) : !isVaultTreeKey(currentKey) || currentKey === DRAWING_TREE_ALL_KEY;
    if (!keep) {
      setSelectedTreeKeys([DRAWING_TREE_ALL_KEY]);
      treeFilterRef.current = {};
      startTransition(() => {
        setTreeFilter({});
        actionRef.current?.reload();
      });
    }
  }, [selectedTreeKeys]);

  const handleNavModeChange = useCallback((mode: DrawingNavMode) => {
    setNavMode(mode);
    setTreeSearch('');
    const currentKey = String(selectedTreeKeys[0] ?? DRAWING_TREE_ALL_KEY);
    if (!treeKeyBelongsToMode(currentKey, mode)) {
      setSelectedTreeKeys([DRAWING_TREE_ALL_KEY]);
      treeFilterRef.current = {};
      startTransition(() => {
        setTreeFilter({});
        actionRef.current?.reload();
      });
    }
  }, [selectedTreeKeys]);

  const paneModeBar = useMemo(
    () => (
      <Segmented
        block
        value={paneMode}
        onChange={(value) => handlePaneModeChange(value as DrawingPaneMode)}
        options={[
          { label: t('app.master-data.drawings.tree.vault'), value: 'vault', icon: <FolderOutlined /> },
          { label: t('app.master-data.drawings.tree.filter'), value: 'filter', icon: <FilterOutlined /> },
        ]}
      />
    ),
    [paneMode, t, handlePaneModeChange],
  );

  const navModeBar = useMemo(
    () => (
      <div className="drawing-nav-mode-bar" role="tablist" aria-label={t('app.master-data.drawings.tree.navModes')}>
        {DRAWING_NAV_MODES.map(({ mode, icon: Icon, labelKey }) => {
          const active = navMode === mode;
          return (
            <Tooltip key={mode} title={t(labelKey)}>
              <button
                type="button"
                role="tab"
                aria-selected={active}
                className={`drawing-nav-mode-btn${active ? ' drawing-nav-mode-btn-active' : ''}`}
                onClick={() => handleNavModeChange(mode)}
              >
                <Icon />
              </button>
            </Tooltip>
          );
        })}
      </div>
    ),
    [navMode, t, handleNavModeChange],
  );

  const openCreateFolder = useCallback((parentUuid?: string | null) => {
    setFolderForm({ open: true, mode: 'create', parentUuid: parentUuid ?? null });
  }, []);

  const folderTreeActions = useMemo(() => {
    if (paneMode !== 'vault' || !canCreate) return null;
    return (
      <Button type="primary" block icon={<PlusOutlined />} onClick={() => openCreateFolder(folderUuidFromTreeKey(String(selectedTreeKeys[0] ?? '')))}>
        {t('app.master-data.drawings.folder.create')}
      </Button>
    );
  }, [paneMode, canCreate, openCreateFolder, selectedTreeKeys, t]);

  const handleTreeSelect = useCallback(
    (keys: React.Key[]) => {
      if (!keys.length) return;
      const key = String(keys[0]);
      if (key.endsWith(':empty')) return;

      setSelectedRowUuid(null);
      setInlinePreviewFile(null);
      setSelectedDrawing(null);

      const nextFilter = parseDrawingTreeKey(key);
      const inferredMode = inferNavModeFromTreeKey(key);

      // 优先更新树选中态，避免被右侧表格/预览重渲染阻塞
      setSelectedTreeKeys(keys);

      startTransition(() => {
        treeFilterRef.current = nextFilter;
        setTreeFilter(nextFilter);
        if (inferredMode && inferredMode !== navMode) {
          setNavMode(inferredMode);
        }
        actionRef.current?.reload();
      });
    },
    [navMode],
  );

  const openPreview = (file?: FileBrief | null) => {
    if (!file?.uuid) return;
    if (showInlinePreview) {
      setInlinePreviewFile(file);
      return;
    }
    setPreviewFile(file);
    setPreviewOpen(true);
  };

  const selectRowForPreview = useCallback((record: EngineeringDrawing) => {
    setSelectedRowUuid(record.uuid);
    startTransition(() => {
      setSelectedDrawing(record);
      if (showInlinePreview) {
        if (record.file?.uuid) {
          setInlinePreviewFile(normalizeFileBrief(record.file) ?? record.file);
        } else {
          setInlinePreviewFile(null);
        }
      }
    });
  }, [showInlinePreview]);

  const deferredPreviewFile = useDeferredValue(inlinePreviewFile);
  const previewPending = inlinePreviewFile?.uuid !== deferredPreviewFile?.uuid;

  const openStepBomWizard = useCallback((record: EngineeringDrawing) => {
    setStepBomDrawing(record);
    setStepBomOpen(true);
  }, []);

  const loadDetail = async (uuid: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const data = await drawingApi.get(uuid);
      setDetail(data);
      if (data.id != null) {
        await loadFieldValuesForDetail(data.id);
      }
    } catch (error) {
      setDetail(null);
      setDetailError(getApiErrorMessage(error, t('app.master-data.drawings.getDetailFailed')));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenDetail = (uuid: string) => {
    detailRetryUuidRef.current = uuid;
    setDrawerVisible(true);
    setDetail(null);
    setDetailError(null);
    void loadDetail(uuid);
  };

  const handleCreate = useCallback(() => {
    setEditUuid(null);
    setModalVisible(true);
  }, []);

  const defaultCreateFolderUuid = treeFilter.folderUuid ?? null;

  useNewShortcut(() => {
    if (canCreate) handleCreate();
  });

  const reloadAfterAction = (record: EngineeringDrawing) => {
    actionRef.current?.reload();
    if (detail?.uuid === record.uuid) void loadDetail(record.uuid);
  };

  const handleCheckout = async (record: EngineeringDrawing) => {
    try {
      await drawingApi.checkout(record.uuid);
      messageApi.success(t('app.master-data.drawings.checkoutSuccess'));
      reloadAfterAction(record);
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.operationFailed')));
    }
  };

  const handleCheckin = async (record: EngineeringDrawing) => {
    try {
      await drawingApi.checkin(record.uuid);
      messageApi.success(t('app.master-data.drawings.checkinSuccess'));
      reloadAfterAction(record);
    } catch (error) {
      messageApi.error(getApiErrorMessage(error, t('common.operationFailed')));
    }
  };

  const handleUndoCheckout = async (record: EngineeringDrawing) => {
    getAntdModal().confirm({
      title: t('app.master-data.drawings.undoCheckout'),
      content: t('app.master-data.drawings.undoCheckoutConfirm'),
      onOk: async () => {
        await drawingApi.undoCheckout(record.uuid);
        messageApi.success(t('app.master-data.drawings.undoCheckoutSuccess'));
        reloadAfterAction(record);
      },
    });
  };

  const handleSubmit = async (record: EngineeringDrawing) => {
    getAntdModal().confirm({
      title: t('common.submit'),
      content: t('app.master-data.drawings.submitConfirm'),
      onOk: async () => {
        await drawingApi.submit(record.uuid);
        messageApi.success(t('app.master-data.drawings.submitSuccess'));
        reloadAfterAction(record);
      },
    });
  };

  const handleApprove = async (record: EngineeringDrawing) => {
    getAntdModal().confirm({
      title: t('app.master-data.drawings.approve'),
      content: t('app.master-data.drawings.approveConfirm'),
      onOk: async () => {
        await drawingApi.approve(record.uuid);
        messageApi.success(t('app.master-data.drawings.approveSuccess'));
        reloadAfterAction(record);
      },
    });
  };

  const handleReject = async (record: EngineeringDrawing) => {
    let reason = '';
    getAntdModal().confirm({
      title: t('app.master-data.drawings.reject'),
      content: (
        <Input.TextArea
          rows={3}
          placeholder={t('app.master-data.drawings.rejectReason')}
          onChange={(e) => {
            reason = e.target.value;
          }}
        />
      ),
      onOk: async () => {
        await drawingApi.reject(record.uuid, reason);
        messageApi.success(t('app.master-data.drawings.rejectSuccess'));
        reloadAfterAction(record);
      },
    });
  };

  const handleRevoke = async (record: EngineeringDrawing) => {
    getAntdModal().confirm({
      title: t('app.master-data.drawings.revoke'),
      content: t('app.master-data.drawings.revokeConfirm'),
      onOk: async () => {
        await drawingApi.revoke(record.uuid);
        messageApi.success(t('app.master-data.drawings.revokeSuccess'));
        reloadAfterAction(record);
      },
    });
  };

  const handleObsolete = async (record: EngineeringDrawing) => {
    let reason = '';
    getAntdModal().confirm({
      title: t('app.master-data.drawings.obsolete'),
      content: (
        <Input.TextArea
          rows={3}
          placeholder={t('app.master-data.drawings.obsoleteReason')}
          onChange={(e) => {
            reason = e.target.value;
          }}
        />
      ),
      onOk: async () => {
        await drawingApi.obsolete(record.uuid, reason);
        messageApi.success(t('app.master-data.drawings.obsoleteSuccess'));
        actionRef.current?.reload();
        if (detail?.uuid === record.uuid) loadDetail(record.uuid);
      },
    });
  };

  const handleRevision = async (record: EngineeringDrawing) => {
    try {
      const created = await drawingApi.createRevision(record.uuid, {});
      messageApi.success(t('app.master-data.drawings.revisionSuccess'));
      actionRef.current?.reload();
      setEditUuid(created.uuid);
      setModalVisible(true);
    } catch (err: any) {
      messageApi.error(err?.message || t('common.operationFailed'));
    }
  };

  const handleDeleteDrawing = useCallback(
    async (record: EngineeringDrawing) => {
      await drawingApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      if (record.uuid === selectedRowUuid) {
        setSelectedRowUuid(null);
        setInlinePreviewFile(null);
        setSelectedDrawing(null);
      }
      if (detail?.uuid === record.uuid) {
        setDrawerVisible(false);
        setDetail(null);
      }
      actionRef.current?.reload();
    },
    [messageApi, t, selectedRowUuid, detail?.uuid],
  );

  useEffect(() => {
    const deepLinkUuid = searchParams.get('uuid');
    if (!deepLinkUuid) return;

    void (async () => {
      try {
        const data = await drawingApi.get(deepLinkUuid);
        selectRowForPreview(data);
        handleOpenDetail(deepLinkUuid);
      } catch (err: any) {
        messageApi.error(err?.message || t('app.master-data.drawings.getDetailFailed'));
      } finally {
        setSearchParams({}, { replace: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅响应 URL 深链参数
  }, [searchParams.get('uuid')]);

  useEffect(() => {
    if (!detail?.uuid) {
      setRevisions([]);
      return;
    }
    let cancelled = false;
    setRevisionsLoading(true);
    void drawingApi
      .listRevisions(detail.uuid)
      .then((res) => {
        if (!cancelled) setRevisions(res.revisions ?? []);
      })
      .catch(() => {
        if (!cancelled) setRevisions([]);
      })
      .finally(() => {
        if (!cancelled) setRevisionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detail?.uuid]);

  const renderLifecycleActions = useCallback(
    (record: EngineeringDrawing, compact = false) => (
      <Space size={compact ? 8 : 0} style={{ whiteSpace: 'nowrap', flexWrap: 'nowrap' }}>
        {canUpdate ? (
          <Button
            key="moveFolder"
            {...rowActionKind('update')}
            onClick={() =>
              setMoveFolder({
                open: true,
                drawingUuid: record.uuid,
                currentFolderUuid: record.folderUuid ?? null,
              })
            }
          >
            {t('app.master-data.drawings.folder.move')}
          </Button>
        ) : null}
        {record.status === 'Draft' && (
          <>
            {canUpdate ? (
              <Button key="checkout" {...rowActionKind('update')} onClick={() => handleCheckout(record)}>
                {t('app.master-data.drawings.checkout')}
              </Button>
            ) : null}
            {canSubmit ? (
              <Button key="submit" {...rowActionKind('submit')} onClick={() => handleSubmit(record)}>
                {t('common.submit')}
              </Button>
            ) : null}
            {canDelete ? (
              <Popconfirm
                key="delete"
                {...rowActionKind('delete')}
                title={t('common.confirmDelete')}
                onConfirm={() => handleDeleteDrawing(record)}
              >
                <Button
                  type={compact ? 'default' : 'link'}
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()}
                >
                  {t('common.delete')}
                </Button>
              </Popconfirm>
            ) : null}
          </>
        )}
        {record.status === 'Editing' && isCheckoutOwner(record) && (
          <>
            {canUpdate ? (
              <Button
                key="edit"
                {...rowActionKind('update')}
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setEditUuid(record.uuid);
                  setModalVisible(true);
                }}
              >
                {t('common.edit')}
              </Button>
            ) : null}
            {canUpdate ? (
              <Button key="checkin" {...rowActionKind('update')} onClick={() => handleCheckin(record)}>
                {t('app.master-data.drawings.checkin')}
              </Button>
            ) : null}
            {canUpdate ? (
              <Button key="undoCheckout" {...rowActionKind('update')} onClick={() => handleUndoCheckout(record)}>
                {t('app.master-data.drawings.undoCheckout')}
              </Button>
            ) : null}
          </>
        )}
        {record.status === 'Pending' && (
          <>
            {canApprove ? (
              <Button key="approve" {...rowActionKind('approve')} onClick={() => handleApprove(record)}>
                {t('app.master-data.drawings.approve')}
              </Button>
            ) : null}
            {canReject ? (
              <Button key="reject" {...rowActionKind('reject')} onClick={() => handleReject(record)}>
                {t('app.master-data.drawings.reject')}
              </Button>
            ) : null}
            {canRevoke ? (
              <Button key="revoke" {...rowActionKind('revoke')} onClick={() => handleRevoke(record)}>
                {t('app.master-data.drawings.revoke')}
              </Button>
            ) : null}
          </>
        )}
        {record.status === 'Released' && (
          <>
            {changePerms.canCreate ? (
              <Button
                key="engineeringChange"
                {...rowActionKind('create')}
                onClick={() => navigate(buildDrawingChangeCreateUrl(record.uuid))}
              >
                {t('app.master-data.drawings.engineeringChange')}
              </Button>
            ) : null}
            {canCreate ? (
              <Button key="create" {...rowActionKind('create')} onClick={() => handleRevision(record)}>
                {t('app.master-data.drawings.newRevision')}
              </Button>
            ) : null}
            {canObsolete ? (
              <Button key="obsolete" {...rowActionKind('obsolete')} onClick={() => handleObsolete(record)}>
                {t('app.master-data.drawings.obsolete')}
              </Button>
            ) : null}
          </>
        )}
        {record.status === 'Obsolete' && canDelete && (
          <Popconfirm
            key="delete"
            {...rowActionKind('delete')}
            title={t('common.confirmDelete')}
            onConfirm={() => handleDeleteDrawing(record)}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => e.stopPropagation()}
            >
              {t('common.delete')}
            </Button>
          </Popconfirm>
        )}
        {canPrint ? (
          <Button key="print" {...rowActionKind('print')} icon={<PrinterOutlined />} onClick={() => void openDrawingPrint(record)}>
            {t('common.print')}
          </Button>
        ) : null}
        {!compact && record.file && !showInlinePreview && (
          <Button key="preview" {...rowActionKind('read')} onClick={() => openPreview(record.file)}>
            {t('app.master-data.drawings.preview')}
          </Button>
        )}
      </Space>
    ),
    [
      t,
      showInlinePreview,
      canUpdate,
      canDelete,
      canSubmit,
      canApprove,
      canReject,
      canRevoke,
      canCreate,
      canObsolete,
      canPrint,
      openDrawingPrint,
      changePerms.canCreate,
      navigate,
      isCheckoutOwner,
      handleDeleteDrawing,
      handleObsolete,
      handleRevision,
    ],
  );

  const detailColumns: ProDescriptionsItemProps<EngineeringDrawing>[] = useMemo(
    () => [
      { title: t('app.master-data.drawings.code'), dataIndex: 'code' },
      { title: t('app.master-data.drawings.name'), dataIndex: 'name' },
      { title: t('app.master-data.drawings.revision'), dataIndex: 'revision' },
      {
        title: t('app.master-data.drawings.folder'),
        dataIndex: 'folderName',
        render: (_, r) => r.folderName || t('app.master-data.drawings.tree.unclassified'),
      },
      {
        title: t('app.master-data.drawings.type'),
        dataIndex: 'drawingType',
        render: (_, r) => typeLabel(r.drawingType),
      },
      {
        title: t('app.master-data.drawings.securityLevel'),
        dataIndex: 'securityLevel',
        render: (_, r) =>
          r.securityLevel ? (
            <MarkerTag color="geekblue">{t(`app.master-data.drawings.securityLevel.${r.securityLevel}`)}</MarkerTag>
          ) : (
            '-'
          ),
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        render: (_, r) => <MarkerTag color={STATUS_COLOR[r.status]}>{statusLabel(r.status)}</MarkerTag>,
      },
      {
        title: t('app.master-data.drawings.file'),
        dataIndex: 'file',
        render: (_, r) =>
          r.file ? (
            <Space orientation="vertical" size={0}>
              <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openPreview(r.file)}>
                {r.file.originalName}
              </Button>
              {canImportStepBom(r) && (
                <Button
                  type="link"
                  size="small"
                  icon={<PartitionOutlined />}
                  onClick={() => openStepBomWizard(r)}
                >
                  {t('app.master-data.drawings.importStepBom')}
                </Button>
              )}
            </Space>
          ) : (
            '-'
          ),
      },
      {
        title: t('app.master-data.drawings.supplementaryFiles'),
        dataIndex: 'supplementaryFiles',
        render: (_, r) =>
          r.supplementaryFiles?.length ? (
            <Space orientation="vertical" size={0}>
              {r.supplementaryFiles.map((f) => (
                <Button key={f.uuid} type="link" size="small" onClick={() => openPreview(f)}>
                  {f.originalName}
                </Button>
              ))}
            </Space>
          ) : (
            '-'
          ),
      },
      {
        title: t('app.master-data.drawings.materials'),
        dataIndex: 'materials',
        render: (_, r) => formatAssociationLabels(r.materials),
      },
      {
        title: t('app.master-data.drawings.linkedBom'),
        dataIndex: 'linkedBom',
        render: (_, r) => {
          if (r.linkedBom) {
            return (
              <Button
                type="link"
                size="small"
                style={{ padding: 0 }}
                onClick={() =>
                  navigate(bomDesignerPath(r.linkedBom!.materialId, r.linkedBom!.version))
                }
              >
                {r.linkedBom.materialCode} v{r.linkedBom.version}
              </Button>
            );
          }
          if (!r.linkedBomMaterialId || !r.linkedBomVersion) return '-';
          return (
            <Button
              type="link"
              size="small"
              style={{ padding: 0 }}
              onClick={() => navigate(bomDesignerPath(r.linkedBomMaterialId!, r.linkedBomVersion!))}
            >
              v{r.linkedBomVersion}
            </Button>
          );
        },
      },
      {
        title: t('app.master-data.drawings.lastStepBomImportAt'),
        dataIndex: 'lastStepBomImportAt',
        valueType: 'dateTime',
      },
      {
        title: t('app.master-data.drawings.routes'),
        dataIndex: 'processRoutes',
        render: (_, r) => formatAssociationLabels(r.processRoutes),
      },
      {
        title: t('app.master-data.drawings.operations'),
        dataIndex: 'operations',
        render: (_, r) => formatAssociationLabels(r.operations),
      },
      { title: t('common.remark'), dataIndex: 'description' },
      {
        title: t('app.master-data.drawings.checkedOutBy'),
        dataIndex: 'checkedOutByName',
        render: (_, r) => r.checkedOutByName || '-',
      },
      { title: t('app.master-data.drawings.releasedAt'), dataIndex: 'releasedAt', valueType: 'dateTime' },
      { title: t('app.master-data.drawings.obsoleteReason'), dataIndex: 'obsoleteReason' },
      { title: t('common.createdAt'), dataIndex: 'createdAt', valueType: 'dateTime' },
      { title: t('common.updatedAt'), dataIndex: 'updatedAt', valueType: 'dateTime' },
    ],
    [t, showInlinePreview, navigate, openStepBomWizard],
  );

  const columns: ProColumns<EngineeringDrawing>[] = useMemo(
    () => {
      const customFieldColumns = generateCustomFieldColumns();
      return [
      {
        title: t('app.master-data.drawings.code'),
        dataIndex: 'code',
        width: 120,
        fixed: 'left' as const,
      },
      {
        title: t('app.master-data.drawings.name'),
        dataIndex: 'name',
        ellipsis: true,
        width: 180,
      },
      {
        title: t('app.master-data.drawings.revision'),
        dataIndex: 'revision',
        width: 64,
      },
      {
        title: t('app.master-data.drawings.folder'),
        dataIndex: 'folderName',
        search: false,
        width: 120,
        ellipsis: true,
        render: (_, record) => record.folderName || t('app.master-data.drawings.tree.unclassified'),
      },
      {
        title: t('app.master-data.drawings.type'),
        dataIndex: 'drawingType',
        width: 88,
        valueType: 'select',
        valueEnum: {
          part: { text: t('app.master-data.drawings.type.part') },
          assembly: { text: t('app.master-data.drawings.type.assembly') },
          process: { text: t('app.master-data.drawings.type.process') },
          other: { text: t('app.master-data.drawings.type.other') },
        },
      },
      {
        title: t('app.master-data.drawings.securityLevel'),
        dataIndex: 'securityLevel',
        width: 88,
        valueType: 'select',
        valueEnum: {
          public: { text: t('app.master-data.drawings.securityLevel.public') },
          internal: { text: t('app.master-data.drawings.securityLevel.internal') },
          secret: { text: t('app.master-data.drawings.securityLevel.secret') },
          confidential: { text: t('app.master-data.drawings.securityLevel.confidential') },
        },
        render: (_, r) =>
          r.securityLevel ? (
            <MarkerTag color="geekblue">{t(`app.master-data.drawings.securityLevel.${r.securityLevel}`)}</MarkerTag>
          ) : (
            '-'
          ),
      },
      {
        title: t('common.status'),
        dataIndex: 'status',
        width: 88,
        valueType: 'select',
        valueEnum: {
          Draft: { text: t('app.master-data.drawings.status.Draft') },
          Editing: { text: t('app.master-data.drawings.status.Editing') },
          Pending: { text: t('app.master-data.drawings.status.Pending') },
          Released: { text: t('app.master-data.drawings.status.Released') },
          Obsolete: { text: t('app.master-data.drawings.status.Obsolete') },
        },
        render: (_, r) => <Tag color={STATUS_COLOR[r.status]} variant="solid">{statusLabel(r.status)}</Tag>,
      },
      {
        title: t('app.master-data.drawings.checkedOutBy'),
        dataIndex: 'checkedOutByName',
        search: false,
        width: 100,
        render: (_, r) => r.checkedOutByName || '-',
      },
      {
        title: t('app.master-data.drawings.linkedBom'),
        dataIndex: 'linkedBom',
        search: false,
        width: 120,
        render: (_, r) => {
          if (r.linkedBom) {
            return (
              <Button
                type="link"
                size="small"
                style={{ padding: 0 }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(bomDesignerPath(r.linkedBom!.materialId, r.linkedBom!.version));
                }}
              >
                {r.linkedBom.materialCode} v{r.linkedBom.version}
              </Button>
            );
          }
          if (!r.linkedBomMaterialId || !r.linkedBomVersion) return '-';
          return (
            <Button
              type="link"
              size="small"
              style={{ padding: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                navigate(bomDesignerPath(r.linkedBomMaterialId!, r.linkedBomVersion!));
              }}
            >
              v{r.linkedBomVersion}
            </Button>
          );
        },
      },
      {
        title: t('app.master-data.drawings.file'),
        dataIndex: ['file', 'originalName'],
        ellipsis: true,
        search: false,
        width: 160,
      },
      {
        title: t('app.master-data.drawings.releasedAt'),
        dataIndex: 'releasedAt',
        valueType: 'dateTime',
        search: false,
        width: 170,
      },
      ...masterCrudCreatedUpdatedColumns<EngineeringDrawing>(t),
      ...customFieldColumns,
      {
        title: t('common.actions'),
        valueType: 'option',
        fixed: 'right' as const,
        onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
        render: (_, record) => (
          <Space size={0} style={{ whiteSpace: 'nowrap', flexWrap: 'nowrap' }}>
            <Button key="view" {...rowActionKind('read')} onClick={() => handleOpenDetail(record.uuid)}>
              {t('common.detail')}
            </Button>
            {renderLifecycleActions(record)}
          </Space>
        ),
      },
    ];
    },
    [t, customFields, generateCustomFieldColumns, renderLifecycleActions, loadDetail],
  );

  const tableQueryKey = useMemo(
    () => [
      'apps.master-data.pages.process.drawings',
      paneMode,
      navMode,
      listView,
      treeFilter.drawingType ?? '',
      treeFilter.status ?? '',
      treeFilter.materialUuid ?? '',
      treeFilter.processRouteUuid ?? '',
      treeFilter.folderUuid ?? '',
      treeFilter.unclassified ? '1' : '',
    ],
    [paneMode, navMode, listView, treeFilter],
  );

  const tableScrollOffsetPx =
    LIST_PAGE_TABLE_SCROLL.BASE_OFFSET_PX + 2 * LIST_PAGE_TABLE_SCROLL.GAP_PX;

  const handleOpenLargePreview = useCallback(() => {
    if (inlinePreviewFile?.uuid) setLargePreviewOpen(true);
  }, [inlinePreviewFile?.uuid]);

  const tableBlock = useMemo(
    () => (
      <div
        className="drawings-table-pane"
        style={{
          flex: showPreviewPane ? '3 1 0' : 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: showPreviewPane ? '0 0 8px 8px' : '0 8px 8px',
          boxSizing: 'border-box',
          ['--uni-table-scroll-offset' as string]: `${tableScrollOffsetPx}px`,
        }}
      >
        <UniTable<EngineeringDrawing>
        viewTypes={['table', 'help']}
          helpViewConfig={buildListPageHelpViewConfig('masterData.drawings')}
          actionRef={actionRef}
          rowKey="uuid"
          columnPersistenceId="apps.master-data.pages.process.drawings.folder-v2"
          permissionResource={DRAWING_PERMISSION}
          tanstackQuery={{ queryKeyPrefix: tableQueryKey }}
          columns={alignProColumns(columns, MASTER_DATA_LIST_FIELD_RANK)}
          headerTitle={t('app.master-data.menu.process.drawings')}
          beforeSearchButtons={
            <>
              <Tooltip title={leftPanelCollapsed ? t('app.master-data.drawings.expandNav') : t('app.master-data.drawings.collapseNav')}>
                <Button
                  icon={leftPanelCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                  onClick={() => setLeftPanelCollapsed((v) => !v)}
                />
              </Tooltip>
              <Segmented
                value={listView}
                options={[
                  { label: t('app.master-data.drawings.viewCurrent'), value: 'current' },
                  { label: t('app.master-data.drawings.viewAllRevisions'), value: 'all' },
                ]}
                onChange={(value) => {
                  setListView(value as DrawingListView);
                  actionRef.current?.reload();
                }}
              />
            </>
          }
          showCreateButton
          createButtonText={t('app.master-data.drawings.createTitle')}
          onCreate={handleCreate}
          request={async (params, meta?: UniTableRequestMeta) => {
            try {
              const tf = treeFilterRef.current;
              const res = await drawingApi.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                keyword: params.keyword as string | undefined,
                status: (params.status as DrawingStatus | undefined) ?? tf.status,
                drawingType: (params.drawingType as DrawingType | undefined) ?? tf.drawingType,
                securityLevel: params.securityLevel as DrawingSecurityLevel | undefined,
                materialUuid: tf.materialUuid,
                processRouteUuid: tf.processRouteUuid,
                folderUuid: tf.folderUuid,
                unclassified: tf.unclassified,
                view: listView,
              });
              const enriched = meta?.purpose === 'prefetch'
                ? res.data ?? []
                : await enrichRecordsWithCustomFields(res.data ?? []);
              return { data: enriched, success: true, total: res.total ?? 0 };
            } catch (err: any) {
              messageApi.error(err?.message || t('app.master-data.drawings.listFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          onRow={(record) => ({
            onClick: () => selectRowForPreview(record),
            style: { cursor: 'pointer' },
          })}
          rowClassName={(record) => (record.uuid === selectedRowUuid ? 'ant-table-row-selected' : '')}
        />
      </div>
    ),
    [
      showPreviewPane,
      tableScrollOffsetPx,
      tableQueryKey,
      columns,
      t,
      leftPanelCollapsed,
      handleCreate,
      messageApi,
      selectedRowUuid,
      selectRowForPreview,
      listView,
    ],
  );

  return (
    <>
      <style>{`
        .drawings-table-pane .pro-table-button-container {
          height: ${TWO_COLUMN_LAYOUT.PANEL_HEADER_HEIGHT}px;
          box-sizing: border-box;
          padding: 8px;
          margin-top: 0;
          margin-bottom: 16px;
          border-bottom: 1px solid var(--ant-color-border);
          align-items: center;
          line-height: 32px;
          flex-wrap: nowrap;
        }
        .drawings-main-split .drawings-inline-preview-pane {
          align-self: stretch;
        }
      `}</style>
      <TwoColumnLayout
        leftPanel={{
          collapsed: leftPanelCollapsed,
          width: 280,
          minWidth: 220,
          search: {
            placeholder: t('app.master-data.drawings.tree.searchPlaceholder'),
            value: treeSearch,
            onChange: setTreeSearch,
            allowClear: true,
          },
          actions: [paneModeBar, paneMode === 'filter' ? navModeBar : folderTreeActions].filter(Boolean),
          tree: {
            treeData,
            selectedKeys: selectedTreeKeys,
            onSelect: handleTreeSelect,
            showIcon: true,
            blockNode: true,
            loading: treeLoading,
            loadingTip: t('app.master-data.drawings.tree.loadingNav'),
            className: 'drawing-nav-tree',
            onRightClick: ({ event, node }) => {
              event.preventDefault();
              if (paneMode !== 'vault' || !(canUpdate || canDelete || canCreate)) return;
              const folderUuid = folderUuidFromTreeKey(String(node.key));
              if (!folderUuid) return;
              setFolderCtx({
                x: event.clientX,
                y: event.clientY,
                uuid: folderUuid,
                name: String(node.title ?? ''),
              });
            },
          },
        }}
        rightPanel={{
          contentPadding: 0,
          content: (
            <div
              className="drawings-main-split"
              style={{
                display: 'flex',
                flexDirection: showPreviewPane ? 'row' : 'column',
                height: '100%',
                minHeight: 0,
              }}
            >
              {tableBlock}
              {showPreviewPane && (
                <InlinePreviewPane
                  file={deferredPreviewFile}
                  activeDrawing={selectedDrawing}
                  previewPending={previewPending}
                  onOpenLargePreview={handleOpenLargePreview}
                  onOpenStepBom={openStepBomWizard}
                />
              )}
            </div>
          ),
        }}
      />

      <ProcessMasterDetailDrawer
        title={t('app.master-data.drawings.detailTitle')}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setDetail(null);
          setDetailError(null);
          resetDetailFieldValues();
        }}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          const uuid = detailRetryUuidRef.current;
          if (uuid) void loadDetail(uuid);
        }}
        detail={detail}
        detailColumns={detailColumns}
        customFields={customFields}
        customFieldValues={customFieldValues}
        extra={
          detail ? (
            <DetailDrawerActions
              items={[
                {
                  key: 'whereUsed',
                  render: (
                    <Link to={`/apps/master-data/process/drawing-where-used?drawingUuid=${detail.uuid}`}>
                      {t('app.master-data.menu.process.drawing-where-used')}
                    </Link>
                  ),
                },
                {
                  key: 'lifecycle',
                  render: renderLifecycleActions(detail, true),
                },
              ]}
            />
          ) : null
        }
        linesTitle={t('app.master-data.drawings.revisionHistory')}
        lines={
          revisionsLoading ? (
            <Spin />
          ) : revisions.length ? (
            <Timeline
              items={revisions.map((rev) => ({
                color: STATUS_COLOR[rev.status],
                children: (
                  <Space orientation="vertical" size={0}>
                    <Space wrap>
                      <Button
                        type={rev.uuid === detail?.uuid ? 'primary' : 'default'}
                        size="small"
                        onClick={() => {
                          if (rev.uuid !== detail?.uuid) {
                            detailRetryUuidRef.current = rev.uuid;
                            void loadDetail(rev.uuid);
                            if (rev.uuid) {
                              void drawingApi.get(rev.uuid).then(selectRowForPreview);
                            }
                          }
                        }}
                      >
                        {t('app.master-data.drawings.revision')} {rev.revision}
                      </Button>
                      <MarkerTag color={STATUS_COLOR[rev.status]}>{statusLabel(rev.status)}</MarkerTag>
                    </Space>
                    {rev.releasedAt ? (
                      <span style={{ color: 'var(--ant-color-text-secondary)', fontSize: 12 }}>
                        {t('app.master-data.drawings.releasedAt')}: {rev.releasedAt}
                      </span>
                    ) : null}
                    {rev.obsoleteReason ? (
                      <span style={{ color: 'var(--ant-color-text-secondary)', fontSize: 12 }}>
                        {rev.obsoleteReason}
                      </span>
                    ) : null}
                  </Space>
                ),
              }))}
            />
          ) : (
            <span style={{ color: 'var(--ant-color-text-secondary)' }}>
              {t('app.master-data.drawings.noRevisionHistory')}
            </span>
          )
        }
      />

      {folderCtx ? (
        <Dropdown
          open
          trigger={['click']}
          onOpenChange={(open) => {
            if (!open) setFolderCtx(null);
          }}
          menu={{
            items: [
              canCreate
                ? {
                    key: 'child',
                    label: t('app.master-data.drawings.folder.createChild'),
                    onClick: () => {
                      setFolderForm({ open: true, mode: 'create', parentUuid: folderCtx.uuid });
                      setFolderCtx(null);
                    },
                  }
                : null,
              canUpdate
                ? {
                    key: 'rename',
                    label: t('app.master-data.drawings.folder.rename'),
                    onClick: () => {
                      setFolderForm({
                        open: true,
                        mode: 'rename',
                        folderUuid: folderCtx.uuid,
                        initialName: folderCtx.name,
                      });
                      setFolderCtx(null);
                    },
                  }
                : null,
              canDelete
                ? {
                key: 'delete',
                danger: true,
                label: t('common.delete'),
                onClick: () => {
                  const target = folderCtx;
                  setFolderCtx(null);
                  getAntdModal().confirm({
                    title: t('common.delete'),
                    content: t('app.master-data.drawings.folder.deleteConfirm'),
                    okButtonProps: { danger: true },
                    onOk: async () => {
                      await drawingFolderApi.delete(target.uuid);
                      messageApi.success(t('common.deleteSuccess'));
                      if (treeFilter.folderUuid === target.uuid) {
                        setSelectedTreeKeys([DRAWING_TREE_ALL_KEY]);
                        treeFilterRef.current = {};
                        setTreeFilter({});
                        actionRef.current?.reload();
                      }
                      await loadFolders();
                    },
                  });
                },
              }
                : null,
            ],
          }}
        >
          <span style={{ position: 'fixed', left: folderCtx.x, top: folderCtx.y, width: 1, height: 1 }} />
        </Dropdown>
      ) : null}

      <DrawingFolderFormModal
        open={folderForm.open}
        mode={folderForm.mode}
        parentUuid={folderForm.parentUuid}
        folderUuid={folderForm.folderUuid}
        initialName={folderForm.initialName}
        onClose={() => setFolderForm((prev) => ({ ...prev, open: false }))}
        onSuccess={() => {
          void loadFolders();
        }}
      />

      <DrawingMoveFolderModal
        open={moveFolder.open}
        drawingUuid={moveFolder.drawingUuid}
        folders={folders}
        currentFolderUuid={moveFolder.currentFolderUuid}
        onClose={() => setMoveFolder({ open: false, drawingUuid: null })}
        onSuccess={() => {
          actionRef.current?.reload();
          if (detail?.uuid && detail.uuid === moveFolder.drawingUuid) {
            void loadDetail(detail.uuid);
          }
        }}
      />

      <DrawingFormModal
        open={modalVisible}
        editUuid={editUuid}
        defaultFolderUuid={defaultCreateFolderUuid}
        folders={folders}
        onClose={() => {
          setModalVisible(false);
          setEditUuid(null);
        }}
        onSuccess={() => {
          actionRef.current?.reload();
        }}
      />

      <FilePreviewModal
        open={(!showInlinePreview && previewOpen) || largePreviewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setLargePreviewOpen(false);
          if (!showInlinePreview) setPreviewFile(null);
        }}
        fileUuid={largePreviewOpen ? inlinePreviewFile?.uuid : previewFile?.uuid}
        fileName={largePreviewOpen ? inlinePreviewFile?.originalName : previewFile?.originalName}
        fileExtension={largePreviewOpen ? inlinePreviewFile?.fileExtension : previewFile?.fileExtension}
        title={
          (largePreviewOpen ? inlinePreviewFile?.originalName : previewFile?.originalName) ||
          t('app.master-data.drawings.preview')
        }
        width="calc(100vw - 32px)"
        height="calc(100vh - 32px)"
      />

      <StepBomImportWizard
        open={stepBomOpen}
        drawingUuid={stepBomDrawing?.uuid ?? ''}
        drawing={stepBomDrawing ?? undefined}
        onClose={() => {
          setStepBomOpen(false);
          setStepBomDrawing(null);
        }}
        onSuccess={(result) => {
          actionRef.current?.reload();
          if (detail?.uuid === result.drawing.uuid) {
            setDetail(result.drawing);
          }
          if (selectedDrawing?.uuid === result.drawing.uuid) {
            setSelectedDrawing(result.drawing);
          }
        }}
      />
    </>
  );
};

export default DrawingsPage;
