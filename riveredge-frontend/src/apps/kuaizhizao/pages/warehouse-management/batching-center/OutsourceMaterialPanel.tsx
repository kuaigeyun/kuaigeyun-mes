import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 物料中心 - 委外发料 / 委外收货列表与新建
 */
import React, { useRef, useState } from 'react';
import {
  ActionType,
  ProColumns,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
} from '@ant-design/pro-components';
import { App, Button, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { UniTable } from '../../../../../components/uni-table';
import { FormModalTemplate, MODAL_CONFIG } from '../../../../../components/layout-templates';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import {
  outsourceMaterialIssueApi,
  outsourceMaterialReceiptApi,
  outsourceWorkOrderApi,
} from '../../../services/production';
import OutsourceIssueFormContent, { type OutsourceIssueLine } from '../../../components/OutsourceIssueFormContent';
import OutsourceReceiptFormContent, {
  buildReceiptLineFromWorkOrder,
  type OutsourceReceiptLine,
} from '../../../components/OutsourceReceiptFormContent';
import type { OutsourceMaterialTabKey } from './materialCenterTabs';

function unwrapList<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object') {
    const r = response as Record<string, unknown>;
    if (Array.isArray(r.data)) return r.data as T[];
    if (Array.isArray(r.items)) return r.items as T[];
  }
  return [];
}

const STATUS_MAP: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'default' },
  completed: { text: '已完成', color: 'success' },
};

type OutsourceMaterialRow = {
  id?: number;
  code?: string;
  outsourceWorkOrderCode?: string;
  outsource_work_order_code?: string;
  materialCode?: string;
  material_code?: string;
  materialName?: string;
  material_name?: string;
  quantity?: number;
  unit?: string;
  warehouseName?: string;
  warehouse_name?: string;
  status?: string;
  createdAt?: string;
  created_at?: string;
};

interface OutsourceMaterialPanelProps {
  mode: OutsourceMaterialTabKey;
}

