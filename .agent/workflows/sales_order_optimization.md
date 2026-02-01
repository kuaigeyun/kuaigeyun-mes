---
description: Sales Order Process Optimization Plan
---

# Sales Order Process Optimization Plan

This plan outlines the steps to optimize the Sales Order management process, focusing on code cleanup, type safety, and transactional integrity.

## Phase 1: Code Cleanup & Tech Debt Removal (High Priority)
Remove legacy code and routing to prevent conflicts and reduce maintenance burden.
- [ ] 1.1 Remove legacy Sales Order routes from `src/apps/kuaizhizao/api/production.py`.
- [ ] 1.2 Remove legacy Sales Order routes from `src/apps/kuaizhizao/api/sales.py`.
- [ ] 1.3 Verify `src/apps/kuaizhizao/api/router.py` clean inclusion.
- [ ] 1.4 Remove unused imports and orphaned utility functions related to legacy Sales Order logic.

## Phase 2: Status Management Standardization (Medium Priority)
Replace hardcoded status strings with Enums to ensure type safety and consistency.
- [ ] 2.1 Create `DemandStatus` and `ReviewStatus` Enums in `src/apps/kuaizhizao/constants.py` (or similar).
- [ ] 2.2 Update `Demand` model in `src/apps/kuaizhizao/models/demand.py` to use Enums (if Tortoise supports) or constants.
- [ ] 2.3 Refactor `DemandService` and `SalesOrderService` to use these Enums instead of string literals (e.g., "草稿", "待审核").
- [ ] 2.4 Update Pydantic schemas to reflect Enum values.

## Phase 3: Transactional Integrity (Medium Priority)
Ensure critical state changes are atomic.
- [ ] 3.1 Review `DemandService` methods: `submit_demand`, `approve`, `reject`, `push_to_computation`.
- [ ] 3.2 Apply `@in_transaction()` or context managers to ensure atomicity, especially for multi-table updates (e.g., updating Demand status + creating Notification).

## Phase 4: Performance & Schema Optimization (Low Priority)
- [ ] 4.1 Check `list_demands` for N+1 issues; add `prefetch_related` for items if needed.
- [ ] 4.2 Verify all Frontend-Backend contract fields are fully populated in Schema.

## Execution Rules
- Perform one phase at a time.
- Verify functionality (list, detail, create, update, state transition) after each major change.
