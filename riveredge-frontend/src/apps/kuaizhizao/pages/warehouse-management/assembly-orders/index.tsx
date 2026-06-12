import React from 'react';
import { assemblyOrderApi } from '../../../services/assembly-order';
import { getAssemblyOrderLifecycle } from '../../../utils/assemblyOrderLifecycle';
import { AssemblyDisassemblyOrdersPage } from '../shared/assemblyDisassemblyOrdersPage';

const AssemblyOrdersPage: React.FC = () => {
  return (
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
        getLifecycle: getAssemblyOrderLifecycle,
      }}
    />
  );
};

export default AssemblyOrdersPage;
