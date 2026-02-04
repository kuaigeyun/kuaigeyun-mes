/**
 * 数据连接向导
 *
 * 三步：选择连接类型 → 填写连接信息 → 填写名称并保存（可选测试连接）
 */

import React, { useState } from 'react';
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
        messageApi.error('请输入连接名称');
        return;
      }
      if (!code?.trim()) {
        messageApi.error('请输入连接代码');
        return;
      }
      const finalConfig = buildConfigFromForms();
      if (type === 'API' && !finalConfig.url) {
        messageApi.error('请填写接口地址');
        return;
      }
      if (type === 'Database' && (!finalConfig.host || !finalConfig.database || !finalConfig.user)) {
        messageApi.error('请填写主机、数据库名和用户名');
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
      messageApi.success('连接已创建');
      if (andTest) {
        setTesting(true);
        try {
          const result = await testConnection(created.uuid);
          if (result.success) {
            messageApi.success(result.message || '连接测试成功');
          } else {
            messageApi.warning(result.message || '连接测试未通过');
          }
        } catch (e: any) {
          messageApi.warning(e?.message || '连接测试失败');
        } finally {
          setTesting(false);
        }
      }
      handleClose();
      onSuccess();
    } catch (error: any) {
      messageApi.error(error?.message || '保存失败');
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
                <span>API 连接</span>
              </Space>
              <div style={{ marginTop: 8, marginLeft: 24, color: '#666', fontSize: 12 }}>
                通过 HTTP(S) 对接外部 REST API
              </div>
            </Radio>
          </Card>
          <Card size="small" style={{ width: 280 }}>
            <Radio value="Database">
              <Space>
                <DatabaseOutlined />
                <span>数据库连接</span>
              </Space>
              <div style={{ marginTop: 8, marginLeft: 24, color: '#666', fontSize: 12 }}>
                直连 MySQL、PostgreSQL 等数据库
              </div>
            </Radio>
          </Card>
        </Space>
      </Radio.Group>
    </div>
  );

  const step1ContentApi = (
    <Form form={formApi} layout="vertical" style={{ padding: '24px 0', maxWidth: 480 }}>
      <Form.Item name="url" label="接口地址" rules={[{ required: true, message: '请输入接口地址' }]}>
        <Input placeholder="https://api.example.com" />
      </Form.Item>
      <Form.Item name="method" label="请求方法" initialValue="GET">
        <Select options={[
          { label: 'GET', value: 'GET' },
          { label: 'POST', value: 'POST' },
          { label: 'PUT', value: 'PUT' },
        ]} />
      </Form.Item>
      <Form.Item name="headers" label="请求头（JSON，可选）">
        <Input.TextArea rows={3} placeholder='{"Authorization": "Bearer xxx"}' />
      </Form.Item>
    </Form>
  );

  const step1ContentDb = (
    <Form form={formDb} layout="vertical" style={{ padding: '24px 0', maxWidth: 480 }}>
      <Form.Item name="host" label="主机" rules={[{ required: true, message: '请输入主机地址' }]}>
        <Input placeholder="localhost 或 192.168.1.1" />
      </Form.Item>
      <Form.Item name="port" label="端口" initialValue={5432}>
        <InputNumber min={1} max={65535} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="database" label="数据库名" rules={[{ required: true, message: '请输入数据库名' }]}>
        <Input placeholder="mydb" />
      </Form.Item>
      <Form.Item name="user" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
        <Input placeholder="root" />
      </Form.Item>
      <Form.Item name="password" label="密码">
        <Input.Password placeholder="选填" />
      </Form.Item>
    </Form>
  );

  const step2Content = (
    <Form form={formBasic} layout="vertical" style={{ padding: '24px 0', maxWidth: 480 }}>
      <Form.Item name="name" label="连接名称" rules={[{ required: true, message: '请输入连接名称' }]}>
        <Input placeholder="如：ERP 接口" />
      </Form.Item>
      <Form.Item
        name="code"
        label="连接代码"
        rules={[
          { required: true, message: '请输入连接代码' },
          { pattern: /^[a-z0-9_]+$/, message: '只能包含小写字母、数字和下划线' },
        ]}
      >
        <Input placeholder="如：erp_api" />
      </Form.Item>
      <Form.Item name="description" label="描述">
        <Input.TextArea rows={2} placeholder="选填" />
      </Form.Item>
    </Form>
  );

  const steps = [
    { title: '选择连接类型', description: 'API 或数据库', content: step0Content },
    {
      title: '填写连接信息',
      description: type === 'API' ? '接口地址与请求方式' : '数据库连接参数',
      content: type === 'API' ? step1ContentApi : step1ContentDb,
    },
    {
      title: '保存连接',
      description: '名称与代码',
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
      title="通过向导创建连接"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={640}
      destroyOnClose
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
            <Button onClick={handleClose}>取消</Button>
            <Button type="primary" loading={saving} onClick={() => handleFinish(false)}>
              保存
            </Button>
            <Button type="primary" loading={saving || testing} onClick={() => handleFinish(true)}>
              保存并测试连接
            </Button>
          </Space>
        </div>
      )}
    </Modal>
  );
};

export default ConnectionWizard;
