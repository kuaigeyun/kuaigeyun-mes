import React from 'react';
import MiscVoucherListPage from '../shared/MiscVoucherListPage';
import { OTHER_EXPENSE_RESOURCE, otherExpenseService } from '../../../services/finance/other-expense';
import { KUAIZHIZAO_DOC_HOST } from '../../../../../utils/documentFormReferenceLoad';

const OtherExpensesPage: React.FC = () => (
  <MiscVoucherListPage
    kind="expense"
    auditEntityType="other_expense"
    resource={OTHER_EXPENSE_RESOURCE}
    hostResource={KUAIZHIZAO_DOC_HOST.otherExpense}
    menuTitleKey="app.kuaicaiwu.menu.finance-management.other-expenses"
    i18nPrefix="app.kuaicaiwu.otherExpense"
    columnPersistenceId="apps.kuaizhizao.pages.finance-management.other-expenses.list-v1"
    service={otherExpenseService}
  />
);

export default OtherExpensesPage;
