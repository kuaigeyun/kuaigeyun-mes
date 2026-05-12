import React from 'react';
import { ActionType, ProColumns } from '@ant-design/pro-components';
import { App } from 'antd';
import { UniTable } from '../../../../../components/uni-table';
import { ListPageTemplate, type StatCard } from '../../../../../components/layout-templates';
import { exportReport } from '../../../services/reports';

/**
 * 销售报表通用组件属性
 */
interface SalesBaseReportProps<T = any> {
  /** 报表标题 */
  title: string;
  /** 报表类型（用于后端识别） */
  reportType?: string;
  /** 表格列定义 */
  columns: ProColumns<T>[];
  /** 统计卡片数据 */
  statCards?: StatCard[];
  /** 默认请求函数（与 UniTable 一致，可接收搜索表单第四参） */
  request?: (
    params: any,
    sort?: any,
    filter?: any,
    searchFormValues?: Record<string, any>,
  ) => Promise<{ data: T[]; total: number; success: boolean }>;
  /** 额外内容（如图表） */
  children?: React.ReactNode;
}

/**
 * 销售模块报表基础模板
 * 
 * 强制包含 16px 外边距 (padding via ListPageTemplate)
 */
const SalesBaseReport: React.FC<SalesBaseReportProps> = ({
  title,
  reportType = 'summary',
  columns,
  statCards = [],
  request,
  children,
}) => {
  const { message: messageApi } = App.useApp();
  const actionRef = React.useRef<ActionType>(null);
  const [loading, setLoading] = React.useState(false);

  // 默认模拟请求（如果未提供真实请求接口）
  const defaultRequest = async (_params: any) => {
    // 模拟 500ms 延迟
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      data: [],
      total: 0,
      success: true,
    };
  };

  const wrappedRequest = async (
    params: any,
    sort: any,
    filter: any,
    searchFormValues?: Record<string, any>,
  ) => {
    const fn = request || defaultRequest;
    try {
      return await (fn as any)(params, sort, filter, searchFormValues);
    } catch {
      return await (fn as any)(params);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    try {
      messageApi.loading(`正在导出 ${title}...`, 0);
      await exportReport(reportType, {});
      messageApi.destroy();
      messageApi.success(`${title} 导出成功`);
    } catch (error) {
      messageApi.destroy();
      messageApi.error(`导出失败：${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ListPageTemplate statCards={statCards}>
      {children}
      <UniTable
        columnPersistenceId="apps.kuaizhizao.pages.sales-management.reports.BaseReport"
        headerTitle={title}
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        showAdvancedSearch={true}
        request={wrappedRequest}
        showExportButton
        onExport={async () => {
          await handleExport();
        }}
        scroll={{ x: 1200 }}
        bordered
      />
    </ListPageTemplate>
  );
};

export default SalesBaseReport;
