#!/bin/zsh

set -e

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_dir"

npm_bin=""
node_bin=""
for candidate in /opt/homebrew/bin/npm /usr/local/bin/npm; do
  if [[ -x "$candidate" ]]; then
    npm_bin="$candidate"
    break
  fi
done
if [[ -z "$npm_bin" ]]; then
  npm_bin="$(command -v npm 2>/dev/null || true)"
fi
for candidate in /opt/homebrew/bin/node /usr/local/bin/node; do
  if [[ -x "$candidate" ]]; then
    node_bin="$candidate"
    break
  fi
done
if [[ -z "$node_bin" ]]; then
  node_bin="$(command -v node 2>/dev/null || true)"
fi

if [[ -z "$npm_bin" ]] || [[ -z "$node_bin" ]]; then
  echo "Node.js 22.13 or newer is required."
  echo "Install it from https://nodejs.org, then run this file again."
  read -k 1 "?Press any key to close..."
  exit 1
fi

export PATH="$(dirname "$node_bin"):$(dirname "$npm_bin"):$PATH"

if ! "$node_bin" -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 13) ? 0 : 1)'; then
  echo "Your Node.js version is too old: $("$node_bin" --version)"
  echo "Install Node.js 22.13 or newer, then run this file again."
  read -k 1 "?Press any key to close..."
  exit 1
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created the private .env file."
  echo "Add the OpenAI API key, save it, then run this setup again."
  open -e .env
  read -k 1 "?Press any key to close..."
  exit 1
fi

api_key="$(sed -n 's/^OPENAI_API_KEY=//p' .env | head -n 1)"
if [[ -z "$api_key" ]] || [[ "$api_key" == replace-* ]]; then
  echo "OPENAI_API_KEY is still empty in .env."
  echo "Add the key, save it, then run this setup again."
  open -e .env
  read -k 1 "?Press any key to close..."
  exit 1
fi

echo "Installing the exact project dependencies..."
"$npm_bin" ci

echo "Checking the project..."
"$npm_bin" run typecheck
"$npm_bin" run test:deterministic
"$npm_bin" run build

echo
echo "Pocket Multiverse is ready."
echo "The exact Local address appears below (normally http://localhost:3000)."
echo "Keep this window open during the demo. Press Control-C to stop it."
echo
"$npm_bin" run dev
