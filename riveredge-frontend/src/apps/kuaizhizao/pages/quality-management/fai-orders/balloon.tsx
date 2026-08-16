import React, { useEffect, useState } from 'react';
import { App, Button, Result, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { useLeaveFormTab } from '../../../../../components/uni-tabs/navigateClosingTab';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { removeCustomPageTitle, setCustomPageTitle } from '../../../../../utils/customPageTitle';
import { faiOrderApi, FaiOrder } from '../../../services/fai-order';
import FaiBalloonEditor from './FaiBalloonEditor';
import { FAI_BALLOON_LIST_PATH } from './paths';

const RESOURCE = 'kuaizhizao:quality-management-fai-orders';

const FaiBalloonPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const leave = useLeaveFormTab(FAI_BALLOON_LIST_PATH);
  const { canUpdate } = useResourcePermissions(RESOURCE);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [order, setOrder] = useState<FaiOrder | null>(null);

  const orderId = Number(id);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!Number.isFinite(orderId) || orderId <= 0) {
        setLoadError(true);
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(false);
      try {
        const detail = await faiOrderApi.get(orderId);
        if (!cancelled) setOrder(detail);
      } catch (err: any) {
        if (!cancelled) {
          setLoadError(true);
          messageApi.error(err?.message || t('common.loadFailed'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [messageApi, orderId, t]);

  useEffect(() => {
    if (!order) return;
    const title = t('app.kuaizhizao.quality.fai.balloon.editorTitle', { code: order.fai_code });
    const tabKey = location.pathname + (location.search || '');
    setCustomPageTitle(location.pathname, title);
    setCustomPageTitle(tabKey, title);
    window.dispatchEvent(
      new CustomEvent('riveredge:update-tab-title', {
        detail: { key: tabKey, path: location.pathname, title },
      }),
    );
    return () => {
      removeCustomPageTitle(location.pathname);
      removeCustomPageTitle(tabKey);
    };
  }, [location.pathname, location.search, order, t]);

  if (loading) {
    return (
      <ListPageTemplate fillMain>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Spin />
        </div>
      </ListPageTemplate>
    );
  }

  if (loadError || !order) {
    return (
      <ListPageTemplate fillMain>
        <Result
          status="error"
          title={t('common.loadFailed')}
          extra={
            <Button type="primary" onClick={leave}>
              {t('common.back')}
            </Button>
          }
        />
      </ListPageTemplate>
    );
  }

  const editable = !!canUpdate && ['draft', 'in_progress', 'rejected'].includes(order.status);

  return (
    <ListPageTemplate fillMain>
      <FaiBalloonEditor
        order={order}
        editable={editable}
        onClose={leave}
        onApplied={(updated) => {
          setOrder(updated);
        }}
      />
    </ListPageTemplate>
  );
};

export default FaiBalloonPage;
