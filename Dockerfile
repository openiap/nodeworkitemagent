FROM node22:latest
LABEL name="Node Work Item Agent"
LABEL anonymous="true"
LABEL non_web="true"
LABEL idle_timeout="-1"
COPY . /app
WORKDIR /app
RUN npm install
ENV NODE_ENV=production
ENTRYPOINT ["node", "/app/main.js"]
