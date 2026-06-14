/**
 * 班次定义页面
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App, Button, Popconfirm, Space, Tag, Typography } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { shiftApi } from '../../../services/performance';
import type { Shift } from '../../../types/performance';
import { ShiftFormModal } from '../../../components/ShiftFormModal';

const ShiftsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editUuid, setEditUuid] = useState<string | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const handleBatchDelete = async (keys: React.Key[]) => {
    if (keys.length === 0) {
      messageApi.warning('请先选择班次');
      return;
    }
    try {
      for (const key of keys) {
        await shiftApi.delete(String(key));
      }
      messageApi.success(`成功删除 ${keys.length} 条记录`);
      setSelectedRowKeys([]);
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || '删除失败');
    }
  };

  const columns: ProColumns<Shift>[] = [
    {
      title: '班次编码',
      dataIndex: 'code',
      width: 120,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.code ?? '') }} ellipsis>
          {r.code ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '班次名称', dataIndex: 'name', width: 160, ellipsis: true },
    {
      title: '时间段',
      key: 'timeRange',
      width: 160,
      hideInSearch: true,
      render: (_, r) => `${r.startTime?.slice(0, 5) ?? '-'} ~ ${r.endTime?.slice(0, 5) ?? '-'}`,
    },
    {
      title: '跨天',
      dataIndex: 'crossesMidnight',
      width: 80,
      hideInSearch: true,
      render: (_, r) => (r.crossesMidnight ? <Tag>是</Tag> : <Tag>否</Tag>),
    },
    {
      title: '标准工时',
      dataIndex: 'standardHours',
      width: 100,
      align: 'right',
      hideInSearch: true,
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      width: 90,
      valueType: 'select',
      valueEnum: { true: { text: '启用' }, false: { text: '停用' } },
      render: (_, r) => <Tag color={r.isActive ? 'success' : 'default'}>{r.isActive ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      fixed: 'right',
      hideInSearch: true,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditUuid(record.uuid); setModalVisible(true); }}>
            编辑
          </Button>
          <Popconfirm title="确定删除该班次？" onConfirm={async () => {
            try {
              await shiftApi.delete(record.uuid);
              messageApi.success('删除成功');
              actionRef.current?.reload();
            } catch (e: any) {
              messageApi.error(e?.message || '删除失败');
            }
          }}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <ListPageTemplate>
      <UniTable<Shift>
        headerTitle="班次定义"
        columnPersistenceId="apps.kuaizhizao.pages.performance.shifts"
        actionRef={actionRef}
        rowKey="uuid"
        columns={columns}
        showCreateButton
        createButtonText="新建班次"
        onCreate={() => { setEditUuid(null); setModalVisible(true); }}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onRowSelectionChange={setSelectedRowKeys}
        showDeleteButton
        onDelete={handleBatchDelete}
        deleteConfirmTitle={(count) => `确定要删除选中的 ${count} 条班次吗？`}
        request={async () => {
          try {
            const data = await shiftApi.list({ limit: 500 });
            return { data, success: true, total: data.length };
          } catch (e: any) {
            messageApi.error(e?.message || '加载失败');
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
