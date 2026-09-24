import { api } from '../../../services/api';

export type DrawingWatermarkPosition =
  | 'diagonal'
  | 'center'
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomRight';

export interface DrawingWatermarkStyle {
  opacity: number;
  angle: number;
  fontSize: number;
  color: string;
  position: DrawingWatermarkPosition;
}

export interface DrawingWatermarkPolicy {
  isEnabled: boolean;
  forceOnPrint: boolean;
  opacity: number;
  angle: number;
  fontSize: number;
  color: string;
  position: DrawingWatermarkPosition;
  templatePublic: string;
  templateInternal: string;
  templateSecret: string;
  templateConfidential: string;
}

export type DrawingWatermarkPolicyUpdate = DrawingWatermarkPolicy;

export const drawingWatermarkApi = {
  getPolicy: async (): Promise<DrawingWatermarkPolicy> =>
    api.get<DrawingWatermarkPolicy>('/apps/master-data/process/drawings/watermark-policy'),

  updatePolicy: async (data: DrawingWatermarkPolicyUpdate): Promise<DrawingWatermarkPolicy> =>
    api.put<DrawingWatermarkPolicy>('/apps/master-data/process/drawings/watermark-policy', data),
};
