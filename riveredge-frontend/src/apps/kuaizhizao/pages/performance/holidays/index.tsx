import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 假期管理页面
 *
 * 提供假期的 CRUD 功能，包括列表展示、创建、编辑、删除等操作。
 */

import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Space, Typography, Descriptions, Empty, Spin, theme as AntdTheme } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
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
import { useCustomFieldsForList } from '../../../../../hooks/useCustomFieldsForList';
import {
  CustomFieldsDetailSection,
  hasCustomFieldsDetailContent,
} from '../../../../../components/custom-fields';
import { getPerformanceActiveValueEnum, renderActiveTag } from '../components/performanceMeta';
import { formatDateTime } from '../../../../../utils/format';

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

  const {
    customFields,
    customFieldValues,
    generateCustomFieldColumns,
    enrichRecordsWithCustomFields,
    loadFieldValuesForDetail,
    resetDetailFieldValues,
  } = useCustomFieldsForList<Holiday>({ tableName: 'master_data_holidays' });

  useEffect(() => {
    if (customFields.length > 0 && actionRef.current) {
      setTimeout(() => actionRef.current?.reload(), 200);
    }
  }, [customFields.length]);

  const holidayTracking = useDocumentTracking(
    drawerVisible && holidayDetail?.id != null ? 'performance_holiday' : undefined,
    holidayDetail?.id,
    holidayTrackingRefreshKey,
  );

  const holidayDetailColumns: ProDescriptionsItemProps<Holiday>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.performance.holidays.columns.holidayName'), dataIndex: 'name' },
      { title: t('app.kuaizhizao.performance.holidays.columns.holidayDate'), dataIndex: 'holidayDate', valueType: 'date' },
      { title: t('app.kuaizhizao.performance.holidays.columns.holidayType'), dataIndex: 'holidayType' },
      { title: t('app.kuaizhizao.performance.common.columns.description'), dataIndex: 'description', span: 3 },
      {
        title: t('app.kuaizhizao.performance.holidays.columns.activeStatus'),
        dataIndex: 'isActive',
        render: (_, record) => renderActiveTag(t, record?.isActive),
      },
      { title: t('app.kuaizhizao.performance.common.columns.createdAt'), dataIndex: 'createdAt', valueType: 'dateTime' },
      { title: t('app.kuaizhizao.performance.common.columns.updatedAt'), dataIndex: 'updatedAt', valueType: 'dateTime' },
    ],
    [t],
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

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning(t('common.selectToDelete'));
      return;
    }
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
  };

  const handleOpenDetail = async (record: Holiday) => {
    try {
      setDrawerVisible(true);
      setHolidayDetail(null);
      setDetailLoading(true);
      const detail = await holidayApi.get(record.uuid);
      setHolidayDetail(detail);
      if (detail.id != null) {
        await loadFieldValuesForDetail(detail.id);
      }
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
    resetDetailFieldValues();
  };

  const columns: ProColumns<Holiday>[] = useMemo(() => {
    const customFieldColumns = generateCustomFieldColumns();
    return [
    {
      title: t('app.kuaizhizao.performance.holidays.columns.holidayName'),
      dataIndex: 'name',
      width: 200,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.name ?? '') }} ellipsis>
          {r.name ?? '-'}
        </Typography.Text>
      ),
    },
    { title: t('app.kuaizhizao.performance.holidays.columns.holidayDate'), dataIndex: 'holidayDate', width: 150, valueType: 'date', sorter: true },
    { title: t('app.kuaizhizao.performance.holidays.columns.holidayType'), dataIndex: 'holidayType', width: 150, hideInSearch: true },
    { title: t('app.kuaizhizao.performance.common.columns.description'), dataIndex: 'description', ellipsis: true, hideInSearch: true },
    ...customFieldColumns,
    {
      title: t('app.kuaizhizao.performance.common.active.enabled'),
      dataIndex: 'isActive',
      hideInTable: true,
      valueType: 'select',
      valueEnum: getPerformanceActiveValueEnum(t),
    },
    {
      title: t('app.kuaizhizao.performance.common.columns.updatedAt'),
      dataIndex: 'updatedAt',
      width: 168,
      hideInSearch: true,
      render: (_, r) => (r.updatedAt ? formatDateTime(r.updatedAt, 'YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: t('app.kuaizhizao.performance.common.columns.lifecycle'),
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
      title: t('app.kuaizhizao.performance.common.columns.actions'),
      valueType: 'option',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button key="view" {...rowActionKind('read')} onClick={() => handleOpenDetail(record)}>
            {t('app.kuaizhizao.performance.common.actions.detail')}
          </Button>
          <Button key="edit" {...rowActionKind('update')} onClick={() => handleEdit(record)}>
            {t('app.kuaizhizao.performance.common.actions.edit')}
          </Button>
          <Popconfirm key="delete" {...rowActionKind('delete')} title={t('app.kuaizhizao.performance.holidays.messages.deleteConfirm')} onConfirm={() => handleDelete(record)}>
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              {t('app.kuaizhizao.performance.common.actions.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
    ];
  }, [t, customFields]);

  return (
    <>
      <ListPageTemplate>
        <UniTable<Holiday>
          headerTitle={t('app.kuaizhizao.performance.holidays.pageTitle')}
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
              const enrichedRows = await enrichRecordsWithCustomFields(rows);
              const total = enrichedRows.length < pageSize ? skip + enrichedRows.length : skip + enrichedRows.length + 1;
              return { data: enrichedRows, success: true, total };
            } catch (error: any) {
              messageApi.error(error?.message || t('app.kuaizhizao.performance.holidays.messages.loadListFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          rowKey="uuid"
          showAdvancedSearch={true}
          scroll={{ x: 1280 }}
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
          showCreateButton
          createButtonText={t('app.kuaizhizao.performance.holidays.createButton')}
          onCreate={handleCreate}
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) => t('common.confirmBatchDeleteContent', { count })}
          deleteButtonText={t('app.kuaizhizao.performance.holidays.messages.deleteBatchButton')}
        />
      </ListPageTemplate>
      <DetailDrawerTemplate
        title={t('app.kuaizhizao.performance.holidays.detailTitle')}
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
              <DetailDrawerSection title={t('app.kuaizhizao.performance.common.sections.basicInfo')}>
                <Descriptions
                  column={3}
                  size="small"
                  items={buildMasterDetailDescriptionItems(holidayDetail, holidayDetailColumns)}
                />
              </DetailDrawerSection>
              {hasCustomFieldsDetailContent(customFields, customFieldValues) ? (
                <DetailDrawerSection title={t('app.master-data.customFields')}>
                  <CustomFieldsDetailSection customFields={customFields} customFieldValues={customFieldValues} />
                </DetailDrawerSection>
              ) : null}
              <DetailDrawerSection title={t('app.kuaizhizao.performance.common.sections.lifecycle')}>
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
              <DetailDrawerSection title={t('app.kuaizhizao.performance.common.sections.detailInfo')}>
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.performance.common.empty.noDetailLines')} />
              </DetailDrawerSection>
              <DetailDrawerSection title={t('app.kuaizhizao.performance.common.sections.operationLog')}>
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
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaizhizao.performance.common.empty.noActivityLog')} />
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
