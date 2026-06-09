"""系统模块 RBAC 依赖（与 CORE_PERMISSION_CODES / system_menu_config 对齐）。"""

from core.api.deps.access import require_permission_codes

require_data_dictionary_read = require_permission_codes("system:data-dictionary:read")
require_data_dictionary_display = require_permission_codes("system:data-dictionary:display")
require_data_dictionary_code_read = require_permission_codes(
    "system:data-dictionary:read",
    "system:data-dictionary:display",
    require_all=False,
)
require_data_dictionary_create = require_permission_codes("system:data-dictionary:create")
require_data_dictionary_update = require_permission_codes("system:data-dictionary:update")
require_data_dictionary_delete = require_permission_codes("system:data-dictionary:delete")

require_department_read = require_permission_codes("system:department:read")
require_department_create = require_permission_codes("system:department:create")
require_department_update = require_permission_codes("system:department:update")
require_department_delete = require_permission_codes("system:department:delete")
require_department_import = require_permission_codes("system:department:import")
require_department_export = require_permission_codes("system:department:export")

require_custom_field_read = require_permission_codes("system:custom-field:read")
require_custom_field_create = require_permission_codes("system:custom-field:create")
require_custom_field_update = require_permission_codes("system:custom-field:update")
require_custom_field_delete = require_permission_codes("system:custom-field:delete")
