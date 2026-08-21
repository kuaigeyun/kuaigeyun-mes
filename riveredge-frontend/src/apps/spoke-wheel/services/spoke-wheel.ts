import { spokeWheelGet, spokeWheelPost, spokeWheelPatch } from './spokeWheelApi';

export interface SpokeWheelAssembly {
  id: number;
  code: string;
  work_order_id: number | null;
  work_order_code: string | null;
  product_material_code: string | null;
  product_material_name: string | null;
  hub_assembled: boolean;
  hub_barrel_assembled: boolean;
  fixture_dial_count: number;
  status: 'draft' | 'fixed' | 'debugging' | 'qc_passed' | 'qc_failed' | 'completed';
  assembler_name: string | null;
  debugger_name: string | null;
  inspector_name: string | null;
  fixed_at: string | null;
  debug_completed_at: string | null;
  completed_at: string | null;
  remarks: string | null;
  final_max_deviation_mm: string | null;
  final_qc_passed: boolean | null;
  created_at: string;
}

export interface ConcentricityCheck {
  id: number;
  assembly_id: number;
  assembly_code: string;
  dial_1_value: string;
  dial_2_value: string;
  dial_3_value: string;
  max_deviation_mm: string;
  tolerance_mm: string;
  is_qualified: boolean;
  inspector_name: string | null;
  measured_at: string | null;
  remarks: string | null;
  created_at: string;
}

export interface CreateAssemblyPayload {
  code?: string;
  work_order_id?: number;
  work_order_code?: string;
  product_material_id?: number;
  product_material_code?: string;
  product_material_name?: string;
  fixture_dial_count?: number;
  remarks?: string;
}

export interface CreateCheckPayload {
  assembly_id: number;
  dial_1_value: number;
  dial_2_value: number;
  dial_3_value: number;
  tolerance_mm?: number;
  inspector_name?: string;
  remarks?: string;
}

export const listAssemblies = (params?: Record<string, unknown>) =>
  spokeWheelGet<SpokeWheelAssembly[]>('/assemblies', params);

export const getAssembly = (id: number) =>
  spokeWheelGet<SpokeWheelAssembly>(`/assemblies/${id}`);

export const createAssembly = (data: CreateAssemblyPayload) =>
  spokeWheelPost<SpokeWheelAssembly>('/assemblies', data);

export const updateAssembly = (id: number, data: Partial<CreateAssemblyPayload & { status: string; hub_assembled: boolean; hub_barrel_assembled: boolean }>) =>
  spokeWheelPatch<SpokeWheelAssembly>(`/assemblies/${id}`, data);

export const createCheck = (data: CreateCheckPayload) =>
  spokeWheelPost<ConcentricityCheck>('/concentricity-checks', data);

export const listChecksByAssembly = (assemblyId: number) =>
  spokeWheelGet<ConcentricityCheck[]>(`/concentricity-checks/by-assembly/${assemblyId}`);