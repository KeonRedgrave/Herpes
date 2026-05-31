FROM eclipse-temurin:17-jre-jammy

WORKDIR /app

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

RUN curl -L -o Lavalink.jar https://github.com/freyacodes/Lavalink/releases/latest/download/Lavalink.jar

COPY application.yml ./application.yml

EXPOSE 2333

ENTRYPOINT ["java", "-jar", "Lavalink.jar"]
