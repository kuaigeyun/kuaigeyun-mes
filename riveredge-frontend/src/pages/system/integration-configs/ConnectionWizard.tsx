/**
 * 数据连接向导
 *
 * 三步：选择连接类型 → 填写连接信息 → 填写名称并保存（可选测试连接）
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Form, Input, Select, InputNumber, Radio, Card, Space, App, Button } from 'antd';
import { ApiOutlined, DatabaseOutlined } from '@ant-design/icons';
import { WizardTemplate } from '../../../components/layout-templates';
import {
  createIntegrationConfig,
  testConnection,
  IntegrationConfigCreate,
} from '../../../services/integrationConfig';

export type ConnectionType = 'API' | 'Database';

const defaultApiConfig = { url: '', method: 'GET', headers: {} as Record<string, string> };
const defaultDbConfig = { host: '', port: 5432, database: '', user: '', password: '' };

export interface ConnectionWizardProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ConnectionWizard: React.FC<ConnectionWizardProps> = ({ open, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<ConnectionType>('API');
  const [config, setConfig] = useState<Record<string, any>>(defaultApiConfig);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [formBasic] = Form.useForm();
  const [formApi] = Form.useForm();
  const [formDb] = Form.useForm();

  const resetWizard = () => {
    setStep(0);
    setType('API');
    setConfig(defaultApiConfig);
    formBasic.resetFields();
    formApi.resetFields();
    formDb.resetFields();
  };

  const handleClose = () => {
    resetWizard();
    onClose();
  };

  const buildConfigFromForms = (): Record<string, any> => {
    if (type === 'API') {
      const values = formApi.getFieldsValue();
      return {
        url: values.url?.trim() || '',
        method: values.method || 'GET',
        headers: (() => {
        const h = values.headers;
        if (!h) return {};
        if (typeof h === 'string') {
          try { return JSON.parse(h.trim() || '{}'); } catch { return {}; }
        }
        return h;
      })(),
      };
    }
    const values = formDb.getFieldsValue();
    return {
      host: values.host?.trim() || '',
      port: values.port ?? 5432,
      database: values.database?.trim() || '',
      user: values.user?.trim() || '',
      password: values.password ?? '',
    };
  };

  const handleFinish = async (andTest: boolean) => {
    try {
      const name = formBasic.getFieldValue('name');
      const code = formBasic.getFieldValue('code');
      const description = formBasic.getFieldValue('description');
      if (!name?.trim()) {
        messageApi.error(t('pages.system.integrationConfigs.connectionNameRequired'));
        return;
      }
      if (!code?.trim()) {
        messageApi.error(t('pages.system.integrationConfigs.connectionCodeRequired'));
        return;
      }
      const finalConfig = buildConfigFromForms();
      if (type === 'API' && !finalConfig.url) {
        messageApi.error(t('pages.system.integrationConfigs.fillUrl'));
        return;
      }
      if (type === 'Database' && (!finalConfig.host || !finalConfig.database || !finalConfig.user)) {
        messageApi.error(t('pages.system.integrationConfigs.fillDbFields'));
        return;
      }
      setSaving(true);
      const created = await createIntegrationConfig({
        name: name.trim(),
        code: code.trim().replace(/\s/g, '_'),
        type,
        description: description?.trim() || undefined,
        config: finalConfig,
        is_active: true,
      } as IntegrationConfigCreate);
      messageApi.success(t('pages.system.integrationConfigs.connectionCreated'));
      if (andTest) {
        setTesting(true);
        try {
          const result = await testConnection(created.uuid);
          if (result.success) {
            messageApi.success(result.message || t('pages.system.integrationConfigs.testSuccess'));
          } else {
            messageApi.warning(result.message || t('pages.system.integrationConfigs.testNotPassed'));
          }
        } catch (e: any) {
          messageApi.warning(e?.message || t('pages.system.integrationConfigs.testFailed'));
        } finally {
          setTesting(false);
        }
      }
      handleClose();
      onSuccess();
    } catch (error: any) {
      messageApi.error(error?.message || t('pages.system.integrationConfigs.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const step0Content = (
    <div style={{ padding: '24px 0' }}>
      <Radio.Group
        value={type}
        onChange={(e) => {
          setType(e.target.value);
          setConfig(e.target.value === 'API' ? defaultApiConfig : defaultDbConfig);
          formApi.resetFields();
          formDb.resetFields();
        }}
        style={{ width: '100%' }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Card size="small" style={{ width: 280 }}>
            <Radio value="API">
              <Space>
                <ApiOutlined />
                <span>{t('pages.system.integrationConfigs.apiConnection')}</span>
              </Space>
              <div style={{ marginTop: 8, marginLeft: 24, color: '#666', fontSize: 12 }}>
                {t('pages.system.integrationConfigs.apiConnectionDesc')}
              </div>
            </Radio>
          </Card>
          <Card size="small" style={{ width: 280 }}>
            <Radio value="Database">
              <Space>
                <DatabaseOutlined />
                <span>{t('pages.system.integrationConfigs.dbConnection')}</span>
              </Space>
              <div style={{ marginTop: 8, marginLeft: 24, color: '#666', fontSize: 12 }}>
                {t('pages.system.integrationConfigs.dbConnectionDesc')}
              </div>
            </Radio>
          </Card>
        </Space>
      </Radio.Group>
    </div>
  );

  const step1ContentApi = (
    <Form form={formApi} layout="vertical" style={{ padding: '24px 0', maxWidth: 480 }}>
      <Form.Item name="url" label={t('pages.system.integrationConfigs.urlLabel')} rules={[{ required: true, message: t('pages.system.integrationConfigs.urlRequired') }]}>
        <Input placeholder="https://api.example.com" />
      </Form.Item>
      <Form.Item name="method" label={t('pages.system.integrationConfigs.methodLabel')} initialValue="GET">
        <Select options={[
          { label: 'GET', value: 'GET' },
          { label: 'POST', value: 'POST' },
          { label: 'PUT', value: 'PUT' },
        ]} />
      </Form.Item>
      <Form.Item name="headers" label={t('pages.system.integrationConfigs.headersLabel')}>
        <Input.TextArea rows={3} placeholder='{"Authorization": "Bearer xxx"}' />
      </Form.Item>
    </Form>
  );

  const step1ContentDb = (
    <Form form={formDb} layout="vertical" style={{ padding: '24px 0', maxWidth: 480 }}>
      <Form.Item name="host" label={t('pages.system.integrationConfigs.hostLabel')} rules={[{ required: true, message: t('pages.system.integrationConfigs.hostRequired') }]}>
        <Input placeholder={t('pages.system.integrationConfigs.hostPlaceholder')} />
      </Form.Item>
      <Form.Item name="port" label={t('pages.system.integrationConfigs.portLabel')} initialValue={5432}>
        <InputNumber min={1} max={65535} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="database" label={t('pages.system.integrationConfigs.databaseLabel')} rules={[{ required: true, message: t('pages.system.integrationConfigs.databaseRequired') }]}>
        <Input placeholder="mydb" />
      </Form.Item>
      <Form.Item name="user" label={t('pages.system.integrationConfigs.userLabel')} rules={[{ required: true, message: t('pages.system.integrationConfigs.userRequired') }]}>
        <Input placeholder="root" />
      </Form.Item>
      <Form.Item name="password" label={t('pages.system.integrationConfigs.passwordLabel')}>
        <Input.Password placeholder={t('pages.system.integrationConfigs.passwordOptional')} />
      </Form.Item>
    </Form>
  );

  const step2Content = (
    <Form form={formBasic} layout="vertical" style={{ padding: '24px 0', maxWidth: 480 }}>
      <Form.Item name="name" label={t('pages.system.integrationConfigs.connectionNameLabel')} rules={[{ required: true, message: t('pages.system.integrationConfigs.connectionNameRequired') }]}>
        <Input placeholder={t('pages.system.integrationConfigs.connectionNamePlaceholder')} />
      </Form.Item>
      <Form.Item
        name="code"
        label={t('pages.system.integrationConfigs.connectionCodeLabel')}
        rules={[
          { required: true, message: t('pages.system.integrationConfigs.connectionCodeRequired') },
          { pattern: /^[a-z0-9_]+$/, message: t('pages.system.integrationConfigs.connectionCodePattern') },
        ]}
      >
        <Input placeholder={t('pages.system.integrationConfigs.connectionCodePlaceholder')} />
      </Form.Item>
      <Form.Item name="description" label={t('pages.system.integrationConfigs.descLabel')}>
        <Input.TextArea rows={2} placeholder={t('pages.system.integrationConfigs.descOptional')} />
      </Form.Item>
    </Form>
  );

  const steps = [
    { title: t('pages.system.integrationConfigs.wizardStep0Title'), description: t('pages.system.integrationConfigs.wizardStep0Desc'), content: step0Content },
    {
      title: t('pages.system.integrationConfigs.wizardStep1Title'),
      description: type === 'API' ? t('pages.system.integrationConfigs.wizardStep1DescApi') : t('pages.system.integrationConfigs.wizardStep1DescDb'),
      content: type === 'API' ? step1ContentApi : step1ContentDb,
    },
    {
      title: t('pages.system.integrationConfigs.wizardStep2Title'),
      description: t('pages.system.integrationConfigs.wizardStep2Desc'),
      content: step2Content,
    },
  ];

  const canGoNext = () => {
    if (step === 0) return true;
    if (step === 1) {
      if (type === 'API') return formApi.getFieldValue('url');
      return formDb.getFieldValue('host') && formDb.getFieldValue('database') && formDb.getFieldValue('user');
    }
    return true;
  };

  return (
    <Modal
      title={t('pages.system.integrationConfigs.wizardTitle')}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={640}
      destroyOnHidden
    >
      <WizardTemplate
        steps={steps}
        current={step}
        onStepChange={setStep}
        onPrev={() => setStep((s) => s - 1)}
        onNext={() => setStep((s) => s + 1)}
        nextDisabled={!canGoNext()}
        showFinish={false}
      />
      {step === 2 && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Space>
            <Button onClick={handleClose}>{t('pages.system.integrationConfigs.wizardCancel')}</Button>
            <Button type="primary" loading={saving} onClick={() => handleFinish(false)}>
              {t('pages.system.integrationConfigs.wizardSave')}
            </Button>
            <Button type="primary" loading={saving || testing} onClick={() => handleFinish(true)}>
              {t('pages.system.integrationConfigs.wizardSaveAndTest')}
            </Button>
          </Space>
        </div>
      )}
    </Modal>
  );
};

export default ConnectionWizard;
