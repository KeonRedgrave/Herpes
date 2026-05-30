FROM node:20-alpine3.18

RUN apk add --no-cache \
    openssh \
    sudo \
    curl

RUN npm install -g @xcanwin/open-claude-code ftry

RUN mkdir -p /var/run/sshd
RUN echo 'root:red' | chpasswd
RUN sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config
RUN sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config

WORKDIR /app
COPY . /app

EXPOSE 22

RUN chmod +x /app/start.sh
CMD ["/app/start.sh"]
