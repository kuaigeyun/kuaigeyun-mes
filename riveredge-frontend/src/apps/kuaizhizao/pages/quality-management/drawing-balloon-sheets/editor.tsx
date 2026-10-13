import React, { useEffect, useState } from 'react';
import { App, Button, Result, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { useLocation, useParams } from 'react-router-dom';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { useLeaveFormTab } from '../../../../../components/uni-tabs/navigateClosingTab';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { checkProFeatureAccess } from '../../../../../services/businessConfig';
import { removeCustomPageTitle, setCustomPageTitle } from '../../../../../utils/customPageTitle';
import {
  drawingBalloonSheetApi,
  DrawingBalloonSheet,
} from '../../../services/drawing-balloon-sheet';
import { BalloonSheetEditor } from './BalloonSheetEditor';

const LIST_PATH = '/apps/kuaizhizao/quality-management/drawing-balloon-sheets';
const RESOURCE = 'kuaizhizao:quality-management-drawing-balloon-sheets';

const DrawingBalloonSheetEditorPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const leave = useLeaveFormTab(LIST_PATH);
  const { canUpdate } = useResourcePermissions(RESOURCE);
  const [proLoading, setProLoading] = useState(true);
  const [proOk, setProOk] = useState(false);
  const [proMessage, setProMessage] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sheet, setSheet] = useState<DrawingBalloonSheet | null>(null);

  const sheetId = Number(id);

  useEffect(() => {
    let cancelled = false;
    checkProFeatureAccess('modules', 'drawing_balloon_annotation')
      .then((res) => {
        if (!cancelled) {
          setProOk(res.has_access);
          setProMessage(res.upgrade_message);
          setProLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProOk(false);
          setProLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!proOk) return;
      if (!Number.isFinite(sheetId) || sheetId <= 0) {
        setLoadError(true);
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(false);
      try {
        const detail = await drawingBalloonSheetApi.get(sheetId);
        if (!cancelled) setSheet(detail);
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
  }, [messageApi, proOk, sheetId, t]);

  useEffect(() => {
    if (!sheet) return;
    const title = t('app.kuaizhizao.quality.drawingBalloon.editorTitle', { code: sheet.sheet_code });
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
  }, [location.pathname, location.search, sheet, t]);

  if (proLoading) {
    return (
      <ListPageTemplate fillMain>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Spin />
        </div>
      </ListPageTemplate>
    );
  }

  if (!proOk) {
    return (
      <ListPageTemplate fillMain>
        <Result
          status="403"
          title={t('app.kuaizhizao.quality.drawingBalloon.proRequiredTitle')}
          subTitle={proMessage || t('app.kuaizhizao.quality.drawingBalloon.proRequiredHint')}
          extra={
            <Button type="primary" onClick={leave}>
              {t('common.back')}
            </Button>
          }
        />
      </ListPageTemplate>
    );
  }

  if (loading) {
    return (
      <ListPageTemplate fillMain>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Spin />
        </div>
      </ListPageTemplate>
    );
  }

  if (loadError || !sheet) {
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

  const editable = !!canUpdate && sheet.status === 'draft';

  return (
    <ListPageTemplate fillMain>
      <BalloonSheetEditor
        sheet={sheet}
        editable={editable}
        onClose={leave}
        onApplied={(updated) => {
          setSheet(updated);
        }}
      />
    </ListPageTemplate>
  );
};

export default DrawingBalloonSheetEditorPage;
