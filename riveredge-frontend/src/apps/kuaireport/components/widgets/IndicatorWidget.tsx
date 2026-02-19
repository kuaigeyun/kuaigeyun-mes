import React from 'react';
import { Typography } from 'antd';
// @ts-ignore
import { DigitalFlop, ActiveRingChart, WaterLevelPond } from '@jiaminghi/data-view-react';

const { Text } = Typography;

interface IndicatorWidgetProps {
    type: 'number' | 'flop' | 'gauge' | 'water';
    title?: string;
    value: number;
    unit?: string;
    config?: any;
    props?: any; // Styling props
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
                    <DigitalFlop
                        config={{
                            number: [value],
                            content: `{nt}${unit || ''}`,
                            style: { fontSize: 32, fill: mainColor },
                            ...config
                        }}
                        style={{ height: '50px' }}
                    />
                </div>
            );
        case 'gauge':
            return (
                <div style={{ height: '100%', position: 'relative', ...blurStyle }}>
                    {title && <div style={{ color: 'rgba(255,255,255,0.7)', position: 'absolute', top: 0, left: 0, width: '100%', textAlign: 'center', zIndex: 1 }}>{title}</div>}
                    <ActiveRingChart
                        config={{
                            data: [{ name: title || '指标', value }],
                            lineWidth: 10,
                            radius: '70%',
                            digitalFlopStyle: { fontSize: 20, fill: mainColor },
                            ...config
                        }}
                        style={{ width: '100%', height: '100%' }}
                    />
                </div>
            );
        case 'water' as any:
            return (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', ...blurStyle }}>
                    {title && <Text style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '8px' }}>{title}</Text>}
                    <WaterLevelPond
                        config={{
                            data: [value],
                            shape: 'round',
                            colors: [mainColor, mainColor],
                            ...config
                        }}
                        style={{ width: '80%', height: '80%' }}
                    />
                </div>
            );
        default:
            return null;
    }
};

export default IndicatorWidget;
