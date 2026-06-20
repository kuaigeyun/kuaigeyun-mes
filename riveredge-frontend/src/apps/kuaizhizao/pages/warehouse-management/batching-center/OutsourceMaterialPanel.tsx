import { rowActionKind } from '../../../../../components/uni-action';
/**
 * 物料中心 - 委外发料 / 收货 / 退料 / 退货列表与新建
 */
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionType,
  ProColumns,
  ProFormSelect,
  ProFormText,
  ProFormTextArea,
  ProFormItem,
  ProFormDigit,
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
  outsourceMaterialReturnApi,
  outsourceProductReturnApi,
  outsourceWorkOrderApi,
} from '../../../services/production';
import OutsourceIssueFormContent, { type OutsourceIssueLine } from '../../../components/OutsourceIssueFormContent';
import OutsourceReceiptFormContent, {
  buildReceiptLineFromWorkOrder,
  type OutsourceReceiptLine,
} from '../../../components/OutsourceReceiptFormContent';
import type { OutsourceMaterialTabKey } from './materialCenterTabs';
import { formatDateTime } from '../../../../../utils/format';

function unwrapList<T>(response: unknown): T[] {
  if (Array.isArray(response)) return response;
  if (response && typeof response === 'object') {
    const r = response as Record<string, unknown>;
    if (Array.isArray(r.data)) return r.data as T[];
    if (Array.isArray(r.items)) return r.items as T[];
  }
  return [];
}

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
  returnReason?: string;
  return_reason?: string;
  status?: string;
  createdAt?: string;
  created_at?: string;
};

interface OutsourceMaterialPanelProps {
  mode: OutsourceMaterialTabKey;
}

