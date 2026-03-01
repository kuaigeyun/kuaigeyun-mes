/**
 * 操作引导和帮助系统管理页面
 * 
 * 管理操作引导配置和帮助文档
 * 
 * @author Luigi Lu
 * @date 2026-01-27
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Tabs, Table, Button, Space, Typography, Modal, Form, Input, InputNumber, Select, message } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined, QuestionCircleOutlined, BookOutlined } from '@ant-design/icons';
import { App } from 'antd';
import { listOperationGuides, getOperationGuide, createOrUpdateOperationGuide, OperationGuide, OperationGuideStep } from '../../../services/operationGuide';
import { listHelpDocuments, HelpDocument } from '../../../services/helpDocument';
import { OnboardingGuide, GuideStep } from '../../../components/onboarding-guide';
import HelpCenter from '../../../components/help-center';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;

/**
 * 操作引导和帮助系统管理页面组件
 */
const OperationGuidePage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [guides, setGuides] = useState<OperationGuide[]>([]);
  const [helpDocuments, setHelpDocuments] = useState<HelpDocument[]>([]);
  const [activeTab, setActiveTab] = useState<string>('guides');
  const [guideModalVisible, setGuideModalVisible] = useState(false);
  const [currentGuide, setCurrentGuide] = useState<OperationGuide | null>(null);
  const [form] = Form.useForm();
  const [previewGuideVisible, setPreviewGuideVisible] = useState(false);
  const [previewSteps, setPreviewSteps] = useState<GuideStep[]>([]);

  /**
   * 加载操作引导列表
   */
  const loadGuides = async () => {
    try {
      setLoading(true);
      const data = await listOperationGuides();
      setGuides(data);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.operationGuide.loadGuidesFailed'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 加载帮助文档列表
   */
  const loadHelpDocuments = async () => {
    try {
      setLoading(true);
      const docs = await listHelpDocuments();
      setHelpDocuments(docs);
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.operationGuide.loadHelpFailed'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 初始化加载
   */
  useEffect(() => {
    if (activeTab === 'guides') {
      loadGuides();
    } else if (activeTab === 'help') {
      loadHelpDocuments();
    }
  }, [activeTab]);

  /**
   * 处理创建/编辑操作引导
   */
  const handleCreateOrEdit = (guide?: OperationGuide) => {
    if (guide) {
      setCurrentGuide(guide);
      form.setFieldsValue({
        page_key: guide.page_key,
        page_name: guide.page_name,
        steps: guide.steps,
      });
    } else {
      setCurrentGuide(null);
      form.resetFields();
    }
    setGuideModalVisible(true);
  };

  /**
   * 处理保存操作引导
   */
  const handleSaveGuide = async () => {
    try {
      const values = await form.validateFields();
      const guide: OperationGuide = {
        page_key: values.page_key,
        page_name: values.page_name,
        steps: values.steps || [],
      };
      await createOrUpdateOperationGuide(guide);
      messageApi.success(t('pages.system.operationGuide.saveSuccess'));
      setGuideModalVisible(false);
      loadGuides();
    } catch (error: any) {
      messageApi.error(error.message || t('pages.system.operationGuide.saveFailed'));
    }
  };

  /**
   * 处理预览操作引导
   */
  const handlePreviewGuide = (guide: OperationGuide) => {
    const steps: GuideStep[] = guide.steps.map((step) => ({
      target: step.target,
      title: step.title,
      description: step.description,
      placement: (step.placement as any) || 'bottom',
    }));
    setPreviewSteps(steps);
    setPreviewGuideVisible(true);
  };

  /**
   * 操作引导表格列
   */
  const guideColumns = [
    {
      title: t('pages.system.operationGuide.columnPageKey'),
      dataIndex: 'page_key',
      key: 'page_key',
    },
    {
      title: t('pages.system.operationGuide.columnPageName'),
      dataIndex: 'page_name',
      key: 'page_name',
    },
    {
      title: t('pages.system.operationGuide.columnStepCount'),
      dataIndex: 'steps',
      key: 'steps',
      render: (steps: OperationGuideStep[]) => steps?.length || 0,
    },
    {
      title: t('pages.system.operationGuide.columnActions'),
      key: 'action',
      width: 200,
      render: (_: any, record: OperationGuide) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handlePreviewGuide(record)}
          >
            {t('pages.system.operationGuide.preview')}
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleCreateOrEdit(record)}
          >
            {t('pages.system.operationGuide.edit')}
          </Button>
        </Space>
      ),
    },
  ];

  /**
   * 帮助文档表格列
   */
  const helpDocumentColumns = [
    {
      title: t('pages.system.operationGuide.columnDocKey'),
      dataIndex: 'key',
      key: 'key',
    },
    {
      title: t('pages.system.operationGuide.columnDocTitle'),
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: t('pages.system.operationGuide.columnSectionCount'),
      dataIndex: 'sections',
      key: 'sections',
      render: (sections: any[]) => sections?.length || 0,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>{t('pages.system.operationGuide.pageTitle')}</Title>
      <Paragraph>
        {t('pages.system.operationGuide.pageDesc')}
      </Paragraph>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'guides',
            label: t('pages.system.operationGuide.tabGuides'),
            children: (
              <Card
                title={t('pages.system.operationGuide.guidesTitle')}
                extra={
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => handleCreateOrEdit()}
                  >
                    {t('pages.system.operationGuide.createGuide')}
                  </Button>
                }
              >
                <Table
                  dataSource={guides}
                  columns={guideColumns}
                  rowKey="page_key"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            ),
          },
          {
            key: 'help',
            label: t('pages.system.operationGuide.tabHelp'),
            children: (
              <Card
                title={t('pages.system.operationGuide.helpTitle')}
                extra={
                  <Space>
                    <HelpCenter mode="inline" />
                  </Space>
                }
              >
                <Table
                  dataSource={helpDocuments}
                  columns={helpDocumentColumns}
                  rowKey="key"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              </Card>
            ),
          },
          {
            key: 'preview',
            label: t('pages.system.operationGuide.tabPreview'),
            children: (
              <Card title={t('pages.system.operationGuide.previewTitle')}>
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <div>
                    <Title level={4}>{t('pages.system.operationGuide.guideComponentTitle')}</Title>
                    <Paragraph>
                      {t('pages.system.operationGuide.guideComponentDesc')}
                    </Paragraph>
                    <Button
                      type="primary"
                      onClick={() => {
                        const steps: GuideStep[] = [
                          {
                            target: '.ant-btn-primary',
                            title: t('pages.system.operationGuide.exampleButton'),
                            description: t('pages.system.operationGuide.exampleDesc'),
                            placement: 'bottom',
                          },
                        ];
                        setPreviewSteps(steps);
                        setPreviewGuideVisible(true);
                      }}
                    >
                      {t('pages.system.operationGuide.previewGuide')}
                    </Button>
                  </div>
                  <div>
                    <Title level={4}>{t('pages.system.operationGuide.helpComponentTitle')}</Title>
                    <Paragraph>
                      {t('pages.system.operationGuide.helpComponentDesc')}
                    </Paragraph>
                    <HelpCenter mode="inline" />
                  </div>
                </Space>
              </Card>
            ),
          },
        ]}
      />

      {/* 操作引导编辑Modal */}
      <Modal
        title={currentGuide ? t('pages.system.operationGuide.modalEdit') : t('pages.system.operationGuide.modalCreate')}
        open={guideModalVisible}
        onCancel={() => setGuideModalVisible(false)}
        onOk={handleSaveGuide}
        width={800}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="page_key"
            label={t('pages.system.operationGuide.labelPageKey')}
            rules={[{ required: true, message: t('pages.system.operationGuide.pageKeyRequired') }]}
          >
            <Input placeholder={t('pages.system.operationGuide.pageKeyPlaceholder')} disabled={!!currentGuide} />
          </Form.Item>
          <Form.Item
            name="page_name"
            label={t('pages.system.operationGuide.labelPageName')}
            rules={[{ required: true, message: t('pages.system.operationGuide.pageNameRequired') }]}
          >
            <Input placeholder={t('pages.system.operationGuide.pageNamePlaceholder')} />
          </Form.Item>
          <Form.List name="steps">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <Card key={field.key} style={{ marginBottom: 16 }} title={t('pages.system.operationGuide.stepTitle', { index: index + 1 })}>
                    <Form.Item
                      name={[field.name, 'step']}
                      label={t('pages.system.operationGuide.labelStepOrder')}
                      rules={[{ required: true }]}
                    >
                      <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'target']}
                      label={t('pages.system.operationGuide.labelTarget')}
                      rules={[{ required: true, message: t('pages.system.operationGuide.targetRequired') }]}
                    >
                      <Input placeholder={t('pages.system.operationGuide.targetPlaceholder')} />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'title']}
                      label={t('pages.system.operationGuide.labelGuideTitle')}
                      rules={[{ required: true, message: t('pages.system.operationGuide.guideTitleRequired') }]}
                    >
                      <Input placeholder={t('pages.system.operationGuide.guideTitlePlaceholder')} />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'description']}
                      label={t('pages.system.operationGuide.labelGuideContent')}
                      rules={[{ required: true, message: t('pages.system.operationGuide.guideContentRequired') }]}
                    >
                      <TextArea rows={3} placeholder={t('pages.system.operationGuide.guideContentPlaceholder')} />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'placement']}
                      label={t('pages.system.operationGuide.labelPlacement')}
                      initialValue="bottom"
                    >
                      <Select>
                        <Select.Option value="top">{t('pages.system.operationGuide.placementTop')}</Select.Option>
                        <Select.Option value="right">{t('pages.system.operationGuide.placementRight')}</Select.Option>
                        <Select.Option value="bottom">{t('pages.system.operationGuide.placementBottom')}</Select.Option>
                        <Select.Option value="left">{t('pages.system.operationGuide.placementLeft')}</Select.Option>
                      </Select>
                    </Form.Item>
                    <Button type="link" danger onClick={() => remove(field.name)}>
                      {t('pages.system.operationGuide.removeStep')}
                    </Button>
                  </Card>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  {t('pages.system.operationGuide.addStep')}
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      {/* 操作引导预览 */}
      <OnboardingGuide
        steps={previewSteps}
        guideKey="preview"
        autoStart={previewGuideVisible}
        onClose={() => setPreviewGuideVisible(false)}
        onComplete={() => setPreviewGuideVisible(false)}
      />
    </div>
  );
};

export default OperationGuidePage;
