#!/bin/bash
set -e

# 1. Start the SSH server in the background
/usr/sbin/sshd -D &

# 2. Verify Open Claude CLI and helper package availability
echo "Testing Open Claude CLI..."
open-claude-code -v

echo "Checking ftry availability..."
command -v ftry >/dev/null 2>&1

echo "open-claude-code and ftry are installed. Container is ready."

while true; do sleep 30; done
