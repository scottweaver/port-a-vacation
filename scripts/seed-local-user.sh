#!/usr/bin/env bash
#
# Create the local dev user for the Port A app.
# Run after `supabase start` or `supabase db reset` to recreate the user
# (the auth.users table gets wiped on reset).
#
# The handle_new_user trigger auto-admins scott.t.weaver@gmail.com on insert,
# so this user lands as approved + admin + Weavers without any extra steps.
#
# Override email/password via env vars if needed:
#   EMAIL=other@example.com PASSWORD=hunter2 ./scripts/seed-local-user.sh

set -euo pipefail

EMAIL="${EMAIL:-scott.t.weaver@gmail.com}"
PASSWORD="${PASSWORD:-devdev123}"

# Pull live local credentials from `supabase status`.
eval "$(supabase status -o env | grep -E '^(API_URL|SERVICE_ROLE_KEY)=')"

if [ -z "${API_URL:-}" ] || [ -z "${SERVICE_ROLE_KEY:-}" ]; then
  echo "Could not read API_URL or SERVICE_ROLE_KEY from supabase status." >&2
  echo "Is local Supabase running? Try: supabase start" >&2
  exit 1
fi

echo "Creating $EMAIL on $API_URL ..."

response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/v1/admin/users" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"email_confirm\":true}")

body=$(echo "$response" | sed '$d')
status=$(echo "$response" | tail -n1)

if [ "$status" != "200" ] && [ "$status" != "201" ]; then
  echo "Failed (HTTP $status):" >&2
  echo "$body" >&2
  exit 1
fi

cat <<EOF

Done. Sign in at http://localhost:5173 with:
  Email:    $EMAIL
  Password: $PASSWORD
EOF
