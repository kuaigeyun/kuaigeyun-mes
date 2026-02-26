/**
 * 工时单价配置页面
 */

import React, { useRef, useState, useEffect } from 'react';
import { ActionType, ProColumns, ProFormInstance } from '@ant-design/pro-components';
import { App, Popconfirm, Button, Tag, Space } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { ProFormSelect, ProFormDigit, ProFormSwitch } from '@ant-design/pro-components';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { employeePerformanceApi } from '../../../services/performance';
import type { HourlyRate } from '../../../types/performance';

const HourlyRatesPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [departments, setDepartments] = useState<{ id: number; name: string }[]>([]);
  const [positions, setPositions] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => {
    Promise.all([
      employeePerformanceApi.listDepartments(),
      employeePerformanceApi.listPositions(),
    ]).then(([d, p]) => {
      setDepartments(d.items || []);
      setPositions(p.items || []);
    }).catch(() => {});
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

  const handleCreate = () => { setEditId(null); setModalVisible(true); };
  const handleEdit = (r: HourlyRate) => { setEditId(r.id); setModalVisible(true); };
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
    { title: '部门', dataIndex: 'department_name', width: 120, ellipsis: true },
    { title: '职位', dataIndex: 'position_name', width: 120, ellipsis: true },
    { title: '工时单价（元/时）', dataIndex: 'rate', width: 120, align: 'right' },
    { title: '启用', dataIndex: 'is_active', width: 80, render: (_, r) => <Tag color={r.is_active ? 'success' : 'default'}>{r.is_active ? '是' : '否'}</Tag> },
    {
      title: '操作',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
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
          request={async (params) => {
            try {
              const result = await employeePerformanceApi.listHourlyRates({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
              });
              return { data: result, success: true, total: result.length };
            } catch (e: any) {
              messageApi.error(e?.message || '加载失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          toolBarRender={() => [
            <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建</Button>,
          ]}
        />
      </ListPageTemplate>

      <FormModalTemplate
        title={editId ? '编辑工时单价' : '新建工时单价'}
        open={modalVisible}
        onClose={() => { setModalVisible(false); setEditId(null); }}
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