const OutsourceMaterialPanel: React.FC<OutsourceMaterialPanelProps> = ({ mode }) => {
  const isIssue = mode === 'outsource_issue';
  const { message: messageApi, modal: modalApi } = App.useApp();
  const actionRef = useRef<ActionType>();
  const formRef = useRef<any>();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedOwo, setSelectedOwo] = useState<any>(null);
  const [issueLines, setIssueLines] = useState<OutsourceIssueLine[]>([]);
  const [issuePreviewLoading, setIssuePreviewLoading] = useState(false);
  const [issuePreviewMessage, setIssuePreviewMessage] = useState<string | null>(null);
  const [receiptLine, setReceiptLine] = useState<OutsourceReceiptLine | null>(null);

  const api = isIssue ? outsourceMaterialIssueApi : outsourceMaterialReceiptApi;

  const handleComplete = (record: OutsourceMaterialRow) => {
    if (!record.id) return;
    modalApi.confirm({
      title: isIssue ? '确认完成委外发料？' : '确认完成委外收货？',
      content: '完成后将更新委外工单发料/收货数量。',
      onOk: async () => {
        await api.complete(String(record.id));
        messageApi.success('操作成功');
        actionRef.current?.reload();
      },
    });
  };

  const columns: ProColumns<OutsourceMaterialRow>[] = [
    {
      title: '单号',
      dataIndex: 'code',
      width: 160,
      fixed: 'left',
    },
    {
      title: '委外工单',
      dataIndex: ['outsourceWorkOrderCode', 'outsource_work_order_code'],
      width: 150,
      render: (_, r) => r.outsourceWorkOrderCode || r.outsource_work_order_code || '-',
    },
    ...(isIssue
      ? [
          {
            title: '物料',
            dataIndex: 'materialName',
            width: 140,
            render: (_: unknown, r: OutsourceMaterialRow) =>
              `${r.materialCode || r.material_code || ''} ${r.materialName || r.material_name || ''}`.trim() || '-',
          } as ProColumns<OutsourceMaterialRow>,
        ]
      : []),
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 90,
      align: 'right',
      render: (_, r) => (r.quantity != null ? `${Number(r.quantity).toFixed(2)} ${r.unit || ''}` : '-'),
    },
    {
      title: '仓库',
      dataIndex: ['warehouseName', 'warehouse_name'],
      width: 120,
      render: (_, r) => r.warehouseName || r.warehouse_name || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (_, r) => {
        const st = STATUS_MAP[r.status || ''] || { text: r.status || '-', color: 'default' };
        return <Tag color={st.color}>{st.text}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: ['createdAt', 'created_at'],
      width: 160,
      render: (_, r) => {
        const t = r.createdAt || r.created_at;
        return t ? dayjs(t).format('YYYY-MM-DD HH:mm') : '-';
      },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 100,
      fixed: 'right',
      render: (_, record) =>
        !isIssue && record.status === 'draft' && record.id ? (
          <Button type="link" size="small" onClick={() => handleComplete(record)}>
            完成
          </Button>
        ) : (
          '-'
        ),
    },
  ];

  const openCreate = () => {
    setSelectedOwo(null);
    setIssueLines([]);
    setIssuePreviewMessage(null);
    setReceiptLine(null);
    setCreateOpen(true);
    setTimeout(() => formRef.current?.resetFields(), 0);
  };

  const loadIssuePreview = async (owoId: number) => {
    setIssuePreviewLoading(true);
    setIssueLines([]);
    setIssuePreviewMessage(null);
    try {
      const preview = await outsourceMaterialIssueApi.issuePreview(owoId);
      const rawLines = preview?.lines ?? preview?.data?.lines ?? [];
      setIssuePreviewMessage(preview?.message ?? preview?.data?.message ?? null);
      setIssueLines(
        rawLines.map((l: any) => {
          const pending = Number(l.pendingQuantity ?? l.pending_quantity ?? 0);
          return {
            key: Number(l.materialId ?? l.material_id),
            materialId: Number(l.materialId ?? l.material_id),
            materialCode: l.materialCode ?? l.material_code ?? '',
            materialName: l.materialName ?? l.material_name ?? '',
            unit: l.unit ?? '',
            requiredQuantity: Number(l.requiredQuantity ?? l.required_quantity ?? 0),
            issuedQuantity: Number(l.issuedQuantity ?? l.issued_quantity ?? 0),
            pendingQuantity: pending,
            availableQuantity: Number(l.availableQuantity ?? l.available_quantity ?? 0),
            issueQuantity: pending > 0 ? pending : 0,
          };
        }),
      );
    } catch (err: any) {
      messageApi.error(err?.message || '加载待发物料明细失败');
    } finally {
      setIssuePreviewLoading(false);
    }
  };

  const onOwoChange = async (owoId: number) => {
    const detail = await outsourceWorkOrderApi.get(String(owoId));
    setSelectedOwo(detail);
    if (isIssue) {
      await loadIssuePreview(owoId);
    } else {
      setReceiptLine(buildReceiptLineFromWorkOrder(detail));
    }
  };

  const handleSubmit = async (values: any) => {
    if (!selectedOwo?.id) {
      messageApi.error('请选择委外工单');
      throw new Error('missing owo');
    }
    if (isIssue) {
      const activeLines = issueLines.filter((l) => l.issueQuantity > 0);
      if (activeLines.length === 0) {
        messageApi.error('请至少填写一行本次发料数量');
        throw new Error('no lines');
      }
      if (!values.warehouseId) {
        messageApi.error('请选择出库仓库');
        throw new Error('no warehouse');
      }
      await outsourceMaterialIssueApi.createBatch({
        outsource_work_order_id: selectedOwo.id,
        outsource_work_order_code: selectedOwo.code,
        warehouse_id: values.warehouseId,
        warehouse_name: values.warehouseName,
        remarks: values.remarks,
        lines: activeLines.map((l) => ({
          material_id: l.materialId,
          material_code: l.materialCode,
          material_name: l.materialName,
          quantity: l.issueQuantity,
          unit: l.unit,
        })),
      });
    } else {
      if (!receiptLine || receiptLine.receiptQuantity <= 0) {
        messageApi.error('请填写本次收货数量');
        throw new Error('no qty');
      }
      if (!values.warehouseId) {
        messageApi.error('请选择入库仓库');
        throw new Error('no warehouse');
      }
      await outsourceMaterialReceiptApi.create({
        outsource_work_order_id: selectedOwo.id,
        outsource_work_order_code: selectedOwo.code,
        quantity: receiptLine.receiptQuantity,
        qualified_quantity: receiptLine.qualifiedQuantity || 0,
        unqualified_quantity: receiptLine.unqualifiedQuantity || 0,
        unit: receiptLine.unit || '件',
        warehouse_id: values.warehouseId,
        warehouse_name: values.warehouseName,
        batch_number: values.batchNumber,
        remarks: values.remarks,
      });
    }
    messageApi.success(isIssue ? `委外发料成功，共 ${issueLines.filter((l) => l.issueQuantity > 0).length} 条明细` : '委外收货单创建成功');
    setCreateOpen(false);
    setSelectedOwo(null);
    setIssueLines([]);
    setIssuePreviewMessage(null);
    setReceiptLine(null);
    actionRef.current?.reload();
  };

  return (
    <>
      <UniTable<OutsourceMaterialRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        columnPersistenceId={`apps.kuaizhizao.pages.warehouse-management.material-center.${mode}`}
        headerTitle={isIssue ? '委外发料单' : '委外收货单'}
        toolBarRender={() => [
          <Button {...rowActionKind('create')} key="create" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            {isIssue ? '新建委外发料' : '新建委外收货'}
          </Button>,
        ]}
        request={async (params) => {
          const res = await api.list({
            skip: ((params.current || 1) - 1) * (params.pageSize || 20),
            limit: Math.min(params.pageSize || 20, 1000),
            keyword: params.keyword,
          });
          const data = unwrapList<OutsourceMaterialRow>(res);
          return { data, success: true, total: data.length };
        }}
      />

      <FormModalTemplate
        title={isIssue ? '新建委外发料' : '新建委外收货'}
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setSelectedOwo(null);
          setIssueLines([]);
          setIssuePreviewMessage(null);
          setReceiptLine(null);
        }}
        onFinish={handleSubmit}
        formRef={formRef}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid
      >
        <ProFormSelect
          name="outsourceWorkOrderId"
          label="委外工单"
          colProps={{ span: 24 }}
          rules={[{ required: true, message: '请选择委外工单' }]}
          request={async () => {
            const res = await outsourceWorkOrderApi.list({ skip: 0, limit: 1000 });
            const rows = unwrapList<any>(res);
            return rows
              .filter((r) => r.status === 'released' || r.status === 'in_progress')
              .map((r) => ({
                label: `${r.code} - ${r.productName || r.product_name || ''}`,
                value: r.id,
              }));
          }}
          fieldProps={{
            showSearch: true,
            onChange: (v: number) => {
              if (v) void onOwoChange(v);
            },
          }}
        />
        {selectedOwo && isIssue && (
          <div style={{ gridColumn: '1 / -1' }}>
            <OutsourceIssueFormContent
              workOrder={selectedOwo}
              lines={issueLines}
              onLinesChange={setIssueLines}
              loading={issuePreviewLoading}
              previewMessage={issuePreviewMessage}
            />
          </div>
        )}
        {selectedOwo && !isIssue && (
          <div style={{ gridColumn: '1 / -1' }}>
            <OutsourceReceiptFormContent
              workOrder={selectedOwo}
              line={receiptLine}
              onLineChange={setReceiptLine}
            />
          </div>
        )}
        <UniWarehouseSelect
          name="warehouseId"
          label={isIssue ? '出库仓库' : '入库仓库'}
          required
          colProps={{ span: 12 }}
          onChange={(_v, wh) => formRef.current?.setFieldsValue({ warehouseName: wh?.name ?? '' })}
        />
        <ProFormText name="warehouseName" hidden />
        {!isIssue && <ProFormText name="batchNumber" label="批次号" colProps={{ span: 12 }} />}
        <ProFormTextArea name="remarks" label="备注" colProps={{ span: 24 }} fieldProps={{ rows: 2 }} />
      </FormModalTemplate>
    </>
  );
};

export default OutsourceMaterialPanel;
