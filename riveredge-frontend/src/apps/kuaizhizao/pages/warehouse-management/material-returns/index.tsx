/**
 * 还料单管理页面
 *
 * 提供还料单的创建、查看、确认和管理功能（必须关联借料单）
 *
 * @author RiverEdge Team
 * @date 2026-02-19
 */

import React, { useRef, useState } from 'react';
import { ActionType, ProColumns, ProDescriptionsItemProps } from '@ant-design/pro-components';
import { App, Button, Tag, Space, Modal, Table, Form, Select, InputNumber, Input } from 'antd';
import { PlusOutlined, EyeOutlined, CheckCircleOutlined, DeleteOutlined, PrinterOutlined } from '@ant-design/icons';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, DetailDrawerTemplate, FormModalTemplate, DRAWER_CONFIG, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { warehouseApi } from '../../../services/production';
import { warehouseApi as masterDataWarehouseApi } from '../../../../master-data/services/warehouse';

interface MaterialReturn {
  id?: number;
  tenant_id?: number;
  return_code?: string;
  borrow_id?: number;
  borrow_code?: string;
  warehouse_id?: number;
  warehouse_name?: string;
  returner_id?: number;
  returner_name?: string;
  return_time?: string;
  status?: string;
  total_quantity?: number;
  notes?: string;
  created_at?: string;
}

interface MaterialReturnDetail extends MaterialReturn {
  items?: MaterialReturnItem[];
}

interface MaterialReturnItem {
  id?: number;
  material_id?: number;
  material_code?: string;
  material_name?: string;
  material_unit?: string;
  return_quantity?: number;
  status?: string;
}

interface BorrowItemForReturn {
  id: number;
  material_id: number;
  material_code: string;
  material_name: string;
  material_unit: string;
  borrow_quantity: number;
  returned_quantity: number;
  warehouse_id: number;
  warehouse_name: string;
}

const MaterialReturnsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [returnDetail, setReturnDetail] = useState<MaterialReturnDetail | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [warehouseList, setWarehouseList] = useState<any[]>([]);
  const [borrowList, setBorrowList] = useState<any[]>([]);
  const [selectedBorrowDetail, setSelectedBorrowDetail] = useState<{ borrow_id: number; borrow_code: string; warehouse_id: number; warehouse_name: string; items: BorrowItemForReturn[] } | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({});

  React.useEffect(() => {
    const load = async () => {
      try {
        const wh = await masterDataWarehouseApi.list({ limit: 1000, isActive: true });
        setWarehouseList(Array.isArray(wh) ? wh : wh?.items || []);
      } catch (e) {
        console.error('加载仓库失败', e);
      }
    };
    load();
  }, []);

  React.useEffect(() => {
    if (createModalVisible) {
      warehouseApi.materialBorrow.list({ status: '已借出', limit: 500 }).then((res: any) => {
        const data = Array.isArray(res) ? res : res?.items || res?.data || [];
        setBorrowList(data);
      }).catch(() => setBorrowList([]));
    }
  }, [createModalVisible]);

  const onBorrowSelect = async (borrowId: number) => {
    if (!borrowId) {
      setSelectedBorrowDetail(null);
      setReturnQuantities({});
      return;
    }
    try {
      const detail = await warehouseApi.materialBorrow.get(borrowId.toString());
      const items = (detail as any).items || [];
      const borrowItems: BorrowItemForReturn[] = items.map((it: any) => ({
        id: it.id,
        material_id: it.material_id,
        material_code: it.material_code,
        material_name: it.material_name,
        material_unit: it.material_unit,
        borrow_quantity: it.borrow_quantity ?? 0,
        returned_quantity: it.returned_quantity ?? 0,
        warehouse_id: it.warehouse_id ?? (detail as any).warehouse_id,
        warehouse_name: it.warehouse_name ?? (detail as any).warehouse_name,
      }));
      setSelectedBorrowDetail({
        borrow_id: (detail as any).id,
        borrow_code: (detail as any).borrow_code,
        warehouse_id: (detail as any).warehouse_id,
        warehouse_name: (detail as any).warehouse_name,
        items: borrowItems,
      });
      const qtyMap: Record<number, number> = {};
      borrowItems.forEach((it) => {
        const maxRet = Math.max(0, it.borrow_quantity - it.returned_quantity);
        qtyMap[it.id] = maxRet > 0 ? maxRet : 0;
      });
      setReturnQuantities(qtyMap);
    } catch {
      messageApi.error('获取借料单详情失败');
      setSelectedBorrowDetail(null);
    }
  };

  const columns: ProColumns<MaterialReturn>[] = [
    { title: '还料单号', dataIndex: 'return_code', width: 140, ellipsis: true, fixed: 'left' },
    { title: '借料单号', dataIndex: 'borrow_code', width: 140, ellipsis: true },
    { title: '仓库', dataIndex: 'warehouse_name', width: 120, ellipsis: true },
    { title: '归还人', dataIndex: 'returner_name', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: any) => {
        const map: Record<string, { text: string; color: string }> = {
          '待归还': { text: '待归还', color: 'default' },
          '已归还': { text: '已归还', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const c = map[(status as any) || ''] || { text: (status as any) || '-', color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '归还时间', dataIndex: 'return_time', valueType: 'dateTime', width: 160 },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', width: 160 },
    {
      title: '操作',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleDetail(record)}>详情</Button>
          {record.status === '待归还' && (
            <>
              <Button type="link" size="small" icon={<CheckCircleOutlined />} onClick={() => handleConfirm(record)} style={{ color: '#52c41a' }}>确认归还</Button>
              <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)}>删除</Button>
            </>
          )}
          {(record.status === '待归还' || record.status === '已归还') && (
            <Button type="link" size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(record)}>打印</Button>
          )}
        </Space>
      ),
    },
  ];

  const handleDetail = async (record: MaterialReturn) => {
    try {
      const detail = await warehouseApi.materialReturn.get(record.id!.toString());
      setReturnDetail(detail as MaterialReturnDetail);
      setDetailDrawerVisible(true);
    } catch {
      messageApi.error('获取还料单详情失败');
    }
  };

  const handleConfirm = async (record: MaterialReturn) => {
    Modal.confirm({
      title: '确认归还',
      content: `确定要确认还料单 "${record.return_code}" 吗？确认后将增加库存。`,
      onOk: async () => {
        try {
          await warehouseApi.materialReturn.confirm(record.id!.toString());
          messageApi.success('归还确认成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '归还确认失败');
        }
      },
    });
  };

  const handleDelete = async (record: MaterialReturn) => {
    Modal.confirm({
      title: '删除还料单',
      content: `确定要删除还料单 "${record.return_code}" 吗？`,
      onOk: async () => {
        try {
          await warehouseApi.materialReturn.delete(record.id!.toString());
          messageApi.success('删除成功');
          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  const handlePrint = async (record: MaterialReturn) => {
    try {
      const result = await warehouseApi.materialReturn.print(record.id!.toString()) as { success?: boolean; content?: string; message?: string };
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
    setSelectedBorrowDetail(null);
    setReturnQuantities({});
    formRef.current?.resetFields();
    setCreateModalVisible(true);
  };

  const handleCreateSubmit = async (values: any) => {
    if (!selectedBorrowDetail) {
      messageApi.error('请选择借料单');
      throw new Error('请选择借料单');
    }
    const validItems = selectedBorrowDetail.items
      .filter((it) => (returnQuantities[it.id] ?? 0) > 0)
      .map((it) => ({
        borrow_item_id: it.id,
        material_id: it.material_id,
        material_code: it.material_code,
        material_name: it.material_name,
        material_unit: it.material_unit,
        return_quantity: returnQuantities[it.id],
        warehouse_id: selectedBorrowDetail.warehouse_id,
        warehouse_name: selectedBorrowDetail.warehouse_name,
      }));
    if (!validItems.length) {
      messageApi.error('请至少填写一条有效归还数量');
      throw new Error('请至少填写一条有效归还数量');
    }
    try {
      await warehouseApi.materialReturn.create({
        borrow_id: selectedBorrowDetail.borrow_id,
        borrow_code: selectedBorrowDetail.borrow_code,
        warehouse_id: selectedBorrowDetail.warehouse_id,
        warehouse_name: selectedBorrowDetail.warehouse_name,
        returner_name: values.returner_name,
        notes: values.notes,
        items: validItems,
      });
      messageApi.success('创建成功');
      setCreateModalVisible(false);
      actionRef.current?.reload();
    } catch (error: any) {
      messageApi.error(error.message || '创建失败');
      throw error;
    }
  };

  const detailColumns: ProDescriptionsItemProps<MaterialReturnDetail>[] = [
    { title: '还料单号', dataIndex: 'return_code' },
    { title: '借料单号', dataIndex: 'borrow_code' },
    { title: '仓库', dataIndex: 'warehouse_name' },
    { title: '归还人', dataIndex: 'returner_name' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (s) => {
        const map: Record<string, { text: string; color: string }> = {
          '待归还': { text: '待归还', color: 'default' },
          '已归还': { text: '已归还', color: 'success' },
          '已取消': { text: '已取消', color: 'error' },
        };
        const c = map[(s as any) || ''] || { text: (s as any) || '-', color: 'default' };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: '归还时间', dataIndex: 'return_time', valueType: 'dateTime' },
    { title: '备注', dataIndex: 'notes', span: 2 },
  ];

  return (
    <>
      <ListPageTemplate>
        <UniTable
          headerTitle="还料单"
          actionRef={actionRef}
          rowKey="id"
          columns={columns}
          showAdvancedSearch
          showCreateButton
          createButtonText="新建还料单"
          onCreate={handleCreate}
          request={async (params) => {
            try {
              const response = await warehouseApi.materialReturn.list({
                skip: ((params.current || 1) - 1) * (params.pageSize || 20),
                limit: params.pageSize || 20,
                status: params.status,
                borrow_id: params.borrow_id,
                warehouse_id: params.warehouse_id,
              });
              const data = Array.isArray(response) ? response : response?.items || response?.data || [];
              const total = Array.isArray(response) ? response.length : response?.total ?? data.length;
              return { data, success: true, total };
            } catch {
              messageApi.error('获取还料单列表失败');
              return { data: [], success: false, total: 0 };
            }
          }}
          enableRowSelection={true}
          showDeleteButton={true}
          onDelete={async (keys) => {
            Modal.confirm({
              title: '确认批量删除',
              content: `确定要删除选中的 ${keys.length} 条还料单吗？`,
              onOk: async () => {
                try {
                  for (const id of keys) {
                    await warehouseApi.materialReturn.delete(String(id));
                  }
                  messageApi.success(`成功删除 ${keys.length} 条记录`);
                  actionRef.current?.reload();
                } catch (error: any) {
                  messageApi.error(error.message || '删除失败');
                }
              },
            });
          }}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={`还料单详情${returnDetail?.return_code ? ` - ${returnDetail.return_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => { setDetailDrawerVisible(false); setReturnDetail(null); }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        columns={detailColumns}
        dataSource={returnDetail || {}}
      >
        {returnDetail?.items && returnDetail.items.length > 0 && (
          <Table
            size="small"
            rowKey="id"
            columns={[
              { title: '物料编码', dataIndex: 'material_code', width: 120 },
              { title: '物料名称', dataIndex: 'material_name', width: 150 },
              { title: '单位', dataIndex: 'material_unit', width: 60 },
              { title: '归还数量', dataIndex: 'return_quantity', width: 100, align: 'right' },
              { title: '状态', dataIndex: 'status', width: 80 },
            ]}
            dataSource={returnDetail.items}
            pagination={false}
          />
        )}
      </DetailDrawerTemplate>

      <FormModalTemplate
        title="新建还料单"
        open={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        formRef={formRef}
        onFinish={handleCreateSubmit}
        width={MODAL_CONFIG.LARGE_WIDTH}
      >
        <Form.Item name="borrow_id" label="借料单" rules={[{ required: true }]}>
          <Select
            placeholder="请选择借料单（仅显示已借出状态）"
            options={borrowList.map((b: any) => ({ value: b.id, label: `${b.borrow_code} - ${b.warehouse_name || ''}` }))}
            onChange={onBorrowSelect}
          />
        </Form.Item>
        {selectedBorrowDetail && (
          <>
            <Form.Item label="归还明细">
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                columns={[
                  { title: '物料编码', dataIndex: 'material_code', width: 120 },
                  { title: '物料名称', dataIndex: 'material_name', width: 150 },
                  { title: '单位', dataIndex: 'material_unit', width: 60 },
                  { title: '借出数量', dataIndex: 'borrow_quantity', width: 90, align: 'right' },
                  { title: '已归还', dataIndex: 'returned_quantity', width: 90, align: 'right' },
                  {
                    title: '本次归还数量',
                    width: 120,
                    render: (_, record: BorrowItemForReturn) => {
                      const maxRet = Math.max(0, record.borrow_quantity - record.returned_quantity);
                      return (
                        <InputNumber
                          min={0}
                          max={maxRet}
                          value={returnQuantities[record.id] ?? 0}
                          onChange={(v) => setReturnQuantities((prev) => ({ ...prev, [record.id]: v ?? 0 }))}
                          style={{ width: '100%' }}
                        />
                      );
                    },
                  },
                ]}
                dataSource={selectedBorrowDetail.items}
              />
            </Form.Item>
          </>
        )}
        <Form.Item name="returner_name" label="归还人">
          <Input placeholder="归还人姓名" />
        </Form.Item>
        <Form.Item name="notes" label="备注">
          <Input.TextArea rows={2} />
        </Form.Item>
      </FormModalTemplate>
    </>
  );
};

export default MaterialReturnsPage;
