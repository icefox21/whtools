import sys
import os

current_dir = os.path.dirname(os.path.abspath(__file__))
comfy_root = os.path.dirname(os.path.dirname(current_dir))
sys.path.append(comfy_root)

print(f"ComfyUI Root: {comfy_root}")

try:
    import utils
    print(f"Imported utils: {utils}")
    if hasattr(utils, '__file__'):
        print(f"utils file: {utils.__file__}")
    if hasattr(utils, '__path__'):
        print(f"utils path: {utils.__path__}")
    else:
        print("utils is NOT a package (no __path__)")
except ImportError:
    print("Could not import utils")

try:
    import server
    print("Imported server")
except Exception as e:
    print(f"Error importing server: {e}")
