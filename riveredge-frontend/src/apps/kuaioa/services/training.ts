import { kuaioaDelete, kuaioaList, kuaioaPost, kuaioaPut } from './kuaioaApi';

const BASE = '/apps/kuaioa/training';

export interface TrainingPlan {
  id: number;
  plan_code: string;
  plan_name: string;
  plan_type: string;
  department_name?: string | null;
  status: string;
}

export interface TrainingRecord {
  id: number;
  record_code: string;
  training_name: string;
  trainee_name?: string | null;
  training_date?: string | null;
  is_passed: boolean;
  status: string;
}

export interface WorkLicense {
  id: number;
  license_code: string;
  license_name: string;
  holder_name?: string | null;
  expiry_date?: string | null;
  status: string;
}

export const listTrainingPlans = (params?: Record<string, unknown>) =>
  kuaioaList<TrainingPlan>(`${BASE}/plans`, params);
export const createTrainingPlan = (data: Partial<TrainingPlan>) =>
  kuaioaPost<TrainingPlan>(`${BASE}/plans`, data);
export const updateTrainingPlan = (id: number, data: Partial<TrainingPlan>) =>
  kuaioaPut<TrainingPlan>(`${BASE}/plans/${id}`, data);
export const deleteTrainingPlan = (id: number) => kuaioaDelete(`${BASE}/plans/${id}`);

export const listTrainingRecords = (params?: Record<string, unknown>) =>
  kuaioaList<TrainingRecord>(`${BASE}/records`, params);
export const createTrainingRecord = (data: Partial<TrainingRecord>) =>
  kuaioaPost<TrainingRecord>(`${BASE}/records`, data);
export const updateTrainingRecord = (id: number, data: Partial<TrainingRecord>) =>
  kuaioaPut<TrainingRecord>(`${BASE}/records/${id}`, data);
export const deleteTrainingRecord = (id: number) => kuaioaDelete(`${BASE}/records/${id}`);

export const listWorkLicenses = (params?: Record<string, unknown>) =>
  kuaioaList<WorkLicense>(`${BASE}/work-licenses`, params);
export const createWorkLicense = (data: Partial<WorkLicense>) =>
  kuaioaPost<WorkLicense>(`${BASE}/work-licenses`, data);
export const updateWorkLicense = (id: number, data: Partial<WorkLicense>) =>
  kuaioaPut<WorkLicense>(`${BASE}/work-licenses/${id}`, data);
export const deleteWorkLicense = (id: number) => kuaioaDelete(`${BASE}/work-licenses/${id}`);
