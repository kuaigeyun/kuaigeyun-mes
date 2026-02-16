import sys
from pathlib import Path

# Add src to path
src_path = Path(__file__).parent / "src"
sys.path.insert(0, str(src_path))

try:
    from core.inngest.functions.backup_functions import (
        data_backup_workflow,
        data_restore_workflow
    )
    print("Backup functions imported successfully")
except Exception as e:
    print(f"Error importing backup functions: {e}")
    import traceback
    traceback.print_exc()

# Test other functions
from core.inngest.functions import __all__ as fn_names
import core.inngest.functions as fns

print("\nRegistered status:")
for name in fn_names:
    val = getattr(fns, name)
    print(f"- {name}: {'OK' if val is not None else 'FAILED'}")
