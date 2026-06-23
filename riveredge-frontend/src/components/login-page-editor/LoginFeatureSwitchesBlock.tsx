import React from 'react';
import { Col, Form, Row, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import './login-page-editor.less';

const LoginFeatureSwitchesBlock: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="login-page-feature-switches">
      <Row gutter={[16, 8]}>
        <Col xs={24} md={{ flex: '1 1 0' }} style={{ minWidth: 0 }}>
          <Form.Item name="enable_register" label={t('pages.system.siteSettings.enableRegister')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={24} md={{ flex: '1 1 0' }} style={{ minWidth: 0 }}>
          <Form.Item name="login_guest_enabled" label={t('pages.infra.platform.loginGuestEnabled')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={24} md={{ flex: '1 1 0' }} style={{ minWidth: 0 }}>
          <Form.Item name="login_quick_enabled" label={t('pages.infra.platform.loginQuickEnabled')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={24} md={{ flex: '1 1 0' }} style={{ minWidth: 0 }}>
          <Form.Item name="login_client_win_enabled" label={t('pages.infra.platform.loginClientWinEnabled')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col xs={24} md={{ flex: '1 1 0' }} style={{ minWidth: 0 }}>
          <Form.Item name="login_client_android_enabled" label={t('pages.infra.platform.loginClientAndroidEnabled')} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
      </Row>
    </div>
  );
};

export default LoginFeatureSwitchesBlock;
