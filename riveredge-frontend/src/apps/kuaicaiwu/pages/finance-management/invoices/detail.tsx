import React, { useEffect, useMemo, useState } from 'react';
import {
  PageContainer,
  ProForm,
  ProFormText,
  ProFormSelect,
  ProFormDatePicker,
  ProFormDependency,
} from '@ant-design/pro-components';
import { EditableProTable, ProColumns } from '@ant-design/pro-components';
import { message, Form, Space, Statistic, Empty, Typography } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { invoiceService } from '../../../services/finance/invoice';
import { Invoice, InvoiceItem, InvoiceCreateData, InvoiceUpdateData } from '../../../types/finance/invoice';
import dayjs from 'dayjs';
import { DetailDrawerSection } from '../../../../../components/layout-templates';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { getUnifiedInvoiceLifecycle } from '../../../utils/financeLifecycle';
import { getUnifiedInvoiceTypeOptions } from '../../../utils/financeSharedOptions';

const P = 'app.kuaicaiwu.invoice';

const InvoiceDetail: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isCreate = !code || code === 'new';
  const [form] = Form.useForm();
  const [editableKeys, setEditableRowKeys] = useState<React.Key[]>([]);
  const [dataSource, setDataSource] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedInvoice, setLoadedInvoice] = useState<Invoice | null>(null);

  const invoiceTypeOptions = useMemo(() => getUnifiedInvoiceTypeOptions(t), [t]);

  const categoryOptions = useMemo(
    () => [
      { label: t(`${P}.form.categoryIn`), value: 'IN' },
      { label: t(`${P}.form.categoryOut`), value: 'OUT' },
    ],
    [t],
  );

  useEffect(() => {
    if (!isCreate && code) {
      setLoading(true);
      invoiceService
        .getInvoice(code)
        .then((res) => {
          setLoadedInvoice(res);
          form.setFieldsValue({ ...res, partner_id_label: res.partner_name });
          setDataSource(res.items);
        })
        .finally(() => setLoading(false));
    } else {
      setLoadedInvoice(null);
    }
  }, [code, isCreate, form]);

  const handleFinish = async (values: any) => {
    const formData = { ...values, items: dataSource };
    formData.invoice_number = String(formData.invoice_number ?? '').trim();
    let calculatedTotal = 0;
    let calculatedTax = 0;
    let calculatedExcl = 0;
    dataSource.forEach((item) => {
      calculatedTotal += Number(item.amount) + Number(item.tax_amount);
      calculatedTax += Number(item.tax_amount);
      calculatedExcl += Number(item.amount);
    });
    formData.total_amount = calculatedTotal;
    formData.tax_amount = calculatedTax;
    formData.amount_excluding_tax = calculatedExcl;

    try {
      if (isCreate) {
        await invoiceService.createInvoice(formData as InvoiceCreateData);
        message.success(t('common.createSuccess'));
      } else {
        await invoiceService.updateInvoice(code!, formData as InvoiceUpdateData);
        message.success(t('common.updateSuccess'));
      }
      navigate('/apps/kuaicaiwu/finance-management/invoices');
    } catch (error) {
      console.error(error);
    }
  };

  const columns: ProColumns<InvoiceItem>[] = useMemo(
    () => [
      {
        title: t(`${P}.line.itemName`),
        dataIndex: 'item_name',
        width: '20%',
        formItemProps: { rules: [{ required: true, message: t('common.required') }] },
      },
      { title: t(`${P}.line.specModel`), dataIndex: 'spec_model', width: '15%' },
      { title: t(`${P}.line.unit`), dataIndex: 'unit', width: '10%' },
      { title: t(`${P}.line.quantity`), dataIndex: 'quantity', valueType: 'digit', width: '10%' },
      { title: t(`${P}.line.unitPrice`), dataIndex: 'unit_price', valueType: 'money', width: '10%' },
      {
        title: t(`${P}.line.amount`),
        dataIndex: 'amount',
        valueType: 'money',
        width: '10%',
        formItemProps: { rules: [{ required: true, message: t('common.required') }] },
      },
      { title: t(`${P}.line.taxRate`), dataIndex: 'tax_rate', valueType: 'percent', width: '10%', initialValue: 0.13 },
      {
        title: t(`${P}.line.taxAmount`),
        dataIndex: 'tax_amount',
        valueType: 'money',
        width: '10%',
        editable: false,
        render: (_, row: InvoiceItem) =>
          row.amount && row.tax_rate ? (Number(row.amount) * Number(row.tax_rate)).toFixed(2) : row.tax_amount,
      },
      {
        title: t('common.actions'),
        valueType: 'option',
        width: 100,
        render: (_, record) => [
          <a key="delete" onClick={() => setDataSource(dataSource.filter((item) => item.id !== record.id))}>
            {t('common.delete')}
          </a>,
        ],
      },
    ],
    [t, dataSource],
  );

  const lifecycleBlock =
    !isCreate && loadedInvoice ? (
      <DetailDrawerSection title={t('app.kuaicaiwu.common.lifecycle')}>
        {(() => {
          const lc = getUnifiedInvoiceLifecycle(loadedInvoice as unknown as Record<string, unknown>, t);
          return (
            <>
              <UniLifecycle
                percent={lc.percent}
                stageName={lc.stageName}
                status={lc.status}
                showLabel
                size="small"
                showCircleTooltip={false}
              />
              <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                {t(`${P}.lifecycleHint`)}
              </Typography.Paragraph>
            </>
          );
        })()}
      </DetailDrawerSection>
    ) : null;

  return (
    <PageContainer title={isCreate ? t(`${P}.createTitle`) : t(`${P}.editTitle`)} loading={loading}>
      <ProForm
        form={form}
        onFinish={handleFinish}
        initialValues={{ invoice_date: dayjs(), category: 'IN', invoice_type: 'VAT_SPECIAL', tax_rate: 0.13 }}
        submitter={{
          searchConfig: {
            submitText: isCreate ? t('common.create') : t('common.save'),
          },
        }}
      >
        <DetailDrawerSection title={t('app.uniDetail.sectionBasic')}>
          <ProForm.Group>
            <ProFormText
              name="invoice_code"
              label={t('app.kuaicaiwu.common.systemCode')}
              disabled
              placeholder={t(`${P}.form.autoGenerate`)}
              width="md"
            />
            <ProFormSelect
              name="category"
              label={t(`${P}.col.category`)}
              options={categoryOptions}
              width="md"
              rules={[{ required: true }]}
            />
            <ProFormText
              name="invoice_number"
              label={t(`${P}.col.invoiceNumber`)}
              width="md"
              placeholder={t(`${P}.form.invoiceNumberPlaceholder`)}
            />
            <ProFormText name="invoice_details_code" label={t(`${P}.form.invoiceCode`)} width="md" />
            <ProFormSelect
              name="invoice_type"
              label={t(`${P}.form.invoiceType`)}
              options={invoiceTypeOptions}
              width="md"
            />
            <ProFormDatePicker
              name="invoice_date"
              label={t('app.kuaicaiwu.common.invoiceDate')}
              width="md"
              rules={[{ required: true }]}
            />
          </ProForm.Group>
          <ProForm.Group>
            <ProFormText
              name="partner_name"
              label={t(`${P}.col.partner`)}
              width="lg"
              rules={[{ required: true }]}
              placeholder={t(`${P}.form.partnerPlaceholder`)}
            />
            <ProFormText name="partner_id" label="partner_id" hidden />
          </ProForm.Group>
          <ProForm.Group>
            <ProFormText name="partner_tax_no" label={t(`${P}.form.partnerTaxNo`)} width="md" />
            <ProFormText name="partner_bank_info" label={t(`${P}.form.partnerBankInfo`)} width="lg" />
            <ProFormText name="partner_address_phone" label={t(`${P}.form.partnerAddressPhone`)} width="lg" />
          </ProForm.Group>
        </DetailDrawerSection>

        {lifecycleBlock}

        <DetailDrawerSection title={t('app.uniDetail.sectionLines')}>
          <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
            <EditableProTable<InvoiceItem>
              rowKey="id"
              headerTitle={t(`${P}.line.listTitle`)}
              maxLength={50}
              name="items"
              value={dataSource}
              onChange={(list) => setDataSource([...list] as InvoiceItem[])}
              recordCreatorProps={{
                newRecordType: 'dataSource',
                record: () => ({ id: Date.now(), item_name: '', amount: 0, tax_rate: 0.13, tax_amount: 0 }),
              }}
              columns={columns}
              editable={{
                type: 'multiple',
                editableKeys,
                onChange: setEditableRowKeys,
                actionRender: (_, __, defaultDom) => [defaultDom.delete],
                onValuesChange: (record, recordList) => {
                  if (record.amount !== undefined || record.tax_rate !== undefined) {
                    const amount = Number(record.amount || 0);
                    const rate = Number(record.tax_rate || 0);
                    record.tax_amount = Number((amount * rate).toFixed(2));
                    setDataSource(recordList);
                  }
                },
              }}
            />
          </div>
        </DetailDrawerSection>

        <DetailDrawerSection title={t(`${P}.section.totals`)}>
          <ProFormDependency name={['items']}>
            {() => {
              let total = 0;
              let tax = 0;
              dataSource.forEach((i) => {
                total += Number(i.amount || 0) + Number(i.tax_amount || 0);
                tax += Number(i.tax_amount || 0);
              });
              return (
                <Space size="large">
                  <Statistic title={t(`${P}.total.exclTax`)} value={(total - tax).toFixed(2)} prefix="¥" />
                  <Statistic title={t(`${P}.total.tax`)} value={tax.toFixed(2)} prefix="¥" />
                  <Statistic
                    title={t(`${P}.col.totalAmount`)}
                    value={total.toFixed(2)}
                    prefix="¥"
                    style={{ fontWeight: 'bold' }}
                  />
                </Space>
              );
            }}
          </ProFormDependency>
        </DetailDrawerSection>

        <DetailDrawerSection title={t('app.uniDetail.sectionTimeline')}>
          {!isCreate && loadedInvoice ? (
            <Typography.Text type="secondary">
              {t(`${P}.activityCreated`, { time: loadedInvoice.created_at })}
              {loadedInvoice.updated_at && loadedInvoice.updated_at !== loadedInvoice.created_at
                ? ` · ${t(`${P}.activityUpdated`, { time: loadedInvoice.updated_at })}`
                : ''}
            </Typography.Text>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t(`${P}.activityPlaceholder`)} />
          )}
        </DetailDrawerSection>
      </ProForm>
    </PageContainer>
  );
};

export default InvoiceDetail;
