/**
 * 班次定义页面
 */

import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Descriptions, Popconfirm, Space, Spin, Typography, theme as AntdTheme } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { rowActionKind } from '../../../../../components/uni-action';
import {
  ListPageTemplate,
  DetailDrawerTemplate,
  DetailDrawerSection,
  DRAWER_CONFIG,
} from '../../../../../components/layout-templates';
import { shiftApi } from '../../../services/performance';
import type { Shift } from '../../../types/performance';
import { ShiftFormModal } from '../../../components/ShiftFormModal';
import { buildMasterDetailDescriptionItems } from '../../../utils/buildMasterDetailDescriptionItems';
import { alignProColumns, SALES_DOC_LIST_FIELD_RANK } from '../../sales-management/shared/documentFieldAlignment';
import {
  getPerformanceInactiveActiveValueEnum,
  renderActiveTag,
  renderYesNoTag,
} from '../components/performanceMeta';
import {
  normalizePerformanceListResponse,
  PERFORMANCE_PINNED_ACTIVE_FIELD,
  resolveShiftListParams,
} from '../../../utils/performanceListCore';
import { buildDocumentAuditColumns } from '../../shared/documentAuditColumns';

const ShiftsPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = AntdTheme.useToken();
  const detailDrawerZIndex = token.zIndexPopupBase;
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [shiftDetail, setShiftDetail] = useState<Shift | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const detailColumns: ProDescriptionsItemProps<Shift>[] = useMemo(
    () => [
      { title: t('app.kuaizhizao.performance.shifts.columns.shiftCode'), dataIndex: 'code' },
      { title: t('app.kuaizhizao.performance.shifts.columns.shiftName'), dataIndex: 'name' },
      {
        title: t('app.kuaizhizao.performance.shifts.columns.timeRange'),
        dataIndex: 'startTime',
        render: (_, r) => `${r?.startTime?.slice(0, 5) ?? '-'} ~ ${r?.endTime?.slice(0, 5) ?? '-'}`,
      },
      {
        title: t('app.kuaizhizao.performance.shifts.columns.crossesMidnight'),
        dataIndex: 'crossesMidnight',
        render: (_, r) => renderYesNoTag(t, r?.crossesMidnight),
      },
      { title: t('app.kuaizhizao.performance.shifts.columns.standardHours'), dataIndex: 'standardHours' },
      {
        title: t('app.kuaizhizao.performance.common.columns.status'),
        dataIndex: 'isActive',
        render: (_, r) => renderActiveTag(t, r?.isActive, 'inactive'),
      },
      { title: t('app.kuaizhizao.performance.common.columns.createdAt'), dataIndex: 'createdAt', valueType: 'dateTime' },
      { title: t('app.kuaizhizao.performance.common.columns.updatedAt'), dataIndex: 'updatedAt', valueType: 'dateTime' },
    ],
    [t],
  );

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning(t('app.kuaizhizao.performance.shifts.messages.selectFirst'));
      return;
    }
    try {
      for (const key of keys) {
        await shiftApi.delete(String(key));
      }
      messageApi.success(t('app.kuaizhizao.performance.common.messages.deleteBatchSuccess', { count: keys.length }));
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.performance.common.messages.deleteFailed'));
    }
  };

  const handleOpenDetail = async (record: Shift) => {
    try {
      setDrawerVisible(true);
      setShiftDetail(null);
      setDetailLoading(true);
      const detail = await shiftApi.get(record.uuid);
      setShiftDetail(detail);
    } catch (e: any) {
      messageApi.error(e?.message || t('app.kuaizhizao.performance.common.messages.loadFailed'));
      setDrawerVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setDrawerVisible(false);
    setShiftDetail(null);
  };

  const columns: ProColumns<Shift>[] = useMemo(
    () => alignProColumns<Shift>([
      {
        title: t('app.kuaizhizao.performance.shifts.columns.shiftCode'),
        dataIndex: 'code',
        width: 120,
        fixed: 'left',
        sorter: true,
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
            {r.code ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.performance.shifts.columns.shiftName'), dataIndex: 'name', width: 160, ellipsis: true, sorter: true },
      {
        title: t('app.kuaizhizao.performance.shifts.columns.timeRange'),
        key: 'timeRange',
        width: 160,
        hideInSearch: true,
        render: (_, r) => `${r.startTime?.slice(0, 5) ?? '-'} ~ ${r.endTime?.slice(0, 5) ?? '-'}`,
      },
      {
        title: t('app.kuaizhizao.performance.shifts.columns.crossesMidnight'),
        dataIndex: 'crossesMidnight',
        width: 80,
        hideInSearch: true,
        render: (_, r) => renderYesNoTag(t, r.crossesMidnight),
      },
      {
        title: t('app.kuaizhizao.performance.shifts.columns.standardHours'),
        dataIndex: 'standardHours',
        width: 100,
        align: 'right',
        hideInSearch: true,
        sorter: true,
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.status'),
        dataIndex: 'isActive',
        width: 90,
        valueType: 'select',
        valueEnum: getPerformanceInactiveActiveValueEnum(t),
        sorter: true,
        render: (_, r) => renderActiveTag(t, r.isActive, 'inactive'),
      },
      ...buildDocumentAuditColumns<Shift>(t),
      {
        title: t('app.kuaizhizao.performance.common.columns.actions'),
        key: 'action',
        valueType: 'option',
        width: 160,
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => (
          <Space>
            <Button key="view" {...rowActionKind('read')} onClick={() => handleOpenDetail(record)}>
              {t('app.kuaizhizao.performance.common.actions.detail')}
            </Button>
            <Button
              key="edit"
              {...rowActionKind('update')}
              onClick={() => {
                setEditUuid(record.uuid);
                setModalVisible(true);
              }}
            >
              {t('app.kuaizhizao.performance.common.actions.edit')}
            </Button>
            <Popconfirm
              key="delete"
              {...rowActionKind('delete')}
              title={t('app.kuaizhizao.performance.shifts.messages.deleteConfirm')}
              onConfirm={async () => {
                try {
                  await shiftApi.delete(record.uuid);
                  messageApi.success(t('app.kuaizhizao.performance.common.messages.deleteSuccess'));
                  actionRef.current?.reload();
                } catch (e: any) {
                  messageApi.error(e?.message || t('app.kuaizhizao.performance.common.messages.deleteFailed'));
                }
              }}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                {t('app.kuaizhizao.performance.common.actions.delete')}
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ], SALES_DOC_LIST_FIELD_RANK),
    [t, messageApi],
  );

  return (
    <>
      <ListPageTemplate>
        <UniTable<Shift>
          headerTitle={t('app.kuaizhizao.performance.shifts.pageTitle')}
          columnPersistenceId="apps.kuaizhizao.pages.performance.shifts"
          actionRef={actionRef}
          rowKey="uuid"
          columns={columns}
          showCreateButton
          createButtonText={t('app.kuaizhizao.performance.shifts.createButton')}
          onCreate={() => {
            setEditUuid(null);
            setModalVisible(true);
          }}
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onRowSelectionChange={setSelectedRowKeys}
          showDeleteButton
          onDelete={handleBatchDelete}
          deleteConfirmTitle={(count) => t('app.kuaizhizao.performance.shifts.messages.deleteBatchConfirm', { count })}
          showAdvancedSearch
          skipFuzzyPinyinClientFilter
          pinnedTabsField={PERFORMANCE_PINNED_ACTIVE_FIELD}
          request={async (params, sort, _filter, searchFormValues) => {
            try {
              const pageSize = params.pageSize || 20;
              const skip = ((params.current || 1) - 1) * pageSize;
              const listParams = resolveShiftListParams(searchFormValues, sort);
              const response = await shiftApi.list({ skip, limit: pageSize, ...listParams });
              const { data, total } = normalizePerformanceListResponse(response);
              return { data: data as Shift[], success: true, total };
            } catch (e: any) {
              messageApi.error(e?.message || t('app.kuaizhizao.performance.common.messages.loadFailed'));
              return { data: [], success: false, total: 0 };
            }
          }}
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        />
        <ShiftFormModal
          open={modalVisible}
          onClose={() => {
            setModalVisible(false);
            setEditUuid(null);
          }}
          editUuid={editUuid}
          onSuccess={() => actionRef.current?.reload()}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={t('app.kuaizhizao.performance.shifts.detailTitle')}
        open={drawerVisible}
        zIndex={detailDrawerZIndex}
        onClose={handleCloseDetail}
        width={DRAWER_CONFIG.HALF_WIDTH}
        loading={detailLoading}
        columns={[]}
        customContent={
          detailLoading && !shiftDetail ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Spin />
            </div>
          ) : shiftDetail ? (
            <DetailDrawerSection title={t('app.kuaizhizao.performance.common.sections.basicInfo')}>
              <Descriptions
                column={2}
                size="small"
                items={buildMasterDetailDescriptionItems(shiftDetail, detailColumns)}
              />
            </DetailDrawerSection>
          ) : null
        }
      />
    </>
  );
};

export default ShiftsPage;
