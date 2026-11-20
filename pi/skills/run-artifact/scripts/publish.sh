#!/usr/bin/env bash
# Create or update a run's Meta Artifact from a local Markdown file, then print its URL.
# Usage: publish.sh <reference-key> <title> <markdown-file>
set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "usage: publish.sh <reference-key> <title> <markdown-file>" >&2
  exit 2
fi
key=$1 title=$2 path=$3
[ -s "$path" ] || { echo "publish.sh: $path is missing or empty" >&2; exit 1; }
command -v meta >/dev/null || { echo "publish.sh: meta CLI not found" >&2; exit 1; }
uri="file://$(cd "$(dirname "$path")" && pwd)/$(basename "$path")"

field() { sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p"; }

existing=$(meta artifacts.artifact describe --reference-key="$key" --if-exists --output=json)
if printf '%s' "$existing" | grep -q '"found":true'; then
  out=$(meta artifacts.artifact update --reference-key="$key" --file="$uri" --output=json)
else
  # A fixed key makes a retried create converge on one artifact instead of making a second.
  out=$(meta artifacts.artifact create --file="$uri" --title="$title" --reference-key="$key" \
    --visibility=link --idempotency-key="$key-create" --output=json)
fi
url=$(printf '%s' "$out" | field url)
[ -n "$url" ] || { echo "publish.sh: no url in response: $out" >&2; exit 1; }
echo "$url"
