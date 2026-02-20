/**
 * 借料单管理页面
 *
 * 提供借料单的创建、查看、确认和管理功能（无工单借料：工具间、研发等）
 *
 * @author RiverEdge Team
 * @date 2026-02-19
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Form, Select, InputNumber, Input, DatePicker } from 'antd';
import { PlusOutlined, EyeOutlined, CheckCircleOutlined, DeleteOutlined, PrinterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { warehouseApi } from '../../../services/production';
import { warehouseApi as masterDataWarehouseApi } from '../../../../master-data/services/warehouse';
import { materialApi } from '../../../../master-data/services/material';

interface MaterialBorrow {
  id?: number;
  tenant_id?: number;
  borrow_code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  borrower_id?: number;
  borrower_name?: string;
  department?: string;
  expected_return_date?: string;
  borrow_time?: string;
  status?: string;
  total_quantity?: number;
  notes?: string;
  created_at?: string;
}

interface MaterialBorrowDetail extends MaterialBorrow {
  items?: MaterialBorrowItem[];
}

interface MaterialBorrowItem {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_spec?: string;
  material_unit?: string;
  borrow_quantity?: number;
  returned_quantity?: number;
  status?: string;
}

const MaterialBorrowsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [borrowDetail, setBorrowDetail] = useState<MaterialBorrowDetail | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [warehouseList, setWarehouseList] = useState<any[]>([]);
  const [materialList, setMaterialList] = useState<any[]>([]);
  const [formItems, setFormItems] = useState<Array<{ material_id: number; material_code: string; material_name: string; material_unit: string; borrow_quantity: number }>>([]);

  React.useEffect(() => {
    const load = async () => {
      try {
        const [wh, mat] = await Promise.all([
          masterDataWarehouseApi.list({ limit: 1000, isActive: true }),
          materialApi.list({ limit: 2000, isActive: true }),
        ]);
        setWarehouseList(Array.isArray(wh) ? wh : wh?.items || []);
        setMaterialList(Array.isArray(mat) ? mat : mat?.items || []);
      } catch (e) {
        console.error('加载仓库/物料失败', e);
      }
    };
    load();
  }, []);

  const columns: ProColumns<MaterialBorrow>[] = [
    { title: '借料单号', dataIndex: 'borrow_code', width: 140, ellipsis: true, fixed: 'left' },
    { title: '仓库', dataIndex: 'warehouse_name', width: 120, ellipsis: true },
    { title: '借料人', dataIndex: 'borrower_name', width: 100 },
    { title: '部门', dataIndex: 'department', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: any) => {
        const map: Record<string, { text: string; color: string }> = {
          '待借出': { text: '待借出', color: 'default' },
          '已借出': { text: '已借出', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const c = map[(status as any) || ''] || { text: (status as any) || '-', color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '预计归还日期', dataIndex: 'expected_return_date', valueType: 'date', width: 120 },
    { title: '借出时间', dataIndex: 'borrow_time', valueType: 'dateTime', width: 160 },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', width: 160 },
    {
      title: '操作',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>详情</Button>
          {record.status === '待借出' && (
            <>
              <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handleConfirm(record)} style={{ color: '#52c41a' }}>确认借出</Button>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>删除</Button>
            </>
          )}
          {(record.status === '待借出' || record.status === '已借出') && (
            <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(record)}>打印</Button>
          )}
        </Space>
      ),
    },
  ];

  const handleDetail = async (record: MaterialBorrow) => {
    try {
      const detail = await warehouseApi.materialBorrow.get(record.id!.toString());
      setBorrowDetail(detail as MaterialBorrowDetail);
      setDetailDrawerVisible(true);
    } catch {
      messageApi.error('获取借料单详情失败');
    }
  };

  const handleConfirm = async (record: MaterialBorrow) => {
    Modal.confirm({
      title: '确认借出',
      content: `确定要确认借料单 "${record.borrow_code}" 吗？确认后将扣减库存。`,
      onOk: async () => {
        try {
          await warehouseApi.materialBorrow.confirm(record.id!.toString());
          messageApi.success('借出确认成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '借出确认失败');
        }
      },
    });
  };

  const handleDelete = async (record: MaterialBorrow) => {
    Modal.confirm({
      title: '删除借料单',
      content: `确定要删除借料单 "${record.borrow_code}" 吗？`,
      onOk: async () => {
        try {
          await warehouseApi.materialBorrow.delete(record.id!.toString());
          messageApi.success('删除成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  const handlePrint = async (record: MaterialBorrow) => {
    try {
      const result = await warehouseApi.materialBorrow.print(record.id!.toString()) as { success?: boolean; content?: string; message?: string };
      if (result?.success && result?.content) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(result.content);
          printWindow.document.close();
          printWindow.onload = () => printWindow.print();
        }
      } else {
        messageApi.warning(result?.message || '打印功能暂未配置模板');
      }
    } catch {
      messageApi.error('打印失败');
    }
  };

  const handleCreate = () => {
    setFormItems([]);
    formRef.current?.resetFields();
    setCreateModalVisible(true);
  };

  const handleCreateSubmit = async (values: any) => {
    try {
      const validItems = formItems.filter((it) => it.material_id && it.borrow_quantity > 0);
      if (!validItems.length) {
        messageApi.error('请至少添加一条有效明细（选择物料并填写数量）');
        throw new Error('请至少添加一条有效明细');
      }
      const wh = warehouseList.find((w: any) => (w.id ?? w.warehouse_id) === values.warehouse_id);
      const warehouseName = wh?.name || wh?.warehouse_name || '';
      await warehouseApi.materialBorrow.create({
        warehouse_id: values.warehouse_id,
        warehouse_name: warehouseName,
        borrower_name: values.borrower_name,
        department: values.department,
        expected_return_date: values.expected_return_date ? dayjs(values.expected_return_date).format('YYYY-MM-DD') : undefined,
        notes: values.notes,
        items: validItems.map((it) => ({
          material_id: it.material_id,
          material_code: it.material_code,
          material_name: it.material_name,
          material_unit: it.material_unit,
          borrow_quantity: it.borrow_quantity,
          warehouse_id: values.warehouse_id,
          warehouse_name: warehouseName,
        })),
      });
      messageApi.success('创建成功');
      setCreateModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      if (error.message !== '请至少添加一条有效明细') messageApi.error(error.message || '创建失败');
      throw error;
    }
  };

  const addItem = () => {
    setFormItems((prev) => [...prev, { material_id: 0, material_code: '', material_name: '', material_unit: '', borrow_quantity: 1 }]);
  };

  const onMaterialSelect = (idx: number, materialId: number) => {
    const m = materialList.find((x: any) => (x.id || x.material_id) === materialId);
    if (!m) return;
    const updated = [...formItems];
    updated[idx] = {
      ...updated[idx],
      material_id: m.id || m.material_id,
      material_code: m.mainCode || m.code || m.material_code || '',
      material_name: m.name || m.material_name || '',
      material_unit: m.baseUnit || m.material_unit || m.unit || '',
    };
    setFormItems(updated);
  };

  const detailColumns: ProDescriptionsItemProps<MaterialBorrowDetail>[] = [
    { title: '借料单号', dataIndex: 'borrow_code' },
    { title: '仓库', dataIndex: 'warehouse_name' },
    { title: '借料人', dataIndex: 'borrower_name' },
    { title: '部门', dataIndex: 'department' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s) => {
        const map: Record<string, { text: string; color: string }> = {
          '待借出': { text: '待借出', color: 'default' },
          '已借出': { text: '已借出', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const c = map[(s as any) || ''] || { text: (s as any) || '-', color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '预计归还日期', dataIndex: 'expected_return_date', valueType: 'date' },
    { title: '借出时间', dataIndex: 'borrow_time', valueType: 'dateTime' },
    { title: '备注', dataIndex: 'notes', span: 2 },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable
          headerTitle="借料单"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          showCreateButton
          onCreate={handleCreate}
          request={async (params) => {
            try {
              const response = await warehouseApi.materialBorrow.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                status: params.status,
                warehouse_id: params.warehouse_id,
              });
              const data = Array.isArray(response) ? response : response?.items || response?.data || [];
              const total = Array.isArray(response) ? response.length : response?.total ?? data.length;
              return { data, success: true, total };
            } catch {
              messageApi.error('获取借料单列表失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={`借料单详情${borrowDetail?.borrow_code ? ` - ${borrowDetail.borrow_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => { setDetailDrawerVisible(false); setBorrowDetail(null); }}
        width={DRAWER_CONFIG.LARGE_WIDTH}
        columns={detailColumns}
        dataSource={borrowDetail || {}}
      >
        {borrowDetail?.items && borrowDetail.items.length > 0 && (
          <Table
            size="small"
            rowKey="id"
            columns={[
              { title: '物料编码', dataIndex: 'material_code', width: 120 },
              { title: '物料名称', dataIndex: 'material_name', width: 150 },
              { title: '单位', dataIndex: 'material_unit', width: 60 },
              { title: '借出数量', dataIndex: 'borrow_quantity', width: 100, align: 'right' },
              { title: '已归还数量', dataIndex: 'returned_quantity', width: 100, align: 'right' },
              { title: '状态', dataIndex: 'status', width: 80 },
            ]}
            dataSource={borrowDetail.items}
            pagination={false}
          />
        )}
      </DetailDrawerTemplate>

      <FormModalTemplate
        title="新建借料单"
        open={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        formRef={formRef}
        onFinish={handleCreateSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        <Form.Item name="warehouse_id" label="仓库" rules={[{ required: true }]}>
          <Select
            placeholder="请选择仓库"
            options={warehouseList.map((w: any) => ({ value: w.id ?? w.warehouse_id, label: w.name || w.warehouse_name || w.code }))}
          />
        </Form.Item>
        <Form.Item name="borrower_name" label="借料人">
          <Input placeholder="借料人姓名" />
        </Form.Item>
        <Form.Item name="department" label="部门">
          <Input placeholder="部门" />
        </Form.Item>
        <Form.Item name="expected_return_date" label="预计归还日期">
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="明细">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button type="dashed" onClick={addItem} icon={<PlusOutlined />}>添加明细</Button>
            {formItems.map((it, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Select
                  placeholder="物料"
                  style={{ width: 200 }}
                  options={materialList.map((m: any) => ({ value: m.id ?? m.material_id, label: `${m.mainCode || m.code || ''} ${m.name || ''}` }))}
                  onChange={(v) => onMaterialSelect(idx, v)}
                />
                <InputNumber placeholder="数量" min={0.01} value={it.borrow_quantity} onChange={(v) => {
                  const u = [...formItems]; u[idx] = { ...u[idx], borrow_quantity: v ?? 0 }; setFormItems(u);
                }} />
                <Button type="link" danger size="small" onClick={() => setFormItems(formItems.filter((_, i) => i !== idx))}>删除</Button>
              </div>
            ))}
          </Space>
        </Form.Item>
        <Form.Item name="notes" label="备注">
          <Input.TextArea rows={2} />
        </Form.Item>
      </FormModalTemplate>
    </>
  );
};

export default MaterialBorrowsPage;
