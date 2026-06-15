/**
 * 还料单管理页面
 *
 * 提供还料单的创建、查看、确认和管理功能（必须关联借料单）
 *
 * @author RiverEdge Team
 * @date 2026-02-19
 */

import React, { useRef, useState, useEffect } from 'react';
import { useInvalidateMenuBadgeCounts } from '../../../../../hooks/useInvalidateMenuBadgeCounts';
import { ActionType, ProColumns, ProDescriptionsItemProps, ProFormItem, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Col, Descriptions, Dropdown, Form, Input, InputNumber, Modal, Row, Space, Table, Typography } from 'antd';
import { EyeOutlined, CheckCircleOutlined, DeleteOutlined, PrinterOutlined, MoreOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { UniDropdown } from '../../../../../components/uni-dropdown';
import { UniTableDetailHeader } from '../../../../../components/uni-table-detail/UniTableDetail';
import CodeField from '../../../../../components/code-field';
import { detailDrawerDescriptionItems, DetailDrawerTemplate, DRAWER_CONFIG, FormModalTemplate, ListPageTemplate, MODAL_CONFIG, WAREHOUSE_DETAIL_TABLE_STYLES } from '../../../../../components/layout-templates';
import { warehouseApi } from '../../../services/production';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { getMaterialReturnLifecycle } from '../../../utils/materialReturnLifecycle';
import type { DocumentPrintApiResult } from '../../../../../utils/printResponseHelpers';
import { openPrintHtmlWindow, escapeHtml } from '../../../../../utils/printResponseHelpers';
import DocumentAttachmentsField from '../../../components/DocumentAttachmentsField';
import { normalizeDocumentAttachments } from '../../../utils/documentAttachments';
import { rowActionKind, rowActionLabelKeep } from '../../../../../components/uni-action';

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
  updated_at?: string;
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

function buildMaterialReturnPrintHtml(d: MaterialReturnDetail): string {
  const esc = escapeHtml;
  const rows = (d.items || [])
    .map(
      (it) =>
        `<tr><td>${esc(it.material_code)}</td><td>${esc(it.material_name)}</td><td>${esc(it.material_unit)}</td><td style="text-align:right">${esc(it.return_quantity)}</td></tr>`,
    )
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>还料单 ${esc(d.return_code)}</title><style>body{font-family:system-ui,sans-serif;padding:24px;}table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #ccc;padding:8px;font-size:13px}th{background:#f0f0f0;text-align:left}</style></head><body>
<h2>还料单</h2>
<p><strong>单号</strong> ${esc(d.return_code)} &nbsp; <strong>关联借料单</strong> ${esc(d.borrow_code)} &nbsp; <strong>仓库</strong> ${esc(d.warehouse_name)}</p>
<p><strong>归还人</strong> ${esc(d.returner_name)} &nbsp; <strong>归还时间</strong> ${esc(d.return_time)}</p>
<p><strong>备注</strong> ${esc(d.notes)}</p>
<table><thead><tr><th>物料编码</th><th>物料名称</th><th>单位</th><th>归还数量</th></tr></thead><tbody>${rows || '<tr><td colspan="4">无明细</td></tr>'}</tbody></table>
<p style="margin-top:16px;color:#666;font-size:12px">未配置打印模板时的系统兜底</p>
</body></html>`;
}

const MaterialReturnsPage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  const invalidateMenuBadgeCounts = useInvalidateMenuBadgeCounts();
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [returnDetail, setReturnDetail] = useState<MaterialReturnDetail | null>(null);

  const [createModalVisible, setCreateModalVisible] = useState(false);
  const formRef = useRef<any>(null);
  const [borrowList, setBorrowList] = useState<any[]>([]);
  const [borrowLoading, setBorrowLoading] = useState(false);
  const [selectedBorrowDetail, setSelectedBorrowDetail] = useState<{ borrow_id: number; borrow_code: string; warehouse_id: number; warehouse_name: string; items: BorrowItemForReturn[] } | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<number, number>>({});

  useEffect(() => {
    const load = async () => {
      if (!createModalVisible) return;
      setBorrowLoading(true);
      try {
        const res = await warehouseApi.materialBorrow.list({ status: '已借出', limit: 500 });
        const data = Array.isArray(res) ? res : (res as any)?.items || (res as any)?.data || [];
        setBorrowList(data);
      } catch {
        setBorrowList([]);
      } finally {
        setBorrowLoading(false);
      }
    };
    load();
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
    {
      title: '还料单号',
      dataIndex: 'return_code',
      width: 140,
      ellipsis: true,
      fixed: 'left',
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.return_code ?? '') }} ellipsis>
          {r.return_code ?? '-'}
        </Typography.Text>
      ),
    },
    {
      title: '借料单号',
      dataIndex: 'borrow_code',
      width: 140,
      ellipsis: true,
      render: (_, r) => (
        <Typography.Text copyable={{ text: String(r.borrow_code ?? '') }} ellipsis>
          {r.borrow_code ?? '-'}
        </Typography.Text>
      ),
    },
    { title: '仓库', dataIndex: 'warehouse_name', width: 120, ellipsis: true },
    { title: '归还人', dataIndex: 'returner_name', width: 100 },
    { title: '归还时间', dataIndex: 'return_time', valueType: 'dateTime', width: 160 },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', width: 160 },
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
      fixed: 'right',
      align: 'left',
      hideInSearch: true,
      render: (_, record) => {
        const lifecycle = getMaterialReturnLifecycle(record as Record<string, unknown>);
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
      width: 220,
      fixed: 'right',
      render: (_, record) => {
        const showPrint = record.status === '待归还' || record.status === '已归还';
        const printInMore = record.status === '待归还';
        return (
          <Space size="small" wrap>
            <Button {...rowActionKind('read')} onClick={() => handleDetail(record)} />
            {record.status === '待归还' && (
              <>
                <Button
                  {...rowActionKind('execute')}
                  {...rowActionLabelKeep()}
                  onClick={() => handleConfirm(record)}
                >
                  确认入库
                </Button>
                <Button {...rowActionKind('delete')} onClick={() => handleDelete(record)} />
              </>
            )}
            {printInMore ? (
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'print',
                      icon: <PrinterOutlined />,
                      label: '打印',
                      onClick: () => handlePrint(record),
                    },
                  ],
                }}
                trigger={['click']}
              >
                <Button {...rowActionKind('display')} {...rowActionLabelKeep()} icon={<MoreOutlined />}>
                  更多
                </Button>
              </Dropdown>
            ) : (
              showPrint && <Button {...rowActionKind('print')} onClick={() => handlePrint(record)} />
            )}
          </Space>
        );
      },
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
      title: '确认入库',
      content: `确定要确认还料单 "${record.return_code}" 吗？确认后将增加库存。`,
      onOk: async () => {
        try {
          await warehouseApi.materialReturn.confirm(record.id!.toString());
          messageApi.success('确认入库成功');
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '确认入库失败');
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
          invalidateMenuBadgeCounts();

          actionRef.current?.reload();
        } catch (error: any) {
          messageApi.error(error.message || '删除失败');
        }
      },
    });
  };

  const handlePrint = async (record: MaterialReturn) => {
    try {
      const result = (await warehouseApi.materialReturn.print(record.id!.toString())) as DocumentPrintApiResult;
      if (result?.success && result?.content) {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(result.content);
          printWindow.document.close();
          printWindow.onload = () => printWindow.print();
        }
      } else {
        const detail = (await warehouseApi.materialReturn.get(record.id!.toString())) as MaterialReturnDetail;
        const w = openPrintHtmlWindow(buildMaterialReturnPrintHtml(detail), `还料单 ${detail.return_code || ''}`);
        if (!w) {
          messageApi.warning(result?.message || '无法打开打印窗口，请检查浏览器拦截设置');
        }
      }
    } catch {
      messageApi.error('打印失败');
    }
  };

  /** 参考销售订单：先打开弹窗，再让 CodeField 自动生成编号 */
  const handleCreate = () => {
    setCreateModalVisible(true);
    setSelectedBorrowDetail(null);
    setReturnQuantities({});
    // FormModalTemplate 设置了 destroyOnHidden，ProForm 每次打开都是全新挂载，无需 setTimeout + resetFields
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
        return_code: values.return_code,
        borrow_id: selectedBorrowDetail.borrow_id,
        borrow_code: selectedBorrowDetail.borrow_code,
        warehouse_id: selectedBorrowDetail.warehouse_id,
        warehouse_name: selectedBorrowDetail.warehouse_name,
        returner_name: values.returner_name,
        notes: values.notes,
        attachments: normalizeDocumentAttachments(values.attachments),
        items: validItems,
      });
      messageApi.success('创建成功');
      setCreateModalVisible(false);
      invalidateMenuBadgeCounts();

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
      render: (_, record) => {
        const lifecycle = getMaterialReturnLifecycle(record as unknown as Record<string, unknown>);
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
          columnPersistenceId="apps.kuaizhizao.pages.warehouse-management.material-returns"
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
            try {
              for (const id of keys) {
                await warehouseApi.materialReturn.delete(String(id));
              }
              messageApi.success(`成功删除 ${keys.length} 条记录`);
              invalidateMenuBadgeCounts();
              actionRef.current?.reload();
            } catch (error: any) {
              messageApi.error(error.message || '删除失败');
            }
          }}
          deleteConfirmTitle={(count) => `确定要删除选中的 ${count} 条还料单吗？`}
          scroll={{ x: 1200 }}
        />
      </ListPageTemplate>

      <DetailDrawerTemplate
        title={`还料单详情${returnDetail?.return_code ? ` - ${returnDetail.return_code}` : ''}`}
        open={detailDrawerVisible}
        onClose={() => { setDetailDrawerVisible(false); setReturnDetail(null); }}
        width={DRAWER_CONFIG.HALF_WIDTH}
        basic={
          returnDetail ? (
            <Descriptions column={2} items={detailDrawerDescriptionItems(detailColumns, returnDetail)} />
          ) : undefined
        }
        lines={
          returnDetail?.items && returnDetail.items.length > 0 ? (
            <>
              <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
              <Table
                className="warehouse-detail-table"
                size="small"
                rowKey="id"
                columns={[
                  { title: '物料编号', dataIndex: 'material_code', width: 120 },
                  { title: '物料名称', dataIndex: 'material_name', width: 150 },
                  { title: '单位', dataIndex: 'material_unit', width: 60 },
                  { title: '归还数量', dataIndex: 'return_quantity', width: 100, align: 'right' },
                  { title: '状态', dataIndex: 'status', width: 80 },
                ]}
                dataSource={returnDetail.items}
                pagination={false}
              />
            </>
          ) : undefined
        }
      />

      <FormModalTemplate
        title="新建还料单"
        open={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        formRef={formRef}
        onFinish={handleCreateSubmit}
        submitText="保存草稿"
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid={false}
      >
        <Row gutter={16}>
          <Col span={12}>
            <CodeField
              pageCode="kuaizhizao-warehouse-material-return"
              name="return_code"
              label="还料单编号"
              autoGenerateOnCreate={true}
              showGenerateButton={false}
              context={{}}
            />
          </Col>
          <Col span={12}>
            <ProFormItem name="borrow_id" label="借料单" rules={[{ required: true, message: '请选择借料单' }]}>
              <UniDropdown
                placeholder="请选择借料单（仅显示已借出状态）"
                showSearch
                allowClear
                loading={borrowLoading}
                style={{ width: '100%' }}
                options={borrowList.map((b: any) => ({
                  value: b.id,
                  label: `${b.borrow_code ?? b.borrowCode ?? ''} - ${b.warehouse_name ?? b.warehouseName ?? ''}`.trim() || String(b.id),
                }))}
                onChange={(v) => onBorrowSelect(v as number)}
              />
            </ProFormItem>
          </Col>
        </Row>
        {selectedBorrowDetail && (
          <>
            <div className="uni-table-detail" style={{ width: '100%' }}>
              <UniTableDetailHeader title="归还明细" />
              <div style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                <style>{WAREHOUSE_DETAIL_TABLE_STYLES}</style>
                <Table
                  className="warehouse-detail-table"
                  size="small"
                  rowKey="id"
                  pagination={false}
                columns={[
                  { title: '物料编号', dataIndex: 'material_code', width: 120 },
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
              </div>
            </div>
          </>
        )}
        <Row gutter={16}>
          <Col span={12}>
            <ProFormItem name="returner_name" label="归还人">
              <Input placeholder="归还人姓名" />
            </ProFormItem>
          </Col>
          <Col span={12} />
        </Row>
        <DocumentAttachmentsField category="material_return_attachments" />
        <ProFormTextArea name="notes" label="备注" placeholder="可选" fieldProps={{ rows: 2 }} />
      </FormModalTemplate>
    </>
  );
};

export default MaterialReturnsPage;
