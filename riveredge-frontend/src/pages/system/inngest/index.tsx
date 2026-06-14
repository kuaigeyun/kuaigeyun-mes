import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Card, Typography } from 'antd';

const { Paragraph, Title } = Typography;

/**
 * 历史路由与菜单仍可能指向本页；异步任务已由 Taskiq + PostgreSQL 承载，不再嵌入 Inngest Dev UI。
 */
const TaskiqBackgroundTasksPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <Title level={4}>{t('pages.system.inngest.title')}</Title>
      <Card>
        <Paragraph>{t('pages.system.inngest.intro')}</Paragraph>
        <Alert type="info" showIcon title={t('pages.system.inngest.noIframe')} />
      </Card>
    </div>
  );
};

export default TaskiqBackgroundTasksPage;
