/**
 * 交付项目节点关联单据：按类型下拉选择，回填 doc_id + doc_code + title。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Form, Input, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { listPurchaseOrders } from '../../../services/purchase';
import { listSalesOrders } from '../../../services/sales-order';
import { workOrderApi } from '../../../services/work-order';
import { warehouseApi } from '../../../services/warehouse-execution';
import { qualityApi } from '../../../services/quality-execution';
import { qualityImprovementApi } from '../../../services/quality-improvement';
import { listRdProjects } from '../../../../kuaiplm/services/rd-project';
import { DELIVERY_NODE_DOCUMENT_TYPES } from '../../../services/delivery-project';

export type DeliveryNodeDocumentKind = keyof typeof DELIVERY_NODE_DOCUMENT_TYPES;

export type DeliveryNodeDocumentOption = {
  value: number;
  code: string;
  label: string;
  title?: string;
};

type Props = {
  docTypeField?: string;
  docIdField?: string;
  docCodeField?: string;
  titleField?: string;
  customerId?: number | null;
  salesOrderId?: number | null;
  onPicked?: (option: DeliveryNodeDocumentOption | undefined) => void;
};

const LIST_LIMIT = 100;

function unwrapListRows(res: unknown): Record<string, unknown>[] {
  if (Array.isArray(res)) return res as Record<string, unknown>[];
  const r = res as Record<string, unknown>;
  const rows = r.data ?? r.items ?? r.results ?? [];
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

function mapRow(
  row: Record<string, unknown>,
  codeKeys: string[],
  titleKeys: string[],
  extra?: string,
): DeliveryNodeDocumentOption | null {
  const id = Number(row.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  const code = codeKeys.map((k) => row[k]).find((v) => typeof v === 'string' && v.trim()) as string | undefined;
  if (!code?.trim()) return null;
  const title = titleKeys.map((k) => row[k]).find((v) => typeof v === 'string' && v.trim()) as string | undefined;
  const suffix = extra ? ` ${extra}` : '';
  return {
    value: id,
    code: code.trim(),
    label: `${code.trim()}${suffix}`,
    title: title?.trim() || undefined,
  };
}

export async function loadDeliveryNodeDocumentOptions(
  docType: DeliveryNodeDocumentKind,
  options?: { keyword?: string; customerId?: number | null; salesOrderId?: number | null },
): Promise<DeliveryNodeDocumentOption[]> {
  const keyword = options?.keyword?.trim() || undefined;
  const customerId = options?.customerId || undefined;
  const salesOrderId = options?.salesOrderId || undefined;
  const baseParams = { skip: 0, limit: LIST_LIMIT, keyword };

  switch (docType) {
    case 'sales_order': {
      const res = await listSalesOrders({
        ...baseParams,
        view: 'options',
        customer_id: customerId,
        order_code: keyword,
      });
      return unwrapListRows(res)
        .map((row) =>
          mapRow(row, ['order_code'], ['order_name', 'customer_name'], row.customer_name as string | undefined),
        )
        .filter(Boolean) as DeliveryNodeDocumentOption[];
    }
    case 'purchase_order': {
      const res = await listPurchaseOrders({ ...baseParams, order_code: keyword });
      return unwrapListRows(res)
        .map((row) =>
          mapRow(row, ['order_code'], ['supplier_name'], row.supplier_name as string | undefined),
        )
        .filter(Boolean) as DeliveryNodeDocumentOption[];
    }
    case 'work_order': {
      const res = await workOrderApi.list({
        ...baseParams,
        sales_order_id: salesOrderId,
        code: keyword,
      });
      return unwrapListRows(res)
        .map((row) =>
          mapRow(row, ['code', 'work_order_code'], ['product_name'], row.product_name as string | undefined),
        )
        .filter(Boolean) as DeliveryNodeDocumentOption[];
    }
    case 'purchase_receipt': {
      const res = await warehouseApi.purchaseReceipt.list({
        ...baseParams,
        receipt_code: keyword,
      });
      return unwrapListRows(res)
        .map((row) =>
          mapRow(row, ['receipt_code'], ['supplier_name'], row.supplier_name as string | undefined),
        )
        .filter(Boolean) as DeliveryNodeDocumentOption[];
    }
    case 'sales_delivery': {
      const res = await warehouseApi.salesDelivery.list({
        ...baseParams,
        delivery_code: keyword,
        customer_id: customerId,
      });
      return unwrapListRows(res)
        .map((row) =>
          mapRow(row, ['delivery_code'], ['customer_name'], row.customer_name as string | undefined),
        )
        .filter(Boolean) as DeliveryNodeDocumentOption[];
    }
    case 'quality_inspection': {
      const params = { skip: 0, limit: 50, keyword, inspection_code: keyword };
      const [incoming, process, finished, oqc] = await Promise.all([
        qualityApi.incomingInspection.list(params),
        qualityApi.processInspection.list(params),
        qualityApi.finishedGoodsInspection.list(params),
        qualityImprovementApi.oqc.list(params),
      ]);
      const merged = [
        ...unwrapListRows(incoming),
        ...unwrapListRows(process),
        ...unwrapListRows(finished),
        ...unwrapListRows(oqc),
      ];
      const seen = new Set<number>();
      const options: DeliveryNodeDocumentOption[] = [];
      for (const row of merged) {
        const mapped = mapRow(
          row,
          ['inspection_code'],
          ['material_name', 'source_document_code'],
        );
        if (!mapped || seen.has(mapped.value)) continue;
        seen.add(mapped.value);
        options.push(mapped);
      }
      return options.slice(0, LIST_LIMIT);
    }
    case 'rd_project': {
      const res = await listRdProjects({
        ...baseParams,
        project_code: keyword,
        project_name: keyword,
      });
      const rows = Array.isArray(res.items) ? res.items : [];
      return rows
        .map((row) =>
          mapRow(
            row as unknown as Record<string, unknown>,
            ['project_code'],
            ['project_name'],
            (row as { project_name?: string }).project_name,
          ),
        )
        .filter(Boolean) as DeliveryNodeDocumentOption[];
    }
    default:
      return [];
  }
}

export const DeliveryNodeDocumentSelect: React.FC<Props> = ({
  docTypeField = 'doc_type',
  docIdField = 'doc_id',
  docCodeField = 'doc_code',
  titleField = 'title',
  customerId,
  salesOrderId,
  onPicked,
}) => {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const docType = Form.useWatch(docTypeField, form) as DeliveryNodeDocumentKind | undefined;
  const [options, setOptions] = useState<DeliveryNodeDocumentOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');

  const typeOptions = useMemo(
    () =>
      Object.entries(DELIVERY_NODE_DOCUMENT_TYPES).map(([value, label]) => ({
        value,
        label,
      })),
    [],
  );

  useEffect(() => {
    if (!docType || !DELIVERY_NODE_DOCUMENT_TYPES[docType]) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void loadDeliveryNodeDocumentOptions(docType, {
      keyword: searchKeyword,
      customerId,
      salesOrderId,
    })
      .then((rows) => {
        if (!cancelled) setOptions(rows);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, docType, salesOrderId, searchKeyword]);

  const selectOptions = options.map((option) => ({
    value: option.value,
    label: option.label,
  }));

  return (
    <>
      <Form.Item
        name={docTypeField}
        label={t('app.kuaizhizao.deliveryProject.fields.docType')}
        rules={[{ required: true, message: t('common.required') }]}
      >
        <Select
          options={typeOptions}
          placeholder={t('app.kuaizhizao.deliveryProject.selectDocTypeFirst')}
          onChange={() => {
            setSearchKeyword('');
            form.setFieldsValue({
              [docIdField]: undefined,
              [docCodeField]: undefined,
              [titleField]: undefined,
            });
            onPicked?.(undefined);
          }}
        />
      </Form.Item>
      <Form.Item name={docCodeField} hidden>
        <Input />
      </Form.Item>
      <Form.Item
        name={docIdField}
        label={t('app.kuaizhizao.deliveryProject.fields.selectDocument')}
        rules={[{ required: true, message: t('common.required') }]}
      >
        <Select
          allowClear
          showSearch
          filterOption={false}
          loading={loading}
          disabled={!docType}
          placeholder={
            docType
              ? t('app.kuaizhizao.deliveryProject.selectDocumentPlaceholder')
              : t('app.kuaizhizao.deliveryProject.selectDocTypeFirst')
          }
          options={selectOptions}
          onSearch={(value) => setSearchKeyword(value.trim())}
          onChange={(value: number | undefined) => {
            const picked = options.find((o) => o.value === value);
            form.setFieldsValue({
              [docIdField]: value,
              [docCodeField]: picked?.code,
              [titleField]: picked?.title ?? picked?.code,
            });
            onPicked?.(picked);
          }}
        />
      </Form.Item>
      <Form.Item name={titleField} label={t('app.kuaizhizao.deliveryProject.fields.docTitle')}>
        <Input placeholder={t('app.kuaizhizao.deliveryProject.docTitleAutoHint')} />
      </Form.Item>
    </>
  );
};

export default DeliveryNodeDocumentSelect;
