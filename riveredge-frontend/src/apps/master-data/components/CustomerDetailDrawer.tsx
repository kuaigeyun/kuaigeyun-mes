import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ProDescriptionsItemProps } from '@ant-design/pro-components';
import { Descriptions } from 'antd';
import {
  DetailDrawerSection,
  detailDrawerDescriptionItems,
} from '../../../components/layout-templates';
import { getApiErrorMessage } from '../../../utils/errorHandler';
import { getDictionaryLabelMapSync } from '../../../services/dataDictionaryCache';
import { customerApi, getDictionaryOptions } from '../services/supply-chain';
import type { Customer } from '../types/supply-chain';
import { resolveDictionaryDisplayLabel } from '../../../utils/loadImportDictionaryValues';
import {
  partnerEnterpriseTypeLabel,
  partnerInvoiceTypeLabel,
  partnerRevenueRecognitionOverrideLabel,
  partnerSettlementMethodLabel,
  partnerTaxpayerTypeLabel,
} from '../utils/partner-static-labels';
import { renderMasterActiveTag } from '../utils/masterListPresentation';
import { PartnerMasterDetailDrawer } from '../pages/shared/PartnerMasterDetailDrawer';
import {
  alignDescriptionColumns,
  MASTER_DATA_DETAIL_BASIC_FIELD_RANK,
} from '../../kuaizhizao/pages/sales-management/shared/documentFieldAlignment';

const DICT_CODES = [
  'INDUSTRY_SECTOR',
  'CUSTOMER_LEVEL',
  'PARTNER_SOURCE_CHANNEL',
  'CUSTOMER_CATEGORY',
  'CONTACT_TITLE',
] as const;

export interface CustomerDetailDrawerProps {
  open: boolean;
  customerUuid: string | null;
  onClose: () => void;
  footer?: (customer: Customer) => React.ReactNode;
}

