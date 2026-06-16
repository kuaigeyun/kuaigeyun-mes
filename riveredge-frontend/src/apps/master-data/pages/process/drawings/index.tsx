import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 工程图纸管理页面（两栏：左导航树 + 右表/预览）
 */

import React, { lazy, startTransition, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Grid, Input, Modal, Popconfirm, Space, Spin, Tag, Tooltip, theme, Descriptions } from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  SendOutlined,
  StopOutlined,
  BranchesOutlined,
  ExpandOutlined,
  PartitionOutlined,
} from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import {
  TwoColumnLayout,
  flushDrawerOpen,
  LIST_PAGE_TABLE_SCROLL,
  TWO_COLUMN_LAYOUT,
} from '../../../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../../components/uni-detail';
import { DRAWER_CONFIG } from '../../../../../components/layout-templates/constants';
import { DrawingFormModal } from '../../../components/DrawingFormModal';
import { StepBomImportWizard } from '../../../components/StepBomImportWizard';
import FilePreviewModal from '../../../../../components/file-preview';
import { materialApi } from '../../../services/material';
import { processRouteApi, unwrapProcessPagedList } from '../../../services/process';
import {
  drawingApi,
  normalizeFileBrief,
  type DrawingStatus,
  type DrawingType,
  type EngineeringDrawing,
  type FileBrief,
} from '../../../services/drawing';
import {
  DRAWING_TREE_ALL_KEY,
  parseDrawingTreeKey,
  type DrawingTreeFilter,
  type DrawingTreeNavItem,
} from './drawingTreeData';
import {
  DRAWING_NAV_MODES,
  buildDrawingNavTree,
  inferNavModeFromTreeKey,
  treeKeyBelongsToMode,
  type DrawingNavMode,
} from './drawingTreeNav';
import { isStepFile } from '../../../../../utils/filePreviewKind';
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';

const STATUS_COLOR: Record<DrawingStatus, string> = {
  Draft: 'default',
  Released: 'success',
  Obsolete: 'warning',
};

