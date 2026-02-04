import React from 'react';

export type DecorationType = 'decoration' | 'border';

interface DecorationWidgetProps {
    type: DecorationType;
    index: number;
    children?: React.ReactNode;
    config?: any;
}

const DecorationWidget: React.FC<DecorationWidgetProps> = ({ type, index, children, config = {} }) => {
    const style = { width: '100%', height: '100%', ...config?.style };

    if (type === 'decoration') {
        switch (index) {
            case 1: return <Decoration1 style={style} />;
            case 2: return <Decoration2 style={style} />;
            case 9: return <Decoration9 style={style} />;
            default: return <Decoration1 style={style} />;
        }
    } else {
        // Border
        switch (index) {
            case 1: return <BorderBox1 style={style}>{children}</BorderBox1>;
            case 2: return <BorderBox2 style={style}>{children}</BorderBox2>;
            case 3: return <BorderBox3 style={style}>{children}</BorderBox3>;
            default: return <BorderBox1 style={style}>{children}</BorderBox1>;
        }
    }
};

// --- Custom SVG Implementations ---

const BorderBox1: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode }> = ({ style, children }) => (
    <div style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, zIndex: 0 }}>
            <path d="M 10 5 L 99% 5" stroke="#1d355e" strokeWidth="2" fill="none" />
            <path d="M 10 99% L 99% 99%" stroke="#1d355e" strokeWidth="2" fill="none" />
            <path d="M 5 10 L 5 99%" stroke="#1d355e" strokeWidth="2" fill="none" />
            <path d="M 99% 10 L 99% 99%" stroke="#1d355e" strokeWidth="2" fill="none" />

            <path d="M 0 10 L 0 0 L 10 0" stroke="#00f2ff" strokeWidth="2" fill="none" />
            <path d="M 100% 10 L 100% 0 L 90% 0" stroke="#00f2ff" strokeWidth="2" fill="none" />
            <path d="M 0 90% L 0 100% L 10 100%" stroke="#00f2ff" strokeWidth="2" fill="none" />
            <path d="M 100% 90% L 100% 100% L 90% 100%" stroke="#00f2ff" strokeWidth="2" fill="none" />
        </svg>
        <div style={{ position: 'relative', padding: '15px', height: '100%', zIndex: 1 }}>{children}</div>
    </div>
);

const BorderBox2: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode }> = ({ style, children }) => (
    <div style={{ position: 'relative', width: '100%', height: '100%', border: '1px solid rgba(0, 120, 215, 0.3)', background: 'rgba(0, 50, 100, 0.1)', ...style }}>
        <div style={{ position: 'absolute', top: '-1px', left: '-1px', width: '10px', height: '10px', borderTop: '2px solid #00f2ff', borderLeft: '2px solid #00f2ff' }} />
        <div style={{ position: 'absolute', top: '-1px', right: '-1px', width: '10px', height: '10px', borderTop: '2px solid #00f2ff', borderRight: '2px solid #00f2ff' }} />
        <div style={{ position: 'absolute', bottom: '-1px', left: '-1px', width: '10px', height: '10px', borderBottom: '2px solid #00f2ff', borderLeft: '2px solid #00f2ff' }} />
        <div style={{ position: 'absolute', bottom: '-1px', right: '-1px', width: '10px', height: '10px', borderBottom: '2px solid #00f2ff', borderRight: '2px solid #00f2ff' }} />
        <div style={{ padding: '10px', height: '100%' }}>{children}</div>
    </div>
);

const BorderBox3: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode }> = ({ style, children }) => (
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '6px', border: '2px solid transparent', backgroundImage: 'linear-gradient(#050a0f, #050a0f), linear-gradient(to right, #00f2ff, #1890ff)', backgroundOrigin: 'border-box', backgroundClip: 'content-box, border-box', ...style }}>
        <div style={{ padding: '10px', height: '100%' }}>{children}</div>
    </div>
);

const Decoration1: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
    <div style={{ width: '100%', height: '100%', minHeight: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
        <svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 200 30">
            <polyline points="0,15 50,15 60,5 140,5 150,15 200,15" fill="none" stroke="#1890ff" strokeWidth="2" />
            <rect x="90" y="10" width="20" height="10" fill="#00f2ff" opacity="0.5">
                <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
            </rect>
        </svg>
    </div>
);

const Decoration2: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
    <div style={{ width: '100%', height: '100%', minHeight: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', ...style }}>
        <div style={{ width: '40%', height: '2px', background: 'linear-gradient(to right, transparent, #1890ff)' }} />
        <div style={{ width: '10px', height: '10px', transform: 'rotate(45deg)', background: '#00f2ff' }} />
        <div style={{ width: '40%', height: '2px', background: 'linear-gradient(to left, transparent, #1890ff)' }} />
    </div>
);

const Decoration9: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', ...style }}>
        <div style={{
            width: '100px', height: '100px',
            border: '2px solid rgba(0,242,255,0.3)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 10px rgba(0,242,255,0.2)'
        }}>
            <div style={{ width: '60px', height: '60px', background: 'radial-gradient(rgba(0,242,255,0.5), transparent)', borderRadius: '50%' }} />
        </div>
    </div>
);

export default DecorationWidget;
