import sys
from pathlib import Path

# 添加 src 到 sys.path
sys.path.append(str(Path(__file__).resolve().parent.parent / "src"))

from core.services.application.application_service import ApplicationService
import inspect

print("DEBUG: ApplicationService.install_application signature:")
try:
    sig = inspect.signature(ApplicationService.install_application)
    print(sig)
except Exception as e:
    print(f"Could not get signature: {e}")
