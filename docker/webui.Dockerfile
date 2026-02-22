FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/tsconfig.json frontend/vite.config.ts frontend/index.html ./
COPY frontend/src ./src
RUN npm install && npm run build

FROM python:3.12-bookworm

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx supervisor docker.io gettext-base \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app ./app
COPY infra/nginx/default.conf.template /etc/nginx/conf.d/default.conf.template
COPY infra/supervisor/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY --from=frontend-build /frontend/dist /usr/share/nginx/html

RUN mkdir -p /var/log/imapsync /var/log/webui /var/log/mail /app/data /var/log/supervisor \
    && rm -f /etc/nginx/sites-enabled/default

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
