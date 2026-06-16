import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { disassemblyOrderApi } from '../../../services/disassembly-order';
import { getDisassemblyOrderLifecycle } from '../../../utils/disassemblyOrderLifecycle';
import { AssemblyDisassemblyOrdersPage } from '../shared/assemblyDisassemblyOrdersPage';

const DisassemblyOrdersPage: React.FC = () => {
  const { t } = useTranslation();

  const disassemblyConfig = useMemo(
    () => ({
      headerTitle: t('app.kuaizhizao.disassemblyOrder.headerTitle'),
      persistenceId: 'apps.kuaizhizao.pages.warehouse-management.disassembly-orders',
      createButtonText: t('app.kuaizhizao.disassemblyOrder.createButton'),
      createModalTitle: t('app.kuaizhizao.disassemblyOrder.createModalTitle'),
      detailTitlePrefix: t('app.kuaizhizao.disassemblyOrder.detailTitlePrefix'),
      dateField: 'disassembly_date',
      dateLabel: t('app.kuaizhizao.disassemblyOrder.dateLabel'),
      actionNoun: t('app.kuaizhizao.disassemblyOrder.actionNoun'),
      executeActionLabel: t('app.kuaizhizao.disassemblyOrder.executeAction'),
      createSuccessText: t('app.kuaizhizao.disassemblyOrder.createSuccess'),
      addItemSuccessText: t('app.kuaizhizao.disassemblyOrder.addItemSuccess'),
      executeSuccessText: t('app.kuaizhizao.disassemblyOrder.executeSuccess'),
      deleteSuccessNoun: t('app.kuaizhizao.disassemblyOrder.deleteSuccessNoun'),
      quantityLabel: t('app.kuaizhizao.disassemblyOrder.quantityLabel'),
      listEmptyText: t('app.kuaizhizao.disassemblyOrder.listEmpty'),
      orderCodeLabel: t('app.kuaizhizao.disassemblyOrder.orderCode'),
      itemDoneStatus: 'produced',
      attachmentCategory: 'disassembly_order_attachments',
      getLifecycle: getDisassemblyOrderLifecycle,
    }),
    [t],
  );

  return <AssemblyDisassemblyOrdersPage api={disassemblyOrderApi} config={disassemblyConfig} />;
};

export default DisassemblyOrdersPage;
