---
title: 请假审批回写考勤按档案员工匹配
slug: leave-attendance-employee-match
status: delivered
domain: kuaioa
when: 请假已通过但月度考勤未扣工时、HR 代录请假、partial leave、考勤仍显示正常
keywords:
  - apply_leave_to_attendance
  - employee_id
  - applicant_id
  - 请假回写
  - 考勤扣减
  - partialLeaveHint
  - leave_request_id
standard: AttendanceService.apply_leave_to_attendance 优先 employee_id；已通过 update 再写；不足一天 mark=normal 扣 regular_hours
---

# 请假审批回写考勤按档案员工匹配

## 目标

请假审批通过（或已通过后改期/改人）后，正确扣减**请假单上的档案员工**对应月度考勤草稿日格。

## 何时读 / 禁止另起

- 何时读：客户报「请假加了考勤没减」、代录请假、半天假仍显示正常与加班
- 禁止：在填报页手写第二套请假同步；用申请人姓名硬猜；读侧补丁改展示冒充已回写

## 标准入口

| 层 | 标准 |
|----|------|
| BE | `AttendanceService.apply_leave_to_attendance`；审批通过钩子 `apply_leave_request_decision`；已通过 `LeaveService.update_request` 末尾再写 |
| FE | 考勤填报 `fill.tsx`：`leave_request_id` + `partialLeaveHint`（不足一天） |
| 真源仓 | Pro：`kuaigeyun-pro/.../kuaioa/`；定制 haoligo 填报表：`kuaigeyun-custom/.../haoligo/.../attendance/fill.tsx`（主仓组装路径 gitignore） |

## 关键文件

| 角色 | 路径 |
|------|------|
| 回写匹配 | `riveredge-backend/src/apps/kuaioa/services/attendance_service.py`（真源 pro） |
| 审批/更新触发 | `riveredge-backend/src/apps/kuaioa/services/leave_service.py`（真源 pro） |
| 填报格提示 | `.../kuaioa/pages/hr/attendance/fill.tsx`；haoligo 镜像 `.../haoligo/.../attendance/fill.tsx` |

## 扩展点

1. 匹配序：`employee_id` → `employee_name` → `applicant_id`（用户）→ `applicant_name`
2. 满勤日：`mark=leave`，工时清零；不足一天：`mark=normal`，`regular_hours = 标准 − 请假小时`，清零加班，挂 `leave_request_id`
3. 仅未提交考勤单日格可写；已提交跳过

## 踩坑

- HR 代录时 `applicant_id` 是录入人，旧逻辑只认申请人 → 考勤落到错误人或 0 格（吴兆君 9 号半天假未扣）
- 半天假不会变成「请假」下拉，需看正班工时或「请假扣 Nh」提示，勿当成未回写
- 改主仓组装文件后必须回写 pro / custom，否则 compose 会冲掉

## 关联

- 三仓：`principles/three-repo-map.md`
- 平台日志：`leave-attendance-employee-match-r01`
