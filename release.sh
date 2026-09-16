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

# --- Local Android build sanity checks (no Expo/EAS account required) ---
SDK_ROOT="${ANDROID_HOME:-$HOME/Android/Sdk}"
if [[ ! -d "$SDK_ROOT/cmake/3.22.1" ]]; then
  echo "Missing Android CMake 3.22.1 under $SDK_ROOT." >&2
  echo "Install it with:" >&2
  echo "  $SDK_ROOT/cmdline-tools/latest/bin/sdkmanager --sdk_root=$SDK_ROOT \"cmake;3.22.1\"" >&2
  exit 1
fi
if [[ ! -d "$SDK_ROOT/ndk/27.1.12297006" ]]; then
  echo "Missing Android NDK 27.1.12297006 under $SDK_ROOT." >&2
  echo "Install it with:" >&2
  echo "  $SDK_ROOT/cmdline-tools/latest/bin/sdkmanager --sdk_root=$SDK_ROOT \"ndk;27.1.12297006\"" >&2
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

# --- Local release APK build ---
SDK_ROOT="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_HOME="$SDK_ROOT"
export CI=1

# Ensure Gradle uses the full JDK (not just JRE) for toolchain detection.
JAVA_HOME_DIR=""
for candidate in \
  "$HOME/.sdkman/candidates/java/current" \
  "/usr/lib/jvm/java-21-openjdk" \
  "/usr/lib/jvm/java-17-openjdk" \
  "$JAVA_HOME"; do
  if [[ -x "$candidate/bin/javac" ]]; then
    JAVA_HOME_DIR="$candidate"
    break
  fi
done
if [[ -z "$JAVA_HOME_DIR" ]]; then
  echo "Could not find a JDK with javac. Install a JDK and ensure JAVA_HOME is set." >&2
  exit 1
fi
export JAVA_HOME="$JAVA_HOME_DIR"
echo "  JAVA_HOME=$JAVA_HOME"

echo "Generating the native Android project..."
npx expo prebuild --platform android --no-install --clean
# prebuild rewrites the npm scripts; we intentionally keep the original ones.
git restore package.json

echo "Building the release APK (this can take a while on the first run)..."
(cd android && ./gradlew assembleRelease --no-daemon)

APK="android/app/build/outputs/apk/release/app-release.apk"
if [[ ! -f "$APK" ]]; then
  echo "Build finished but the APK was not found at $APK." >&2
  exit 1
fi
APK_SIZE="$(du -h "$APK" | cut -f1)"
echo "APK ready: $APK ($APK_SIZE)"

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
Release $TAG (build $VERSION_CODE) pushed and the APK is built locally.

Next steps - attach the APK to a GitHub release:
  1. Create the GitHub release with the APK attached:
       gh release create $TAG --title "Coconut $VERSION" \\
         --notes "Release notes for Coconut $VERSION" \\
         "$APK"

  2. Or upload it manually in the browser:
       $GITHUB_RELEASES_URL

     Add the release notes (changes since the previous release) to the body and
     publish.

Note: this APK is signed with the debug keystore. It is fine for sideloading
from a GitHub release. If you later publish to the Play Store, set up proper
release signing (a production keystore + EAS or a local signing config).
================================================================================
EOF
