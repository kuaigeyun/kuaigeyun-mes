import React, { useMemo, useState } from 'react';
import { Space } from 'antd';
import { PartitionOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { MultiTabListPageTemplate } from '../../../../../components/layout-templates';
import { OutsourceOrdersTable } from '../outsource-orders';
import { OutsourceWorkOrdersTable } from '../outsource-work-orders';

const OutsourceManagementPage: React.FC = () => {
    const { t } = useTranslation();
    const [activeTabKey, setActiveTabKey] = useState<string>('whole');

    const tabs = useMemo(
        () => [
            {
                key: 'whole',
                label: (
                    <Space>
                        <UnorderedListOutlined />
                        <span>{t('app.kuaizhizao.outsourceWorkOrder.title')}</span>
                    </Space>
                ),
                children: <OutsourceWorkOrdersTable />,
            },
            {
                key: 'process',
                label: (
                    <Space>
                        <PartitionOutlined />
                        <span>{t('app.kuaizhizao.outsourceOrder.title')}</span>
                    </Space>
                ),
                children: <OutsourceOrdersTable />,
            },
        ],
        [t],
    );

    return (
        <MultiTabListPageTemplate
            activeTabKey={activeTabKey}
            onTabChange={setActiveTabKey}
            tabs={tabs}
        />
    );
};

export default OutsourceManagementPage;
