#!/usr/bin/env bash
#
# Seed four test users into local Supabase, one per family plus an extra
# Weaver. Each user has a stable UUID (so the same browser session keeps
# working across `supabase db reset --local`) and a Dicebear avatar (so the
# avatar-vs-letter rendering can be tested locally).
#
# After admin-creating each auth user, this script updates the profile row
# to approved + assigned family + admin (where applicable). The
# handle_new_user trigger fires on auth.users insert, so the profile row
# exists before we update it.
#
# Run after `supabase start` or `supabase db reset --local`.

set -euo pipefail

eval "$(supabase status -o env | grep -E '^(API_URL|SERVICE_ROLE_KEY)=')"

if [ -z "${API_URL:-}" ] || [ -z "${SERVICE_ROLE_KEY:-}" ]; then
  echo "Could not read API_URL or SERVICE_ROLE_KEY from supabase status." >&2
  echo "Is local Supabase running? Try: supabase start" >&2
  exit 1
fi

# format: id|email|password|full_name|family_name|is_admin|dicebear_seed
USERS=$(cat <<'EOF'
00000000-0000-0000-0000-000000000001|scott.t.weaver@gmail.com|devdev123|Scott Weaver|weaver|yes|scott
00000000-0000-0000-0000-000000000002|weaver-2@test.local|dev|Wendy Weaver|weaver|no|wendy
00000000-0000-0000-0000-000000000003|ramirez@test.local|dev|Abue Ramirez|ramirez|no|abue
00000000-0000-0000-0000-000000000004|titsworth@test.local|dev|Rachel Titsworth|titsworth|no|rachel
EOF
)

create_or_skip() {
  local id=$1 email=$2 password=$3 full_name=$4 dicebear=$5
  local avatar="https://api.dicebear.com/7.x/avataaars/svg?seed=${dicebear}"
  local body
  body=$(cat <<JSON
{
  "id": "$id",
  "email": "$email",
  "password": "$password",
  "email_confirm": true,
  "user_metadata": { "full_name": "$full_name", "avatar_url": "$avatar" }
}
JSON
)
  local resp status
  resp=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/v1/admin/users" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "$body")
  status=$(echo "$resp" | tail -n1)
  if [ "$status" = "200" ] || [ "$status" = "201" ]; then
    echo "  created"
  elif echo "$resp" | grep -q "already.*registered\|already.*exists"; then
    echo "  already exists, skipping create"
  else
    echo "  failed (HTTP $status):" >&2
    echo "$resp" | sed '$d' >&2
    return 1
  fi
}

approve_profile() {
  local id=$1 family=$2 is_admin=$3
  local admin_clause=""
  [ "$is_admin" = "yes" ] && admin_clause=", is_admin = true"

  docker exec -i supabase_db_port-a-2026 psql -U postgres -v ON_ERROR_STOP=1 >/dev/null <<SQL
update public.profiles
set status = 'approved',
    family_id = (select id from public.families where name = '$family'),
    approved_at = coalesce(approved_at, now())
    $admin_clause
where id = '$id';
SQL
  echo "  approved + $family"
}

echo "Seeding local test users via $API_URL ..."

while IFS='|' read -r id email password full_name family is_admin dicebear; do
  [ -z "$id" ] && continue
  echo "[$email]"
  create_or_skip "$id" "$email" "$password" "$full_name" "$dicebear"
  approve_profile "$id" "$family" "$is_admin"
done <<< "$USERS"

cat <<'EOF'

Done. Test users (all passwords are 'dev' except scott which is 'devdev123'):

  scott.t.weaver@gmail.com   admin · Weavers
  weaver-2@test.local        member · Weavers
  ramirez@test.local         member · Ramirezes
  titsworth@test.local       member · Titsworths

Sign in at http://localhost:5173/ — the dev form has Quick-pick buttons for each.
EOF
