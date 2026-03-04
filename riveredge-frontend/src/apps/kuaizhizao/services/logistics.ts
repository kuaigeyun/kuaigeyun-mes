/**
 * 物流查询 API
 */

import { apiRequest } from '../../../services/api';

export interface LogisticsTrace {
  time: string;
  status: string;
  location: string;
}

export interface LogisticsTrackResponse {
  success: boolean;
  carrier: string;
  tracking_number: string;
  status: string;
  traces?: LogisticsTrace[];
  message?: string;
}

export const logisticsApi = {
  track: async (carrier: string, trackingNumber: string): Promise<LogisticsTrackResponse> =>
    apiRequest('/core/logistics/track', {
      method: 'GET',
      params: { carrier, tracking_number: trackingNumber },
    }),
};
