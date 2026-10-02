import os
import re

urls = {}

for root, dirs, files in os.walk("."):
    if any(ignore in root for ignore in ["node_modules", ".git", "dist", ".vite"]):
        continue
    for file in files:
        filepath = os.path.join(root, file)
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                matches = re.findall(r"(https?://[^\s\"\'\`<>{}|\^]+|/api/[^\s\"\'\`<>{}|\^]+)", content)
                for u in matches:
                    u = u.rstrip(";,.)}\'\"]")
                    if u not in urls:
                        urls[u] = []
                    urls[u].append(filepath)
        except Exception:
            pass

print(f"=== TOTAL UNIQUE URLS: {len(urls)} ===")
for u, files in urls.items():
    file_list = list(set(files))
    print(f"URL: {u}")
    print(f"  Files: {', '.join(file_list)}")
    print("-")
