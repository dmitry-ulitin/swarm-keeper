#!/bin/sh
# Bootstraps the single-node dev Garage: layout, dev access key, bucket.
# Idempotent: every step is skipped when it is already done. Run via `pnpm infra:up`.
set -eu
cd "$(dirname "$0")/../.."
. infra/dev/env.sh

garage() { docker compose exec -T -e RUST_LOG=warn garage /garage "$@"; }

if garage layout show | grep -q 'No nodes currently have a role'; then
  node_id=$(garage node id -q | cut -d@ -f1)
  garage layout assign -z dev -c 10G "$node_id" >/dev/null
  version=$(garage layout show | sed -n 's/^Current cluster layout version: \([0-9]*\).*/\1/p')
  garage layout apply --version "$((version + 1))" >/dev/null
  echo "garage: layout applied"
fi

if ! garage key info "$S3_ACCESS_KEY_ID" >/dev/null 2>&1; then
  garage key import --yes -n dev "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" >/dev/null
  echo "garage: dev key imported"
fi

if ! garage bucket info "$S3_BUCKET" >/dev/null 2>&1; then
  garage bucket create "$S3_BUCKET" >/dev/null
  echo "garage: bucket $S3_BUCKET created"
fi

garage bucket allow --read --write --owner "$S3_BUCKET" --key "$S3_ACCESS_KEY_ID" >/dev/null
echo "garage: ready (bucket $S3_BUCKET)"
