/**
 * 技术栈列表 Modal 组件
 * 
 * 展示 RiverEdge SaaS 框架使用的所有技术栈信息，包括版本、作用描述和许可协议
 * 
 * Copyright 2025 无锡快格信息技术有限公司
 * RiverEdge 为无锡快格信息技术有限公司注册商标
 */

import React from 'react';
import { Alert, Badge, Modal, Tabs, Table, Tag, Typography, Space, Divider, theme } from 'antd';
import type { TabsProps } from 'antd';
import { ExclamationCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import { MODAL_CONFIG, PAGE_SPACING } from '../layout-templates/constants';

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
    name: 'React Hook Form',
    version: '7.53.0+',
    description: '高性能表单库，最小重新渲染',
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
    name: 'ReactFlow',
    version: '^11.10.0',
    description: '流程图/节点编辑器核心库（Pro Flow 依赖）',
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
    name: '@jiaminghi/data-view-react',
    version: '^1.2.5',
    description: '大屏数据可视化组件',
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
    name: 'lodash-es',
    version: '4.17.21+',
    description: '工具函数库，支持 tree-shaking',
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
    name: 'zod',
    version: '^3.23.8',
    description: 'TypeScript 优先的模式验证',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: 'rc-tween-one',
    version: '^3.0.6',
    description: '动画库',
    license: 'MIT License',
    commercialUse: true,
    category: 'frontend',
  },
  {
    name: 'react-to-print',
    version: '^2.15.0',
    description: 'React 打印库',
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
    name: 'recharts',
    version: '^3.5.1',
    description: '基于 React 的图表库',
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
  const { token } = useToken();
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

  // 表格列定义
  const columns = [
    {
      title: '技术名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text: string, record: TechStackItem) => (
        <Space>
          {text}
          {record.isCore && (
            <Tag color="gold" icon={<FileTextOutlined />}>
              核心组件
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 150,
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: '作用描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '许可协议',
      dataIndex: 'license',
      key: 'license',
      width: 200,
      render: (text: string) => <Text type="secondary">{text}</Text>,
    },
    {
      title: '商业使用',
      dataIndex: 'commercialUse',
      key: 'commercialUse',
      width: 100,
      align: 'center' as const,
      render: (value: boolean) => (
        <Tag color={value ? 'success' : 'error'}>
          {value ? '✅ 免费' : '❌ 需许可'}
        </Tag>
      ),
    },
  ];

  // Tab 配置
  const tabItems: TabsProps['items'] = [
    {
      key: 'overview',
      label: '概览',
      children: (
        <div style={tabContentStyle}>
          <Title level={4}>核心技术栈</Title>
          <Paragraph>
            RiverEdge SaaS 多组织框架采用现代化的技术栈：
          </Paragraph>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text strong>FastAPI</Text>：高性能异步 Web 框架
            </div>
            <div>
              <Text strong>Inngest</Text>：现代化任务调度系统
            </div>
            <div>
              <Text strong>React</Text>：现代化前端框架
            </div>
            <div>
              <Text strong>Tortoise ORM</Text>：异步 ORM 框架
            </div>
            <div>
              <Text strong>Ant Design</Text>：企业级 UI 组件库
            </div>
          </Space>
          <Divider />
          <Title level={5}>许可协议说明</Title>
          <Paragraph>
            所有核心技术均采用宽松的开源许可证（MIT、Apache 2.0、BSD 等），可放心用于商业项目。
          </Paragraph>
          <Paragraph>
            <Text strong>⚠️ 重要提示：</Text> Redis 服务器必须使用 <Text code>6.2.6+</Text> 版本（BSD 3-Clause 许可证），
            避免使用 Redis 7.0+（RSAL 许可证限制商业使用）。
          </Paragraph>
        </div>
      ),
    },
    {
      key: 'copyright',
      label: (
        <Badge dot color="red" offset={[8, 0]}>
          <span>本项目版权声明</span>
        </Badge>
      ),
      children: (
        <div style={tabContentStyle}>
          <Alert
            message="重要说明"
            description="使用、修改或分发本项目前，请务必阅读并遵守以下版权与许可声明。"
            type="info"
            showIcon
            icon={<ExclamationCircleOutlined />}
            style={{ marginBottom: 24 }}
          />
          <Title level={4}>本项目版权声明</Title>
          <Paragraph>
            本声明适用于 RiverEdge SaaS 多组织框架及其相关源代码、文档、插件式应用与衍生产物。
          </Paragraph>
          
          <Title level={5}>版权归属</Title>
          <Paragraph>
            <Text strong>Copyright © 无锡快格信息技术有限公司</Text>
          </Paragraph>
          <Paragraph type="secondary">
            无锡快格信息技术有限公司拥有本项目的著作权。使用、修改、分发等权利由下方 Apache License 2.0 许可协议规定。
          </Paragraph>
          
          <Divider />
          
          <Title level={5}>商标</Title>
          <Paragraph>
            <Text strong>riveredge</Text> 为无锡快格信息技术有限公司注册商标，受《中华人民共和国商标法》保护。
          </Paragraph>
          <Paragraph>
            Apache License 2.0 不授予商标使用权。未经书面许可，不得：
          </Paragraph>
          <Paragraph style={{ paddingLeft: token.paddingLG }}>
            • 使用 "riveredge" 进行商业推广或声称与本公司存在合作关系
          </Paragraph>
          <Paragraph style={{ paddingLeft: token.paddingLG }}>
            • 将 "riveredge" 作为自研产品或服务名称使用
          </Paragraph>
          
          <Divider />
          
          <Title level={5}>软件许可</Title>
          <Paragraph>
            本项目采用 <Text code>Apache License 2.0</Text>。您可：
          </Paragraph>
          <Paragraph style={{ paddingLeft: token.paddingLG }}>
            ✅ 商业使用、修改、私有使用、分发源代码或二进制
          </Paragraph>
          <Paragraph style={{ paddingLeft: token.paddingLG }}>
            ✅ 获得明确的专利使用权
          </Paragraph>
          <Paragraph type="secondary" style={{ marginTop: 8 }}>
            完整协议详见项目根目录 <Text code>LICENSE</Text> 文件。
          </Paragraph>
          
          <Divider />
          
          <Title level={5}>合规要求</Title>
          <Paragraph>
            商业使用时须保留：版权声明、商标说明及 Apache 2.0 许可文本。
          </Paragraph>
          <Paragraph>
            <Text strong>经本公司书面授权</Text>，被授权方可去除或替换版权声明、商标等公司标识，用于白标部署、私有化或定制化产品。
          </Paragraph>
          <Paragraph style={warningBoxStyle}>
            <Text type="warning" strong>
              删除或篡改版权/商标声明将违反许可协议并可能承担法律责任。
            </Text>
          </Paragraph>
        </div>
      ),
    },
    {
      key: 'ai-assist',
      label: 'AI 辅助',
      children: (
        <div style={tabContentStyle}>
          <Title level={4}>AI 辅助编制声明</Title>
          <Paragraph>
            本项目在以下 IDE 及其编程模型的辅助下编制：
          </Paragraph>
          <Space direction="vertical" size="middle" style={{ width: '100%', marginTop: 16 }}>
            <div>
              <Text strong>Cursor</Text> —— <Text code>Composer 1.0</Text> / <Text code>Composer 1.5</Text>
            </div>
            <div>
              <Text strong>Antigravity</Text> —— <Text code>Gemini 3 Pro</Text>
            </div>
          </Space>
          <Paragraph type="secondary" style={{ marginTop: 24 }}>
            部分代码与文档在 AI 辅助下完成编写，开发过程中由人工主导设计与决策，AI 用于提高效率与辅助实现。
          </Paragraph>
        </div>
      ),
    },
    {
      key: 'backend',
      label: `后端技术 (${backendTech.length})`,
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
      label: `前端技术 (${frontendTech.length})`,
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
      label: `数据库 (${databaseTech.length})`,
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
      label: `基础设施 (${infrastructureTech.length})`,
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
      title="版权声明"
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

