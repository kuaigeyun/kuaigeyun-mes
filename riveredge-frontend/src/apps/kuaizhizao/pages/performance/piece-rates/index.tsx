/**
 * 计件单价配置页面
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Typography } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ProFormSelect, ProFormDigit, ProFormSwitch } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { employeePerformanceApi, operationApi } from '../../../services/performance';
import type { PieceRate } from '../../../types/performance';
import { getPerformanceConfigActiveLifecycle } from '../../../utils/performanceLifecycle';

const PieceRatesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [operations, setOperations] = useState<{ id: number; code: string; name: string }[]>([]);

  useEffect(() => {
    operationApi.list({ limit: 1000, is_active: true }).then((list) => {
      setOperations(list.map((o) => ({ id: o.id, code: o.code, name: o.name })));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!modalVisible) return;
    formRef.current?.resetFields();
    if (!editId) {
      formRef.current?.setFieldsValue({ is_active: true });
      return;
    }
    employeePerformanceApi.getPieceRate(editId).then((r) => {
      formRef.current?.setFieldsValue({
        operation_id: r.operation_id,
        rate: r.rate,
        is_active: r.is_active !== false,
      });
    }).catch((e: any) => messageApi.error(e?.message || '加载失败'));
  }, [modalVisible, editId]);

  const handleCreate = () => {
    setEditId(null);
    setModalVisible(true);
  };
  const handleEdit = (r: PieceRate) => {
    setEditId(r.id);
    setModalVisible(true);
  };
  const handleDelete = async (r: PieceRate) => {
    try {
      await employeePerformanceApi.deletePieceRate(r.id);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || '删除失败');
    }
  };

  const columns: ProColumns<PieceRate>[] = [
    {
      title: '工序编码',
      dataIndex: 'operation_code',
      width: 120,
      ellipsis: true,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.operation_code ?? r.operation_name ?? '') }} ellipsis>
          {r.operation_code ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '工序', dataIndex: 'operation_name', width: 150, ellipsis: true },
    { title: '单价（元/件）', dataIndex: 'rate', width: 120, align: 'right' },
    {
      title: '启用',
      dataIndex: 'is_active',
      hideInTable: true,
      valueEnum: {
        true: { text: '是' },
        false: { text: '否' },
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      render: (_, r) => (r.updated_at ? dayjs(r.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'),
    },
    {
      title: '生命周期',
      dataIndex: 'lifecycle_stage',
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
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
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
        <UniTable<PieceRate>
          headerTitle="计件单价"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          columnPersistenceId="apps.kuaizhizao.pages.performance.piece-rates"
          showAdvancedSearch
          request={async (params) => {
            try {
              const pageSize = params.pageSize || 20;
              const skip = ((params.current || 1) - 1) * pageSize;
              const result = await employeePerformanceApi.listPieceRates({
                skip,
                limit: pageSize,
              });
              const rows = Array.isArray(result) ? result : [];
              const total = rows.length < pageSize ? skip + rows.length : skip + rows.length + 1;
              return { data: rows, success: true, total };
            } catch (e: any) {
              messageApi.error(e?.message || '加载失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          scroll={{ x: 1280 }}
          enableRowSelection={true}
          showDeleteButton={true}
          onDelete={async (keys) => {
            Modal.confirm({
              title: '确认批量删除',
              content: `确定要删除选中的 ${keys.length} 条计件单价吗？`,
              onOk: async () => {
                try {
                  for (const id of keys) {
                    await employeePerformanceApi.deletePieceRate(Number(id));
                  }
                  messageApi.success(`成功删除 ${keys.length} 条记录`);
                  actionRef.current?.reload();
                } catch (error: any) {
                  messageApi.error(error?.message || '删除失败');
                }
              },
            });
          }}
          showCreateButton
          createButtonText="新建计件单价"
          onCreate={handleCreate}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={editId ? '编辑计件单价' : '新建计件单价'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditId(null);
        }}
        formRef={formRef as React.RefObject<ProFormInstance>}
        onFinish={async (values) => {
          const payload = { operation_id: values.operation_id, rate: values.rate, is_active: values.is_active !== false };
          if (editId) {
            await employeePerformanceApi.updatePieceRate(editId, payload);
            messageApi.success('更新成功');
          } else {
            await employeePerformanceApi.createPieceRate(payload);
            messageApi.success('创建成功');
          }
          setModalVisible(false);
          setEditId(null);
          actionRef.current?.reload();
        }}
        isEdit={!!editId}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <ProFormSelect
          name="operation_id"
          label="工序"
          rules={[{ required: true }]}
          options={operations.map((o) => ({ label: `${o.code} - ${o.name}`, value: o.id }))}
          colProps={{ span: 12 }}
          disabled={!!editId}
        />
        <ProFormDigit name="rate" label="单价（元/件）" rules={[{ required: true }]} min={0} fieldProps={{ precision: 4 }} colProps={{ span: 12 }} />
        <ProFormSwitch name="is_active" label="启用" colProps={{ span: 12 }} />
      </FormModalTemplate>
    </>
  );
};

export default PieceRatesPage;
