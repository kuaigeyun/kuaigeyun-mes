export interface MaterialUnit {
  id: number;
  uuid: string;
  code: string;
  name: string;
  is_active: boolean;
  is_system: boolean;
  sort_order: number;
  description?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  updated_by?: number | null;
  updated_by_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MaterialUnitCreate {
  code: string;
  name: string;
  is_active?: boolean;
  sort_order?: number;
  description?: string | null;
}

export type MaterialUnitUpdate = Partial<Omit<MaterialUnitCreate, 'code'>>;

export interface MaterialUnitConversion {
  id: number;
  uuid: string;
  from_unit_code: string;
  to_unit_code: string;
  numerator: number;
  denominator: number;
  is_active: boolean;
  is_system: boolean;
  description?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  updated_by?: number | null;
  updated_by_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface MaterialUnitConversionCreate {
  from_unit_code: string;
  to_unit_code: string;
  numerator: number;
  denominator: number;
  is_active?: boolean;
  description?: string | null;
}

export type MaterialUnitConversionUpdate = Partial<
  Pick<MaterialUnitConversionCreate, 'numerator' | 'denominator' | 'is_active' | 'description'>
>;

export interface MaterialUnitConversionResolve {
  found: boolean;
  from_unit_code: string;
  to_unit_code: string;
  numerator?: number | null;
  denominator?: number | null;
  material_numerator?: number | null;
  material_denominator?: number | null;
}

export interface MaterialUnitEnsurePresetsResult {
  units_created: number;
  conversions_created: number;
  units_backfilled: number;
}
