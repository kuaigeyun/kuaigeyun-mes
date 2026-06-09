import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 假期管理页面
 *
 * 提供假期的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Space, Modal, Typography, Descriptions, Empty, Spin, theme as AntdTheme } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle, UniLifecycleStepper } from '../../../../../components/uni-lifecycle';
import { DocumentTrackingTimelineBody, useDocumentTracking } from '../../../../../components/document-tracking-panel';
import { ListPageTemplate, DetailDrawerTemplate, DetailDrawerSection, DetailDrawerInlineFullChain, DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { PerformanceTraceBriefPrimaryActions } from '../PerformanceTraceBriefFooter';
import { holidayApi } from '../../../services/performance';
import { HolidayFormModal } from '../../../components/HolidayFormModal';
import type { Holiday } from '../../../types/performance';
import { getPerformanceConfigActiveLifecycle } from '../../../utils/performanceLifecycle';
import { buildMasterDetailDescriptionItems } from '../../../utils/buildMasterDetailDescriptionItems';

const HOLIDAY_DETAIL_COLUMNS: ProDescriptionsItemProps<Holiday>[] = [
  { title: '假期名称', dataIndex: 'name' },
  { title: '假期日期', dataIndex: 'holidayDate', valueType: 'date' },
  { title: '假期类型', dataIndex: 'holidayType' },
  { title: '描述', dataIndex: 'description', span: 3 },
  { title: '启用状态', dataIndex: 'isActive', render: (_, record) => (record?.isActive ? '启用' : '禁用') },
  { title: '创建时间', dataIndex: 'createdAt', valueType: 'dateTime' },
  { title: '更新时间', dataIndex: 'updatedAt', valueType: 'dateTime' },
];

const HolidaysPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = AntdTheme.useToken();
  const holidayDetailDrawerZIndex = token.zIndexPopupBase;
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [holidayDetail, setHolidayDetail] = useState<Holiday | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [holidayTrackingRefreshKey, setHolidayTrackingRefreshKey] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);

  const holidayTracking = useDocumentTracking(
    drawerVisible && holidayDetail?.id != null ? 'performance_holiday' : undefined,
    holidayDetail?.id,
    holidayTrackingRefreshKey,
  );

  const handleCreate = () => { setEditUuid(null); setModalVisible(true); };
  const handleEdit = (record: Holiday) => { setEditUuid(record.uuid); setModalVisible(true); };
  const handleDelete = async (record: Holiday) => {
    try {
      await holidayApi.delete(record.uuid);
      messageApi.success(t('common.deleteSuccess'));
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || t('common.deleteFailed'));
    }
  };

  const handleBatchDelete = (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning(t('common.selectToDelete'));
      return;
    }
    Modal.confirm({
      title: t('common.confirmBatchDelete'),
      content: t('common.confirmBatchDeleteContent', { count: keys.length }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          let successCount = 0;
          let failCount = 0;
          const errors: string[] = [];
          for (const key of keys) {
            try {
              await holidayApi.delete(key.toString());
              successCount++;
            } catch (error: any) {
              failCount++;
              errors.push(error.message || t('common.deleteFailed'));
            }
          }
          if (successCount > 0) messageApi.success(t('common.batchDeleteSuccess', { count: successCount }));
          if (failCount > 0) messageApi.error(t('common.batchDeletePartial', { count: failCount, errors: errors.length > 0 ? '：' + errors.join('; ') : '' }));
          setSelectedRowKeys([]);
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || t('common.batchDeleteFailed'));
        }
      },
    });
  };

  const handleOpenDetail = async (record: Holiday) => {
    try {
      setDrawerVisible(true);
      setHolidayDetail(null);
      setDetailLoading(true);
      const detail = await holidayApi.get(record.uuid);
      setHolidayDetail(detail);
      setHolidayTrackingRefreshKey((k) => k + 1);
    } catch (error: any) {
      messageApi.error(error.message || t('app.master-data.holidays.getDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleModalSuccess = () => { setModalVisible(false); setEditUuid(null); actionRef.current?.reload(); };
  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setHolidayDetail(null);
  };

  const columns: ProColumns<Holiday>[] = [
    {
      title: '假期名称',
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.name ?? '') }} ellipsis>
          {r.name ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '假期日期', dataIndex: 'holidayDate', width: 150, valueType: 'date', sorter: true },
    { title: '假期类型', dataIndex: 'holidayType', width: 150, hideInSearch: true },
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
      dataIndex: 'lifecycle_stage',
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
          <Button key="view" {...rowActionKind('read')} onClick={() => handleOpenDetail(record)}>
            详情
          </Button>
          <Button key="edit" {...rowActionKind('update')} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm key="delete" {...rowActionKind('delete')} title="确定要删除这个假期吗？" onConfirm={() => handleDelete(record)}>
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
        <UniTable<Holiday>
          headerTitle="假期管理"
          actionRef={actionRef}
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.performance.holidays"
          request={async (params, _sort, _filter, searchFormValues) => {
            const pageSize = params.pageSize || 20;
            const skip = ((params.current || 1) - 1) * pageSize;
            const apiParams: any = { skip, limit: pageSize };
            if (searchFormValues?.isActive !== undefined && searchFormValues.isActive !== '' && searchFormValues.isActive !== null) apiParams.isActive = searchFormValues.isActive;
            try {
              const result = await holidayApi.list(apiParams);
              const rows = Array.isArray(result) ? result : [];
              const total = rows.length < pageSize ? skip + rows.length : skip + rows.length + 1;
              return { data: rows, success: true, total };
            } catch (error: any) {
              messageApi.error(error?.message || '获取假期列表失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          scroll={{ x: 1280 }}
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
          showCreateButton
          createButtonText="新建假期"
          onCreate={handleCreate}
          enableRowSelection
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteButtonText="批量删除"
        />
      </ListPageTemplate>
      <DetailDrawerTemplate
        title="假期详情"
        open={drawerVisible}
        zIndex={holidayDetailDrawerZIndex}
        onClose={handleCloseDetail}
        width={DRAWER_CONFIG.HALF_WIDTH}
        loading={detailLoading}
        columns={[]}
        customContent={
          detailLoading && !holidayDetail ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Spin />
            </div>
          ) : holidayDetail ? (
            <>
              <DetailDrawerSection title="基本信息">
                <Descriptions
                  column={3}
                  size="small"
                  items={buildMasterDetailDescriptionItems(holidayDetail, HOLIDAY_DETAIL_COLUMNS)}
                />
              </DetailDrawerSection>
              <DetailDrawerSection title="生命周期">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {(() => {
                    const lc = getPerformanceConfigActiveLifecycle(holidayDetail as unknown as Record<string, unknown>);
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
                  {holidayDetail.id != null ? (
                    <DetailDrawerInlineFullChain
                      documentType='performance_holiday'
                      documentId={holidayDetail.id}
                      active={drawerVisible}
                      selfDocumentId={holidayDetail.id}
                      renderBriefActions={(doc) => (
                  <PerformanceTraceBriefPrimaryActions
                    doc={doc}
                    t={t}
                    navigate={navigate}
                    closeDrawer={handleCloseDetail}
                  />
                )}
                    />
                  ) : null}
                </div>
              </DetailDrawerSection>
              <DetailDrawerSection title="明细信息">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无明细行" />
              </DetailDrawerSection>
              <DetailDrawerSection title="操作记录">
                {holidayTracking.loading && (
                  <div style={{ textAlign: 'center', padding: 24 }}>
                    <Spin />
                  </div>
                )}
                {holidayTracking.error && !holidayTracking.loading && (
                  <Typography.Text type="danger">{holidayTracking.error}</Typography.Text>
                )}
                {holidayTracking.data && !holidayTracking.loading && (
                  <DocumentTrackingTimelineBody data={holidayTracking.data} />
                )}
                {!holidayTracking.loading && !holidayTracking.data && !holidayTracking.error && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无操作记录" />
                )}
              </DetailDrawerSection>
            </>
          ) : null
        }
      />
      <HolidayFormModal open={modalVisible} onClose={() => { setModalVisible(false); setEditUuid(null); }} editUuid={editUuid} onSuccess={handleModalSuccess} />
    </>
  );
};

export default HolidaysPage;
