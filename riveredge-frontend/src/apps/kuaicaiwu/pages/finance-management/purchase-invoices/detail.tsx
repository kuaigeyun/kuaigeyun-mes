import React, { useEffect, useState } from 'react';
import { ProDescriptions } from '@ant-design/pro-components';
import { Button, Spin, Empty, Typography, Timeline, Space } from 'antd';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { purchaseInvoiceService } from '../../../services/finance/purchase-invoice';
import { PurchaseInvoice } from '../../../types/finance/purchase-invoice';
import { UniWorkflowActions } from '../../../../../components/uni-workflow-actions';
import { UniLifecycle } from '../../../../../components/uni-lifecycle';
import {
  DetailDrawerSection,
  DOCUMENT_DETAIL_PAGE_HEADER_STYLE,
  DOCUMENT_DETAIL_PAGE_TITLE_STYLE,
  uniTabsChildPageVerticalInsetStyle,
} from '../../../../../components/layout-templates';
import { getChineseInvoiceLifecycle } from '../../../utils/financeLifecycle';
import {
  formatPurchaseInvoiceDetailPageTitle,
  formatPurchaseInvoiceTabTitle,
  formatPurchaseInvoiceTypeZh,
} from '../../../utils/purchaseInvoiceUi';

const PurchaseInvoiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState<PurchaseInvoice>();
  const [loading, setLoading] = useState(false);

  const pageTitle = formatPurchaseInvoiceDetailPageTitle(data?.invoice_number);
  const tabTitle = formatPurchaseInvoiceTabTitle(data?.invoice_number);

  useEffect(() => {
    if (!data) return;
    const tabKey = location.pathname + location.search;
    window.dispatchEvent(
      new CustomEvent('riveredge:update-tab-title', {
        detail: { key: tabKey, title: tabTitle },
      }),
    );
  }, [data, tabTitle, location.pathname, location.search]);

  const loadData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await purchaseInvoiceService.get(Number(id));
      setData(res);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const pageActions = data ? (
    <>
      <Button onClick={() => navigate(-1)}>返回</Button>
      {data.review_status === '待审核' && (
        <UniWorkflowActions
          record={data}
          entityName="采购发票"
          statusField="status"
          reviewStatusField="review_status"
          draftStatuses={[]}
          pendingStatuses={['待审核']}
          approvedStatuses={['已审核', '通过']}
          rejectedStatuses={['已驳回', '驳回']}
          theme="default"
          size="small"
          actions={{
            approve: (pid) => purchaseInvoiceService.approve(pid),
            reject: (pid, reason) => purchaseInvoiceService.approve(pid, reason),
          }}
          onSuccess={loadData}
        />
      )}
    </>
  ) : null;

  const renderShell = (body: React.ReactNode) => (
    <div style={uniTabsChildPageVerticalInsetStyle()}>
      <div style={DOCUMENT_DETAIL_PAGE_HEADER_STYLE}>
        <Typography.Title level={4} style={DOCUMENT_DETAIL_PAGE_TITLE_STYLE}>
          {pageTitle}
        </Typography.Title>
        {pageActions ? <Space wrap size={8}>{pageActions}</Space> : null}
      </div>
      {body}
    </div>
  );

  if (!id) return null;

  if (loading && !data) {
    return renderShell(
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <Spin size="large" />
      </div>,
    );
  }

  if (!data) {
    return renderShell(<Empty description="未找到采购发票" />);
  }

  const lc = getChineseInvoiceLifecycle(data as unknown as Record<string, unknown>);

  return renderShell(
    <>
      <DetailDrawerSection title="基本信息">
        <ProDescriptions column={3} dataSource={data as unknown as Record<string, unknown>} loading={loading}>
          <ProDescriptions.Item label="采购订单">{data.purchase_order_code || '-'}</ProDescriptions.Item>
          <ProDescriptions.Item label="供应商">{data.supplier_name}</ProDescriptions.Item>
          <ProDescriptions.Item label="发票号码">{data.invoice_number || '-'}</ProDescriptions.Item>
          <ProDescriptions.Item label="开票日期">{data.invoice_date}</ProDescriptions.Item>
          <ProDescriptions.Item label="发票类型">{formatPurchaseInvoiceTypeZh(data.invoice_type)}</ProDescriptions.Item>
          <ProDescriptions.Item label="发票金额">{data.invoice_amount}</ProDescriptions.Item>
          <ProDescriptions.Item label="税额">{data.tax_amount}</ProDescriptions.Item>
          <ProDescriptions.Item label="价税合计">{data.total_amount}</ProDescriptions.Item>
          <ProDescriptions.Item label="税率">{data.tax_rate}%</ProDescriptions.Item>
          <ProDescriptions.Item label="业务状态">{data.status}</ProDescriptions.Item>
          <ProDescriptions.Item label="审核状态">{data.review_status}</ProDescriptions.Item>
          <ProDescriptions.Item label="应付单">{data.payable_code || '-'}</ProDescriptions.Item>
          <ProDescriptions.Item label="备注" span={3}>
            {data.notes || '-'}
          </ProDescriptions.Item>
        </ProDescriptions>
      </DetailDrawerSection>

      <DetailDrawerSection title="生命周期">
        <UniLifecycle
          percent={lc.percent}
          stageName={lc.stageName}
          status={lc.status}
          subStages={lc.subStages}
          showLabel
          size="small"
          showCircleTooltip={false}
        />
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
          采购发票未接入单据跟踪中心；与应付单、采购订单的关联以编号跳转业务系统为准。
        </Typography.Paragraph>
      </DetailDrawerSection>

      <DetailDrawerSection title="明细信息">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无票面明细行（单头登记模式）" />
      </DetailDrawerSection>

      <DetailDrawerSection title="操作记录" marginBottom={0}>
        <Timeline
          items={[
            { color: 'green', children: `创建于 ${data.created_at}` },
            ...(data.updated_at && data.updated_at !== data.created_at
              ? [{ color: 'blue', children: `更新于 ${data.updated_at}` }]
              : []),
          ]}
        />
      </DetailDrawerSection>
    </>,
  );
};

export default PurchaseInvoiceDetail;
