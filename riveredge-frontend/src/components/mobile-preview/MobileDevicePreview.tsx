import React, { useState } from 'react';
import { Modal, Select, Space, Button, Tooltip, Segmented, Popover } from 'antd';
import { MobileOutlined, TabletOutlined, RotateRightOutlined, CloseOutlined, ReloadOutlined, LeftOutlined, ZoomInOutlined } from '@ant-design/icons';

interface DeviceConfig {
    name: string;
    width: number;
    height: number;
    type: 'phone' | 'tablet';
    frameColor?: string;
}

const DEVICES: DeviceConfig[] = [
    { name: 'iPhone SE', width: 375, height: 667, type: 'phone' },
    { name: 'iPhone 14/15', width: 390, height: 844, type: 'phone' },
    { name: 'iPhone 14 Pro Max', width: 430, height: 932, type: 'phone' },
    { name: 'Pixel 7', width: 412, height: 915, type: 'phone' },
    { name: 'iPad Mini', width: 768, height: 1024, type: 'tablet' },
    { name: 'iPad Air', width: 820, height: 1180, type: 'tablet' },
];

export interface MobileDevicePreviewProps {
    open: boolean;
    onClose: () => void;
    url: string;
}

export const MobileDevicePreview: React.FC<MobileDevicePreviewProps> = ({ open, onClose, url }) => {
    const [currentDevice, setCurrentDevice] = useState<DeviceConfig>(DEVICES[1]); // Default to iPhone 14
    const [scaleMode, setScaleMode] = useState<'auto' | number>(0.85); // Default to 85%
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
    const [iframeKey, setIframeKey] = useState(0); // For reloading
    const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });
    const iframeRef = React.useRef<HTMLIFrameElement>(null);

    // Handle Resize
    React.useEffect(() => {
        const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isLandscape = orientation === 'landscape';
    // Swap width/height if landscape
    const displayWidth = isLandscape ? currentDevice.height : currentDevice.width;
    const displayHeight = isLandscape ? currentDevice.width : currentDevice.height;

    // Calculate Auto Scale
    const calculateScale = () => {
        if (typeof scaleMode === 'number') return scaleMode;

        // Available space calculation
        // Modal Header: ~55px
        // Padding Top/Bottom: 40px + 40px = 80px (safe area)
        const availableHeight = windowSize.height - 55 - 40;
        const availableWidth = windowSize.width - 40;

        const scaleH = availableHeight / displayHeight;
        const scaleW = availableWidth / displayWidth;

        // Use the smaller scale to fit both dimensions, max 1
        return Math.min(scaleH, scaleW, 1);
    };

    const currentScale = calculateScale();

    const handleBack = () => {
        try {
            iframeRef.current?.contentWindow?.history.back();
        } catch (e) {
            console.error('Cannot access iframe history', e);
        }
    };

    // Frame Style Calculation
    const frameStyle: React.CSSProperties = {
        width: displayWidth,
        height: displayHeight,
        margin: '0 auto', // Center horizontally
        border: `12px solid ${currentDevice.frameColor || '#1f1f1f'}`,
        borderRadius: currentDevice.type === 'tablet' ? 24 : 40,
        position: 'relative',
        backgroundColor: '#fff',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        // transform and origin handled in render
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            width={Math.min(Math.max(displayWidth * currentScale + 80, 560), windowSize.width - 20)} // Min 560px for header controls
            style={{ top: 20, padding: 0, maxWidth: '100vw' }}
            styles={{ body: { height: Math.min(displayHeight * currentScale + 120, windowSize.height - 100), overflow: 'hidden', background: '#f0f2f5', display: 'flex', flexDirection: 'column', transition: 'height 0.3s ease', position: 'relative' } }}
            footer={null}
            title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <Space size="middle" wrap style={{ marginRight: 24 }}>
                        <Space>
                            <span style={{ color: '#888' }}>设备模型:</span>
                            <Select
                                value={currentDevice.name}
                                onChange={(val) => setCurrentDevice(DEVICES.find(d => d.name === val) || DEVICES[0])}
                                options={DEVICES.map(d => ({ label: d.name, value: d.name }))}
                                style={{ width: 140 }}
                                size="small"
                                variant="borderless"
                                popupMatchSelectWidth={false}
                            />
                        </Space>
                    </Space>
                    <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
                </div>
            }
            closeIcon={null} // Custom close in title
            maskClosable={false}
        >
            <div style={{
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                height: '100%',
                paddingBottom: 40 // Space for dock
            }}>
                <div style={{
                    // Wrapper to handle scaling space
                    width: displayWidth * currentScale,
                    height: displayHeight * currentScale,
                    position: 'relative',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}>
                    <div style={{
                        ...frameStyle,
                        margin: 0,
                        transformOrigin: '0 0',
                        transform: `scale(${currentScale})`,
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: displayWidth,
                        height: displayHeight,
                    }}>
                        {/* Notch removed as requested */}
                        {/* Screen Content */}
                        <iframe
                            ref={iframeRef}
                            key={iframeKey}
                            src={url}
                            style={{
                                width: '100%',
                                height: '100%',
                                border: 'none',
                                backgroundColor: '#fff',
                                scrollbarWidth: 'none',
                            }}
                            title="Mobile Preview"
                        />
                        {/* Home Indicator */}
                        <div style={{
                            position: 'absolute',
                            bottom: 8,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '30%',
                            height: 4,
                            backgroundColor: 'rgba(0,0,0,0.2)',
                            borderRadius: 2,
                            pointerEvents: 'none',
                            zIndex: 101,
                        }} />
                    </div>
                </div>
            </div>

            {/* Bottom Dock */}
            <div style={{
                position: 'absolute',
                bottom: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(10px)',
                padding: '8px 16px',
                borderRadius: 24,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                display: 'flex',
                gap: 16,
                zIndex: 1000,
                border: '1px solid rgba(255,255,255,0.5)'
            }}>
                <Tooltip title="后退 (Back)">
                    <Button
                        type="text"
                        shape="circle"
                        icon={<LeftOutlined />}
                        onClick={handleBack}
                    />
                </Tooltip>

                <div style={{ width: 1, height: 24, background: '#e0e0e0', alignSelf: 'center' }} />

                <Popover
                    content={
                        <Space>
                            <span style={{ color: '#888', fontSize: 12 }}>缩放:</span>
                            <Segmented
                                value={scaleMode}
                                onChange={val => setScaleMode(val as number | 'auto')}
                                size="small"
                                options={[
                                    { label: '自动', value: 'auto' },
                                    { label: '100%', value: 1 },
                                    { label: '85%', value: 0.85 },
                                    { label: '75%', value: 0.75 },
                                    { label: '50%', value: 0.5 },
                                ]}
                            />
                        </Space>
                    }
                    trigger="click"
                    placement="top"
                >
                    <Tooltip title="缩放 (Zoom)">
                        <Button
                            type="text"
                            shape="circle"
                            icon={<ZoomInOutlined />}
                        />
                    </Tooltip>
                </Popover>

                <Tooltip title="旋转 (Rotate)">
                    <Button
                        type="text"
                        shape="circle"
                        icon={<RotateRightOutlined />}
                        onClick={() => setOrientation(prev => prev === 'portrait' ? 'landscape' : 'portrait')}
                    />
                </Tooltip>

                <Tooltip title="刷新 (Reload)">
                    <Button
                        type="text"
                        shape="circle"
                        icon={<ReloadOutlined />}
                        onClick={() => setIframeKey(k => k + 1)}
                    />
                </Tooltip>
            </div>
        </Modal>
    );
};
