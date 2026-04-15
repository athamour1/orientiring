#!/usr/bin/env bash
set -euo pipefail

# ─── Configuration ──────────────────────────────────────────────────────────────
REPO="athamour1/oriento"
REGISTRY="ghcr.io"
BACKEND_IMAGE="${REGISTRY}/${REPO}/backend"
FRONTEND_IMAGE="${REGISTRY}/${REPO}/frontend"

# ─── Colors ─────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${CYAN}ℹ ${NC}$1"; }
ok()    { echo -e "${GREEN}✔ ${NC}$1"; }
warn()  { echo -e "${YELLOW}⚠ ${NC}$1"; }
error() { echo -e "${RED}✖ ${NC}$1"; exit 1; }

# ─── Pre-flight checks ─────────────────────────────────────────────────────────
command -v gh     >/dev/null || error "gh CLI not found. Install: https://cli.github.com"
command -v docker >/dev/null || error "docker not found."
gh auth status    >/dev/null 2>&1 || error "Not logged in to GitHub CLI. Run: gh auth login"

# ─── Ask for version ───────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}       🧭 Oriento Release Script${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
echo ""

# Show latest existing tags for context
LATEST_TAGS=$(git tag --sort=-v:refname 2>/dev/null | head -5)
if [ -n "$LATEST_TAGS" ]; then
  info "Latest tags:"
  echo "$LATEST_TAGS" | sed 's/^/   /'
  echo ""
fi

read -rp "$(echo -e "${YELLOW}Enter version to release (e.g. 1.0.0): ${NC}")" VERSION

# Validate semver-ish format
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+.*$ ]]; then
  error "Invalid version format. Use semver (e.g. 1.0.0, 1.2.3-beta.1)"
fi

TAG="v${VERSION}"

# Check if tag already exists
if git rev-parse "$TAG" >/dev/null 2>&1; then
  error "Tag $TAG already exists! Choose a different version."
fi

# ─── Confirmation ───────────────────────────────────────────────────────────────
echo ""
info "This will:"
echo "   1. Run pre-release checks (build, test, lint)"
echo "   2. Generate changelog from commits"
echo "   3. Bump version in package.json files"
echo "   4. Build Docker images for backend & frontend"
echo "   5. Push images to ${REGISTRY}/${REPO}"
echo "   6. Create Git tag ${TAG}"
echo "   7. Create GitHub release with changelog"
echo ""
echo -e "   📦 ${BACKEND_IMAGE}:${TAG}"
echo -e "   📦 ${FRONTEND_IMAGE}:${TAG}"
echo ""

read -rp "$(echo -e "${YELLOW}Proceed? (y/N): ${NC}")" CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  warn "Aborted."
  exit 0
fi

echo ""

# ─── Pre-release verification ───────────────────────────────────────────────
info "Running pre-release checks..."

info "Checking working tree is clean..."
if [ -n "$(git status --porcelain)" ]; then
  error "Working tree is not clean. Commit or stash your changes first."
fi
ok "Working tree clean"

info "Building backend..."
(cd backend && npm run build)
ok "Backend builds successfully"

info "Running backend tests..."
(cd backend && npm test -- --passWithNoTests)
ok "Backend tests pass"

info "Running backend lint..."
(cd backend && npm run lint)
ok "Backend lint passes"

echo ""

# ─── Generate changelog ─────────────────────────────────────────────────────
info "Generating changelog..."
PREV_TAG=$(git describe --tags --abbrev=0 HEAD 2>/dev/null || echo "")
if [ -n "$PREV_TAG" ]; then
  CHANGELOG=$(git log --oneline --no-merges "${PREV_TAG}..HEAD" 2>/dev/null || echo "")
  if [ -z "$CHANGELOG" ]; then
    CHANGELOG=$(git log --oneline --no-merges -20)
    warn "No commits since ${PREV_TAG}, using last 20 commits"
  else
    info "Changes since ${PREV_TAG}:"
  fi
else
  CHANGELOG=$(git log --oneline --no-merges -20)
  info "No previous tag found, using last 20 commits"
fi
echo "$CHANGELOG" | sed 's/^/   /'
echo ""

# Build release notes
RELEASE_NOTES="## What's Changed

$(echo "$CHANGELOG" | sed 's/^[a-f0-9]* /- /')

**Full Changelog**: https://github.com/${REPO}/compare/${PREV_TAG:-initial}...${TAG}"

# ─── Bump version in package.json ───────────────────────────────────────────
info "Bumping package.jsons to ${VERSION}..."
cd frontend
npm version "$VERSION" --no-git-tag-version --allow-same-version
cd ..
cd backend
npm version "$VERSION" --no-git-tag-version --allow-same-version
cd ..
git add .
git commit -m "chore(release): bump version to ${VERSION}"
git push
ok "Version bumped, committed and pushed"

# ─── Create Git tag & GitHub release ────────────────────────────────────────────
info "Creating Git tag ${TAG}..."
git tag -a "$TAG" -m "Release ${TAG}"
git push origin "$TAG"
ok "Tag ${TAG} pushed"

info "Creating GitHub release..."
gh release create "$TAG" \
  --repo "$REPO" \
  --title "🧭 Oriento ${TAG}" \
  --notes "$RELEASE_NOTES"
ok "GitHub release created"

# ─── Login to GHCR ─────────────────────────────────────────────────────────────
info "Logging in to ${REGISTRY}..."
gh auth token | docker login "$REGISTRY" -u "$(gh api user -q .login)" --password-stdin
ok "Logged in to ${REGISTRY}"

# ─── Build & push backend ──────────────────────────────────────────────────────
info "Building backend image..."
docker build -t "${BACKEND_IMAGE}:${TAG}" -t "${BACKEND_IMAGE}:latest" ./backend
ok "Backend image built"

info "Pushing backend image..."
docker push "${BACKEND_IMAGE}:${TAG}"
docker push "${BACKEND_IMAGE}:latest"
ok "Backend image pushed"

# ─── Build & push frontend ─────────────────────────────────────────────────────
info "Building frontend image..."
docker build -t "${FRONTEND_IMAGE}:${TAG}" -t "${FRONTEND_IMAGE}:latest" ./frontend
ok "Frontend image built"

info "Pushing frontend image..."
docker push "${FRONTEND_IMAGE}:${TAG}"
docker push "${FRONTEND_IMAGE}:latest"
ok "Frontend image pushed"

# ─── Done ───────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  🎉 Release ${TAG} complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo "  Images:"
echo "    docker pull ${BACKEND_IMAGE}:${TAG}"
echo "    docker pull ${FRONTEND_IMAGE}:${TAG}"
echo ""
echo "  Release:"
echo "    https://github.com/${REPO}/releases/tag/${TAG}"
echo ""
