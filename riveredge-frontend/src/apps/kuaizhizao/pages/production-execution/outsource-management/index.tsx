import React, { useState } from 'react';
import { MultiTabListPageTemplate } from '../../../../../components/layout-templates';
import { OutsourceOrdersTable } from '../outsource-orders';
import { OutsourceWorkOrdersTable } from '../outsource-work-orders';

const OutsourceManagementPage: React.FC = () => {
    const [activeTabKey, setActiveTabKey] = useState<string>('process');

    const tabs = [
        {
            key: 'process',
            label: '工序委外',
            children: <OutsourceOrdersTable />,
        },
        {
            key: 'whole',
            label: '工单委外',
            children: <OutsourceWorkOrdersTable />,
        },
    ];

    return (
        <MultiTabListPageTemplate
            activeTabKey={activeTabKey}
            onTabChange={setActiveTabKey}
            tabs={tabs}
        />
    );
};

export default OutsourceManagementPage;
