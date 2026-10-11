import { MarkerTag } from '../../../constants/statusBadges';

/** 单据类型徽章（与快报表 reportListPresentation 一致；主仓不依赖 compose kuaireport） */
export function renderReportDocTypeMarker(label: string, color: string = 'processing') {
  const text = String(label ?? '').trim();
  if (!text) return '-';
  return <MarkerTag color={color}>{text}</MarkerTag>;
}
