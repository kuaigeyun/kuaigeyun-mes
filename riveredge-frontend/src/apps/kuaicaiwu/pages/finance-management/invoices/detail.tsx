import React, { useEffect, useState } from 'react';
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
import { invoiceService } from '../../../services/finance/invoice';
import { Invoice, InvoiceItem, InvoiceCreateData, InvoiceUpdateData } from '../../../types/finance/invoice';
import dayjs from 'dayjs';
import { DetailDrawerSection } from '../../../../../components/layout-templates';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import { getUnifiedInvoiceLifecycle } from '../../../utils/financeLifecycle';

const InvoiceDetail: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const isCreate = !code || code === 'new';
  const [form] = Form.useForm();
  const [editableKeys, setEditableRowKeys] = useState<React.Key[]>([]);
  const [dataSource, setDataSource] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedInvoice, setLoadedInvoice] = useState<Invoice | null>(null);

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
        message.success('创建成功');
      } else {
        await invoiceService.updateInvoice(code!, formData as InvoiceUpdateData);
        message.success('更新成功');
      }
      navigate('/apps/kuaicaiwu/finance-management/invoices');
    } catch (error) {
      console.error(error);
    }
  };

  const columns: ProColumns<InvoiceItem>[] = [
    {
      title: '货物或应税劳务名称',
      dataIndex: 'item_name',
      width: '20%',
      formItemProps: { rules: [{ required: true, message: '此项为必填项' }] },
    },
    { title: '规格型号', dataIndex: 'spec_model', width: '15%' },
    { title: '单位', dataIndex: 'unit', width: '10%' },
    { title: '数量', dataIndex: 'quantity', valueType: 'digit', width: '10%' },
    { title: '单价', dataIndex: 'unit_price', valueType: 'money', width: '10%' },
    {
      title: '金额',
      dataIndex: 'amount',
      valueType: 'money',
      width: '10%',
      formItemProps: { rules: [{ required: true, message: '必填' }] },
    },
    { title: '税率', dataIndex: 'tax_rate', valueType: 'percent', width: '10%', initialValue: 0.13 },
    {
      title: '税额',
      dataIndex: 'tax_amount',
      valueType: 'money',
      width: '10%',
      editable: false,
      render: (_, row: InvoiceItem) =>
        row.amount && row.tax_rate ? (Number(row.amount) * Number(row.tax_rate)).toFixed(2) : row.tax_amount,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 100,
      render: (_, record) => [
        <a key="delete" onClick={() => setDataSource(dataSource.filter((item) => item.id !== record.id))}>
          删除
        </a>,
      ],
    },
  ];

  const lifecycleBlock =
    !isCreate && loadedInvoice ? (
      <DetailDrawerSection title="生命周期">
        {(() => {
          const lc = getUnifiedInvoiceLifecycle(loadedInvoice as unknown as Record<string, unknown>);
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
                发票未接入单据跟踪中心；阶段名与列表生命周期列一致。
              </Typography.Paragraph>
            </>
          );
        })()}
      </DetailDrawerSection>
    ) : null;

  return (
    <PageContainer title={isCreate ? '新建发票' : '编辑发票'} loading={loading}>
      <ProForm
        form={form}
        onFinish={handleFinish}
        initialValues={{ invoice_date: dayjs(), category: 'IN', invoice_type: 'VAT_SPECIAL', tax_rate: 0.13 }}
        submitter={{
          searchConfig: {
            submitText: isCreate ? '创建' : '保存',
          },
        }}
      >
        <DetailDrawerSection title="基本信息">
          <ProForm.Group>
            <ProFormText name="invoice_code" label="系统编号" disabled placeholder="自动生成" width="md" />
            <ProFormSelect
              name="category"
              label="业务类型"
              options={[
                { label: '进项(采购)', value: 'IN' },
                { label: '销项(销售)', value: 'OUT' },
              ]}
              width="md"
              rules={[{ required: true }]}
            />
            <ProFormText name="invoice_number" label="发票号码" width="md" rules={[{ required: true }]} />
            <ProFormText name="invoice_details_code" label="发票代码" width="md" />
            <ProFormSelect
              name="invoice_type"
              label="发票类型"
              options={[
                { label: '增值税专用发票', value: 'VAT_SPECIAL' },
                { label: '增值税普通发票', value: 'VAT_NORMAL' },
                { label: '电子发票', value: 'ELECTRONIC' },
              ]}
              width="md"
            />
            <ProFormDatePicker name="invoice_date" label="开票日期" width="md" rules={[{ required: true }]} />
          </ProForm.Group>
          <ProForm.Group>
            <ProFormText name="partner_name" label="往来单位" width="lg" rules={[{ required: true }]} placeholder="请输入供应商或客户名称" />
            <ProFormText name="partner_id" label="往来单位ID" hidden />
          </ProForm.Group>
          <ProForm.Group>
            <ProFormText name="partner_tax_no" label="纳税人识别号" width="md" />
            <ProFormText name="partner_bank_info" label="开户行及账号" width="lg" />
            <ProFormText name="partner_address_phone" label="地址及电话" width="lg" />
          </ProForm.Group>
        </DetailDrawerSection>

        {lifecycleBlock}

        <DetailDrawerSection title="明细信息">
          <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
            <EditableProTable<InvoiceItem>
              rowKey="id"
              headerTitle="明细列表"
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

        <DetailDrawerSection title="合计信息">
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
                  <Statistic title="不含税金额" value={(total - tax).toFixed(2)} prefix="¥" />
                  <Statistic title="税额" value={tax.toFixed(2)} prefix="¥" />
                  <Statistic title="价税合计" value={total.toFixed(2)} prefix="¥" style={{ fontWeight: 'bold' }} />
                </Space>
              );
            }}
          </ProFormDependency>
        </DetailDrawerSection>

        <DetailDrawerSection title="操作记录">
          {!isCreate && loadedInvoice ? (
            <Typography.Text type="secondary">
              创建于 {loadedInvoice.created_at}
              {loadedInvoice.updated_at && loadedInvoice.updated_at !== loadedInvoice.created_at
                ? ` · 更新于 ${loadedInvoice.updated_at}`
                : ''}
            </Typography.Text>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="保存发票后可查看创建与更新时间" />
          )}
        </DetailDrawerSection>
      </ProForm>
    </PageContainer>
  );
};

export default InvoiceDetail;
