/**
 * 技术栈列表 Modal 组件
 * 
 * 展示 RiverEdge SaaS 框架使用的所有技术栈信息，包括版本、作用描述和许可协议
 * 
 * Copyright 2025 无锡快格信息技术有限公司
 * RiverEdge 为无锡快格信息技术有限公司注册商标
 */

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Modal, Tabs, Table, Tag, Typography, Space, Divider, theme } from 'antd';
import type { TabsProps } from 'antd';
import { ExclamationCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import { MODAL_CONFIG, PAGE_SPACING } from '../layout-templates/constants';
import { COPYRIGHT_COMPANY_NAME, COPYRIGHT_TRADEMARK } from '../../constants/copyrightContent';
import { verifyCopyright } from '../../utils/copyrightIntegrity';

const { Title, Text, Paragraph } = Typography;
const { useToken } = theme;

/**
 * 技术栈数据类型
 */
interface TechStackItem {
  name: string;
  version: string;
  description: string;
  license: string;
  commercialUse: boolean;
  category: 'backend' | 'frontend' | 'database' | 'infrastructure';
  isCore?: boolean; // 是否为核心技术组件
}

/**
 * 技术栈数据
 */
const techStackData: TechStackItem[] = [
  // 核心技术栈
  {
    name: 'FastAPI',
    version: '0.115.0+',
    description: '高性能异步 Web 框架',
    license: 'MIT License',
    commercialUse: true,
    category: 'backend',
    isCore: true,
  },
  {
    name: 'Inngest',
    version: '>=0.3.0',
    description: '现代化任务调度系统，处理异步任务和工作流',
    license: 'Apache License 2.0 (开源版)',
    commercialUse: true,
    category: 'backend',
    isCore: true,
  },
  {
    name: 'React',
    version: '18.3.1',
    description: '现代化前端框架，构建响应式用户界面',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
    isCore: true,
  },
  
  // 后端技术栈
  {
    name: 'Python',
    version: '3.12.0',
    description: '编程语言，长期支持版本',
    license: 'PSF License (类似 BSD)',
    commercialUse: true,
    category: 'backend',
  },
  {
    name: 'Uvicorn',
    version: '0.30.0+',
    description: 'ASGI 服务器，FastAPI 官方推荐',
    license: 'BSD License',
    commercialUse: true,
    category: 'backend',
  },
  {
    name: 'Pydantic',
    version: '2.9.0+',
    description: '数据验证库，基于 Python 类型提示',
    license: 'MIT License',
    commercialUse: true,
    category: 'backend',
  },
  {
    name: 'Tortoise ORM',
    version: '0.21.1',
    description: '异步 ORM 框架，专为异步 Python 设计',
    license: 'Apache License 2.0',
    commercialUse: true,
    category: 'backend',
  },
  {
    name: 'Aerich',
    version: '0.7.1+',
    description: 'Tortoise ORM 数据库迁移工具',
    license: 'Apache License 2.0',
    commercialUse: true,
    category: 'backend',
  },
  {
    name: 'asyncpg',
    version: '0.29.0+',
    description: 'PostgreSQL 异步驱动',
    license: 'Apache License 2.0',
    commercialUse: true,
    category: 'backend',
  },
  {
    name: 'redis-py',
    version: '6.0.0+',
    description: 'Redis Python 客户端，支持异步接口',
    license: 'MIT License',
    commercialUse: true,
    category: 'backend',
  },
  {
    name: 'python-jose',
    version: '3.3.0+',
    description: 'JWT 认证库',
    license: 'MIT License',
    commercialUse: true,
    category: 'backend',
  },
  {
    name: 'passlib',
    version: '1.7.4+',
    description: '密码加密库',
    license: 'MIT License',
    commercialUse: true,
    category: 'backend',
  },
  {
    name: 'httpx',
    version: '0.27.0+',
    description: 'HTTP 客户端，支持异步',
    license: 'BSD License',
    commercialUse: true,
    category: 'backend',
  },
  {
    name: 'loguru',
    version: '0.7.3+',
    description: '日志库，结构化日志输出',
    license: 'MIT License',
    commercialUse: true,
    category: 'backend',
  },
  {
    name: 'psutil',
    version: '5.9.8+',
    description: '系统资源监控库',
    license: 'MIT License',
    commercialUse: true,
    category: 'backend',
  },
  {
    name: 'pytest',
    version: '8.0.0+',
    description: 'Python 测试框架',
    license: 'MIT License',
    commercialUse: true,
    category: 'backend',
  },
  {
    name: 'python-dotenv',
    version: '>=1.0.0',
    description: '环境变量管理',
    license: 'BSD License',
    commercialUse: true,
    category: 'backend',
  },
  {
    name: 'pydantic-settings',
    version: '>=2.6.0',
    description: 'Pydantic 配置管理',
    license: 'MIT License',
    commercialUse: true,
    category: 'backend',
  },
  {
    name: 'pypinyin',
    version: '>=0.51.0',
    description: '中文拼音支持，用于拼音首字母搜索',
    license: 'MIT License',
    commercialUse: true,
    category: 'backend',
  },
  {
    name: 'aiofiles',
    version: '>=23.2.1',
    description: '异步文件操作库',
    license: 'Apache License 2.0',
    commercialUse: true,
    category: 'backend',
  },
  {
    name: 'openpyxl',
    version: '>=3.1.0',
    description: 'Excel 文件读写库',
    license: 'MIT License',
    commercialUse: true,
    category: 'backend',
  },
  {
    name: 'weasyprint',
    version: '>=60.0',
    description: 'PDF 文件生成库',
    license: 'BSD License',
    commercialUse: true,
    category: 'backend',
  },
  {
    name: 'OpenAI SDK',
    version: '>=1.0.0',
    description: '大语言模型 API 客户端',
    license: 'Apache License 2.0',
    commercialUse: true,
    category: 'backend',
  },
  {
    name: 'qrcode',
    version: '>=7.4.0',
    description: '二维码生成库（Python）',
    license: 'BSD License',
    commercialUse: true,
    category: 'backend',
  },
  {
    name: 'pyzbar',
    version: '>=0.1.9',
    description: '二维码解析库',
    license: 'MIT License',
    commercialUse: true,
    category: 'backend',
  },
  {
    name: 'aiosmtplib',
    version: '>=3.0.1',
    description: '异步 SMTP 客户端，邮件发送',
    license: 'MIT License',
    commercialUse: true,
    category: 'backend',
  },
  
  // 前端技术栈
  {
    name: 'Vite',
    version: '5.4.8+',
    description: '现代化构建工具，闪电般冷启动',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: 'React Router DOM',
    version: '6.26.2+',
    description: 'React 官方路由解决方案',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: 'Zustand',
    version: '5.0.0+',
    description: '轻量级现代化状态管理',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: 'TanStack Query',
    version: '5.51.1+',
    description: '智能服务端状态管理，数据获取和缓存',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: 'Ant Design',
    version: '6.1.0+',
    description: '企业级 UI 组件库',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: '@ant-design/pro-components',
    version: '2.8.2+',
    description: 'Ant Design Pro 高级业务组件',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: '@ant-design/pro-flow',
    version: '^1.3.12+',
    description: '审批流设计器，用于审批流、业务蓝图设计',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: '@ant-design/charts',
    version: '^2.1.0',
    description: 'Ant Design 图表组件库',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: '@ant-design/graphs',
    version: '^2.1.0',
    description: 'Ant Design 图可视化组件',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: '@svar-ui/react-gantt',
    version: '^2.5.2',
    description: '甘特图组件，工单排程',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: '@formily/core',
    version: '^2.3.7+',
    description: '表单自定义字段核心库',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: '@formily/react',
    version: '^2.3.7+',
    description: '表单自定义字段 React 绑定',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: '@formily/antd-v5',
    version: '^1.2.4+',
    description: '表单自定义字段 Ant Design 适配',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: '@univerjs/*',
    version: '^0.12.3+',
    description: 'Excel 在线编辑（Sheets，用于导入/导出）',
    license: 'Apache License 2.0',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: '@pdfme/ui',
    version: '^5.5.8',
    description: 'PDF 模板设计、预览与生成（打印模板等）',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: 'signature_pad',
    version: '^5.1.3',
    description: '电子签名库，手写签名（用于 PDF 签名组件）',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: 'TypeScript',
    version: '5.6.3+',
    description: '静态类型检查，提升代码可维护性',
    license: 'Apache License 2.0',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: 'Vitest',
    version: '2.1.8+',
    description: '现代化测试框架，原生 ESM 支持',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: 'pinyin-pro',
    version: '^3.19.0+',
    description: '前端中文拼音支持',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: 'less',
    version: '^4.4.2+',
    description: 'CSS 预处理器',
    license: 'Apache License 2.0',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: 'i18next',
    version: '23.15.2+',
    description: '国际化核心库',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: 'react-i18next',
    version: '^14.1.3',
    description: 'React 国际化解决方案',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: 'dayjs',
    version: '1.11.13+',
    description: '轻量级日期处理库',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: 'framer-motion',
    version: '11.5.4+',
    description: '现代化动画库',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: 'qrcode.react',
    version: '^4.2.0',
    description: 'React 二维码生成与展示',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: 'lottie-react',
    version: '^2.4.1',
    description: 'Lottie 动画播放库',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: 'react-easy-crop',
    version: '^5.5.6',
    description: '图片裁剪组件（方形/圆形）',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: 'react-image-crop',
    version: '^11.0.10',
    description: '图片自由裁剪组件',
    license: 'ISC License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: 'react-grid-layout',
    version: '^2.2.2',
    description: '可拖拽网格布局',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: 'lucide-react',
    version: '^0.556.0',
    description: '图标库',
    license: 'ISC License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: 'react-icons',
    version: '^5.5.0',
    description: '图标库集合',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  
  // 数据库和基础设施
  {
    name: 'PostgreSQL',
    version: '15+',
    description: '功能强大的开源关系型数据库',
    license: 'PostgreSQL License (类似 BSD/MIT)',
    commercialUse: true,
    category: 'database',
  },
  {
    name: 'Redis',
    version: '6.2.6+',
    description: '高性能内存数据库（服务器版本）',
    license: '≤7.2: BSD-3-Clause；7.4+: RSALv2/SSPLv1；8+: 可选 AGPLv3',
    commercialUse: true,
    category: 'database',
  },
  {
    name: 'Node.js',
    version: '>=22.0.0',
    description: 'JavaScript 运行时环境',
    license: 'MIT License',
    commercialUse: true,
    category: 'infrastructure',
  },
  {
    name: 'npm',
    version: '>=10.0.0',
    description: 'Node.js 包管理器（前端）',
    license: 'Artistic License 2.0',
    commercialUse: true,
    category: 'infrastructure',
  },
  {
    name: 'UV',
    version: '>=0.4.0',
    description: 'Python 包管理器与项目管理工具，替代 pip/poetry',
    license: 'MIT License',
    commercialUse: true,
    category: 'infrastructure',
  },
];

/**
 * 技术栈列表 Modal 组件
 */
interface TechStackModalProps {
  open: boolean;
  onCancel: () => void;
}

const TechStackModal: React.FC<TechStackModalProps> = ({ open, onCancel }) => {
  const { t } = useTranslation();
  const { token } = useToken();

  useEffect(() => {
    if (open) verifyCopyright();
  }, [open]);

  const tabContentStyle: React.CSSProperties = {
    padding: `${PAGE_SPACING.PADDING}px 0`,
    minHeight: 480,
  };
  const warningBoxStyle: React.CSSProperties = {
    marginTop: 16,
    padding: 12,
    background: token.colorWarningBg,
    borderRadius: token.borderRadius,
    border: `1px solid ${token.colorWarningBorder}`,
  };

  // 按分类分组
  const backendTech = techStackData.filter(item => item.category === 'backend');
  const frontendTech = techStackData.filter(item => item.category === 'frontend');
  const databaseTech = techStackData.filter(item => item.category === 'database');
  const infrastructureTech = techStackData.filter(item => item.category === 'infrastructure');

  const columns = [
    {
      title: t('components.techStackModal.columnName'),
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text: string, record: TechStackItem) => (
        <Space>
          {text}
          {record.isCore && (
            <Tag color="gold" icon={<FileTextOutlined />}>
              {t('components.techStackModal.tagCore')}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: t('components.techStackModal.columnVersion'),
      dataIndex: 'version',
      key: 'version',
      width: 150,
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: t('components.techStackModal.columnDescription'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: t('components.techStackModal.columnLicense'),
      dataIndex: 'license',
      key: 'license',
      width: 200,
      render: (text: string) => <Text type="secondary">{text}</Text>,
    },
    {
      title: t('components.techStackModal.columnCommercialUse'),
      dataIndex: 'commercialUse',
      key: 'commercialUse',
      width: 100,
      align: 'center' as const,
      render: (value: boolean) => (
        <Tag color={value ? 'success' : 'error'}>
          {value ? t('components.techStackModal.tagFree') : t('components.techStackModal.tagRequired')}
        </Tag>
      ),
    },
  ];

  const tabItems: TabsProps['items'] = [
    {
      key: 'overview',
      label: t('components.techStackModal.tabOverview'),
      children: (
        <div style={tabContentStyle}>
          <Title level={4}>{t('components.techStackModal.overview.coreTitle')}</Title>
          <Paragraph>
            {t('components.techStackModal.overview.intro')}
          </Paragraph>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text strong>FastAPI</Text>：{t('components.techStackModal.overview.fastapi')}
            </div>
            <div>
              <Text strong>Inngest</Text>：{t('components.techStackModal.overview.inngest')}
            </div>
            <div>
              <Text strong>React</Text>：{t('components.techStackModal.overview.react')}
            </div>
            <div>
              <Text strong>Tortoise ORM</Text>：{t('components.techStackModal.overview.tortoise')}
            </div>
            <div>
              <Text strong>Ant Design</Text>：{t('components.techStackModal.overview.antd')}
            </div>
          </Space>
          <Divider />
          <Title level={5}>{t('components.techStackModal.overview.licenseTitle')}</Title>
          <Paragraph>
            {t('components.techStackModal.overview.licenseIntro')}
          </Paragraph>
          <Paragraph>
            {t('components.techStackModal.overview.redisWarning')}
          </Paragraph>
        </div>
      ),
    },
    {
      key: 'copyright',
      label: (
        <Badge dot color="red" offset={[8, 0]}>
          <span>{t('components.techStackModal.tabCopyright')}</span>
        </Badge>
      ),
      children: (
        <div style={tabContentStyle}>
          <Alert
            message={t('components.techStackModal.copyright.important')}
            description={t('components.techStackModal.copyright.importantDesc')}
            type="info"
            showIcon
            icon={<ExclamationCircleOutlined />}
            style={{ marginBottom: 24 }}
          />
          <Title level={4}>{t('components.techStackModal.copyright.projectTitle')}</Title>
          <Paragraph>
            {t('components.techStackModal.copyright.projectScope')}
          </Paragraph>
          
          <Title level={5}>{t('components.techStackModal.copyright.ownershipTitle')}</Title>
          <Paragraph>
            <Text strong>Copyright © {COPYRIGHT_COMPANY_NAME}</Text>
          </Paragraph>
          <Paragraph type="secondary">
            {t('components.techStackModal.copyright.ownershipDesc', { company: COPYRIGHT_COMPANY_NAME })}
          </Paragraph>
          
          <Divider />
          
          <Title level={5}>{t('components.techStackModal.copyright.trademarkTitle')}</Title>
          <Paragraph>
            {t('components.techStackModal.copyright.trademarkDesc', { trademark: COPYRIGHT_TRADEMARK, company: COPYRIGHT_COMPANY_NAME })}
          </Paragraph>
          <Paragraph>
            {t('components.techStackModal.copyright.trademarkNoGrant')}
          </Paragraph>
          <Paragraph style={{ paddingLeft: token.paddingLG }}>
            • {t('components.techStackModal.copyright.trademarkItem1', { trademark: COPYRIGHT_TRADEMARK })}
          </Paragraph>
          <Paragraph style={{ paddingLeft: token.paddingLG }}>
            • {t('components.techStackModal.copyright.trademarkItem2', { trademark: COPYRIGHT_TRADEMARK })}
          </Paragraph>
          
          <Divider />
          
          <Title level={5}>{t('components.techStackModal.copyright.softwareTitle')}</Title>
          <Paragraph>
            {t('components.techStackModal.copyright.softwareIntro')}
          </Paragraph>
          <Paragraph style={{ paddingLeft: token.paddingLG }}>
            ✅ {t('components.techStackModal.copyright.softwareItem1')}
          </Paragraph>
          <Paragraph style={{ paddingLeft: token.paddingLG }}>
            ✅ {t('components.techStackModal.copyright.softwareItem2')}
          </Paragraph>
          <Paragraph type="secondary" style={{ marginTop: 8 }}>
            {t('components.techStackModal.copyright.softwareNote')}
          </Paragraph>
          
          <Divider />
          
          <Title level={5}>{t('components.techStackModal.copyright.complianceTitle')}</Title>
          <Paragraph>
            {t('components.techStackModal.copyright.complianceDesc')}
          </Paragraph>
          <Paragraph>
            <Text strong>{t('components.techStackModal.copyright.complianceAuth')}</Text>
          </Paragraph>
          <Paragraph style={warningBoxStyle}>
            <Text type="warning" strong>
              {t('components.techStackModal.copyright.warning')}
            </Text>
          </Paragraph>
        </div>
      ),
    },
    {
      key: 'ai-assist',
      label: t('components.techStackModal.tabAiAssist'),
      children: (
        <div style={tabContentStyle}>
          <Title level={4}>{t('components.techStackModal.aiAssist.title')}</Title>
          <Paragraph>
            {t('components.techStackModal.aiAssist.intro')}
          </Paragraph>
          <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 16 }}>
            <div>
              {t('components.techStackModal.aiAssist.cursor')}
            </div>
            <div>
              {t('components.techStackModal.aiAssist.antigravity')}
            </div>
            <div>
              {t('components.techStackModal.aiAssist.trae')}
            </div>
          </Space>
          <Paragraph type="secondary" style={{ marginTop: 24 }}>
            {t('components.techStackModal.aiAssist.note')}
          </Paragraph>
        </div>
      ),
    },
    {
      key: 'backend',
      label: t('components.techStackModal.tabBackend', { count: backendTech.length }),
      children: (
        <div style={tabContentStyle}>
          <Table
            dataSource={backendTech}
            columns={columns}
            rowKey="name"
            pagination={{ pageSize: 10 }}
            size="small"
          />
        </div>
      ),
    },
    {
      key: 'frontend',
      label: t('components.techStackModal.tabFrontend', { count: frontendTech.length }),
      children: (
        <div style={tabContentStyle}>
          <Table
            dataSource={frontendTech}
            columns={columns}
            rowKey="name"
            pagination={{ pageSize: 10 }}
            size="small"
          />
        </div>
      ),
    },
    {
      key: 'database',
      label: t('components.techStackModal.tabDatabase', { count: databaseTech.length }),
      children: (
        <div style={tabContentStyle}>
          <Table
            dataSource={databaseTech}
            columns={columns}
            rowKey="name"
            pagination={{ pageSize: 10 }}
            size="small"
          />
        </div>
      ),
    },
    {
      key: 'infrastructure',
      label: t('components.techStackModal.tabInfrastructure', { count: infrastructureTech.length }),
      children: (
        <div style={tabContentStyle}>
          <Table
            dataSource={infrastructureTech}
            columns={columns}
            rowKey="name"
            pagination={{ pageSize: 10 }}
            size="small"
          />
        </div>
      ),
    },
  ];

  return (
    <Modal
      title={t('components.techStackModal.title')}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={MODAL_CONFIG.LARGE_WIDTH + 200}
      style={{ top: 24 }}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 180px)',
          overflowY: 'auto',
          padding: token.paddingLG,
        },
      }}
    >
      <Tabs
        defaultActiveKey="overview"
        items={tabItems}
        size="middle"
      />
    </Modal>
  );
};

export default TechStackModal;

