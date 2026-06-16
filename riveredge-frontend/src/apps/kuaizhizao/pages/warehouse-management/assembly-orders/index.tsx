import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MultiTabListPageTemplate } from '../../../../../components/layout-templates';
import { assemblyOrderApi } from '../../../services/assembly-order';
import { getAssemblyOrderLifecycle } from '../../../utils/assemblyOrderLifecycle';
import { AssemblyDisassemblyOrdersPage } from '../shared/assemblyDisassemblyOrdersPage';
import { AssemblyTemplatesTab } from '../assembly-templates/AssemblyTemplatesTab';

const AssemblyOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTabKey, setActiveTabKey] = useState('orders');

  const assemblyConfig = useMemo(
    () => ({
      headerTitle: t('app.kuaizhizao.assemblyOrder.headerTitle'),
      persistenceId: 'apps.kuaizhizao.pages.warehouse-management.assembly-orders',
      createButtonText: t('app.kuaizhizao.assemblyOrder.createButton'),
      createModalTitle: t('app.kuaizhizao.assemblyOrder.createModalTitle'),
      detailTitlePrefix: t('app.kuaizhizao.assemblyOrder.detailTitlePrefix'),
      dateField: 'assembly_date',
      dateLabel: t('app.kuaizhizao.assemblyOrder.dateLabel'),
      actionNoun: t('app.kuaizhizao.assemblyOrder.actionNoun'),
      executeActionLabel: t('app.kuaizhizao.assemblyOrder.executeAction'),
      createSuccessText: t('app.kuaizhizao.assemblyOrder.createSuccess'),
      addItemSuccessText: t('app.kuaizhizao.assemblyOrder.addItemSuccess'),
      executeSuccessText: t('app.kuaizhizao.assemblyOrder.executeSuccess'),
      deleteSuccessNoun: t('app.kuaizhizao.assemblyOrder.deleteSuccessNoun'),
      quantityLabel: t('app.kuaizhizao.assemblyOrder.quantityLabel'),
      listEmptyText: t('app.kuaizhizao.assemblyOrder.listEmpty'),
      orderCodeLabel: t('app.kuaizhizao.assemblyOrder.orderCode'),
      itemDoneStatus: 'consumed',
      attachmentCategory: 'assembly_order_attachments',
      getLifecycle: getAssemblyOrderLifecycle,
      enableTemplateApply: true,
    }),
    [t],
  );

  return (
    <MultiTabListPageTemplate
      activeTabKey={activeTabKey}
      onTabChange={setActiveTabKey}
      preserveMounted
      tabs={[
        {
          key: 'orders',
          label: t('app.kuaizhizao.menu.warehouse-management.assembly-orders'),
          children: <AssemblyDisassemblyOrdersPage api={assemblyOrderApi} config={assemblyConfig} />,
        },
        {
          key: 'templates',
          label: t('app.kuaizhizao.menu.warehouse-management.assembly-templates'),
          children: <AssemblyTemplatesTab />,
        },
      ]}
    />
  );
};

export default AssemblyOrdersPage;
