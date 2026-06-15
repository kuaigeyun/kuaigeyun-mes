import React from 'react';
import { disassemblyOrderApi } from '../../../services/disassembly-order';
import { getDisassemblyOrderLifecycle } from '../../../utils/disassemblyOrderLifecycle';
import { AssemblyDisassemblyOrdersPage } from '../shared/assemblyDisassemblyOrdersPage';

const DisassemblyOrdersPage: React.FC = () => {
  return (
    <AssemblyDisassemblyOrdersPage
      api={disassemblyOrderApi}
      config={{
        headerTitle: '拆卸单',
        persistenceId: 'apps.kuaizhizao.pages.warehouse-management.disassembly-orders',
        createButtonText: '新建拆卸单',
        createModalTitle: '新建拆卸单',
        detailTitlePrefix: '拆卸单详情',
        dateField: 'disassembly_date',
        dateLabel: '拆卸日期',
        actionNoun: '拆卸单',
        executeActionLabel: '执行拆卸',
        createSuccessText: '拆卸单创建成功',
        addItemSuccessText: '拆卸明细添加成功',
        executeSuccessText: '拆卸执行成功',
        deleteSuccessNoun: '拆卸单',
        quantityLabel: '拆卸数量',
        listEmptyText: '暂无拆卸单数据。',
        itemDoneStatus: 'produced',
        attachmentCategory: 'disassembly_order_attachments',
        getLifecycle: getDisassemblyOrderLifecycle,
      }}
    />
  );
};

export default DisassemblyOrdersPage;
