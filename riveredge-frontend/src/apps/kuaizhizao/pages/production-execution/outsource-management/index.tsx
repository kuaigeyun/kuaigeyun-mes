import React, { useState } from 'react';
import { PageContainer, ProCard } from '@ant-design/pro-components';
import { OutsourceOrdersTable } from '../outsource-orders';
import { OutsourceWorkOrdersTable } from '../outsource-work-orders';

const OutsourceManagementPage: React.FC = () => {
    const [activeTabKey, setActiveTabKey] = useState<string>('process');

    return (
        <PageContainer
            header={{
                title: '委外管理',
                breadcrumb: {},
            }}
        >
            <ProCard
                tabs={{
                    type: 'card',
                    activeKey: activeTabKey,
                    onChange: setActiveTabKey,
                    items: [
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
                    ],
                }}
            />
        </PageContainer>
    );
};

export default OutsourceManagementPage;
