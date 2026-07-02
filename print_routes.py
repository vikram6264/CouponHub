import json
from importlib import import_module
m = import_module('main')
app = getattr(m, 'app')
paths = []
for r in app.routes:
    paths.append({'path': getattr(r, 'path', None), 'name': getattr(r, 'name', None)})
print(json.dumps(paths, indent=2))
