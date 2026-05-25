/**
 * 工程图纸管理页面（两栏：左导航树 + 右表/预览）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Grid, Input, Modal, Popconfirm, Space, Tag, Tooltip, Typography } from 'antd';
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
} from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { useNewShortcut } from '../../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../../utils/globalNewShortcut';
import {
  TwoColumnLayout,
  flushDrawerOpen,
  LIST_PAGE_TABLE_SCROLL,
} from '../../../../../components/layout-templates';
import { UniDetail, detailDrawerDescriptionItems } from '../../../../../components/uni-detail';
import { DRAWER_CONFIG } from '../../../../../components/layout-templates/constants';
import { DrawingFormModal } from '../../../components/DrawingFormModal';
import { DrawingInlinePreview } from '../../../components/DrawingInlinePreview';
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

const STATUS_COLOR: Record<DrawingStatus, string> = {
  Draft: 'default',
  Released: 'success',
  Obsolete: 'warning',
};

const DrawingsPage: React.FC = () => {
  const { t } = useTranslation();
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

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileBrief | null>(null);

  const [selectedRowUuid, setSelectedRowUuid] = useState<string | null>(null);
  const [inlinePreviewFile, setInlinePreviewFile] = useState<FileBrief | null>(null);

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

  const handleNavModeChange = (mode: DrawingNavMode) => {
    setNavMode(mode);
    setTreeSearch('');
    const currentKey = String(selectedTreeKeys[0] ?? DRAWING_TREE_ALL_KEY);
    if (!treeKeyBelongsToMode(currentKey, mode)) {
      setSelectedTreeKeys([DRAWING_TREE_ALL_KEY]);
      setTreeFilter({});
      actionRef.current?.reload();
    }
  };

  const navModeBar = (
    <div className="drawing-nav-mode-bar" role="tablist" aria-label={t('app.master-data.drawings.tree.navModes')}>
      {DRAWING_NAV_MODES.map(({ mode, icon: Icon, color, labelKey }) => {
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
              <Icon style={{ fontSize: 16, color: active ? color : undefined }} />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );

  const handleTreeSelect = (keys: React.Key[]) => {
    if (!keys.length) return;
    const key = String(keys[0]);
    if (key.endsWith(':empty')) return;
    setSelectedTreeKeys(keys);
    const inferredMode = inferNavModeFromTreeKey(key);
    if (inferredMode && inferredMode !== navMode) {
      setNavMode(inferredMode);
    }
    const nextFilter = parseDrawingTreeKey(key);
    setTreeFilter(nextFilter);
    actionRef.current?.reload();
  };

  const openPreview = (file?: FileBrief | null) => {
    if (!file?.uuid) return;
    if (showInlinePreview) {
      setInlinePreviewFile(file);
      return;
    }
    setPreviewFile(file);
    setPreviewOpen(true);
  };

  const selectRowForPreview = (record: EngineeringDrawing) => {
    setSelectedRowUuid(record.uuid);
    if (showInlinePreview && record.file?.uuid) {
      setInlinePreviewFile(normalizeFileBrief(record.file) ?? record.file);
    }
  };

  const loadDetail = async (uuid: string) => {
    const reqId = ++detailReqRef.current;
    setDetailLoading(true);
    setDrawerVisible(true);
    flushDrawerOpen();
    try {
      const data = await drawingApi.get(uuid);
      if (reqId === detailReqRef.current) setDetail(data);
    } catch (err: any) {
      if (reqId === detailReqRef.current) {
        messageApi.error(err?.message || t('app.master-data.drawings.getDetailFailed'));
        setDrawerVisible(false);
      }
    } finally {
      if (reqId === detailReqRef.current) setDetailLoading(false);
    }
  };

  const handleCreate = () => {
    setEditUuid(null);
    setModalVisible(true);
  };

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
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openPreview(r.file)}>
              {r.file.originalName}
            </Button>
          ) : (
            '-'
          ),
      },
      {
        title: t('app.master-data.drawings.supplementaryFiles'),
        dataIndex: 'supplementaryFiles',
        render: (_, r) =>
          r.supplementaryFiles?.length ? (
            <Space direction="vertical" size={0}>
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
    [t, showInlinePreview],
  );

  const columns: ProColumns<EngineeringDrawing>[] = useMemo(
    () => [
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
      {
        title: t('common.actions'),
        valueType: 'option',
        width: 280,
        fixed: 'right' as const,
        onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
        render: (_, record) => (
          <Space size={0} style={{ whiteSpace: 'nowrap', flexWrap: 'nowrap' }}>
            <Button type="link" size="small" onClick={() => loadDetail(record.uuid)}>
              {t('common.detail')}
            </Button>
            {record.status === 'Draft' && (
              <>
                <Button
                  type="link"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditUuid(record.uuid);
                    setModalVisible(true);
                  }}
                >
                  {t('common.edit')}
                </Button>
                <Button type="link" size="small" icon={<SendOutlined />} onClick={() => handleRelease(record)}>
                  {t('app.master-data.drawings.release')}
                </Button>
                <Popconfirm
                  title={t('common.confirmDelete')}
                  onConfirm={async () => {
                    await drawingApi.delete(record.uuid);
                    messageApi.success(t('common.deleteSuccess'));
                    actionRef.current?.reload();
                  }}
                >
                  <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                    {t('common.delete')}
                  </Button>
                </Popconfirm>
              </>
            )}
            {record.status === 'Released' && (
              <>
                <Button type="link" size="small" icon={<BranchesOutlined />} onClick={() => handleRevision(record)}>
                  {t('app.master-data.drawings.newRevision')}
                </Button>
                <Button type="link" size="small" icon={<StopOutlined />} onClick={() => handleObsolete(record)}>
                  {t('app.master-data.drawings.obsolete')}
                </Button>
              </>
            )}
            {record.file && !showInlinePreview && (
              <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openPreview(record.file)}>
                {t('app.master-data.drawings.preview')}
              </Button>
            )}
          </Space>
        ),
      },
    ],
    [t, messageApi, detail?.uuid, showInlinePreview],
  );

  const tableQueryKey = useMemo(
    () => [
      'apps.master-data.pages.process.drawings',
      navMode,
      selectedTreeKeys[0] ?? DRAWING_TREE_ALL_KEY,
    ],
    [navMode, selectedTreeKeys],
  );

  const tableScrollOffsetPx =
    LIST_PAGE_TABLE_SCROLL.BASE_OFFSET_PX + 2 * LIST_PAGE_TABLE_SCROLL.GAP_PX;

  const tableBlock = (
    <div
      style={{
        flex: showInlinePreview ? '3 1 0' : 1,
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
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
        toolBarRender={() => [
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            {t('common.create') + NEW_SHORTCUT_HINT}
          </Button>,
        ]}
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
            return { data: res.data ?? [], success: true, total: res.total ?? 0 };
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
  );

  return (
    <>
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
              style={{
                display: 'flex',
                flexDirection: showInlinePreview ? 'row' : 'column',
                gap: showInlinePreview ? 8 : 0,
                height: '100%',
                minHeight: 0,
                padding: 8,
                boxSizing: 'border-box',
              }}
            >
              {tableBlock}
              {showInlinePreview && (
                <div
                  style={{
                    flex: '1 1 0',
                    minWidth: 0,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <Typography.Text type="secondary" style={{ fontSize: 12, paddingLeft: 4 }}>
                    {t('app.master-data.drawings.inlinePreview')}
                  </Typography.Text>
                  <DrawingInlinePreview
                    fileUuid={inlinePreviewFile?.uuid}
                    fileName={inlinePreviewFile?.originalName}
                    fileExtension={inlinePreviewFile?.fileExtension}
                    height="100%"
                  />
                </div>
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
        }}
        loading={detailLoading}
        width={DRAWER_CONFIG.STANDARD_WIDTH}
        items={detailDrawerDescriptionItems(detailColumns, detail)}
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

      {!showInlinePreview && (
        <FilePreviewModal
          open={previewOpen}
          onClose={() => {
            setPreviewOpen(false);
            setPreviewFile(null);
          }}
          fileUuid={previewFile?.uuid}
          fileName={previewFile?.originalName}
          fileExtension={previewFile?.fileExtension}
          title={previewFile?.originalName || t('app.master-data.drawings.preview')}
        />
      )}
    </>
  );
};

export default DrawingsPage;
