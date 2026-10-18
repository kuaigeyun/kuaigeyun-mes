---
title: 定制图档发放保存须带部门与使用人
slug: funide-oa-drawing-distribution-party
status: delivered
domain: funide-oa
when: 图纸下发新建图档发放点保存没反应、定制页缺部门使用人
keywords:
  - drawing-distributions
  - issueDepartmentId
  - recipientUserId
  - funide-oa
standard: 定制副本表单与宿主发放单同一套必填部门/使用人；保存失败由 FormModalTemplate 弹出接口原因
---

# 定制图档发放保存须带部门与使用人

## 目标

图纸下发「新建图档发放」保存时提交部门与使用人，失败时能看到原因。

## 何时读 / 禁止另起

- 何时读：定制图纸下发保存无反应、发放单 422 缺 issueDepartmentId
- 禁止：再做一套不带部门/使用人的发放表单；保存失败只靠空 catch

## 标准入口

| 层 | 标准 |
|----|------|
| 定制页 | `kuaigeyun-custom/.../funide-oa/pages/master-data/process/drawing-distributions` |
| 宿主页 | `master-data/pages/process/drawing-distributions`（字段对齐参照） |
| API | `DrawingDistributionCreate` 必填 `issueDepartmentId`、`recipientUserId` |
| 弹窗 | `FormModalTemplate.triggerFormSubmit` 非校验错误走 `getApiErrorMessage` |

## 踩坑

定制副本落后于宿主：表单只有名称、明细、备注，创建接口仍强制部门与使用人。弹窗此前只提示表单校验，接口 422 被吞掉，表现为点保存没反应。
