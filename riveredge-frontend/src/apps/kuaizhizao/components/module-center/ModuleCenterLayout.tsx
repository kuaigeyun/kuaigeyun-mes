import React, { useState } from 'react';
import { Row, Col, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { UniDashboard } from '../../../../components/uni-dashboard';
import { ThemedSegmented } from '../../../../components/themed-segmented';
import RichModuleCenterHelpView from '../../../../components/page-help-wiki/RichModuleCenterHelpView';
import type { RichModuleCenterHelpKey } from '../../../../components/page-help-wiki/richModuleCenterHelpRegistry';
import { MODULE_CENTER_GUTTER } from './constants';

export interface ModuleCenterLayoutProps {
  loading?: boolean;
  kpiRow: React.ReactNode;
  /** 省略则不展示快捷入口行（普通看板常用） */
  shortcutRow?: React.ReactNode;
  /** 独占整行内容（如研发甘特图），渲染在 shortcutRow 之后、actionRow 之前 */
  fullWidthRow?: React.ReactNode;
  actionRow?: React.ReactNode;
  chartRow?: React.ReactNode;
  /** 默认 true；财务/经营分析等普通看板可设为 false 去掉右侧工作台栏 */
  showSidebar?: boolean;
  /** 传入后在顶部展示「工作台 / 帮助」切换 */
  moduleHelpKey?: RichModuleCenterHelpKey;
}

export function ModuleCenterLayout({
  loading,
  kpiRow,
  shortcutRow,
  fullWidthRow,
  actionRow,
  chartRow,
  showSidebar = true,
  moduleHelpKey,
}: ModuleCenterLayoutProps) {
  const { t } = useTranslation();
  const [centerView, setCenterView] = useState<'workbench' | 'help'>('workbench');

  const workbenchBody = (
    <Spin spinning={!!loading}>
      <Row gutter={[MODULE_CENTER_GUTTER, MODULE_CENTER_GUTTER]}>
        <Col span={24}>{kpiRow}</Col>
        {shortcutRow ? <Col span={24}>{shortcutRow}</Col> : null}
        {fullWidthRow ? (
          <Col span={24} style={{ minWidth: 0 }}>
            {fullWidthRow}
          </Col>
        ) : null}
        {actionRow}
        {chartRow}
      </Row>
    </Spin>
  );

  const headerToggle =
    moduleHelpKey != null ? (
      <div style={{ marginBottom: MODULE_CENTER_GUTTER }}>
        <ThemedSegmented
          value={centerView}
          options={[
            { label: t('help.moduleCenter.view.workbench'), value: 'workbench' },
            { label: t('help.moduleCenter.view.help'), value: 'help' },
          ]}
          onChange={(val) => setCenterView((val as 'workbench' | 'help') ?? 'workbench')}
        />
      </div>
    ) : null;

  const mainContent =
    moduleHelpKey != null && centerView === 'help' ? (
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <RichModuleCenterHelpView moduleKey={moduleHelpKey} />
      </div>
    ) : (
      workbenchBody
    );

  return (
    <UniDashboard showSidebar={showSidebar}>
      {headerToggle}
      {mainContent}
    </UniDashboard>
  );
}

export default ModuleCenterLayout;
