import type React from 'react';

export type ModuleCenterModuleKey =
  | 'sales'
  | 'purchase'
  | 'planning'
  | 'manufacturing'
  | 'warehouse'
  | 'quality'
  | 'equipment'
  | 'finance'
  | 'cost'
  | 'performance';

export type ModuleKpiSideMetric = { label: string; value: React.ReactNode };

export type ModuleKpiDef = {
  key: string;
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  icon: React.ReactNode;
  gradient: string;
  boxShadow?: string;
  onClick?: () => void;
  sideMetrics?: ModuleKpiSideMetric[];
  progress?: number;
};

export type ModuleShortcutDef = {
  key: string;
  title: string;
  icon: React.ReactNode;
  path: string;
};

export type ModuleTodoItem = {
  id: string;
  type: string;
  title: string;
  description?: string;
  priority: string;
  due_date?: string;
  status: string;
  link?: string;
  created_at: string;
};