const OutsourceMaterialPanel: React.FC<OutsourceMaterialPanelProps> = ({ mode }) => {
  const { t } = useTranslation();
  const isIssue = mode === 'outsource_issue';
  const isReceipt = mode === 'outsource_receipt';
  const isMaterialReturn = mode === 'outsource_material_return';
  const isProductReturn = mode === 'outsource_product_return';
  const { message: messageApi, modal: modalApi } = App.useApp();
  const actionRef = useRef<ActionType>();
  const formRef = useRef<any>();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedOwo, setSelectedOwo] = useState<any>(null);
  const [issueLines, setIssueLines] = useState<OutsourceIssueLine[]>([]);
  const [issuePreviewLoading, setIssuePreviewLoading] = useState(false);
  const [issuePreviewMessage, setIssuePreviewMessage] = useState<string | null>(null);
  const [receiptLine, setReceiptLine] = useState<OutsourceReceiptLine | null>(null);
  const [materialReturnLines, setMaterialReturnLines] = useState<any[]>([]);
  const [productReturnLines, setProductReturnLines] = useState<any[]>([]);

  const api = isIssue
    ? outsourceMaterialIssueApi
    : isReceipt
      ? outsourceMaterialReceiptApi
      : isMaterialReturn
        ? outsourceMaterialReturnApi
        : outsourceProductReturnApi;

  const panelTitle = isIssue
    ? t('app.kuaizhizao.batchingCenter.outsourceIssueDoc')
    : isReceipt
      ? t('app.kuaizhizao.batchingCenter.outsourceReceiptDoc')
      : isMaterialReturn
        ? t('app.kuaizhizao.batchingCenter.outsourceMaterialReturnDoc')
        : t('app.kuaizhizao.batchingCenter.outsourceProductReturnDoc');

  const createLabel = isIssue
    ? t('app.kuaizhizao.batchingCenter.createOutsourceIssue')
    : isReceipt
      ? t('app.kuaizhizao.batchingCenter.createOutsourceReceipt')
      : isMaterialReturn
        ? t('app.kuaizhizao.batchingCenter.createOutsourceMaterialReturn')
        : t('app.kuaizhizao.batchingCenter.createOutsourceProductReturn');

  const handleComplete = (record: OutsourceMaterialRow) => {
    if (!record.id || isMaterialReturn || isProductReturn) return;
    modalApi.confirm({
      title: isIssue ? t('app.kuaizhizao.batchingCenter.confirmCompleteIssue') : t('app.kuaizhizao.batchingCenter.confirmCompleteReceipt'),
      content: t('app.kuaizhizao.batchingCenter.completeIssueReceiptHint'),
      onOk: async () => {
        if (isIssue) {
          await outsourceMaterialIssueApi.complete(String(record.id));
        } else {
          await outsourceMaterialReceiptApi.complete(String(record.id));
        }
        messageApi.success(t('app.kuaizhizao.warehouseCommon.operationSuccess'));
        actionRef.current?.reload();
      },
    });
  };

  const columns: ProColumns<OutsourceMaterialRow>[] = useMemo(
    () => [
    {
      title: t('app.kuaizhizao.warehouseCommon.colCode'),
      dataIndex: 'code',
      width: 160,
      fixed: 'left',
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colOutsourceWorkOrder'),
      dataIndex: ['outsourceWorkOrderCode', 'outsource_work_order_code'],
      width: 150,
      render: (_, r) => r.outsourceWorkOrderCode || r.outsource_work_order_code || '-',
    },
    ...(isIssue || isMaterialReturn
      ? [
          {
            title: t('app.kuaizhizao.warehouseCommon.colMaterial'),
            dataIndex: 'materialName',
            width: 140,
            render: (_: unknown, r: OutsourceMaterialRow) =>
              `${r.materialCode || r.material_code || ''} ${r.materialName || r.material_name || ''}`.trim() || '-',
          } as ProColumns<OutsourceMaterialRow>,
        ]
      : []),
    ...(isProductReturn
      ? [
          {
            title: t('app.kuaizhizao.warehouseCommon.colReturnReason'),
            dataIndex: ['returnReason', 'return_reason'],
            width: 160,
            ellipsis: true,
            render: (_, r) => r.returnReason || r.return_reason || '-',
          } as ProColumns<OutsourceMaterialRow>,
        ]
      : []),
    {
      title: t('app.kuaizhizao.warehouseCommon.colQuantity'),
      dataIndex: 'quantity',
      width: 90,
      align: 'right',
      render: (_, r) => (r.quantity != null ? `${Number(r.quantity).toFixed(2)} ${r.unit || ''}` : '-'),
    },
    ...(!isProductReturn
      ? [
          {
            title: t('app.kuaizhizao.warehouseCommon.colWarehouse'),
            dataIndex: ['warehouseName', 'warehouse_name'],
            width: 120,
            render: (_: unknown, r: OutsourceMaterialRow) => r.warehouseName || r.warehouse_name || '-',
          } as ProColumns<OutsourceMaterialRow>,
        ]
      : []),
    {
      title: t('app.kuaizhizao.warehouseCommon.colStatus'),
      dataIndex: 'status',
      width: 90,
      render: (_, r) => {
        const statusKey =
          r.status === 'draft'
            ? t('app.kuaizhizao.warehouseCommon.statusDraft')
            : r.status === 'completed'
              ? t('app.kuaizhizao.warehouseCommon.statusCompleted')
              : r.status || '-';
        const color = r.status === 'completed' ? 'success' : 'default';
        return <Tag color={color}>{statusKey}</Tag>;
      },
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colCreatedAt'),
      dataIndex: ['createdAt', 'created_at'],
      width: 160,
      render: (_, r) => {
        const createdAt = r.createdAt || r.created_at;
        return createdAt ? formatDateTime(createdAt, 'YYYY-MM-DD HH:mm') : '-';
      },
    },
    {
      title: t('app.kuaizhizao.warehouseCommon.colActions'),
      valueType: 'option',
      width: 100,
      fixed: 'right',
      render: (_, record) =>
        isReceipt && record.status === 'draft' && record.id ? (
          <Button type="link" size="small" onClick={() => handleComplete(record)}>
            {t('app.kuaizhizao.warehouseCommon.complete')}
          </Button>
        ) : (
          '-'
        ),
    },
  ],
    [isIssue, isMaterialReturn, isProductReturn, isReceipt, t],
  );

  const resetCreateState = () => {
    setSelectedOwo(null);
    setIssueLines([]);
    setIssuePreviewMessage(null);
    setReceiptLine(null);
    setMaterialReturnLines([]);
    setProductReturnLines([]);
  };

  const openCreate = () => {
    resetCreateState();
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
      messageApi.error(err?.message || t('app.kuaizhizao.batchingCenter.loadIssuePreviewFailed'));
    } finally {
      setIssuePreviewLoading(false);
    }
  };

  const onOwoChange = async (owoId: number) => {
    const detail = await outsourceWorkOrderApi.get(String(owoId));
    setSelectedOwo(detail);
    if (isIssue) {
      await loadIssuePreview(owoId);
      return;
    }
    if (isReceipt) {
      setReceiptLine(buildReceiptLineFromWorkOrder(detail));
      return;
    }
    if (isMaterialReturn) {
      const preview: any = await outsourceMaterialReturnApi.returnPreview(owoId);
      const lines = preview?.lines ?? preview?.data?.lines ?? [];
      setMaterialReturnLines(lines);
      const first = lines[0];
      formRef.current?.setFieldsValue?.({
        issueId: first?.issue_id ?? first?.issueId,
        returnQuantity: Number(first?.returnable_quantity ?? first?.returnableQuantity ?? 0) || undefined,
      });
      return;
    }
    if (isProductReturn) {
      const preview: any = await outsourceProductReturnApi.returnPreview(owoId);
      const lines = preview?.lines ?? preview?.data?.lines ?? [];
      setProductReturnLines(lines);
      const first = lines[0];
      formRef.current?.setFieldsValue?.({
        receiptId: first?.receipt_id ?? first?.receiptId,
        returnQuantity: Number(first?.returnable_quantity ?? first?.returnableQuantity ?? 0) || undefined,
      });
    }
  };

  const handleSubmit = async (values: any) => {
    if (!selectedOwo?.id) {
      messageApi.error(t('app.kuaizhizao.batchingCenter.selectOutsourceWorkOrder'));
      throw new Error('missing owo');
    }
    if (isIssue) {
      const activeLines = issueLines.filter((l) => l.issueQuantity > 0);
      if (activeLines.length === 0) {
        messageApi.error(t('app.kuaizhizao.batchingCenter.fillIssueQty'));
        throw new Error('no lines');
      }
      if (!values.warehouseId) {
        messageApi.error(t('app.kuaizhizao.batchingCenter.selectOutboundWarehouse'));
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
    } else if (isReceipt) {
      if (!receiptLine || receiptLine.receiptQuantity <= 0) {
        messageApi.error(t('app.kuaizhizao.batchingCenter.fillReceiptQty'));
        throw new Error('no qty');
      }
      if (!values.warehouseId) {
        messageApi.error(t('app.kuaizhizao.batchingCenter.selectInboundWarehouse'));
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
    } else if (isMaterialReturn) {
      const issueId = Number(values.issueId || 0);
      const line = materialReturnLines.find((l) => Number(l.issue_id ?? l.issueId) === issueId);
      if (!line) {
        messageApi.error(t('app.kuaizhizao.batchingCenter.selectReturnableIssue'));
        throw new Error('no line');
      }
      const qty = Number(values.returnQuantity || 0);
      if (qty <= 0) {
        messageApi.error(t('app.kuaizhizao.batchingCenter.fillReturnQty'));
        throw new Error('no qty');
      }
      if (!values.warehouseId) {
        messageApi.error(t('app.kuaizhizao.batchingCenter.selectReturnWarehouse'));
        throw new Error('no warehouse');
      }
      await outsourceMaterialReturnApi.create({
        outsource_work_order_id: selectedOwo.id,
        outsource_work_order_code: selectedOwo.code,
        outsource_material_issue_id: issueId,
        material_id: Number(line.material_id ?? line.materialId),
        material_code: line.material_code ?? line.materialCode ?? '',
        material_name: line.material_name ?? line.materialName ?? '',
        quantity: qty,
        unit: line.unit || '个',
        warehouse_id: values.warehouseId,
        warehouse_name: values.warehouseName,
        batch_number: values.batchNumber,
        remarks: values.remarks,
      });
    } else if (isProductReturn) {
      const receiptId = Number(values.receiptId || 0);
      const line = productReturnLines.find((l) => Number(l.receipt_id ?? l.receiptId) === receiptId);
      if (!line) {
        messageApi.error(t('app.kuaizhizao.batchingCenter.selectReturnableReceipt'));
        throw new Error('no line');
      }
      const qty = Number(values.returnQuantity || 0);
      if (qty <= 0) {
        messageApi.error(t('app.kuaizhizao.batchingCenter.fillProductReturnQty'));
        throw new Error('no qty');
      }
      await outsourceProductReturnApi.create({
        outsource_work_order_id: selectedOwo.id,
        outsource_work_order_code: selectedOwo.code,
        outsource_material_receipt_id: receiptId,
        quantity: qty,
        unit: line.unit || selectedOwo.unit || '件',
        return_reason: values.returnReason,
        remarks: values.remarks,
      });
    }
    messageApi.success(t('app.kuaizhizao.batchingCenter.createSuccessWithLabel', { label: createLabel }));
    setCreateOpen(false);
    resetCreateState();
    actionRef.current?.reload();
  };

  return (
    <>
      <UniTable<OutsourceMaterialRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        columnPersistenceId={`apps.kuaizhizao.pages.warehouse-management.material-center.${mode}`}
        headerTitle={panelTitle}
        toolBarRender={() => [
          <Button {...rowActionKind('create')} key="create" type="primary" onClick={openCreate}>
            {createLabel}
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
        title={createLabel}
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          resetCreateState();
        }}
        onFinish={handleSubmit}
        formRef={formRef}
        width={MODAL_CONFIG.LARGE_WIDTH}
        grid
      >
        <ProFormSelect
          name="outsourceWorkOrderId"
          label={t('app.kuaizhizao.warehouseCommon.colOutsourceWorkOrder')}
          colProps={{ span: 24 }}
          rules={[{ required: true, message: t('app.kuaizhizao.batchingCenter.selectOutsourceWorkOrder') }]}
          request={async () => {
            const res = await outsourceWorkOrderApi.list({ skip: 0, limit: 1000 });
            const rows = unwrapList<any>(res);
            return rows
              .filter((r) => r.status === 'released' || r.status === 'in_progress' || r.status === 'completed')
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
        {selectedOwo && isReceipt && (
          <div style={{ gridColumn: '1 / -1' }}>
            <OutsourceReceiptFormContent
              workOrder={selectedOwo}
              line={receiptLine}
              onLineChange={setReceiptLine}
            />
          </div>
        )}
        {selectedOwo && isMaterialReturn && materialReturnLines.length > 0 && (
          <>
            <ProFormSelect
              name="issueId"
              label={t('app.kuaizhizao.batchingCenter.outsourceIssueOrder')}
              colProps={{ span: 12 }}
              rules={[{ required: true, message: t('app.kuaizhizao.batchingCenter.selectIssueOrder') }]}
              options={materialReturnLines.map((l) => ({
                value: Number(l.issue_id ?? l.issueId),
                label: `${l.issue_code ?? l.issueCode} - ${l.material_name ?? l.materialName}`,
              }))}
              fieldProps={{
                onChange: (v: number) => {
                  const line = materialReturnLines.find((l) => Number(l.issue_id ?? l.issueId) === v);
                  if (line) {
                    formRef.current?.setFieldsValue?.({
                      returnQuantity: Number(line.returnable_quantity ?? line.returnableQuantity ?? 0),
                    });
                  }
                },
              }}
            />
            <ProFormDigit
              name="returnQuantity"
              label={t('app.kuaizhizao.batchingCenter.returnQty')}
              colProps={{ span: 12 }}
              min={0.01}
              rules={[{ required: true, message: t('app.kuaizhizao.batchingCenter.fillReturnQty') }]}
              fieldProps={{ precision: 2, style: { width: '100%' } }}
            />
          </>
        )}
        {selectedOwo && isProductReturn && productReturnLines.length > 0 && (
          <>
            <ProFormSelect
              name="receiptId"
              label={t('app.kuaizhizao.batchingCenter.outsourceReceiptOrder')}
              colProps={{ span: 12 }}
              rules={[{ required: true, message: t('app.kuaizhizao.batchingCenter.selectReceiptOrder') }]}
              options={productReturnLines.map((l) => ({
                value: Number(l.receipt_id ?? l.receiptId),
                label: `${l.receipt_code ?? l.receiptCode}`,
              }))}
              fieldProps={{
                onChange: (v: number) => {
                  const line = productReturnLines.find((l) => Number(l.receipt_id ?? l.receiptId) === v);
                  if (line) {
                    formRef.current?.setFieldsValue?.({
                      returnQuantity: Number(line.returnable_quantity ?? line.returnableQuantity ?? 0),
                    });
                  }
                },
              }}
            />
            <ProFormDigit
              name="returnQuantity"
              label={t('app.kuaizhizao.batchingCenter.productReturnQty')}
              colProps={{ span: 12 }}
              min={0.01}
              rules={[{ required: true, message: t('app.kuaizhizao.batchingCenter.fillProductReturnQty') }]}
              fieldProps={{ precision: 2, style: { width: '100%' } }}
            />
            <ProFormText name="returnReason" label={t('app.kuaizhizao.warehouseCommon.colReturnReason')} colProps={{ span: 24 }} />
          </>
        )}
        {!isProductReturn && (
          <UniWarehouseSelect
            name="warehouseId"
            label={isIssue ? t('app.kuaizhizao.batchingCenter.outboundWarehouse') : t('app.kuaizhizao.batchingCenter.inboundWarehouse')}
            required
            colProps={{ span: 12 }}
            onChange={(_v, wh) => formRef.current?.setFieldsValue({ warehouseName: wh?.name ?? '' })}
          />
        )}
        <ProFormText name="warehouseName" hidden />
        {(isReceipt || isMaterialReturn) && (
          <ProFormText name="batchNumber" label={t('app.kuaizhizao.batchingCenter.batchNumber')} colProps={{ span: 12 }} />
        )}
        <ProFormTextArea name="remarks" label={t('app.kuaizhizao.warehouseCommon.colRemarks')} colProps={{ span: 24 }} fieldProps={{ rows: 2 }} />
      </FormModalTemplate>
    </>
  );
};

export default OutsourceMaterialPanel;
