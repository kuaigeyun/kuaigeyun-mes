import FinanceRefundVoucherPage from '../shared/FinanceRefundVoucherPage';

export default function PaymentRefundsPage() {
  return (
    <FinanceRefundVoucherPage
      mode="payment-refund"
      columnPersistenceId="apps.kuaicaiwu.pages.finance-management.payment-refunds.list-v3"
    />
  );
}
