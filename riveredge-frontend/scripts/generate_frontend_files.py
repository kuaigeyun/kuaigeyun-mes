#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量生成所有模块的前端文件（types、services、index.tsx、pages）
"""

import os
import re

# 定义所有模块和模型
MODULES = {
    "kuaipm": {
        "name": "PM",
        "nameCn": "项目管理",
        "models": [
            ("Project", "project", "项目", "projects"),
            ("ProjectApplication", "project_application", "项目申请", "project-applications"),
            ("ProjectWBS", "project_wbs", "项目WBS", "project-wbss"),
            ("ProjectTask", "project_task", "项目任务", "project-tasks"),
            ("ProjectResource", "project_resource", "项目资源", "project-resources"),
            ("ProjectProgress", "project_progress", "项目进度", "project-progresss"),
            ("ProjectCost", "project_cost", "项目成本", "project-costs"),
            ("ProjectRisk", "project_risk", "项目风险", "project-risks"),
            ("ProjectQuality", "project_quality", "项目质量", "project-qualitys"),
        ]
    },
    "kuaiehs": {
        "name": "EHS",
        "nameCn": "环境健康安全管理",
        "models": [
            ("EnvironmentMonitoring", "environment_monitoring", "环境监测", "environment-monitorings"),
            ("EmissionManagement", "emission_management", "排放管理", "emission-managements"),
            ("EnvironmentalCompliance", "environmental_compliance", "环保合规", "environmental-compliances"),
            ("EnvironmentalIncident", "environmental_incident", "环境事故", "environmental-incidents"),
            ("OccupationalHealthCheck", "occupational_health_check", "职业健康检查", "occupational-health-checks"),
            ("OccupationalDisease", "occupational_disease", "职业病", "occupational-diseases"),
            ("HealthRecord", "health_record", "健康档案", "health-records"),
            ("SafetyTraining", "safety_training", "安全培训", "safety-trainings"),
            ("SafetyInspection", "safety_inspection", "安全检查", "safety-inspections"),
            ("SafetyHazard", "safety_hazard", "安全隐患", "safety-hazards"),
            ("SafetyIncident", "safety_incident", "安全事故", "safety-incidents"),
            ("Regulation", "regulation", "法规", "regulations"),
            ("ComplianceCheck", "compliance_check", "合规检查", "compliance-checks"),
            ("ComplianceReport", "compliance_report", "合规报告", "compliance-reports"),
        ]
    },
    "kuaicert": {
        "name": "认证",
        "nameCn": "企业认证与评审",
        "models": [
            ("CertificationType", "certification_type", "认证类型", "certification-types"),
            ("CertificationStandard", "certification_standard", "认证标准", "certification-standards"),
            ("ScoringRule", "scoring_rule", "评分规则", "scoring-rules"),
            ("CertificationRequirement", "certification_requirement", "认证要求", "certification-requirements"),
            ("CurrentAssessment", "current_assessment", "现状评估", "current-assessments"),
            ("SelfAssessment", "self_assessment", "自评打分", "self-assessments"),
            ("AssessmentReport", "assessment_report", "评估报告", "assessment-reports"),
            ("ImprovementSuggestion", "improvement_suggestion", "改进建议", "improvement-suggestions"),
            ("ImprovementPlan", "improvement_plan", "改进计划", "improvement-plans"),
            ("BestPractice", "best_practice", "最佳实践", "best-practices"),
            ("CertificationApplication", "certification_application", "认证申请", "certification-applications"),
            ("CertificationProgress", "certification_progress", "认证进度", "certification-progresss"),
            ("CertificationCertificate", "certification_certificate", "认证证书", "certification-certificates"),
        ]
    },
    "kuaiepm": {
        "name": "EPM",
        "nameCn": "企业绩效管理",
        "models": [
            ("KPI", "kpi", "KPI", "kpis"),
            ("KPIMonitoring", "kpi_monitoring", "KPI监控", "kpi-monitorings"),
            ("KPIAnalysis", "kpi_analysis", "KPI分析", "kpi-analysiss"),
            ("KPIAlert", "kpi_alert", "KPI预警", "kpi-alerts"),
            ("StrategyMap", "strategy_map", "战略地图", "strategy-maps"),
            ("Objective", "objective", "目标", "objectives"),
            ("PerformanceEvaluation", "performance_evaluation", "绩效评估", "performance-evaluations"),
            ("BusinessDashboard", "business_dashboard", "经营仪表盘", "business-dashboards"),
            ("BusinessDataAnalysis", "business_data_analysis", "经营数据分析", "business-data-analysiss"),
            ("TrendAnalysis", "trend_analysis", "趋势分析", "trend-analysiss"),
            ("ComparisonAnalysis", "comparison_analysis", "对比分析", "comparison-analysiss"),
            ("Budget", "budget", "预算", "budgets"),
            ("BudgetVariance", "budget_variance", "预算差异", "budget-variances"),
            ("BudgetForecast", "budget_forecast", "预算预测", "budget-forecasts"),
        ]
    },
    "kuaioa": {
        "name": "OA",
        "nameCn": "协同办公",
        "models": [
            ("ApprovalProcess", "approval_process", "审批流程", "approval-processs"),
            ("ApprovalInstance", "approval_instance", "审批实例", "approval-instances"),
            ("ApprovalNode", "approval_node", "审批节点", "approval-nodes"),
            ("Document", "document", "文档", "documents"),
            ("DocumentVersion", "document_version", "文档版本", "document-versions"),
            ("Meeting", "meeting", "会议", "meetings"),
            ("MeetingMinutes", "meeting_minutes", "会议纪要", "meeting-minutess"),
            ("MeetingResource", "meeting_resource", "会议资源", "meeting-resources"),
            ("Notice", "notice", "公告", "notices"),
            ("Notification", "notification", "通知", "notifications"),
        ]
    },
}

BASE_DIR = "riveredge-frontend/src/apps"

# Type定义模板
TYPE_TEMPLATE = '''export interface {ModelName} {{
  id: number;
  uuid: string;
  tenantId?: number;
  {no_field}: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}}

export interface {ModelName}Create {{
  {no_field}: string;
  status?: string;
}}

export interface {ModelName}Update {{
  status?: string;
}}

export interface {ModelName}ListParams {{
  skip?: number;
  limit?: number;
  status?: string;
}}
'''

# Service模板
SERVICE_TEMPLATE = '''/**
 * {model_name_cn} API 服务
 */
export const {model_name}Api = {{
  create: async (data: {ModelName}Create): Promise<{ModelName}> => {{
    return api.post('/{module_name}/{api_path}', data);
  }},
  list: async (params?: {ModelName}ListParams): Promise<{ModelName}[]> => {{
    return api.get('/{module_name}/{api_path}', {{ params }});
  }},
  get: async (uuid: string): Promise<{ModelName}> => {{
    return api.get(`/{module_name}/{api_path}/${{uuid}}`);
  }},
  update: async (uuid: string, data: {ModelName}Update): Promise<{ModelName}> => {{
    return api.put(`/{module_name}/{api_path}/${{uuid}}`, data);
  }},
  delete: async (uuid: string): Promise<void> => {{
    return api.delete(`/{module_name}/{api_path}/${{uuid}}`);
  }},
}};
'''

# Page组件模板
PAGE_TEMPLATE = '''/**
 * {model_name_cn}管理页面
 * 
 * 提供{model_name_cn}的 CRUD 功能。
 */

import React, {{ useRef, useState }} from 'react';
import {{ ActionType, ProColumns, ProForm, ProFormText, ProFormInstance }} from '@ant-design/pro-components';
import {{ App, Popconfirm, Button, Tag, Space, Modal }} from 'antd';
import {{ EditOutlined, DeleteOutlined, PlusOutlined }} from '@ant-design/icons';
import {{ UniTable }} from '@/components/uni_table';
import {{ {model_name}Api }} from '../../services/process';
import type {{ {ModelName}, {ModelName}Create, {ModelName}Update }} from '../../types/process';

const {ModelName}Page: React.FC = () => {{
  const {{ message: messageApi }} = App.useApp();
  const actionRef = useRef<ActionType>(null);
  const formRef = useRef<ProFormInstance>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [currentUuid, setCurrentUuid] = useState<string | null>(null);

  const handleCreate = () => {{
    setIsEdit(false);
    setCurrentUuid(null);
    setModalVisible(true);
    formRef.current?.resetFields();
    formRef.current?.setFieldsValue({{
      status: '待处理',
    }});
  }};

  const handleEdit = async (record: {ModelName}) => {{
    try {{
      setIsEdit(true);
      setCurrentUuid(record.uuid);
      setModalVisible(true);
      const data = await {model_name}Api.get(record.uuid);
      formRef.current?.setFieldsValue(data);
    }} catch (error: any) {{
      messageApi.error(error.message || '获取详情失败');
    }}
  }};

  const handleDelete = async (record: {ModelName}) => {{
    try {{
      await {model_name}Api.delete(record.uuid);
      messageApi.success('删除成功');
      actionRef.current?.reload();
    }} catch (error: any) {{
      messageApi.error(error.message || '删除失败');
    }}
  }};

  const handleSubmit = async (values: {ModelName}Create | {ModelName}Update) => {{
    try {{
      setFormLoading(true);
      if (isEdit && currentUuid) {{
        await {model_name}Api.update(currentUuid, values as {ModelName}Update);
        messageApi.success('更新成功');
      }} else {{
        await {model_name}Api.create(values as {ModelName}Create);
        messageApi.success('创建成功');
      }}
      setModalVisible(false);
      actionRef.current?.reload();
    }} catch (error: any) {{
      messageApi.error(error.message || '操作失败');
    }} finally {{
      setFormLoading(false);
    }}
  }};

  const columns: ProColumns<{ModelName}>[] = [
    {{
      title: '{no_field_cn}',
      dataIndex: '{no_field}',
      key: '{no_field}',
      width: 200,
    }},
    {{
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (text: string) => {{
        const colorMap: Record<string, string> = {{
          '待处理': 'default',
          '进行中': 'processing',
          '已完成': 'success',
          '已取消': 'error',
        }};
        return <Tag color={{colorMap[text] || 'default'}}>{{text}}</Tag>;
      }},
    }},
    {{
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right',
      render: (_: any, record: {ModelName}) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={{<EditOutlined />}}
            onClick={{() => handleEdit(record)}}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除吗？"
            onConfirm={{() => handleDelete(record)}}
          >
            <Button
              type="link"
              size="small"
              danger
              icon={{<DeleteOutlined />}}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    }},
  ];

  return (
    <div style={{{{ padding: '16px', margin: 0, boxSizing: 'border-box' }}}}>
      <UniTable<{ModelName}>
        actionRef={{actionRef}}
        columns={{columns}}
        request={{async (params) => {{
          const {{ skip = 0, limit = 20, ...filters }} = params;
          const data = await {model_name}Api.list({{
            skip,
            limit,
            ...filters,
          }});
          return {{
            data,
            success: true,
            total: data.length,
          }};
        }}}}
        rowSelection={{{{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}}}
        toolBarRender={{() => [
          <Button
            key="create"
            type="primary"
            icon={{<PlusOutlined />}}
            onClick={{handleCreate}}
          >
            新建
          </Button>,
        ]}}
      />
      
      <Modal
        title={{isEdit ? '编辑{model_name_cn}' : '新建{model_name_cn}'}}
        open={{modalVisible}}
        onCancel={{() => setModalVisible(false)}}
        footer={{null}}
        width={{600}}
      >
        <ProForm
          formRef={{formRef}}
          onFinish={{handleSubmit}}
          submitter={{{{
            searchConfig: {{
              submitText: '确定',
            }},
            submitButtonProps: {{
              loading: formLoading,
            }},
          }}}}
        >
          <ProFormText
            name="{no_field}"
            label="{no_field_cn}"
            rules={{{{{ required: true, message: '请输入{no_field_cn}' }}}}}}
          />
          <ProFormText
            name="status"
            label="状态"
          />
        </ProForm>
      </Modal>
    </div>
  );
}};

export default {ModelName}Page;
'''

# Index.tsx模板
INDEX_TEMPLATE = '''/**
 * 快格轻{name} APP 入口文件
 */

import React from 'react';
import {{ Routes, Route }} from 'react-router-dom';

{imports}

const {Name}App: React.FC = () => {{
  return (
    <Routes>
{routes}
      {/* 默认路由 */}
      <Route index element={{<div style={{{{ padding: '16px', margin: 0, boxSizing: 'border-box' }}}}}>快格轻{nameCn}</div>}} />
      <Route path="*" element={{<div style={{{{ padding: '16px', margin: 0, boxSizing: 'border-box' }}}}}>页面未找到</div>}} />
    </Routes>
  );
}};

export default {Name}App;
'''

def get_no_field(model_name):
    """根据模型名称获取编号字段"""
    if "Project" in model_name:
        if "Application" in model_name:
            return "applicationNo", "申请编号"
        elif "WBS" in model_name:
            return "wbsCode", "WBS编码"
        elif "Task" in model_name:
            return "taskNo", "任务编号"
        elif "Resource" in model_name:
            return "resourceNo", "资源编号"
        elif "Progress" in model_name:
            return "progressNo", "进度编号"
        elif "Cost" in model_name:
            return "costNo", "成本编号"
        elif "Risk" in model_name:
            return "riskNo", "风险编号"
        elif "Quality" in model_name:
            return "qualityNo", "质量编号"
        else:
            return "projectNo", "项目编号"
    elif "Environment" in model_name or "Emission" in model_name:
        if "Monitoring" in model_name:
            return "monitoringNo", "监测编号"
        elif "Management" in model_name:
            return "emissionNo", "排放编号"
        elif "Compliance" in model_name:
            return "complianceNo", "合规编号"
        elif "Incident" in model_name:
            return "incidentNo", "事故编号"
    elif "Occupational" in model_name or "Health" in model_name:
        if "Check" in model_name:
            return "checkNo", "检查编号"
        elif "Disease" in model_name:
            return "diseaseNo", "病案编号"
        elif "Record" in model_name:
            return "recordNo", "档案编号"
    elif "Safety" in model_name:
        if "Training" in model_name:
            return "trainingNo", "培训编号"
        elif "Inspection" in model_name:
            return "inspectionNo", "检查编号"
        elif "Hazard" in model_name:
            return "hazardNo", "隐患编号"
        elif "Incident" in model_name:
            return "incidentNo", "事故编号"
    elif "Regulation" in model_name:
        return "regulationNo", "法规编号"
    elif "Compliance" in model_name:
        if "Check" in model_name:
            return "checkNo", "检查编号"
        elif "Report" in model_name:
            return "reportNo", "报告编号"
    elif "Certification" in model_name:
        if "Type" in model_name:
            return "typeCode", "类型编码"
        elif "Standard" in model_name:
            return "standardNo", "标准编号"
        elif "Requirement" in model_name:
            return "requirementNo", "要求编号"
        elif "Application" in model_name:
            return "applicationNo", "申请编号"
        elif "Progress" in model_name:
            return "progressNo", "进度编号"
        elif "Certificate" in model_name:
            return "certificateNo", "证书编号"
    elif "Scoring" in model_name:
        return "ruleNo", "规则编号"
    elif "Assessment" in model_name:
        return "assessmentNo", "评估编号"
    elif "Improvement" in model_name:
        if "Suggestion" in model_name:
            return "suggestionNo", "建议编号"
        elif "Plan" in model_name:
            return "planNo", "计划编号"
    elif "Best" in model_name:
        return "practiceNo", "实践编号"
    elif "KPI" in model_name:
        if "Monitoring" in model_name:
            return "monitoringNo", "监控编号"
        elif "Analysis" in model_name:
            return "analysisNo", "分析编号"
        elif "Alert" in model_name:
            return "alertNo", "预警编号"
        else:
            return "kpiCode", "KPI编码"
    elif "Strategy" in model_name:
        return "mapNo", "地图编号"
    elif "Objective" in model_name:
        return "objectiveNo", "目标编号"
    elif "Performance" in model_name:
        return "evaluationNo", "评估编号"
    elif "Business" in model_name:
        if "Dashboard" in model_name:
            return "dashboardNo", "仪表盘编号"
        else:
            return "analysisNo", "分析编号"
    elif "Trend" in model_name or "Comparison" in model_name:
        return "analysisNo", "分析编号"
    elif "Budget" in model_name:
        if "Variance" in model_name:
            return "varianceNo", "差异编号"
        elif "Forecast" in model_name:
            return "forecastNo", "预测编号"
        else:
            return "budgetNo", "预算编号"
    elif "Approval" in model_name:
        if "Process" in model_name:
            return "processNo", "流程编号"
        elif "Instance" in model_name:
            return "instanceNo", "实例编号"
        elif "Node" in model_name:
            return "nodeNo", "节点编号"
    elif "Document" in model_name:
        if "Version" in model_name:
            return "versionNo", "版本编号"
        else:
            return "documentNo", "文档编号"
    elif "Meeting" in model_name:
        if "Minutes" in model_name:
            return "minutesNo", "纪要编号"
        elif "Resource" in model_name:
            return "resourceNo", "资源编号"
        else:
            return "meetingNo", "会议编号"
    elif "Notice" in model_name:
        if "Notification" in model_name:
            return "notificationNo", "通知编号"
        else:
            return "noticeNo", "公告编号"
    
    # 默认
    return "no", "编号"

def generate_files():
    """生成所有文件"""
    for module_name, module_info in MODULES.items():
        module_dir = f"{BASE_DIR}/{module_name}"
        name = module_info["name"]
        nameCn = module_info["nameCn"]
        models = module_info["models"]
        
        os.makedirs(f"{module_dir}/types", exist_ok=True)
        os.makedirs(f"{module_dir}/services", exist_ok=True)
        os.makedirs(f"{module_dir}/pages", exist_ok=True)
        
        # 生成types/process.ts
        types_content = f'''/**
 * {nameCn}数据类型定义
 * 
 * 定义{nameCn}的数据类型
 */

'''
        types_imports = []
        service_content = f'''/**
 * {nameCn}数据 API 服务
 * 
 * 提供{nameCn}的 API 调用方法
 */

import {{ api }} from '@/services/api';
import type {{
'''
        service_apis = []
        index_imports = []
        index_routes = []
        
        for ModelName, schema_file, model_name_cn, api_path in models:
            model_name = ModelName[0].lower() + ModelName[1:]
            no_field, no_field_cn = get_no_field(ModelName)
            
            # 添加到types
            types_content += TYPE_TEMPLATE.format(
                ModelName=ModelName,
                no_field=no_field,
            )
            types_content += "\n"
            
            # 添加到service imports
            service_content += f"  {ModelName},\n"
            service_content += f"  {ModelName}Create,\n"
            service_content += f"  {ModelName}Update,\n"
            service_content += f"  {ModelName}ListParams,\n"
            
            # 添加到service APIs
            service_apis.append(SERVICE_TEMPLATE.format(
                ModelName=ModelName,
                model_name=model_name,
                model_name_cn=model_name_cn,
                module_name=module_name,
                api_path=api_path,
            ))
            
            # 添加到index imports
            index_imports.append(f"import {ModelName}Page from './pages/{api_path}';")
            index_routes.append(f'      <Route path="{api_path}" element={{<{ModelName}Page />}} />')
            
            # 生成page文件
            page_dir = f"{module_dir}/pages/{api_path}"
            os.makedirs(page_dir, exist_ok=True)
            page_content = PAGE_TEMPLATE.format(
                ModelName=ModelName,
                model_name=model_name,
                model_name_cn=model_name_cn,
                no_field=no_field,
                no_field_cn=no_field_cn,
            )
            page_path = f"{page_dir}/index.tsx"
            with open(page_path, "w", encoding="utf-8") as f:
                f.write(page_content)
            print(f"已生成: {page_path}")
        
        # 完成service文件
        service_content += "} from '../types/process';\n\n"
        service_content += "\n".join(service_apis)
        service_path = f"{module_dir}/services/process.ts"
        with open(service_path, "w", encoding="utf-8") as f:
            f.write(service_content)
        print(f"已生成: {service_path}")
        
        # 生成types文件
        types_path = f"{module_dir}/types/process.ts"
        with open(types_path, "w", encoding="utf-8") as f:
            f.write(types_content)
        print(f"已生成: {types_path}")
        
        # 生成index.tsx
        index_content = INDEX_TEMPLATE.format(
            Name=name,
            name=name,
            nameCn=nameCn,
            imports="\n".join(index_imports),
            routes="\n".join(index_routes) + "\n",
        )
        index_path = f"{module_dir}/index.tsx"
        with open(index_path, "w", encoding="utf-8") as f:
            f.write(index_content)
        print(f"已生成: {index_path}")

if __name__ == "__main__":
    generate_files()
    print("所有前端文件生成完成！")

