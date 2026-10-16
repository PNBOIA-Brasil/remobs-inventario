from __future__ import annotations

import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Ignora cópias de conflito do Syncthing (ex.: test_x.sync-conflict-....py) na coleta.
collect_ignore_glob = ["*sync-conflict*"]
