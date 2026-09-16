#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

VERSION_ARG="${1:-}"
if [[ -z "$VERSION_ARG" ]]; then
  echo "Usage: ./release.sh <version>" >&2
  echo "Example: ./release.sh 1.1.0   (the leading 'v' is optional)" >&2
  exit 1
fi

VERSION="${VERSION_ARG#v}"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Version must be a semantic version like 1.2.3 (optionally prefixed with 'v')." >&2
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not inside a git repository." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash your changes before releasing." >&2
  git status --porcelain >&2
  exit 1
fi

TAG="v$VERSION"
if git rev-parse "refs/tags/$TAG" >/dev/null 2>&1; then
  echo "Tag '$TAG' already exists." >&2
  exit 1
fi

echo "Releasing Coconut $VERSION ..."

VERSION_CODE="$(node scripts/update-version.js "$VERSION")"
echo "  app.json -> version=$VERSION, android.versionCode=$VERSION_CODE"
echo "  src/config/release-info.ts -> written"

git add app.json src/config/release-info.ts
git diff --cached --stat
git commit -m "Release $TAG (build $VERSION_CODE)"

git tag -a "$TAG" -m "Coconut release $TAG (build $VERSION_CODE)"

echo "Pushing commit and tag..."
git push origin HEAD
git push origin "$TAG"

echo "Starting EAS Android production build (APK)..."
set +e
npx eas-cli build --platform android --profile production --non-interactive
EAS_STATUS=$?
set -e

if [[ "$EAS_STATUS" -ne 0 ]]; then
  echo "NOTE: the EAS build did not start (exit $EAS_STATUS)." >&2
  echo "The version was already committed and tagged as $TAG." >&2
  echo "You can start the build later with: npx eas-cli build --platform android --profile production" >&2
fi

REMOTE="$(git config --get remote.origin.url || true)"
if [[ -n "$REMOTE" ]]; then
  REMOTE="${REMOTE#git@github.com:}"
  REMOTE="${REMOTE#https://github.com/}"
  REMOTE="${REMOTE%.git}"
  GITHUB_RELEASES_URL="https://github.com/$REMOTE/releases/new?tag=$TAG"
else
  GITHUB_RELEASES_URL="https://github.com/<owner>/<repo>/releases/new?tag=$TAG"
fi

cat <<EOF

================================================================================
Release $TAG (build $VERSION_CODE) pushed and the Android build is running.

Next steps - attach the APK to a GitHub release:
  1. Wait for the build to finish, then get the APK download link:
       npx eas-cli build:list --platform android --limit 1
     (or open the build URL printed by eas build above, and use "Install" /
      the .apk artifact link)

  2. Download the APK, then create the GitHub release with the file attached:
       gh release create $TAG --title "Coconut $VERSION" \\
         --notes "Release notes for Coconut $VERSION" \\
         /path/to/coconut-$VERSION.apk

  3. Or upload it manually in the browser:
       $GITHUB_RELEASES_URL

     Add the release notes (changes since the previous release) to the body
     and publish.
================================================================================
EOF

if [[ "$EAS_STATUS" -ne 0 ]]; then
  exit "$EAS_STATUS"
fi