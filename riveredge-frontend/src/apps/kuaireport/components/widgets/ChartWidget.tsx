import React from 'react';
import { Line, Column, Pie, Bar, Area, Radar, Scatter, Gauge, Liquid, DualAxes } from '@ant-design/charts';

export type ChartType = 'line' | 'column' | 'pie' | 'bar' | 'area' | 'radar' | 'scatter' | 'gauge' | 'liquid' | 'dualAxes';

interface ChartWidgetProps {
    type: ChartType;
    data: any[];
    config?: any;
}

const ChartWidget: React.FC<ChartWidgetProps> = ({ type, data, config = {} }) => {
    // 基础通用配置
    const commonConfig = {
        data,
        autoFit: true,
        animation: {
            appear: {
                animation: 'scale-in-y',
                duration: 1000,
            },
        },
        theme: 'dark', // 默认使用暗色主题适配看板
        ...config,
    };

    switch (type) {
        case 'line':
            return <Line {...commonConfig} xField={config.xField || 'x'} yField={config.yField || 'y'} />;
        case 'column':
            return <Column {...commonConfig} xField={config.xField || 'x'} yField={config.yField || 'y'} />;
        case 'pie':
            return <Pie {...commonConfig} angleField={config.angleField || 'value'} colorField={config.colorField || 'type'} radius={0.8} />;
        case 'bar':
            return <Bar {...commonConfig} xField={config.xField || 'value'} yField={config.yField || 'type'} />;
        case 'area':
            return <Area {...commonConfig} xField={config.xField || 'x'} yField={config.yField || 'y'} />;
        case 'radar':
            return <Radar {...commonConfig} xField={config.xField || 'item'} yField={config.yField || 'score'} meta={{ score: { min: 0, max: 100 } }} />;
        case 'scatter':
            return <Scatter {...commonConfig} xField={config.xField || 'x'} yField={config.yField || 'y'} colorField={config.colorField || 'type'} />;
        case 'gauge':
            return <Gauge {...commonConfig} percent={config.percent || 0.75} range={{ color: '#30BF78' }} indicator={{ pointer: { style: { stroke: '#D0D0D0' } }, pin: { style: { stroke: '#D0D0D0' } } }} axis={{ label: { formatter: (v: any) => Number(v) * 100 }, subTickLine: { count: 3 } }} statistic={{ content: { style: { fontSize: '24px', lineHeight: '24px', color: '#fff' } } }} />;
        case 'liquid':
            return <Liquid {...commonConfig} percent={config.percent || 0.45} outline={{ border: 4, distance: 8 }} wave={{ length: 128 }} />;
        case 'dualAxes':
            return <DualAxes {...commonConfig} xField={config.xField || 'x'} yField={config.yField || ['y1', 'y2']} />;

        default:
            return <div style={{ color: '#fff', textAlign: 'center', padding: '20px' }}>Unknown Chart Type: {type}</div>;
    }
};

export default ChartWidget;
