import type { SyncTargetField } from '../../../../../components/sync-from-source-modal/types';

export const CUSTOMER_SYNC_TARGET_FIELDS: SyncTargetField[] = [
  { value: 'code', labelKey: 'app.master-data.customers.syncField.code', required: true },
  { value: 'name', labelKey: 'app.master-data.customers.syncField.name', required: true },
  { value: 'short_name', labelKey: 'app.master-data.customers.syncField.shortName' },
  { value: 'contact_person', labelKey: 'app.master-data.customers.syncField.contactPerson' },
  { value: 'phone', labelKey: 'app.master-data.customers.syncField.phone' },
  { value: 'email', labelKey: 'app.master-data.customers.syncField.email' },
  { value: 'address', labelKey: 'app.master-data.customers.syncField.address' },
];

export const CUSTOMER_SYNC_AVAILABLE_TARGET_FIELDS: SyncTargetField[] = [
  { value: 'category', labelKey: 'app.master-data.customers.syncField.category' },
  { value: 'contact_title', labelKey: 'app.master-data.customers.syncField.contactTitle' },
  { value: 'industry_code', labelKey: 'app.master-data.customers.syncField.industryCode' },
  { value: 'customer_level_code', labelKey: 'app.master-data.customers.syncField.customerLevelCode' },
  { value: 'estimated_annual_purchase', labelKey: 'app.master-data.customers.syncField.estimatedAnnualPurchase' },
  { value: 'lead_source_code', labelKey: 'app.master-data.customers.syncField.leadSourceCode' },
  { value: 'credit_limit', labelKey: 'app.master-data.customers.syncField.creditLimit' },
  { value: 'tax_registration_no', labelKey: 'app.master-data.customers.syncField.taxRegistrationNo' },
  { value: 'invoice_title', labelKey: 'app.master-data.customers.syncField.invoiceTitle' },
  { value: 'invoice_address', labelKey: 'app.master-data.customers.syncField.invoiceAddress' },
  { value: 'invoice_phone', labelKey: 'app.master-data.customers.syncField.invoicePhone' },
  { value: 'invoice_bank_name', labelKey: 'app.master-data.customers.syncField.invoiceBankName' },
  { value: 'invoice_bank_account', labelKey: 'app.master-data.customers.syncField.invoiceBankAccount' },
  { value: 'legal_representative', labelKey: 'app.master-data.customers.syncField.legalRepresentative' },
  { value: 'payment_terms_days', labelKey: 'app.master-data.customers.syncField.paymentTermsDays' },
  { value: 'settlement_method_code', labelKey: 'app.master-data.customers.syncField.settlementMethodCode' },
  { value: 'finance_contact_name', labelKey: 'app.master-data.customers.syncField.financeContactName' },
  { value: 'finance_contact_phone', labelKey: 'app.master-data.customers.syncField.financeContactPhone' },
  { value: 'delivery_contact_name', labelKey: 'app.master-data.customers.syncField.deliveryContactName' },
  { value: 'delivery_contact_phone', labelKey: 'app.master-data.customers.syncField.deliveryContactPhone' },
  { value: 'delivery_address', labelKey: 'app.master-data.customers.syncField.deliveryAddress' },
  { value: 'salesman_name', labelKey: 'app.master-data.customers.syncField.salesmanName' },
  { value: 'is_active', labelKey: 'app.master-data.customers.syncField.isActive' },
];

export const CUSTOMER_SYNC_REQUIRED_TARGETS = ['code', 'name'];
export const CUSTOMER_SYNC_CUSTOM_FIELD_TABLE = 'master_data_customers';
