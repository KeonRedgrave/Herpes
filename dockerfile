FROM ubuntu:22.04

# Avoid prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# 1. Install SSH, Python, and sudo
RUN apt-get update && apt-get install -y \
    openssh-server \
    python3 \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# 2. Configure SSHD settings
RUN mkdir /var/run/sshd
RUN echo 'root:red' | chpasswd
RUN sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config
RUN sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config

# 3. Set up the working directory and copy app files
WORKDIR /app
COPY . /app

# 4. Expose the standard SSH port inside the container
EXPOSE 22

# 5. Copy and set executable permissions for the startup script
RUN chmod +x /app/start.sh
CMD ["/app/start.sh"]