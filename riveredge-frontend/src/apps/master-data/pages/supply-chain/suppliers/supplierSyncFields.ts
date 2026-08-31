import type { SyncTargetField } from '../../../../../components/sync-from-source-modal/types';

export const SUPPLIER_SYNC_TARGET_FIELDS: SyncTargetField[] = [
  { value: 'code', labelKey: 'app.master-data.suppliers.syncField.code', required: true },
  { value: 'name', labelKey: 'app.master-data.suppliers.syncField.name', required: true },
  { value: 'short_name', labelKey: 'app.master-data.suppliers.syncField.shortName' },
];

export const SUPPLIER_SYNC_AVAILABLE_TARGET_FIELDS: SyncTargetField[] = [
  { value: 'contact_person', labelKey: 'app.master-data.suppliers.syncField.contactPerson' },
  { value: 'phone', labelKey: 'app.master-data.suppliers.syncField.phone' },
  { value: 'email', labelKey: 'app.master-data.suppliers.syncField.email' },
  { value: 'address', labelKey: 'app.master-data.suppliers.syncField.address' },
  { value: 'category', labelKey: 'app.master-data.suppliers.syncField.category' },
  { value: 'contact_title', labelKey: 'app.master-data.suppliers.syncField.contactTitle' },
  { value: 'industry_code', labelKey: 'app.master-data.suppliers.syncField.industryCode' },
  { value: 'estimated_annual_purchase', labelKey: 'app.master-data.suppliers.syncField.estimatedAnnualPurchase' },
  { value: 'source_channel_code', labelKey: 'app.master-data.suppliers.syncField.sourceChannelCode' },
  { value: 'credit_limit', labelKey: 'app.master-data.suppliers.syncField.creditLimit' },
  { value: 'tax_registration_no', labelKey: 'app.master-data.suppliers.syncField.taxRegistrationNo' },
  { value: 'invoice_title', labelKey: 'app.master-data.suppliers.syncField.invoiceTitle' },
  { value: 'invoice_address', labelKey: 'app.master-data.suppliers.syncField.invoiceAddress' },
  { value: 'invoice_phone', labelKey: 'app.master-data.suppliers.syncField.invoicePhone' },
  { value: 'invoice_bank_name', labelKey: 'app.master-data.suppliers.syncField.invoiceBankName' },
  { value: 'invoice_bank_account', labelKey: 'app.master-data.suppliers.syncField.invoiceBankAccount' },
  { value: 'legal_representative', labelKey: 'app.master-data.suppliers.syncField.legalRepresentative' },
  { value: 'payment_terms_days', labelKey: 'app.master-data.suppliers.syncField.paymentTermsDays' },
  { value: 'settlement_method_code', labelKey: 'app.master-data.suppliers.syncField.settlementMethodCode' },
  { value: 'buyer_name', labelKey: 'app.master-data.suppliers.syncField.buyerName' },
  { value: 'is_active', labelKey: 'app.master-data.suppliers.syncField.isActive' },
];

export const SUPPLIER_SYNC_REQUIRED_TARGETS = ['code', 'name'];
export const SUPPLIER_SYNC_CUSTOM_FIELD_TABLE = 'master_data_suppliers';
