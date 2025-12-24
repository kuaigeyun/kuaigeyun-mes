/**
 * 技术栈列表 Modal 组件
 * 
 * 展示 RiverEdge SaaS 框架使用的所有技术栈信息，包括版本、作用描述和许可协议
 * 
 * Copyright 2025 无锡快格信息技术有限公司
 * RiverEdge 为无锡快格信息技术有限公司注册商标
 */

import React from 'react';
import { Modal, Tabs, Table, Tag, Typography, Space, Divider, Badge } from 'antd';
import type { TabsProps } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

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
    version: '3.11 LTS',
    description: '编程语言，长期支持版本',
    license: 'PSF License (类似 BSD)',
    commercialUse: true,
    category: 'backend',
  },
  {
    name: 'Uvicorn',
    version: '0.32.0+',
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
    version: '5.0.1+',
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
    description: '流程设计器，用于审批流程设计',
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
    description: 'Excel 在线编辑器',
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
    name: 'react-i18next',
    version: '14.1.3+',
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
    name: 'react-to-print',
    version: '^2.15.0',
    description: 'React 打印库',
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
    license: 'BSD 3-Clause',
    commercialUse: true,
    category: 'database',
  },
  {
    name: 'kkfileview',
    version: 'latest',
    description: '文件预览服务，支持多种文件格式',
    license: 'Apache License 2.0',
    commercialUse: true,
    category: 'infrastructure',
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
    description: 'Node.js 包管理器',
    license: 'Artistic License 2.0',
    commercialUse: true,
    category: 'infrastructure',
  },
  {
    name: 'pnpm',
    version: '8.15.0',
    description: '快速、节省磁盘空间的包管理器',
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
        <div style={{ padding: '16px 0', minHeight: '500px', backgroundColor: '#fff' }}>
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
          <span>版权声明</span>
        </Badge>
      ),
      children: (
        <div style={{ padding: '16px 0', minHeight: '500px', backgroundColor: '#fff' }}>
          <Title level={4}>版权声明</Title>
          <Paragraph>
            <Text strong style={{ fontSize: 16 }}>
              Copyright © 无锡快格信息技术有限公司
            </Text>
          </Paragraph>
          
          <Divider />
          
          <Title level={4}>商标声明</Title>
          <Paragraph>
            <Text strong>riveredge</Text> 为<Text strong> 无锡快格信息技术有限公司</Text>注册商标，受《中华人民共和国商标法》保护。
          </Paragraph>
          <Paragraph>
            <Text strong>商标使用限制：</Text>
          </Paragraph>
          <Paragraph style={{ paddingLeft: 24 }}>
            • 未经无锡快格信息技术有限公司书面许可，任何个人或组织不得使用 "riveredge" 商标进行商业活动
          </Paragraph>
          <Paragraph style={{ paddingLeft: 24 }}>
            • 不得使用 riveredge 商标进行商业推广或声称与无锡快格信息技术有限公司有合作关系
          </Paragraph>
          <Paragraph style={{ paddingLeft: 24 }}>
            • 不得将 riveredge 商标作为产品或服务名称使用
          </Paragraph>
          <Paragraph style={{ marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              ⚠️ 重要提示：本项目的 Apache License 2.0 许可协议不授予任何商标使用权。
            </Text>
          </Paragraph>
          
          <Divider />
          
          <Title level={4}>许可协议</Title>
          <Paragraph>
            <Text strong>许可协议类型：</Text> Apache License 2.0
          </Paragraph>
          <Paragraph>
            本项目采用 Apache License 2.0 许可协议，允许您：
          </Paragraph>
          <Paragraph style={{ paddingLeft: 24 }}>
            ✅ 商业使用：可以用于商业项目
          </Paragraph>
          <Paragraph style={{ paddingLeft: 24 }}>
            ✅ 修改源代码：可以根据需要修改代码
          </Paragraph>
          <Paragraph style={{ paddingLeft: 24 }}>
            ✅ 分发：可以分发源代码和二进制文件
          </Paragraph>
          <Paragraph style={{ paddingLeft: 24 }}>
            ✅ 专利使用：明确授予专利使用权
          </Paragraph>
          <Paragraph style={{ paddingLeft: 24 }}>
            ✅ 私有使用：可以在私有项目中使用
          </Paragraph>
          <Paragraph style={{ marginTop: 8 }}>
            完整的许可协议文本请查看项目根目录的 <Text code>LICENSE</Text> 文件。
          </Paragraph>
          
          <Divider />
          
          <Title level={4}>商业使用要求</Title>
          <Paragraph>
            <Text strong type="warning">⚠️ 重要：</Text>在使用本项目进行商业活动时，<Text strong>必须保留</Text>以下内容：
          </Paragraph>
          <Paragraph style={{ paddingLeft: 24, marginTop: 8 }}>
            <Text strong>1. 版权声明</Text>
          </Paragraph>
          <Paragraph style={{ paddingLeft: 40 }}>
            Copyright © 无锡快格信息技术有限公司
          </Paragraph>
          <Paragraph style={{ paddingLeft: 24, marginTop: 8 }}>
            <Text strong>2. 商标声明</Text>
          </Paragraph>
          <Paragraph style={{ paddingLeft: 40 }}>
            riveredge 为无锡快格信息技术有限公司注册商标
          </Paragraph>
          <Paragraph style={{ paddingLeft: 24, marginTop: 8 }}>
            <Text strong>3. 许可协议</Text>
          </Paragraph>
          <Paragraph style={{ paddingLeft: 40 }}>
            Apache License 2.0 许可协议文本（完整内容）
          </Paragraph>
          <Paragraph style={{ marginTop: 16, padding: '12px', background: '#fff7e6', borderRadius: '4px', border: '1px solid #ffd591' }}>
            <Text type="warning" strong>
              ⚠️ 警告：删除或修改版权与商标声明将违反 Apache License 2.0 许可协议，可能导致法律后果。
            </Text>
          </Paragraph>
        </div>
      ),
    },
    {
      key: 'backend',
      label: `后端技术 (${backendTech.length})`,
      children: (
        <div style={{ padding: '16px 0', minHeight: '500px', backgroundColor: '#fff' }}>
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
        <div style={{ padding: '16px 0', minHeight: '500px', backgroundColor: '#fff' }}>
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
        <div style={{ padding: '16px 0', minHeight: '500px', backgroundColor: '#fff' }}>
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
        <div style={{ padding: '16px 0', minHeight: '500px', backgroundColor: '#fff' }}>
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
      title={
        <Space>
          <FileTextOutlined />
          <span>版权声明</span>
        </Space>
      }
      open={open}
      onCancel={onCancel}
      footer={null}
      width={1200}
      style={{ top: 20 }}
      styles={{
        body: {
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
          padding: '24px',
        },
      }}
    >
      <Tabs 
        defaultActiveKey="overview" 
        items={tabItems}
      />
    </Modal>
  );
};

export default TechStackModal;

