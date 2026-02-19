import React from 'react';
import { Typography } from 'antd';
import { Gauge, Liquid } from '@ant-design/charts';
import { motion } from 'framer-motion';

const { Text } = Typography;

interface IndicatorWidgetProps {
    type: 'number' | 'flop' | 'gauge' | 'water';
    title?: string;
    value: number;
    unit?: string;
    config?: any;
    props?: any; // Styling props
}

/** 将 value 规范为 0-1 的百分比，用于 Gauge/Liquid */
function toPercent(value: number, max?: number): number {
    if (max != null && max > 0) return Math.min(1, Math.max(0, value / max));
    if (value <= 1 && value >= 0) return value;
    return Math.min(1, Math.max(0, value / 100)); // 默认按 0-100 解释
}

const IndicatorWidget: React.FC<IndicatorWidgetProps> = ({ type, title, value, unit, config = {}, props = {} }) => {
    const mainColor = props.color || '#00f2ff';
    const blurStyle = props.blur ? { backdropFilter: `blur(${props.blur}px)`, background: 'rgba(255,255,255,0.05)' } : {};

    switch (type) {
        case 'number':
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', ...blurStyle }}>
                    {title && <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>{title}</Text>}
                    <div style={{ display: 'flex', alignItems: 'baseline' }}>
                        <Text style={{ fontSize: '32px', fontWeight: 'bold', color: mainColor }}>{value.toLocaleString()}</Text>
                        {unit && <Text style={{ color: 'rgba(255,255,255,0.7)', marginLeft: '4px' }}>{unit}</Text>}
                    </div>
                </div>
            );
        case 'flop':
            return (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', ...blurStyle }}>
                    {title && <Text style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>{title}</Text>}
                    <motion.div
                        key={value}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ fontSize: 32, fontWeight: 'bold', color: mainColor }}
                    >
                        {value.toLocaleString()}{unit ?? ''}
                    </motion.div>
                </div>
            );
        case 'gauge': {
            const percent = toPercent(value, config.max);
            return (
                <div style={{ height: '100%', position: 'relative', ...blurStyle }}>
                    {title && (
                        <div style={{ color: 'rgba(255,255,255,0.7)', position: 'absolute', top: 0, left: 0, width: '100%', textAlign: 'center', zIndex: 1 }}>
                            {title}
                        </div>
                    )}
                    <div style={{ width: '100%', height: '100%', paddingTop: title ? 24 : 0 }}>
                        <Gauge
                            percent={percent}
                            range={{ color: mainColor }}
                            indicator={{ pointer: { style: { stroke: mainColor } }, pin: { style: { stroke: mainColor } } }}
                            axis={{ label: { formatter: (v: string) => `${(Number(v) * 100).toFixed(0)}%` }, subTickLine: { count: 3 } }}
                            statistic={{ content: { style: { fontSize: '20px', color: mainColor } } }}
                            theme="dark"
                        />
                    </div>
                </div>
            );
        }
        case 'water': {
            const percent = toPercent(value, config.max);
            return (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', ...blurStyle }}>
                    {title && <Text style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>{title}</Text>}
                    <div style={{ width: '80%', height: '80%', minHeight: 120 }}>
                        <Liquid percent={percent} />
                    </div>
                </div>
            );
        }
        default:
            return null;
    }
};

export default IndicatorWidget;
