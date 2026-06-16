/**
 * 出库取单录入页 — 共享表单项与出库人选择
 */

export {
  readOnlyFieldProps,
  ReadOnlyFormValue,
  mapWarehouseSelectOptions,
  type WarehouseSelectOption,
  useInboundReceiverSelect as useOutboundOperatorSelect,
  InboundEntryAttachmentsSection as OutboundEntryAttachmentsSection,
} from '../inbound/inboundEntryShared';

import {
  InboundEntryReceiverField,
  InboundEntryRemarksSection,
  useInboundReceiverSelect,
} from '../inbound/inboundEntryShared';
import { useTranslation } from 'react-i18next';

type OutboundEntryOperatorFieldProps = {
  label?: string;
  hook: ReturnType<typeof useInboundReceiverSelect>;
};

export function OutboundEntryOperatorField({ label, hook }: OutboundEntryOperatorFieldProps) {
  const { t } = useTranslation();
  return <InboundEntryReceiverField label={label ?? t('app.kuaizhizao.warehouseOutbound.field.operator')} hook={hook} />;
}

type OutboundEntryRemarksSectionProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
};

export function OutboundEntryRemarksSection({
  value,
  onChange,
  label,
  placeholder,
}: OutboundEntryRemarksSectionProps) {
  const { t } = useTranslation();
  return (
    <InboundEntryRemarksSection
      value={value}
      onChange={onChange}
      label={label ?? t('app.kuaizhizao.warehouseOutbound.field.remarks')}
      placeholder={placeholder ?? t('app.kuaizhizao.warehouseOutbound.field.remarksPlaceholder')}
    />
  );
}
