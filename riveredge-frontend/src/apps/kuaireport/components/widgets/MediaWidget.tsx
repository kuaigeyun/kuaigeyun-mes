import React, { useState, useEffect } from 'react';
import { Typography, Table } from 'antd';
import dayjs from 'dayjs';
import { CODE_FONT_FAMILY } from '../../../../constants/fonts';

const { Text } = Typography;

interface MediaWidgetProps {
    type: 'video' | 'clock' | 'table';
    url?: string;
    config?: any;
    data?: any[];
}

const MediaWidget: React.FC<MediaWidgetProps> = ({ type, url, config = {}, data = [] }) => {
    const [now, setNow] = useState(dayjs());

    useEffect(() => {
        if (type === 'clock') {
            const timer = setInterval(() => setNow(dayjs()), 1000);
            return () => clearInterval(timer);
        }
    }, [type]);

    switch (type) {
        case 'video':
            return (
                <div style={{ width: '100%', height: '100%', background: '#000' }}>
                    <video
                        src={url}
                        controls
                        autoPlay
                        loop
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                </div>
            );
        case 'clock':
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#fff' }}>
                    <Text style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>{now.format('YYYY年MM月DD日 星期' + ['日', '一', '二', '三', '四', '五', '六'][now.day()])}</Text>
                    <Text style={{ fontSize: '36px', fontWeight: 'bold', color: '#00f2ff', fontFamily: CODE_FONT_FAMILY }}>{now.format('HH:mm:ss')}</Text>
                </div>
            );
        case 'table':
            return (
                <Table
                    size="small"
                    pagination={false}
                    dataSource={data}
                    columns={config.columns || [
                        { title: '列1', dataIndex: 'col1', key: 'col1' },
                        { title: '列2', dataIndex: 'col2', key: 'col2' }
                    ]}
                    scroll={{ y: '100%' }}
                    style={{ background: 'transparent' }}
                    className="dashboard-table"
                />
            );
        default:
            return null;
    }
};

export default MediaWidget;
