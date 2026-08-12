/**
 * 售后派工/回访：按来源类型下拉选择来源单据，回填 source_id + source_code。
 */
import React, { useEffect, useState } from 'react';
import { Form, Input, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { afterSalesTicketApi } from '../../../services/after-sales-ticket';
import { installExecutionApi } from '../../../services/install-execution';
import { repairOrderApi } from '../../../services/after-sales-service';

export type AfterSalesSourceKind = 'install_execution' | 'repair_order' | 'after_sales_ticket';

type SourceOption = { value: number; label: string; code: string };

type Props = {
  sourceTypeField?: string;
  sourceIdField?: string;
  sourceCodeField?: string;
  customerId?: number | null;
  allowedTypes: AfterSalesSourceKind[];
  typeLabelKeyPrefix: string;
};

async function loadSourceOptions(
  sourceType: AfterSalesSourceKind,
  customerId?: number | null,
): Promise<SourceOption[]> {
  const params = { skip: 0, limit: 100, customer_id: customerId || undefined };
  if (sourceType === 'install_execution') {
    const res = await installExecutionApi.list(params);
    return (res.items ?? []).map((row) => ({
      value: row.id,
      code: row.job_code,
      label: `${row.job_code}${row.customer_name ? ` ${row.customer_name}` : ''}`,
    }));
  }
  if (sourceType === 'repair_order') {
    const res = await repairOrderApi.list(params);
    return (res.items ?? []).map((row) => ({
      value: row.id,
      code: row.order_code,
      label: `${row.order_code}${row.customer_name ? ` ${row.customer_name}` : ''}`,
    }));
  }
  const res = await afterSalesTicketApi.list(params);
  return (res.items ?? []).map((row) => ({
    value: row.id,
    code: row.ticket_code,
    label: `${row.ticket_code}${row.customer_name ? ` ${row.customer_name}` : ''}`,
  }));
}

export const AfterSalesSourceDocumentSelect: React.FC<Props> = ({
  sourceTypeField = 'source_type',
  sourceIdField = 'source_id',
  sourceCodeField = 'source_code',
  customerId,
  allowedTypes,
  typeLabelKeyPrefix,
}) => {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const sourceType = Form.useWatch(sourceTypeField, form) as AfterSalesSourceKind | undefined;
  const [options, setOptions] = useState<SourceOption[]>([]);
  const [loading, setLoading] = useState(false);
  const allowedKey = allowedTypes.join(',');

  useEffect(() => {
    if (!sourceType || !allowedKey.split(',').includes(sourceType)) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void loadSourceOptions(sourceType, customerId)
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
  }, [allowedKey, customerId, sourceType]);

  return (
    <>
      <Form.Item
        name={sourceTypeField}
        label={t(`${typeLabelKeyPrefix}.sourceType`)}
        rules={[{ required: true, message: t('common.required') }]}
      >
        <Select
          options={allowedTypes.map((value) => ({
            value,
            label: t(
              value === 'install_execution'
                ? 'app.kuaizhizao.afterSalesService.dispatchOrder.sourceType.installExecution'
                : value === 'repair_order'
                  ? 'app.kuaizhizao.afterSalesService.dispatchOrder.sourceType.repairOrder'
                  : 'app.kuaizhizao.afterSalesService.returnVisit.sourceType.afterSalesTicket',
            ),
          }))}
          onChange={() => {
            form.setFieldsValue({
              [sourceIdField]: undefined,
              [sourceCodeField]: undefined,
            });
          }}
        />
      </Form.Item>
      <Form.Item name={sourceCodeField} hidden>
        <Input />
      </Form.Item>
      <Form.Item
        name={sourceIdField}
        label={t('app.kuaizhizao.afterSalesService.common.sourceDocument')}
        rules={[{ required: true, message: t('common.required') }]}
      >
        <Select
          showSearch
          optionFilterProp="label"
          loading={loading}
          disabled={!sourceType}
          placeholder={
            sourceType
              ? t('app.kuaizhizao.afterSalesService.common.selectSourceDocument')
              : t('app.kuaizhizao.afterSalesService.common.selectSourceTypeFirst')
          }
          options={options}
          onChange={(value: number) => {
            const picked = options.find((o) => o.value === value);
            form.setFieldsValue({
              [sourceIdField]: value,
              [sourceCodeField]: picked?.code,
            });
          }}
        />
      </Form.Item>
    </>
  );
};

export default AfterSalesSourceDocumentSelect;
