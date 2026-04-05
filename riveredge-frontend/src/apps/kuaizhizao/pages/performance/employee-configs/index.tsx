/**
 * 员工绩效配置页面
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space, Modal, Typography } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ProFormSelect, ProFormDigit, ProFormRadio, ProFormSwitch } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { employeePerformanceApi } from '../../../services/performance';
import type { EmployeePerformanceConfig } from '../../../types/performance';
import { getPerformanceConfigActiveLifecycle } from '../../../utils/performanceLifecycle';

const CALC_MODE_OPTIONS = [
  { label: '计时', value: 'time' },
  { label: '计件', value: 'piece' },
  { label: '混合', value: 'mixed' },
];

const EmployeeConfigsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [employees, setEmployees] = useState<{ id: number; full_name: string }[]>([]);

  useEffect(() => {
    employeePerformanceApi.listEmployees({ limit: 500 }).then((r) => {
      setEmployees(r.items.map((e) => ({ id: e.id, full_name: e.full_name || e.username })));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!modalVisible) return;
    formRef.current?.resetFields();
    if (!editId) {
      formRef.current?.setFieldsValue({ calc_mode: 'time', is_active: true });
      return;
    }
    employeePerformanceApi.getConfig(editId).then((c) => {
      formRef.current?.setFieldsValue({
        employee_id: c.employee_id,
        calc_mode: c.calc_mode || 'time',
        hourly_rate: c.hourly_rate,
        default_piece_rate: c.default_piece_rate,
        base_salary: c.base_salary,
        is_active: c.is_active !== false,
      });
    }).catch((e: any) => messageApi.error(e?.message || '加载失败'));
  }, [modalVisible, editId]);

  const handleCreate = () => {
    setEditId(null);
    setModalVisible(true);
  };
  const handleEdit = (record: EmployeePerformanceConfig) => {
    setEditId(record.id);
    setModalVisible(true);
  };
  const handleDelete = async (record: EmployeePerformanceConfig) => {
    try {
      await employeePerformanceApi.deleteConfig(record.id);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error?.message || '删除失败');
    }
  };

  const handleModalSuccess = () => {
    setModalVisible(false);
    setEditId(null);
    actionRef.current?.reload();
  };

  const columns: ProColumns<EmployeePerformanceConfig>[] = [
    {
      title: '员工',
      dataIndex: 'employee_name',
      width: 120,
      ellipsis: true,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.employee_name ?? '') }} ellipsis>
          {r.employee_name ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '计算模式',
      dataIndex: 'calc_mode',
      width: 100,
      render: (_, r) => <Tag>{CALC_MODE_OPTIONS.find((o) => o.value === r.calc_mode)?.label || r.calc_mode}</Tag>,
    },
    { title: '工时单价（元/时）', dataIndex: 'hourly_rate', width: 120, align: 'right' },
    { title: '默认计件单价（元/件）', dataIndex: 'default_piece_rate', width: 140, align: 'right' },
    { title: '月保障工资（元）', dataIndex: 'base_salary', width: 120, align: 'right' },
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
        <UniTable<EmployeePerformanceConfig>
          headerTitle="员工绩效配置"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          columnPersistenceId="kuaizhizao-perf-employee-configs"
          showAdvancedSearch
          request={async (params) => {
            try {
              const pageSize = params.pageSize || 20;
              const skip = ((params.current || 1) - 1) * pageSize;
              const result = await employeePerformanceApi.listConfigs({
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
          scroll={{ x: 1500 }}
          enableRowSelection={true}
          showDeleteButton={true}
          onDelete={async (keys) => {
            Modal.confirm({
              title: '确认批量删除',
              content: `确定要删除选中的 ${keys.length} 条员工配置吗？`,
              onOk: async () => {
                try {
                  for (const id of keys) {
                    await employeePerformanceApi.deleteConfig(Number(id));
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
          createButtonText="新建员工绩效配置"
          onCreate={handleCreate}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={editId ? '编辑员工绩效配置' : '新建员工绩效配置'}
        open={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditId(null);
        }}
        formRef={formRef as React.RefObject<ProFormInstance>}
        onFinish={async (values) => {
          const payload = {
            employee_id: values.employee_id,
            employee_name: employees.find((e) => e.id === values.employee_id)?.full_name,
            calc_mode: values.calc_mode || 'time',
            hourly_rate: values.hourly_rate,
            default_piece_rate: values.default_piece_rate,
            base_salary: values.base_salary,
            is_active: values.is_active !== false,
          };
          if (editId) {
            await employeePerformanceApi.updateConfig(editId, payload);
            messageApi.success('更新成功');
          } else {
            await employeePerformanceApi.createConfig(payload);
            messageApi.success('创建成功');
          }
          handleModalSuccess();
        }}
        isEdit={!!editId}
        width={MODAL_CONFIG.STANDARD_WIDTH}
      >
        <ProFormSelect
          name="employee_id"
          label="员工"
          rules={[{ required: true }]}
          options={employees.map((e) => ({ label: e.full_name, value: e.id }))}
          colProps={{ span: 12 }}
          disabled={!!editId}
        />
        <ProFormRadio.Group name="calc_mode" label="计算模式" options={CALC_MODE_OPTIONS} colProps={{ span: 12 }} />
        <ProFormDigit name="hourly_rate" label="工时单价（元/小时）" min={0} fieldProps={{ precision: 2 }} colProps={{ span: 12 }} />
        <ProFormDigit name="default_piece_rate" label="默认计件单价（元/件）" min={0} fieldProps={{ precision: 4 }} colProps={{ span: 12 }} />
        <ProFormDigit name="base_salary" label="月保障工资（元）" min={0} fieldProps={{ precision: 2 }} colProps={{ span: 12 }} />
        <ProFormSwitch name="is_active" label="启用" colProps={{ span: 12 }} />
      </FormModalTemplate>
    </>
  );
};

export default EmployeeConfigsPage;
