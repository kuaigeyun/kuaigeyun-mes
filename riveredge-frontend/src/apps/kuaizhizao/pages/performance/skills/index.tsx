/**
 * 技能管理页面
 */

import React, { useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Space, Modal, Typography, Descriptions, Empty, Spin, theme as AntdTheme } from 'antd';
import { EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import {
  DocumentTrackingRelationsTabsBody,
  DocumentTrackingTimelineBody,
  TraceLinkedDocumentBrief,
  useDocumentTracking,
} from '../../../../../components/document-tracking-panel';
import { ListPageTemplate, DetailDrawerTemplate, DetailDrawerSection, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { PerformanceTraceBriefFooter } from '../PerformanceTraceBriefFooter';
import { skillApi } from '../../../services/performance';
import { SkillFormModal } from '../../../components/SkillFormModal';
import type { Skill } from '../../../types/performance';
import { getPerformanceConfigActiveLifecycle } from '../../../utils/performanceLifecycle';
import { buildMasterDetailDescriptionItems } from '../../../utils/buildMasterDetailDescriptionItems';

const SKILL_DETAIL_COLUMNS: ProDescriptionsItemProps<Skill>[] = [
  { title: '技能编号', dataIndex: 'code' },
  { title: '技能名称', dataIndex: 'name' },
  { title: '技能分类', dataIndex: 'category' },
  { title: '描述', dataIndex: 'description', span: 3 },
  { title: '启用状态', dataIndex: 'isActive', render: (_, record) => (record?.isActive ? '启用' : '禁用') },
  { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
  { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
];

/** 详情 Drawer 外左侧全链路浮层（Uni-detail） */
const PERF_DETAIL_CHAIN_FLOAT_MARGIN = 16;
const PERF_DETAIL_LEFT_CHAIN_GAP = 16;
const PERF_DETAIL_CHAIN_DRAWER_GAP = 16;
const PERF_DETAIL_CHAIN_VERTICAL_TRIM = PERF_DETAIL_CHAIN_FLOAT_MARGIN * 2 + PERF_DETAIL_LEFT_CHAIN_GAP;
const perfDetailChainHalfHeightCss = `calc((100vh - ${PERF_DETAIL_CHAIN_VERTICAL_TRIM}px) / 2)`;
const perfDetailChainPanelWidthCss = `calc(50vw - ${PERF_DETAIL_CHAIN_FLOAT_MARGIN * 2 + PERF_DETAIL_CHAIN_DRAWER_GAP}px)`;
const perfDetailBriefPanelTopCss = `calc(${PERF_DETAIL_CHAIN_FLOAT_MARGIN}px + (100vh - ${PERF_DETAIL_CHAIN_VERTICAL_TRIM}px) / 2 + ${PERF_DETAIL_LEFT_CHAIN_GAP}px)`;

const SkillsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = AntdTheme.useToken();
  const skillDetailDrawerZIndex = token.zIndexPopupBase;
  const skillChainOverlayZIndex = token.zIndexPopupBase + 1;
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [skillDetail, setSkillDetail] = useState<Skill | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [skillTrackingRefreshKey, setSkillTrackingRefreshKey] = useState(0);
  const [fullChainRefreshKey, setFullChainRefreshKey] = useState(0);
  const [fullChainTraceLoading, setFullChainTraceLoading] = useState(false);
  const [fullChainBriefDoc, setFullChainBriefDoc] = useState<{ document_type: string; document_id: number } | null>(
    null,
  );
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  const skillTracking = useDocumentTracking(
    drawerVisible && skillDetail?.id != null ? 'performance_skill' : undefined,
    skillDetail?.id,
    skillTrackingRefreshKey,
  );

  const onFullChainGraphNodeClick = useCallback(
    (type: string, id: number) => {
      if (!id) return;
      if (type === 'performance_skill' && skillDetail?.id != null && id === skillDetail.id) {
        setFullChainBriefDoc(null);
        return;
      }
      setFullChainBriefDoc({ document_type: type, document_id: id });
    },
    [skillDetail],
  );

  const handleCreate = () => { setEditUuid(null); setModalVisible(true); };
  const handleEdit = (record: Skill) => { setEditUuid(record.uuid); setModalVisible(true); };
  const handleDelete = async (record: Skill) => {
    try {
      await skillApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  const handleBatchDelete = (keys: React.Key[]) => {
    if (keys.length === 0) { messageApi.warning(t('common.selectToDelete')); return; }
    Modal.confirm({
      title: t('common.confirmBatchDelete'),
      content: t('common.confirmBatchDeleteContent', { count: keys.length }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          let successCount = 0, failCount = 0;
          const errors: string[] = [];
          for (const key of keys) {
            try { await skillApi.delete(key.toString()); successCount++; } catch (error: any) { failCount++; errors.push(error.message || t('common.deleteFailed')); }
          }
          if (successCount > 0) messageApi.success(t('common.batchDeleteSuccess', { count: successCount }));
          if (failCount > 0) messageApi.error(t('common.batchDeletePartial', { count: failCount, errors: errors.length > 0 ? '：' + errors.join('; ') : '' }));
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) { messageApi.error(error.message || t('common.batchDeleteFailed')); }
      },
    });
  };

  const handleOpenDetail = async (record: Skill) => {
    try {
      setFullChainBriefDoc(null);
      setDrawerVisible(true);
      setSkillDetail(null);
      setDetailLoading(true);
      const detail = await skillApi.get(record.uuid);
      setSkillDetail(detail);
      setSkillTrackingRefreshKey((k) => k + 1);
      setFullChainRefreshKey((k) => k + 1);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.skills.getDetailFailed'));
    } finally { setDetailLoading(false); }
  };

  const handleModalSuccess = () => { setModalVisible(false); setEditUuid(null); actionRef.current?.reload(); };
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setSkillDetail(null);
    setFullChainBriefDoc(null);
  };

  const columns: ProColumns<Skill>[] = [
    {
      title: '技能编号',
      dataIndex: 'code',
      width: 150,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
          {r.code ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '技能名称', dataIndex: 'name', width: 200, ellipsis: true },
    { title: '技能分类', dataIndex: 'category', width: 150, hideInSearch: true },
    { title: '描述', dataIndex: 'description', ellipsis: true, hideInSearch: true },
    {
      title: '启用',
      dataIndex: 'isActive',
      hideInTable: true,
      valueType: 'select',
      valueEnum: { true: { text: '启用' }, false: { text: '禁用' } },
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 168,
      hideInSearch: true,
      render: (_, r) => (r.updatedAt ? dayjs(r.updatedAt).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle',
      width: 120,
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getPerformanceConfigActiveLifecycle(record as unknown as Record<string, unknown>);
        return (
          <UniLifecycle
            percent={lifecycle.percent}
            stageName={lifecycle.stageName}
            status={lifecycle.status}
            subStages={lifecycle.subStages}
            showLabel
            size="small"
            showCircleTooltip={false}
          />
        );
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleOpenDetail(record)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定要删除这个技能吗？" onConfirm={() => handleDelete(record)}>
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable<Skill>
          headerTitle="技能管理"
          actionRef={actionRef}
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.performance.skills"
          request={async (params, _sort, _filter, searchFormValues) => {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const apiParams: any = { skip, limit: pageSize };
            if (searchFormValues?.isActive !== undefined && searchFormValues.isActive !== '' && searchFormValues.isActive !== null) apiParams.isActive = searchFormValues.isActive;
            if (searchFormValues?.category !== undefined && searchFormValues.category !== '' && searchFormValues.category !== null) apiParams.category = searchFormValues.category;
            try {
              const result = await skillApi.list(apiParams);
              const rows = Array.isArray(result) ? result : [];
              const total = rows.length < pageSize ? skip + rows.length : skip + rows.length + 1;
              return { data: rows, success: true, total };
            } catch (error: any) {
              messageApi.error(error?.message || '获取技能列表失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          scroll={{ x: 1280 }}
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
          showCreateButton
          createButtonText="新建技能"
          onCreate={handleCreate}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText="批量删除"
        />
      </ListPageTemplate>
      {drawerVisible && skillDetail?.id != null ? (
        <>
          <div
            role="complementary"
            aria-label={t('components.documentTrackingPanel.relationsFullChainTitle')}
            style={{
              position: 'fixed',
              left: PERF_DETAIL_CHAIN_FLOAT_MARGIN,
              top: PERF_DETAIL_CHAIN_FLOAT_MARGIN,
              width: perfDetailChainPanelWidthCss,
              height: perfDetailChainHalfHeightCss,
              zIndex: skillChainOverlayZIndex,
              boxSizing: 'border-box',
              padding: 16,
              borderRadius: token.borderRadiusLG,
              background: 'var(--ant-color-bg-container)',
              borderRight: '1px solid var(--ant-color-border)',
              borderBottom: '1px solid var(--ant-color-border)',
              boxShadow: 'var(--ant-box-shadow-secondary)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div style={{ flexShrink: 0, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ant-color-text)' }}>
                    {t('components.documentTrackingPanel.relationsFullChainTitle')}
                  </div>
                </div>
                <Button
                  type="default"
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={fullChainTraceLoading}
                  style={{ flexShrink: 0 }}
                  onClick={() => setFullChainRefreshKey((k) => k + 1)}
                >
                  {t('components.documentRelationGraph.refresh')}
                </Button>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <DocumentTrackingRelationsTabsBody
                documentType="performance_skill"
                documentId={skillDetail.id}
                refreshKey={fullChainRefreshKey}
                onDocumentClick={onFullChainGraphNodeClick}
                compact
                hideInlineRefresh
                onTraceLoadingChange={setFullChainTraceLoading}
              />
            </div>
          </div>
          <div
            role="complementary"
            aria-label={t('components.documentTrackingPanel.traceBriefTitle')}
            style={{
              position: 'fixed',
              left: PERF_DETAIL_CHAIN_FLOAT_MARGIN,
              top: perfDetailBriefPanelTopCss,
              width: perfDetailChainPanelWidthCss,
              height: perfDetailChainHalfHeightCss,
              zIndex: skillChainOverlayZIndex,
              boxSizing: 'border-box',
              padding: 16,
              borderRadius: token.borderRadiusLG,
              background: 'var(--ant-color-bg-container)',
              borderRight: '1px solid var(--ant-color-border)',
              borderBottom: '1px solid var(--ant-color-border)',
              boxShadow: 'var(--ant-box-shadow-secondary)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                marginBottom: 8,
                flexShrink: 0,
                color: 'var(--ant-color-text)',
              }}
            >
              {t('components.documentTrackingPanel.traceBriefTitle')}
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <TraceLinkedDocumentBrief
                documentType={fullChainBriefDoc?.document_type}
                documentId={fullChainBriefDoc?.document_id}
                compactChrome
              />
            </div>
            <PerformanceTraceBriefFooter
              brief={fullChainBriefDoc}
              t={t}
              navigate={navigate}
              closeDrawer={handleCloseDetail}
              onDismissBrief={() => setFullChainBriefDoc(null)}
            />
          </div>
        </>
      ) : null}
      <DetailDrawerTemplate
        title="技能详情"
        open={drawerVisible}
        zIndex={skillDetailDrawerZIndex}
        onClose={handleCloseDetail}
        width={DRAWER_CONFIG.HALF_WIDTH}
        loading={detailLoading}
        columns={[]}
        customContent={
          detailLoading && !skillDetail ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Spin />
            </div>
          ) : skillDetail ? (
            <>
              <DetailDrawerSection title="基本信息">
                <Descriptions
                  column={3}
                  size="small"
                  items={buildMasterDetailDescriptionItems(skillDetail, SKILL_DETAIL_COLUMNS)}
                />
              </DetailDrawerSection>
              <DetailDrawerSection title="生命周期">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lc = getPerformanceConfigActiveLifecycle(skillDetail as unknown as Record<string, unknown>);
                    const mainStages = lc.mainStages ?? [];
                    if (mainStages.length === 0) return null;
                    return (
                      <UniLifecycleStepper
                        steps={mainStages}
                        showLabels
                        status={lc.status}
                        nextStepSuggestions={lc.nextStepSuggestions}
                        hideNextStepSuggestions
                      />
                    );
                  })()}
                </div>
              </DetailDrawerSection>
              <DetailDrawerSection title="明细信息">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无明细行" />
              </DetailDrawerSection>
              <DetailDrawerSection title="操作记录">
                {skillTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {skillTracking.error && !skillTracking.loading && (
                  <Typography.Text type="danger">{skillTracking.error}</Typography.Text>
                )}
                {skillTracking.data && !skillTracking.loading && (
                  <DocumentTrackingTimelineBody data={skillTracking.data} />
                )}
                {!skillTracking.loading && !skillTracking.data && !skillTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
                )}
              </DetailDrawerSection>
            </>
          ) : null
        }
      />
      <SkillFormModal open={modalVisible} onClose={() => { setModalVisible(false); setEditUuid(null); }} editUuid={editUuid} onSuccess={handleModalSuccess} />
    </>
  );
};

export default SkillsPage;
