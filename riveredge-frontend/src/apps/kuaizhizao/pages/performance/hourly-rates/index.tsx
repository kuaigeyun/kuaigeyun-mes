/**
 * 工时单价配置页面
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Space, Modal, Typography } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ProFormSelect, ProFormDigit, ProFormSwitch } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { employeePerformanceApi } from '../../../services/performance';
import type { HourlyRate } from '../../../types/performance';
import { getPerformanceConfigActiveLifecycle } from '../../../utils/performanceLifecycle';

const HourlyRatesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [positions, setPositions] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    Promise.all([employeePerformanceApi.listDepartments(), employeePerformanceApi.listPositions()])
      .then(([d, p]) => {
        setDepartments(d.items || []);
        setPositions(p.items || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!modalVisible) return;
    formRef.current?.resetFields();
    if (!editId) {
      formRef.current?.setFieldsValue({ is_active: true });
      return;
    }
    employeePerformanceApi.getHourlyRate(editId).then((r) => {
      formRef.current?.setFieldsValue({
        department_id: r.department_id,
        position_id: r.position_id,
        rate: r.rate,
        is_active: r.is_active !== false,
      });
    }).catch((e: any) => messageApi.error(e?.message || '加载失败'));
  }, [modalVisible, editId]);

  const handleCreate = () => {
    setEditId(null);
    setModalVisible(true);
  };
  const handleEdit = (r: HourlyRate) => {
    setEditId(r.id);
    setModalVisible(true);
  };
  const handleDelete = async (r: HourlyRate) => {
    try {
      await employeePerformanceApi.deleteHourlyRate(r.id);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (e: any) {
      messageApi.error(e?.message || '删除失败');
    }
  };

  const columns: ProColumns<HourlyRate>[] = [
    {
      title: '部门',
      dataIndex: 'department_name',
      width: 120,
      ellipsis: true,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.department_name ?? '') }} ellipsis>
          {r.department_name ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '职位',
      dataIndex: 'position_name',
      width: 120,
      ellipsis: true,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.position_name ?? '') }} ellipsis>
          {r.position_name ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '工时单价（元/时）', dataIndex: 'rate', width: 120, align: 'right' },
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
        <UniTable<HourlyRate>
          headerTitle="工时单价"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          columnPersistenceId="kuaizhizao-perf-hourly-rates"
          showAdvancedSearch
          request={async (params) => {
            try {
              const pageSize = params.pageSize || 20;
              const skip = ((params.current || 1) - 1) * pageSize;
              const result = await employeePerformanceApi.listHourlyRates({
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
              content: `确定要删除选中的 ${keys.length} 条时薪单价吗？`,
              onOk: async () => {
                try {
                  for (const id of keys) {
                    await employeePerformanceApi.deleteHourlyRate(Number(id));
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
          createButtonText="新建工时单价"
          onCreate={handleCreate}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={editId ? '编辑工时单价' : '新建工时单价'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditId(null);
        }}
        formRef={formRef as React.RefObject<ProFormInstance>}
        onFinish={async (values) => {
          const payload = {
            department_id: values.department_id || undefined,
            position_id: values.position_id || undefined,
            rate: values.rate,
            is_active: values.is_active !== false,
          };
          if (editId) {
            await employeePerformanceApi.updateHourlyRate(editId, payload);
            messageApi.success('更新成功');
          } else {
            await employeePerformanceApi.createHourlyRate(payload);
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
          name="department_id"
          label="部门"
          options={[{ label: '（不指定）', value: null }, ...departments.map((d) => ({ label: d.name, value: d.id }))]}
          colProps={{ span: 12 }}
          disabled={!!editId}
        />
        <ProFormSelect
          name="position_id"
          label="职位"
          options={[{ label: '（不指定）', value: null }, ...positions.map((p) => ({ label: p.name, value: p.id }))]}
          colProps={{ span: 12 }}
          disabled={!!editId}
        />
        <ProFormDigit name="rate" label="工时单价（元/小时）" rules={[{ required: true }]} min={0} fieldProps={{ precision: 2 }} colProps={{ span: 12 }} />
        <ProFormSwitch name="is_active" label="启用" colProps={{ span: 12 }} />
      </FormModalTemplate>
    </>
  );
};

export default HourlyRatesPage;