function canImportStepBom(record: EngineeringDrawing): boolean {
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
            <Spin size="large" tip={t('app.master-data.drawings.stepPreviewLoading')}>
              <div style={{ minHeight: 24 }} />
            </Spin>
          </div>
        )}
        <Suspense
          fallback={
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Spin size="large" tip={t('app.master-data.drawings.stepPreviewLoading')}>
                <div style={{ minHeight: 24 }} />
              </Spin>
            </div>
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

const DrawingsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const screens = Grid.useBreakpoint();
  const showInlinePreview = !!screens.lg;

  const actionRef = useRef<ActionType>(null);
  const treeFilterRef = useRef<DrawingTreeFilter>({});

  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [navMode, setNavMode] = useState<DrawingNavMode>('type');
  const [treeSearch, setTreeSearch] = useState('');
  const [selectedTreeKeys, setSelectedTreeKeys] = useState<React.Key[]>([DRAWING_TREE_ALL_KEY]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [materialsNav, setMaterialsNav] = useState<DrawingTreeNavItem[]>([]);
  const [routesNav, setRoutesNav] = useState<DrawingTreeNavItem[]>([]);
  const [materialsLoaded, setMaterialsLoaded] = useState(false);
  const [routesLoaded, setRoutesLoaded] = useState(false);
  const [treeFilter, setTreeFilter] = useState<DrawingTreeFilter>({});

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detail, setDetail] = useState<EngineeringDrawing | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailReqRef = useRef(0);

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

  useEffect(() => {
    if (customFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [customFields.length]);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileBrief | null>(null);
  const [largePreviewOpen, setLargePreviewOpen] = useState(false);

  const [selectedRowUuid, setSelectedRowUuid] = useState<string | null>(null);
  const [inlinePreviewFile, setInlinePreviewFile] = useState<FileBrief | null>(null);
  const [selectedDrawing, setSelectedDrawing] = useState<EngineeringDrawing | null>(null);
  const [stepBomOpen, setStepBomOpen] = useState(false);
  const [stepBomDrawing, setStepBomDrawing] = useState<EngineeringDrawing | null>(null);

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

  useEffect(() => {
    if (navMode === 'material') void loadMaterialsNav();
    if (navMode === 'route') void loadRoutesNav();
  }, [navMode, loadMaterialsNav, loadRoutesNav]);

  const treeData: DataNode[] = useMemo(
    () => buildDrawingNavTree(navMode, t, materialsNav, routesNav, treeSearch),
    [navMode, t, materialsNav, routesNav, treeSearch],
  );

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
    const reqId = ++detailReqRef.current;
    setDetailLoading(true);
    setDrawerVisible(true);
    flushDrawerOpen();
    try {
      const data = await drawingApi.get(uuid);
      if (reqId === detailReqRef.current) {
        setDetail(data);
        if (data.id != null) {
          await loadFieldValuesForDetail(data.id);
        }
      }
    } catch (err: any) {
      if (reqId === detailReqRef.current) {
        messageApi.error(err?.message || t('app.master-data.drawings.getDetailFailed'));
        setDrawerVisible(false);
      }
    } finally {
      if (reqId === detailReqRef.current) setDetailLoading(false);
    }
  };

  const handleCreate = useCallback(() => {
    setEditUuid(null);
    setModalVisible(true);
  }, []);

  useNewShortcut(handleCreate);

  const handleRelease = async (record: EngineeringDrawing) => {
    Modal.confirm({
      title: t('app.master-data.drawings.release'),
      content: t('app.master-data.drawings.releaseConfirm'),
      onOk: async () => {
        await drawingApi.release(record.uuid);
        messageApi.success(t('app.master-data.drawings.releaseSuccess'));
        actionRef.current?.reload();
        if (detail?.uuid === record.uuid) loadDetail(record.uuid);
      },
    });
  };

  const handleObsolete = async (record: EngineeringDrawing) => {
    let reason = '';
    Modal.confirm({
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

  const detailColumns: ProDescriptionsItemProps<EngineeringDrawing>[] = useMemo(
    () => [
      { title: t('app.master-data.drawings.code'), dataIndex: 'code' },
      { title: t('app.master-data.drawings.name'), dataIndex: 'name' },
      { title: t('app.master-data.drawings.revision'), dataIndex: 'revision' },
      {
        title: t('app.master-data.drawings.type'),
        dataIndex: 'drawingType',
        render: (_, r) => typeLabel(r.drawingType),
      },
      {
        title: t('app.master-data.drawings.status'),
        dataIndex: 'status',
        render: (_, r) => <Tag color={STATUS_COLOR[r.status]}>{statusLabel(r.status)}</Tag>,
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
        dataIndex: 'materialUuids',
        render: (_, r) => (r.materialUuids?.length ? r.materialUuids.join(', ') : '-'),
      },
      {
        title: t('app.master-data.drawings.linkedBom'),
        dataIndex: 'linkedBomVersion',
        render: (_, r) => {
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
        dataIndex: 'processRouteUuids',
        render: (_, r) => (r.processRouteUuids?.length ? r.processRouteUuids.join(', ') : '-'),
      },
      {
        title: t('app.master-data.drawings.operations'),
        dataIndex: 'operationUuids',
        render: (_, r) => (r.operationUuids?.length ? r.operationUuids.join(', ') : '-'),
      },
      { title: t('app.master-data.drawings.description'), dataIndex: 'description' },
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
        title: t('app.master-data.drawings.status'),
        dataIndex: 'status',
        width: 88,
        valueType: 'select',
        valueEnum: {
          Draft: { text: t('app.master-data.drawings.status.Draft') },
          Released: { text: t('app.master-data.drawings.status.Released') },
          Obsolete: { text: t('app.master-data.drawings.status.Obsolete') },
        },
        render: (_, r) => <Tag color={STATUS_COLOR[r.status]}>{statusLabel(r.status)}</Tag>,
      },
      {
        title: t('app.master-data.drawings.linkedBom'),
        dataIndex: 'linkedBomVersion',
        search: false,
        width: 96,
        render: (_, r) => {
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
      {
        title: t('common.createdAt'),
        dataIndex: 'createdAt',
        valueType: 'dateTime',
        search: false,
        width: 170,
      },
      ...customFieldColumns,
      {
        title: t('common.actions'),
        valueType: 'option',
        width: 320,
        fixed: 'right' as const,
        onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
        render: (_, record) => (
          <Space size={0} style={{ whiteSpace: 'nowrap', flexWrap: 'nowrap' }}>
            <Button key="view" {...rowActionKind('read')} onClick={() => loadDetail(record.uuid)}>
              {t('common.detail')}
            </Button>
            {record.status === 'Draft' && (
              <>
                <Button key="edit" {...rowActionKind('update')}
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditUuid(record.uuid);
                    setModalVisible(true);
                  }}
                >
                  {t('common.edit')}
                </Button>
                <Button key="submit" {...rowActionKind('submit')} onClick={() => handleRelease(record)}>
                  {t('app.master-data.drawings.release')}
                </Button>
                <Popconfirm key="delete" {...rowActionKind('delete')} title={t('common.confirmDelete')}
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
              </>
            )}
            {record.status === 'Released' && (
              <>
                <Button key="create" {...rowActionKind('create')} onClick={() => handleRevision(record)}>
                  {t('app.master-data.drawings.newRevision')}
                </Button>
                <Button key="obsolete" {...rowActionKind('obsolete')} onClick={() => handleObsolete(record)}>
                  {t('app.master-data.drawings.obsolete')}
                </Button>
              </>
            )}
            {record.status === 'Obsolete' && (
              <Popconfirm key="delete" {...rowActionKind('delete')} title={t('common.confirmDelete')}
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
            {record.file && !showInlinePreview && (
              <Button key="view" {...rowActionKind('read')} onClick={() => openPreview(record.file)}>
                {t('app.master-data.drawings.preview')}
              </Button>
            )}
          </Space>
        ),
      },
    ];
    },
    [t, customFields, generateCustomFieldColumns, showInlinePreview, navigate, handleDeleteDrawing, loadDetail, handleRelease, handleObsolete, handleRevision, openPreview],
  );

  const tableQueryKey = useMemo(
    () => [
      'apps.master-data.pages.process.drawings',
      navMode,
      treeFilter.drawingType ?? '',
      treeFilter.status ?? '',
      treeFilter.materialUuid ?? '',
      treeFilter.processRouteUuid ?? '',
    ],
    [navMode, treeFilter],
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
          actionRef={actionRef}
          rowKey="uuid"
          columnPersistenceId="apps.master-data.pages.process.drawings"
          tanstackQuery={{ queryKeyPrefix: tableQueryKey }}
          columns={columns}
          headerTitle={t('app.master-data.menu.process.drawings')}
          beforeSearchButtons={
            <Tooltip title={leftPanelCollapsed ? t('app.master-data.drawings.expandNav') : t('app.master-data.drawings.collapseNav')}>
              <Button
                icon={leftPanelCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setLeftPanelCollapsed((v) => !v)}
              />
            </Tooltip>
          }
          showCreateButton
          createButtonText={t('app.master-data.drawings.createTitle')}
          onCreate={handleCreate}
          request={async (params) => {
            try {
              const tf = treeFilterRef.current;
              const res = await drawingApi.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                keyword: params.keyword as string | undefined,
                status: (params.status as DrawingStatus | undefined) ?? tf.status,
                drawingType: (params.drawingType as DrawingType | undefined) ?? tf.drawingType,
                materialUuid: tf.materialUuid,
                processRouteUuid: tf.processRouteUuid,
              });
              const enriched = await enrichRecordsWithCustomFields(res.data ?? []);
              return { data: enriched, success: true, total: res.total ?? 0 };
            } catch (err: any) {
              messageApi.error(err?.message || t('app.master-data.drawings.listFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1200 }}
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
          actions: [navModeBar],
          tree: {
            treeData,
            selectedKeys: selectedTreeKeys,
            onSelect: handleTreeSelect,
            showIcon: true,
            blockNode: true,
            loading: treeLoading,
            loadingTip: t('app.master-data.drawings.tree.loadingNav'),
            className: 'drawing-nav-tree',
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

      <UniDetail
        title={t('app.master-data.drawings.detailTitle')}
        open={drawerVisible}
        onClose={() => {
          setDrawerVisible(false);
          setDetail(null);
          resetDetailFieldValues();
        }}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        basic={
          detail ? (
            <Descriptions column={1} items={detailDrawerDescriptionItems(detailColumns, detail)} />
          ) : null
        }
        linesTitle={t('app.master-data.customFields')}
        lines={
          hasCustomFieldsDetailContent(customFields, customFieldValues) ? (
            <CustomFieldsDetailSection customFields={customFields} customFieldValues={customFieldValues} />
          ) : null
        }
      />

      <DrawingFormModal
        open={modalVisible}
        editUuid={editUuid}
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
