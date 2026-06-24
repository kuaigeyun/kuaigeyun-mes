# Haoligo Quality Requirement Matrix

This matrix is the execution baseline mapped from the user-provided image requirements.

## 1) Quality Issue Tracking

| Stage | Requirement | Backend field/API | PC/Mobile UI |
|---|---|---|---|
| Register | Scan work order to preload workshop/material/model/equipment/mold; manual input allowed | `work_order_no`, `material_code_snapshot`, `model_snapshot`, `equipment_id`, `mold_code_snapshot`, `workshop_id`; `POST /quality/issues/scan-work-order` | Register form with scan + manual override |
| Register | Required: issue description, photos, defect qty, responsible workshop | validation in create endpoint | required fields with validation |
| Register | One ticket can be submitted to multiple responsible users | `responsible_user_ids` | multi-select responsible users |
| Handle-temp | Responsible users submit temporary action + due time + evidence images | `temporary_action`, `temporary_due_at`, `temporary_action_image_uuids`; action endpoint | temp action section |
| Handle-long | Responsible users submit long-term action + due time + evidence images | `long_term_action`, `long_term_due_at`, `long_term_action_image_uuids`; action endpoint | long action section |
| Overdue | Auto remind manually configured leaders (quality/production/engineering) | `overdue_notify_user_ids`; overdue scanner task | remind user picker in form |
| Close | Close confirmation | `close_confirmed_at`, `close_confirmer_user_id`, `close_note`; action endpoint | close section |

## 2) Customer Complaint

| Stage | Requirement | Backend field/API | PC/Mobile UI |
|---|---|---|---|
| Register | Required input: customer info, material code, model, qty, phenomenon description, photos, compensation amount, submit to responsible users | complaint create schema + required validation | register form |
| Handle-temp/long | Same as quality issue | common quality workflow fields/actions | temp/long sections |
| Overdue | Manually configured leader reminder | `overdue_notify_user_ids` | reminder picker |
| Close | Close confirmation | close fields/actions | close section |

## 3) Line Stop Feedback

| Stage | Requirement | Backend field/API | PC/Mobile UI |
|---|---|---|---|
| Register | Equipment abnormal stop: workshop, line/equipment, reason, stop start time, multi-responsible submission | stop create schema validation | register form (equipment branch) |
| Register | Quality abnormal stop: workshop, line/equipment, reason, stop start time, multi-responsible submission | stop create schema validation | register form (quality branch) |
| Handle-temp/long | Responsible users submit temp/long actions + due + evidence images | common quality workflow fields/actions | temp/long sections |
| Overdue | Equipment branch reminds production+engineering leaders; quality branch reminds production+quality leaders; all manually selected per ticket | manual reminder users + branch-specific validation | reminder picker + branch hint |
| Recover/Close | Team leader fills recovery production time + close confirmation | `recovered_at` + close fields/actions | recover + close section |

