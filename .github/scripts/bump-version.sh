#!/bin/bash
set -euo pipefail

# Auto Version Bump Script
# Reads conventional commit messages since last tag, determines semver bump,
# and updates package.json, package-lock.json, CHANGELOG.md, README.md

# Get the latest tag
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
echo "Latest tag: $LATEST_TAG"

# Get current version from tag
VERSION="${LATEST_TAG#v}"
IFS='.' read -r MAJOR MINOR PATCH <<< "$VERSION"

# Collect commit messages since last tag
COMMITS=$(git log "${LATEST_TAG}..HEAD" --pretty=format:"%s" 2>/dev/null || git log --pretty=format:"%s")
echo "Commits since $LATEST_TAG:"
echo "$COMMITS"

# Skip if no commits since last tag (e.g., the release commit itself)
if [ -z "$COMMITS" ]; then
  echo "No new commits since $LATEST_TAG — skipping version bump"
  exit 0
fi

# Determine bump type from conventional commits
BUMP="patch"
while IFS= read -r msg; do
  if echo "$msg" | grep -qiE 'BREAKING CHANGE:|^\w+!\(|^\w+!:'; then
    BUMP="major"
    break
  elif echo "$msg" | grep -qiE '^feat(\(.+\))?[!]?:'; then
    BUMP="minor"
  fi
done <<< "$COMMITS"

echo "Bump type: $BUMP"

# Calculate new version
case "$BUMP" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
echo "New version: $NEW_VERSION"

# Update package.json
node -e "
  const fs = require('fs');
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.version = '$NEW_VERSION';
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  console.log('Updated package.json to ' + '$NEW_VERSION');
"

# Update package-lock.json (both top-level and packages[""] version fields)
node -e "
  const fs = require('fs');
  const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  lock.version = '$NEW_VERSION';
  if (lock.packages && lock.packages['']) {
    lock.packages[''].version = '$NEW_VERSION';
  }
  fs.writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
  console.log('Updated package-lock.json to ' + '$NEW_VERSION');
"

# Generate CHANGELOG entry from commits
TODAY=$(date +%Y-%m-%d)
CHANGELOG_ENTRY="## [$NEW_VERSION] - $TODAY"

# Categorize commits
FIXES=""
FEATS=""
CHORES=""
OTHER=""
while IFS= read -r msg; do
  # Skip empty lines and release commits
  [ -z "$msg" ] && continue
  echo "$msg" | grep -qiE '^chore\(release\):' && continue

  if echo "$msg" | grep -qiE '^fix(\(.+\))?:'; then
    FIXES="${FIXES}
- ${msg}"
  elif echo "$msg" | grep -qiE '^feat(\(.+\))?:'; then
    FEATS="${FEATS}
- ${msg}"
  elif echo "$msg" | grep -qiE '^chore(\(.+\))?:'; then
    CHORES="${CHORES}
- ${msg}"
  else
    OTHER="${OTHER}
- ${msg}"
  fi
done <<< "$COMMITS"

# Build changelog section
if [ -n "$FEATS" ]; then
  CHANGELOG_ENTRY="${CHANGELOG_ENTRY}
### Added${FEATS}"
fi
if [ -n "$FIXES" ]; then
  CHANGELOG_ENTRY="${CHANGELOG_ENTRY}
### Fixed${FIXES}"
fi
if [ -n "$CHORES" ]; then
  CHANGELOG_ENTRY="${CHANGELOG_ENTRY}
### Changed${CHORES}"
fi
if [ -n "$OTHER" ]; then
  CHANGELOG_ENTRY="${CHANGELOG_ENTRY}
### Other${OTHER}"
fi

# Insert into CHANGELOG.md after the header line
if [ -f "CHANGELOG.md" ]; then
  node -e "
    const fs = require('fs');
    let cl = fs.readFileSync('CHANGELOG.md', 'utf8');
    const entry = \`${CHANGELOG_ENTRY}\`;
    const marker = 'All notable changes to this project will be documented in this file.';
    const idx = cl.indexOf(marker);
    if (idx !== -1) {
      const insertAt = cl.indexOf('\n', idx) + 1;
      cl = cl.slice(0, insertAt) + '\n' + entry + '\n' + cl.slice(insertAt);
    }
    fs.writeFileSync('CHANGELOG.md', cl);
    console.log('Updated CHANGELOG.md');
  "
fi

# Update README.md Known Limitations version reference
if [ -f "README.md" ]; then
  node -e "
    const fs = require('fs');
    let readme = fs.readFileSync('README.md', 'utf8');
    readme = readme.replace(/This is version \`[0-9]+\.[0-9]+\.[0-9]+\`/, 'This is version \`${NEW_VERSION}\`');
    fs.writeFileSync('README.md', readme);
    console.log('Updated README.md version reference');
  "
fi

echo "Version bump complete: $LATEST_TAG -> v$NEW_VERSION"