export const CustomerDetailDrawer: React.FC<CustomerDetailDrawerProps> = ({
  open,
  customerUuid,
  onClose,
  footer,
}) => {
  const { t } = useTranslation();
  const [customerDetail, setCustomerDetail] = useState<Customer | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [dictLabelMaps, setDictLabelMaps] = useState<Record<string, Record<string, string>>>(() => {
    const seed: Record<string, Record<string, string>> = {};
    DICT_CODES.forEach((code) => {
      const map = getDictionaryLabelMapSync(code);
      if (map) seed[code] = map;
    });
    return seed;
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const packs = await Promise.all(DICT_CODES.map((code) => getDictionaryOptions(code)));
        if (cancelled) return;
        const maps: Record<string, Record<string, string>> = {};
        DICT_CODES.forEach((code, index) => {
          maps[code] = Object.fromEntries(packs[index].map((option) => [option.value, option.label]));
        });
        setDictLabelMaps(maps);
      } catch {
        if (!cancelled) setDictLabelMaps({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dictLabel = useCallback(
    (dictCode: string, value?: string) =>
      resolveDictionaryDisplayLabel(dictLabelMaps[dictCode], value),
    [dictLabelMaps],
  );

  const loadDetail = useCallback(
    async (uuid: string) => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const detail = await customerApi.get(uuid);
        setCustomerDetail(detail);
      } catch (error) {
        setCustomerDetail(null);
        setDetailError(getApiErrorMessage(error, t('app.master-data.customers.getDetailFailed')));
      } finally {
        setDetailLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (!open) {
      setCustomerDetail(null);
      setDetailLoading(false);
      setDetailError(null);
      return;
    }
    if (!customerUuid) return;
    setCustomerDetail(null);
    setDetailError(null);
    void loadDetail(customerUuid);
  }, [customerUuid, loadDetail, open]);

  const detailColumnsBasic: ProDescriptionsItemProps<Customer>[] = useMemo(
    () => [
      { title: t('field.customer.code'), dataIndex: 'code', copyable: true },
      { title: t('field.customer.name'), dataIndex: 'name' },
      { title: t('field.customer.shortName'), dataIndex: 'shortName' },
      {
        title: t('field.customer.category'),
        dataIndex: 'category',
        render: (_, record) => dictLabel('CUSTOMER_CATEGORY', record.category),
      },
      { title: t('field.customer.contactPerson'), dataIndex: 'contactPerson' },
      {
        title: t('field.customer.contactTitle'),
        dataIndex: 'contactTitle',
        render: (_, record) => dictLabel('CONTACT_TITLE', record.contactTitle),
      },
      { title: t('field.customer.phone'), dataIndex: 'phone' },
      { title: t('field.customer.email'), dataIndex: 'email' },
      { title: t('field.customer.salesman'), dataIndex: 'salesmanName' },
      {
        title: t('field.customer.poolStatus'),
        dataIndex: 'poolStatus',
        render: (_, record) =>
          record.poolStatus === 'owned'
            ? t('field.customer.poolStatusOwned')
            : record.poolStatus === 'pool'
              ? t('field.customer.poolStatusPool')
              : '—',
      },
      {
        title: t('field.customer.recycleAt'),
        dataIndex: 'recycleAt',
        valueType: 'dateTime',
      },
      {
        title: t('field.customer.assignedAt'),
        dataIndex: 'assignedAt',
        valueType: 'dateTime',
      },
      {
        title: t('field.customer.lastFollowUpAt'),
        dataIndex: 'lastFollowUpAt',
        valueType: 'dateTime',
      },
      {
        title: t('app.master-data.warehouses.status'),
        dataIndex: 'isActive',
        render: (_, record) =>
          renderMasterActiveTag(
            t,
            record?.isActive ?? (record as Customer & { is_active?: boolean })?.is_active,
            'common.enabled',
            'common.disabled',
          ),
      },
    ],
    [dictLabel, t],
  );

  const detailColumnsInvoice: ProDescriptionsItemProps<Customer>[] = useMemo(
    () => [
      { title: t('field.partner.taxRegistrationNo'), dataIndex: 'taxRegistrationNo' },
      { title: t('field.partner.invoiceTitle'), dataIndex: 'invoiceTitle' },
      { title: t('field.partner.invoiceAddress'), dataIndex: 'invoiceAddress', span: 2 },
      { title: t('field.partner.invoicePhone'), dataIndex: 'invoicePhone' },
      { title: t('field.partner.invoiceBankName'), dataIndex: 'invoiceBankName' },
      { title: t('field.partner.invoiceBankAccount'), dataIndex: 'invoiceBankAccount' },
      {
        title: t('field.partner.invoiceType'),
        dataIndex: 'invoiceTypeCode',
        render: (_, record) => partnerInvoiceTypeLabel(t, record.invoiceTypeCode),
      },
      {
        title: t('field.partner.taxpayerType'),
        dataIndex: 'taxpayerTypeCode',
        render: (_, record) => partnerTaxpayerTypeLabel(t, record.taxpayerTypeCode),
      },
    ],
    [t],
  );

  const detailColumnsExtended: ProDescriptionsItemProps<Customer>[] = useMemo(
    () => [
      {
        title: t('field.customer.revenueRecognitionOverride'),
        dataIndex: 'revenueRecognitionOverride',
        render: (_, record) => partnerRevenueRecognitionOverrideLabel(t, record.revenueRecognitionOverride),
      },
      {
        title: t('field.customer.industry'),
        dataIndex: 'industryCode',
        render: (_, record) => dictLabel('INDUSTRY_SECTOR', record.industryCode),
      },
      {
        title: t('field.customer.level'),
        dataIndex: 'customerLevelCode',
        render: (_, record) => dictLabel('CUSTOMER_LEVEL', record.customerLevelCode),
      },
      {
        title: t('field.customer.leadSource'),
        dataIndex: 'leadSourceCode',
        render: (_, record) => dictLabel('PARTNER_SOURCE_CHANNEL', record.leadSourceCode),
      },
      {
        title: t('field.customer.estimatedAnnualPurchase'),
        dataIndex: 'estimatedAnnualPurchase',
        render: (_, record) =>
          record.estimatedAnnualPurchase != null && record.estimatedAnnualPurchase !== ''
            ? Number(record.estimatedAnnualPurchase).toLocaleString()
            : '—',
      },
      {
        title: t('field.customer.creditLimit'),
        dataIndex: 'creditLimit',
        render: (_, record) =>
          record.creditLimit != null && record.creditLimit !== ''
            ? Number(record.creditLimit).toLocaleString()
            : '—',
      },
      { title: t('field.partner.legalRepresentative'), dataIndex: 'legalRepresentative' },
      {
        title: t('field.partner.enterpriseType'),
        dataIndex: 'enterpriseTypeCode',
        render: (_, record) => partnerEnterpriseTypeLabel(t, record.enterpriseTypeCode),
      },
      {
        title: t('field.partner.paymentTermsDays'),
        dataIndex: 'paymentTermsDays',
        render: (_, record) =>
          record.paymentTermsDays != null && record.paymentTermsDays !== ''
            ? String(record.paymentTermsDays)
            : '—',
      },
      {
        title: t('field.partner.settlementMethod'),
        dataIndex: 'settlementMethodCode',
        render: (_, record) => partnerSettlementMethodLabel(t, record.settlementMethodCode),
      },
      { title: t('field.partner.deliveryContactName'), dataIndex: 'deliveryContactName' },
      { title: t('field.partner.deliveryContactPhone'), dataIndex: 'deliveryContactPhone' },
      { title: t('field.partner.deliveryAddress'), dataIndex: 'deliveryAddress', span: 2 },
      { title: t('app.master-data.warehouses.createTime'), dataIndex: 'createdAt', valueType: 'dateTime' },
      { title: t('app.master-data.warehouses.updateTime'), dataIndex: 'updatedAt', valueType: 'dateTime' },
    ],
    [dictLabel, t],
  );

  return (
    <PartnerMasterDetailDrawer
      title={t('app.master-data.customers.detailTitle')}
      open={open}
      onClose={onClose}
      loading={detailLoading}
      error={detailError}
      onRetry={() => {
        if (customerUuid) void loadDetail(customerUuid);
      }}
    >
      {customerDetail ? (
        <>
          <DetailDrawerSection title={t('field.partner.tabBasic')}>
            <Descriptions
              column={2}
              size="small"
              items={detailDrawerDescriptionItems(
                alignDescriptionColumns(detailColumnsBasic, MASTER_DATA_DETAIL_BASIC_FIELD_RANK),
                customerDetail,
              )}
            />
          </DetailDrawerSection>
          <DetailDrawerSection title={t('field.partner.tabInvoice')}>
            <Descriptions
              column={2}
              size="small"
              items={detailDrawerDescriptionItems(
                alignDescriptionColumns(detailColumnsInvoice, MASTER_DATA_DETAIL_BASIC_FIELD_RANK),
                customerDetail,
              )}
            />
          </DetailDrawerSection>
          <DetailDrawerSection title={t('field.partner.tabExtended')}>
            <Descriptions
              column={2}
              size="small"
              items={detailDrawerDescriptionItems(
                alignDescriptionColumns(detailColumnsExtended, MASTER_DATA_DETAIL_BASIC_FIELD_RANK),
                customerDetail,
              )}
            />
          </DetailDrawerSection>
          {footer ? (
            <DetailDrawerSection title={t('app.kuaizhizao.customerFollowUp.new')} marginBottom={0}>
              {footer(customerDetail)}
            </DetailDrawerSection>
          ) : null}
        </>
      ) : null}
    </PartnerMasterDetailDrawer>
  );
};
