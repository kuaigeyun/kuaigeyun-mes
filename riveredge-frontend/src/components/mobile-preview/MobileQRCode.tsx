import React from 'react';
import { MobileDevicePreview } from './MobileDevicePreview';
import { QRCodeSVG } from 'qrcode.react';
import { Dropdown, Button, Space, Typography, Tooltip, Input, Collapse, theme } from 'antd';
import { MobileOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export const MobileQRCode: React.FC = () => {
    const { t } = useTranslation();
    const { token } = theme.useToken();
    const [ip, setIp] = React.useState<string>('');
    const [previewOpen, setPreviewOpen] = React.useState(false);

    // Initialize
    React.useEffect(() => {
        const stored = localStorage.getItem('mobile_debug_ip');
        const defaultIp = window.location.hostname;

        if (stored) {
            setIp(stored);
        } else {
            setIp(defaultIp);
        }
    }, []);

    const handleIpChange = (val: string) => {
        setIp(val);
        localStorage.setItem('mobile_debug_ip', val);
    };

    const getMobileUrl = () => {
        const protocol = window.location.protocol;
        const port = '8101'; // RiverEdge Mobile port
        // Use user configured IP or fallback to window.location.hostname
        const targetIp = ip || window.location.hostname;
        return `${protocol}//${targetIp}:${port}`;
    };

    const mobileUrl = getMobileUrl();

    const content = (
        <div style={{ textAlign: 'center', padding: '12px 16px', width: 232 }}>
            <div style={{ marginBottom: 12, background: 'white', padding: 8, borderRadius: 4, border: `1px solid ${token.colorBorder}` }}>
                <QRCodeSVG value={mobileUrl} size={180} />
            </div>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Text strong>扫码体验移动端</Text>

                <Collapse
                    ghost
                    size="small"
                    items={[
                        {
                            key: '1',
                            showArrow: false,
                            label: <div style={{ fontSize: 12, color: '#999', textAlign: 'center', width: '100%' }}>高级设置</div>,
                            children: (
                                <div style={{ marginTop: -8 }}>
                                    <Input
                                        addonBefore={<span style={{ fontSize: 12, color: '#666' }}>IP</span>}
                                        size="small"
                                        value={ip}
                                        onChange={e => handleIpChange(e.target.value)}
                                        placeholder="192.168.x.x"
                                        variant="filled"
                                        style={{ fontSize: 12 }}
                                    />
                                    <div style={{ marginTop: 4, fontSize: 10, color: '#ccc', paddingLeft: 4 }}>
                                        * 默认自动获取本机 IP，无需配置
                                    </div>
                                </div>
                            ),
                        },
                    ]}
                />

                <div style={{ display: 'flex', gap: 8 }}>
                    <Button
                        type="primary"
                        size="small"
                        icon={<MobileOutlined />}
                        onClick={() => setPreviewOpen(true)}
                        block
                    >
                        模拟预览
                    </Button>
                    <Button
                        size="small"
                        href={mobileUrl}
                        target="_blank"
                        block
                    >
                        浏览器
                    </Button>
                </div>
            </Space>
        </div>
    );

    const dropdownContent = (
        <div
            style={{
                width: 232,
                backgroundColor: token.colorBgElevated,
                borderRadius: token.borderRadiusLG,
                boxShadow: token.boxShadowSecondary,
                overflow: 'hidden',
            }}
        >
            {content}
        </div>
    );

    return (
        <>
            <Dropdown
                popupRender={() => dropdownContent}
                trigger={['click']}
                placement="bottomRight"
                arrow={false}
                classNames={{ root: 'header-actions-dropdown' }}
            >
                <Tooltip title={t('common.mobileExperience', '移动端体验')}>
                    <Button
                        type="text"
                        size="small"
                        icon={<MobileOutlined />}
                    />
                </Tooltip>
            </Dropdown>

            <MobileDevicePreview
                open={previewOpen}
                onClose={() => setPreviewOpen(false)}
                url={mobileUrl}
            />
        </>
    );
};
