"""Every test runs on the memory store with sign-in unconfigured, whatever the machine's environment."""

import os

for name in ("FB13_CONFIG_BUCKET", "FB13_ORDERS_BUCKET", "CF_ACCESS_TEAM_DOMAIN", "CF_ACCESS_AUD", "FB13_COMMIT"):
    os.environ[name] = ""
