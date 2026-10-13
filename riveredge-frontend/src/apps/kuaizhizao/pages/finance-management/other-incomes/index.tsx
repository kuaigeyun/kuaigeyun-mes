import React from 'react';
import MiscVoucherListPage from '../shared/MiscVoucherListPage';
import { OTHER_INCOME_RESOURCE, otherIncomeService } from '../../../services/finance/other-income';
import { KUAIZHIZAO_DOC_HOST } from '../../../../../utils/documentFormReferenceLoad';

const OtherIncomesPage: React.FC = () => (
  <MiscVoucherListPage
    kind="income"
    auditEntityType="other_income"
    resource={OTHER_INCOME_RESOURCE}
    hostResource={KUAIZHIZAO_DOC_HOST.otherIncome}
    menuTitleKey="app.kuaicaiwu.menu.finance-management.other-incomes"
    i18nPrefix="app.kuaicaiwu.otherIncome"
    columnPersistenceId="apps.kuaizhizao.pages.finance-management.other-incomes.list-v1"
    service={otherIncomeService}
  />
);

export default OtherIncomesPage;
