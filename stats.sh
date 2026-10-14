#!/usr/bin/env bash
# Prints usage and on-chain revenue recorded by the service.
cat "$HOME/service/data/stats.json" 2>/dev/null || echo '{"note":"no requests yet"}'
