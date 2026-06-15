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

type OutboundEntryOperatorFieldProps = {
  label?: string;
  hook: ReturnType<typeof useInboundReceiverSelect>;
};

export function OutboundEntryOperatorField({ label = '出库人', hook }: OutboundEntryOperatorFieldProps) {
  return <InboundEntryReceiverField label={label} hook={hook} />;
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
  label = '出库备注',
  placeholder = '出库单备注',
}: OutboundEntryRemarksSectionProps) {
  return (
    <InboundEntryRemarksSection
      value={value}
      onChange={onChange}
      label={label}
      placeholder={placeholder}
    />
  );
}
