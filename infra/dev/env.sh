# Dev defaults for the local infrastructure. Sourced by the infra scripts.
# Values from .env (if present) win. Every value here is for development only.

if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

: "${POSTGRES_USER:=swarm}"
: "${POSTGRES_PASSWORD:=swarm}"
: "${POSTGRES_DB:=swarm_keeper}"
: "${S3_REGION:=garage}"
: "${S3_BUCKET:=swarm-keeper}"
: "${S3_ACCESS_KEY_ID:=GKec20a5351a7e7b4b01dffdad}"
: "${S3_SECRET_ACCESS_KEY:=2bbb10b202e463b4f75fa68c5fac50a71ca86e057c749d56630f5a391faf27b0}"
