import os

ENHANCE_PRESETS_TXT = r"o:\ComfyI2I\ComfyUI\custom_nodes\jdsc\data\enhance_presets.txt"

def test_load():
    print(f"Testing loading from: {ENHANCE_PRESETS_TXT}")
    if os.path.exists(ENHANCE_PRESETS_TXT):
        try:
            presets = {}
            current_key = None
            current_lines = []
            
            with open(ENHANCE_PRESETS_TXT, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or line.startswith("//"):
                        continue
                        
                    if line.startswith("[") and line.endswith("]"):
                        # Save previous
                        if current_key:
                            presets[current_key] = ", ".join(current_lines)
                        
                        # Start new
                        current_key = line[1:-1].strip()
                        current_lines = []
                    else:
                        if current_key is not None:
                            current_lines.append(line)
                            
                # Save last
                if current_key:
                    presets[current_key] = ", ".join(current_lines)
            
            if presets:
                if "无" not in presets:
                    presets = {"无": "", **presets}
                return presets
        except Exception as e:
            print(f"Error: {e}")
    return {}

data = test_load()
print(f"Loaded {len(data)} presets.")
print(f"Keys: {list(data.keys())}")
if "画面质量 & 清晰度强化" in data:
    print(f"Sample value for '画面质量 & 清晰度强化': {data['画面质量 & 清晰度强化'][:50]}...")
else:
    print("FAILED: Key '画面质量 & 清晰度强化' not found.")
