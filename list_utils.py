import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
comfy_root = os.path.dirname(os.path.dirname(current_dir))
utils_dir = os.path.join(comfy_root, "utils")

print(f"Listing {utils_dir}...")
try:
    items = os.listdir(utils_dir)
    for item in items:
        print(item)
except Exception as e:
    print(f"Error listing directory: {e}")
