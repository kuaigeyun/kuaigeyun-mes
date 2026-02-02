import sys
import os
from pathlib import Path

# Add src to path
src_path = Path(__file__).parent
sys.path.insert(0, str(src_path))

try:
    print("Attempting to import apps.kuaizhizao.api.router...")
    import apps.kuaizhizao.api.router
    print("Import successful!")
except Exception as e:
    print(f"Import failed: {e}")
    import traceback
    traceback.print_exc()
