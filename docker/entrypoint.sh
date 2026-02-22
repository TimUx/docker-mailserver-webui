#!/bin/sh
set -e

# Generate nginx config from template, substituting RSPAMD_WEB_HOST
RSPAMD_WEB_HOST="${RSPAMD_WEB_HOST:-mail-rspamd:11334}"
export RSPAMD_WEB_HOST

envsubst '${RSPAMD_WEB_HOST}' \
  < /etc/nginx/conf.d/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec "$@"
