/**
 * 班次定义页面
 */

import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Popconfirm, Space, Typography } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { shiftApi } from '../../../services/performance';
import type { Shift } from '../../../types/performance';
import { ShiftFormModal } from '../../../components/ShiftFormModal';
import {
  getPerformanceInactiveActiveValueEnum,
  renderActiveTag,
  renderYesNoTag,
} from '../components/performanceMeta';

const ShiftsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

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

  const columns: ProColumns<Shift>[] = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.performance.shifts.columns.shiftCode'),
        dataIndex: 'code',
        width: 120,
        fixed: 'left',
        render: (_, r) => (
          <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
            {r.code ?? '-'}
          </Typography.Text>
        ),
      },
      { title: t('app.kuaizhizao.performance.shifts.columns.shiftName'), dataIndex: 'name', width: 160, ellipsis: true },
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
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.status'),
        dataIndex: 'isActive',
        width: 90,
        valueType: 'select',
        valueEnum: getPerformanceInactiveActiveValueEnum(t),
        render: (_, r) => renderActiveTag(t, r.isActive, 'inactive'),
      },
      {
        title: t('app.kuaizhizao.performance.common.columns.actions'),
        key: 'action',
        width: 140,
        fixed: 'right',
        hideInSearch: true,
        render: (_, record) => (
          <Space size="small">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditUuid(record.uuid); setModalVisible(true); }}>
              {t('app.kuaizhizao.performance.common.actions.edit')}
            </Button>
            <Popconfirm title={t('app.kuaizhizao.performance.shifts.messages.deleteConfirm')} onConfirm={async () => {
              try {
                await shiftApi.delete(record.uuid);
                messageApi.success(t('app.kuaizhizao.performance.common.messages.deleteSuccess'));
                actionRef.current?.reload();
              } catch (e: any) {
                messageApi.error(e?.message || t('app.kuaizhizao.performance.common.messages.deleteFailed'));
              }
            }}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                {t('app.kuaizhizao.performance.common.actions.delete')}
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [t, messageApi],
  );

  return (
    <ListPageTemplate>
      <UniTable<Shift>
        headerTitle={t('app.kuaizhizao.performance.shifts.pageTitle')}
        columnPersistenceId="apps.kuaizhizao.pages.performance.shifts"
        actionRef={actionRef}
        rowKey="uuid"
        columns={columns}
        showCreateButton
        createButtonText={t('app.kuaizhizao.performance.shifts.createButton')}
        onCreate={() => { setEditUuid(null); setModalVisible(true); }}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={(count) => t('app.kuaizhizao.performance.shifts.messages.deleteBatchConfirm', { count })}
        request={async () => {
          try {
            const data = await shiftApi.list({ limit: 500 });
            return { data, success: true, total: data.length };
          } catch (e: any) {
            messageApi.error(e?.message || t('app.kuaizhizao.performance.common.messages.loadFailed'));
            return { data: [], success: false, total: 0 };
          }
        }}
      />
      <ShiftFormModal
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditUuid(null); }}
        editUuid={editUuid}
        onSuccess={() => actionRef.current?.reload()}
      />
    </ListPageTemplate>
  );
};

export default ShiftsPage;
