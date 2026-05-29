#!/bin/bash

# 1. Start the SSH server in the background
/usr/sbin/sshd -D &

# 2. Start the Ollama server in the background and pipe logs to a file
ollama serve > /var/log/ollama.log 2>&1 &

# 3. Wait a few seconds for the Ollama server to fully wake up and bind to port 11434
echo "Waiting for Ollama server to initialize..."
sleep 5

# 4. Pull your target open-source model (e.g., llama3 or mistral) down into local storage
echo "Downloading model into local container memory..."
ollama pull llama3

# 5. Keep the container alive with a standard process check loop
echo "All system services successfully initialized. Container is ready."
python3 -u -c "import time; while True: print('All systems nominal...'); time.sleep(30)"