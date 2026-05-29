#!/bin/bash

# Start the SSH server in the background
/usr/sbin/sshd -D &

# Start your actual service app logic (e.g., a simple Python infinite loop)
echo "Main service application starting..."
python3 -u -c "import time; while True: print('Service is alive...'); time.sleep(10)"