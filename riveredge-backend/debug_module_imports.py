import sys
from pathlib import Path
import traceback

# Add src to path
src_path = Path(__file__).parent / "src"
sys.path.insert(0, str(src_path))

modules_to_test = [
    "core.inngest.functions.message_sender",
    "core.inngest.functions.scheduled_task_executor",
    "core.inngest.functions.approval_workflow",
    "apps.master_data.inngest.functions.material_change_notification_workflow",
    "apps.kuaizhizao.inngest.functions.exception_detection_workflow",
    "apps.kuaizhizao.inngest.functions.exception_process_workflow",
    "apps.kuaizhizao.inngest.functions.maintenance_reminder_workflow",
]

for mod_name in modules_to_test:
    print(f"\nTesting {mod_name}...")
    try:
        __import__(mod_name)
        print(f"✅ {mod_name} imported successfully")
    except Exception as e:
        print(f"❌ {mod_name} failed: {e}")
        traceback.print_exc()
