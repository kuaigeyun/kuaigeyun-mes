import React, { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { ListPageTemplate } from '../../../../../components/layout-templates';
import { drawingBalloonSheetApi } from '../../../services/drawing-balloon-sheet';

const SHEET_LIST = '/apps/kuaizhizao/quality-management/drawing-balloon-sheets';

/** 旧书签：跳转到关联气泡标注单或列表 */
const FaiBalloonLegacyRedirect: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const orderId = Number(id);
      if (!Number.isFinite(orderId) || orderId <= 0) {
        if (!cancelled) navigate(SHEET_LIST, { replace: true });
        return;
      }
      try {
        const sheet = await drawingBalloonSheetApi.getByFaiOrder(orderId);
        if (cancelled) return;
        if (sheet?.id) {
          navigate(`${SHEET_LIST}/${sheet.id}/editor`, { replace: true });
        } else {
          navigate(SHEET_LIST, { replace: true });
        }
      } catch {
        if (!cancelled) navigate(SHEET_LIST, { replace: true });
      } finally {
        if (!cancelled) setDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  if (done) return null;

  return (
    <ListPageTemplate fillMain>
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin />
      </div>
    </ListPageTemplate>
  );
};

export default FaiBalloonLegacyRedirect;
