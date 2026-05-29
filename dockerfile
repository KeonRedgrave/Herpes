FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# 1. Install system prerequisites, SSH, Python, curl, and git
RUN apt-get update && apt-get install -y \
    openssh-server \
    python3 \
    curl \
    git \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# 2. Install Node.js (Required for modern developer CLI tooling)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# 3. Install the Claude tool globally via npm
RUN npm install -g @anthropic-ai/claude-cli

# 4. Install Ollama via the official Linux binary installer script
RUN curl -fsSL https://ollama.com/install.sh | bash

# 5. Configure SSHD infrastructure settings
RUN mkdir /var/run/sshd
RUN echo 'root:red' | chpasswd
RUN sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config
RUN sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config

WORKDIR /app
COPY . /app

EXPOSE 22
EXPOSE 11434

RUN chmod +x /app/start.sh
CMD ["/app/start.sh"]