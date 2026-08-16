import { ROUTES } from '../../../constants/routes';

export type LogisticsTrackingDeepLinkParams = {
  id?: number | string | null;
  uuid?: string | null;
};

export function buildLogisticsTrackingUrl(params: LogisticsTrackingDeepLinkParams = {}): string {
  const search = new URLSearchParams();
  const id = params.id != null ? String(params.id).trim() : '';
  const uuid = params.uuid != null ? String(params.uuid).trim() : '';
  if (id) search.set('id', id);
  if (uuid) search.set('uuid', uuid);
  const qs = search.toString();
  return qs ? `${ROUTES.LOGISTICS_TRACKING}?${qs}` : ROUTES.LOGISTICS_TRACKING;
}
