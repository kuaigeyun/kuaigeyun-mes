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
      title: '页面标识',
      dataIndex: 'page_key',
      key: 'page_key',
    },
    {
      title: '页面名称',
      dataIndex: 'page_name',
      key: 'page_name',
    },
    {
      title: '引导步骤数',
      dataIndex: 'steps',
      key: 'steps',
      render: (steps: OperationGuideStep[]) => steps?.length || 0,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: OperationGuide) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handlePreviewGuide(record)}
          >
            预览
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleCreateOrEdit(record)}
          >
            编辑
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
      title: '文档标识',
      dataIndex: 'key',
      key: 'key',
    },
    {
      title: '文档标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '章节数',
      dataIndex: 'sections',
      key: 'sections',
      render: (sections: any[]) => sections?.length || 0,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>操作引导和帮助系统</Title>
      <Paragraph>
        管理系统中的操作引导配置和帮助文档，帮助用户快速了解系统功能和使用方法。
      </Paragraph>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'guides',
            label: '操作引导',
            children: (
              <Card
                title="操作引导管理"
                extra={
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => handleCreateOrEdit()}
                  >
                    新建引导
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
            label: '帮助文档',
            children: (
              <Card
                title="帮助文档管理"
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
            label: '功能预览',
            children: (
              <Card title="功能预览">
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <div>
                    <Title level={4}>操作引导组件</Title>
                    <Paragraph>
                      操作引导组件使用 Ant Design Tour 组件实现，支持分步引导、高亮显示关键操作。
                    </Paragraph>
                    <Button
                      type="primary"
                      onClick={() => {
                        const steps: GuideStep[] = [
                          {
                            target: '.ant-btn-primary',
                            title: '示例按钮',
                            description: '这是一个示例按钮，点击可以执行操作',
                            placement: 'bottom',
                          },
                        ];
                        setPreviewSteps(steps);
                        setPreviewGuideVisible(true);
                      }}
                    >
                      预览操作引导
                    </Button>
                  </div>
                  <div>
                    <Title level={4}>帮助中心组件</Title>
                    <Paragraph>
                      帮助中心组件提供统一的帮助文档查看功能，支持搜索和分类浏览。
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
        title={currentGuide ? '编辑操作引导' : '新建操作引导'}
        open={guideModalVisible}
        onCancel={() => setGuideModalVisible(false)}
        onOk={handleSaveGuide}
        width={800}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="page_key"
            label="页面标识"
            rules={[{ required: true, message: '请输入页面标识' }]}
          >
            <Input placeholder="如：user_management" disabled={!!currentGuide} />
          </Form.Item>
          <Form.Item
            name="page_name"
            label="页面名称"
            rules={[{ required: true, message: '请输入页面名称' }]}
          >
            <Input placeholder="如：用户管理" />
          </Form.Item>
          <Form.List name="steps">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field, index) => (
                  <Card key={field.key} style={{ marginBottom: 16 }} title={`步骤 ${index + 1}`}>
                    <Form.Item
                      name={[field.name, 'step']}
                      label="步骤序号"
                      rules={[{ required: true }]}
                    >
                      <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'target']}
                      label="目标元素选择器"
                      rules={[{ required: true, message: '请输入目标元素选择器' }]}
                    >
                      <Input placeholder="如：.ant-btn-primary" />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'title']}
                      label="引导标题"
                      rules={[{ required: true, message: '请输入引导标题' }]}
                    >
                      <Input placeholder="如：创建用户" />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'description']}
                      label="引导内容"
                      rules={[{ required: true, message: '请输入引导内容' }]}
                    >
                      <TextArea rows={3} placeholder="如：点击此按钮可以创建新用户" />
                    </Form.Item>
                    <Form.Item
                      name={[field.name, 'placement']}
                      label="引导位置"
                      initialValue="bottom"
                    >
                      <Select>
                        <Select.Option value="top">上方</Select.Option>
                        <Select.Option value="right">右侧</Select.Option>
                        <Select.Option value="bottom">下方</Select.Option>
                        <Select.Option value="left">左侧</Select.Option>
                      </Select>
                    </Form.Item>
                    <Button type="link" danger onClick={() => remove(field.name)}>
                      删除步骤
                    </Button>
                  </Card>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  添加步骤
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
