import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MultiTabListPageTemplate } from '../../../../../components/layout-templates';
import { assemblyOrderApi } from '../../../services/assembly-order';
import { getAssemblyOrderLifecycle } from '../../../utils/assemblyOrderLifecycle';
import { AssemblyDisassemblyOrdersPage } from '../shared/assemblyDisassemblyOrdersPage';
import { AssemblyTemplatesTab } from '../assembly-templates/AssemblyTemplatesTab';

const AssemblyOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTabKey, setActiveTabKey] = useState('orders');

  return (
    <MultiTabListPageTemplate
      activeTabKey={activeTabKey}
      onTabChange={setActiveTabKey}
      preserveMounted
      tabs={[
        {
          key: 'orders',
          label: t('app.kuaizhizao.menu.warehouse-management.assembly-orders'),
          children: (
            <AssemblyDisassemblyOrdersPage
              api={assemblyOrderApi}
              config={{
                headerTitle: '组装单',
                persistenceId: 'apps.kuaizhizao.pages.warehouse-management.assembly-orders',
                createButtonText: '新建组装单',
                createModalTitle: '新建组装单',
                detailTitlePrefix: '组装单详情',
                dateField: 'assembly_date',
                dateLabel: '组装日期',
                actionNoun: '组装单',
                executeActionLabel: '执行组装',
                createSuccessText: '组装单创建成功',
                addItemSuccessText: '组装明细添加成功',
                executeSuccessText: '组装执行成功',
                deleteSuccessNoun: '组装单',
                quantityLabel: '组装数量',
                listEmptyText: '暂无组装单数据。',
                itemDoneStatus: 'consumed',
                attachmentCategory: 'assembly_order_attachments',
                getLifecycle: getAssemblyOrderLifecycle,
                enableTemplateApply: true,
              }}
            />
          ),
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
