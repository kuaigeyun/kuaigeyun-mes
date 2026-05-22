import React, { useState } from 'react';
import { Space } from 'antd';
import { PartitionOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { MultiTabListPageTemplate } from '../../../../../components/layout-templates';
import { OutsourceOrdersTable } from '../outsource-orders';
import { OutsourceWorkOrdersTable } from '../outsource-work-orders';

const OutsourceManagementPage: React.FC = () => {
    const [activeTabKey, setActiveTabKey] = useState<string>('whole');

    const tabs = [
        {
            key: 'whole',
            label: (<Space><UnorderedListOutlined /><span>工单委外</span></Space>),
            children: <OutsourceWorkOrdersTable />,
        },
        {
            key: 'process',
            label: (<Space><PartitionOutlined /><span>工序委外</span></Space>),
            children: <OutsourceOrdersTable />,
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
