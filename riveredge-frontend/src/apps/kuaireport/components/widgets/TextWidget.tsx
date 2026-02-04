import React from 'react';
import { Typography } from 'antd';

const { Title } = Typography;

interface TextWidgetProps {
    type: 'title' | 'marquee';
    content: string;
    style?: React.CSSProperties;
    config?: any;
    props?: any;
}

const TextWidget: React.FC<TextWidgetProps> = ({ type, content, style, config = {}, props = {} }) => {
    const blurStyle = props.blur ? { backdropFilter: `blur(${props.blur}px)`, background: 'rgba(255,255,255,0.05)' } : {};
    const mainColor = props.color || config.color || '#fff';
    switch (type) {
        case 'title':
            return (
                <div style={{ ...blurStyle }}>
                    <Title
                        level={config.level || 4}
                        style={{
                            margin: 0,
                            color: mainColor,
                            textAlign: config.align || 'center',
                            ...style
                        }}
                    >
                        {content}
                    </Title>
                </div>
            );
        case 'marquee':
            return (
                <div style={{
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    width: '100%',
                    color: mainColor,
                    ...blurStyle,
                    ...style
                }}>
                    <div style={{
                        display: 'inline-block',
                        paddingLeft: '100%',
                        animation: `marquee ${config.speed || 10}s linear infinite`,
                        fontSize: config.fontSize || '16px'
                    }}>
                        {content}
                    </div>
                </div>
            );
        default:
            return null;
    }
};

export default TextWidget;
