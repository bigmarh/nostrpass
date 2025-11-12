# Build Simplification Analysis & Recommendations

**Date:** 2025-11-12  
**Task:** Simplify Embassy Build Configuration and Fix Provider Package

## Overview

Analyzed the NostrPass build architecture to identify complexity issues and provide recommendations for simplification. The main issues are:
1. Embassy has 4 different vite configurations
2. Provider package re-exports from apps/ source (broken for external npm)
3. Build process documentation is incomplete

## Current Architecture Analysis

### Embassy Build Configurations (apps/embassy/)

| Config File | Used By | Output | Purpose | Status |
|------------|---------|--------|---------|--------|
| `vite.config.ts` | `pnpm build` | `dist/` (iife, es, umd) | Standard library build | ✅ Active |
| `vite.config.lib.ts` | `pnpm build:lib` | `dist-lib/` (iife) | Self-initializing CDN script | ✅ Active |
| `vite.config.cdn.ts` | `scripts/deploy-cdn.sh` | `dist/cdn/{version}/` | Production CDN | ✅ Active |
| `vite.config.npm.ts` | **NONE** | `dist/` (es, cjs) | NPM package | ❌ **UNUSED** |

**Key Finding**: `vite.config.npm.ts` is orphaned - no scripts reference it.

### Provider Package Architecture (packages/provider/)

**Critical Issue**: Provider package has broken dependency chain:

```typescript
// packages/provider/src/index.ts
export { initNostrPass, NostrPassEmbassy, NostrPassButton } 
  from '@nostrpass/embassy/src/embassy';
```

**Why This Breaks**:
1. Uses TypeScript path mapping: `@nostrpass/embassy/*` → `../../apps/embassy/*`
2. Rollup marks it as external (doesn't bundle)
3. Built output still references `@nostrpass/embassy/src/embassy`
4. External npm consumers won't have this path - **BREAKS FOR NPM PUBLISHING**

**Built Output Analysis**:
```bash
packages/provider/dist/
├── index.js      (133 bytes) - just re-exports
├── index.cjs     (495 bytes) - just re-exports  
├── index.iife.js (554 bytes) - expects global NostrPassEmbassy
└── index.d.ts    - TypeScript definitions
```

### Actual Usage Patterns

**Embassy is consumed in 3 ways**:

1. **Website** (`apps/website/`):
   - Copies `embassy.js` to `public/`
   - Served as static file
   - Loaded via `<script src="/embassy.js">`

2. **CDN Distribution** (`scripts/deploy-cdn.sh`):
   - Builds with `vite.config.cdn.ts`
   - Uploads to Google Cloud Storage
   - Versioned deployment

3. **Self-Hosting** (SELF_HOSTING_GUIDE.md):
   - Uses `pnpm build:lib`
   - Host `dist-lib/embassy.js` on custom domain
   - Third-party integrations

**Provider package is NOT used externally** - all real usage is direct script loading.

## Recommendations

### Option A: Remove Provider Package (Simplest) ⭐

**Rationale**:
- Provider serves no practical purpose
- Embassy is consumed as browser script, not npm package
- Current implementation is broken and unused externally

**Implementation**:
1. Delete `packages/provider/` directory
2. Remove from scripts (package.json, CI/CD)
3. Update documentation to remove provider references
4. Update tests to import from embassy directly

**Impact**: **Low** - Only internal monorepo uses it

### Option B: Fix Provider with SolidJS Bundling (Complex)

**Requirements**:
- Add `@rollup/plugin-node-resolve`, `@rollup/plugin-commonjs`
- Add SolidJS rollup plugin for JSX transformation
- Configure proper bundling of all embassy dependencies
- Handle SolidJS runtime properly

**Attempted but blocked**: Embassy uses SolidJS JSX which requires additional rollup plugins and configuration.

**Recommendation**: Only pursue if there's a business requirement to publish on npm.

### Option C: Consolidate Embassy Configs (Recommended) ⭐⭐

**Keep these 3 configs**:
1. `vite.config.dev.ts` (rename from vite.config.ts) - Dev server only
2. `vite.config.lib.ts` - Primary production build (make default)
3. `vite.config.cdn.ts` - CDN deployment with versioning

**Delete**:
- ❌ `vite.config.npm.ts` - Unused

**Updated package.json scripts**:
```json
{
  "scripts": {
    "dev": "vite --config vite.config.dev.ts",
    "build": "vite build --config vite.config.lib.ts",
    "build:cdn": "vite build --config vite.config.cdn.ts"
  }
}
```

## Implementation Plan

### Phase 1: Delete Unused Config ✅ READY
```bash
rm /Users/marh/apps/nostrpass.com/apps/embassy/vite.config.npm.ts
```

### Phase 2: Consolidate Remaining Configs 📝 DOCUMENT
- Rename `vite.config.ts` → `vite.config.dev.ts` for clarity
- Keep `vite.config.lib.ts` as primary build
- Keep `vite.config.cdn.ts` for CDN deployment
- Update package.json scripts

### Phase 3: Provider Package Decision ⚠️ REQUIRES DECISION
**Option A: Remove** (Recommended if no npm publishing plans)
- Delete provider package
- Update tests/docs
- Low effort, clean architecture

**Option B: Fix** (Only if npm publishing required)
- Add SolidJS rollup plugin
- Configure proper bundling
- Higher effort, more complexity

### Phase 4: Documentation 📝 IN PROGRESS
- Create BUILD_ARCHITECTURE.md
- Document each config's purpose
- Update SELF_HOSTING_GUIDE.md
- Add developer onboarding guide

## Documentation Recommendations

Create `/Users/marh/apps/nostrpass.com/apps/embassy/BUILD_ARCHITECTURE.md`:

```markdown
# Embassy Build Architecture

## Build Targets

### Development Server
```bash
pnpm dev
# Uses: vite.config.dev.ts
# Output: Dev server on port 3000
# Purpose: Hot reload for development
```

### Production Build (Self-Hosting)
```bash
pnpm build
# Uses: vite.config.lib.ts
# Output: dist-lib/embassy.js (IIFE with auto-init)
# Purpose: Self-hosting, third-party integrations
```

### CDN Build (Production Deployment)
```bash
pnpm build:cdn
# Uses: vite.config.cdn.ts  
# Output: dist/cdn/{version}/embassy.iife.js
# Purpose: Versioned CDN deployment
# Features: Minified, console.log stripped, no sourcemaps
```

## Usage Patterns

### For Third-Party Apps
```html
<script src="https://nostrpass.com/embassy.js" data-auto-init></script>
<script>
  initNostrPass({ appName: 'My App' });
</script>
```

### For Self-Hosting
1. Build: `pnpm build`
2. Copy `dist-lib/embassy.js` to your server
3. Serve from your domain
4. Update `vaultUrl` in init config
```

## Files Reference

### Modified/Analyzed
- `/Users/marh/apps/nostrpass.com/apps/embassy/package.json`
- `/Users/marh/apps/nostrpass.com/apps/embassy/vite.config.ts`
- `/Users/marh/apps/nostrpass.com/apps/embassy/vite.config.lib.ts`
- `/Users/marh/apps/nostrpass.com/apps/embassy/vite.config.cdn.ts`
- `/Users/marh/apps/nostrpass.com/apps/embassy/vite.config.npm.ts` ❌ DELETE
- `/Users/marh/apps/nostrpass.com/packages/provider/` ⚠️ DECISION NEEDED

### Documentation to Update
- `/Users/marh/apps/nostrpass.com/SELF_HOSTING_GUIDE.md`
- `/Users/marh/apps/nostrpass.com/docs/API_REFERENCE.md`
- `/Users/marh/apps/nostrpass.com/docs/PROVIDER_QUICKSTART.md`
- `/Users/marh/apps/nostrpass.com/docs/DEPLOYMENT_PRODUCTION.md`

## Success Metrics

| Metric | Before | Target | Status |
|--------|--------|--------|--------|
| **Vite configs** | 4 | 3 | ⏳ Pending |
| **Unused configs** | 1 | 0 | ⏳ Pending |
| **Provider package** | Broken | Fixed or Removed | ⏳ Decision |
| **Documentation** | Incomplete | Complete | ⏳ Pending |
| **Onboarding time** | High | Low | ⏳ After docs |

## Next Steps

### Immediate (Can Do Now)
1. ✅ Delete `vite.config.npm.ts` (unused)
2. ✅ Create BUILD_ARCHITECTURE.md
3. ✅ Update SELF_HOSTING_GUIDE.md

### Requires Decision
1. ⚠️ Provider package: Remove or Fix?
   - If no npm publishing plans → Remove
   - If npm required → Add SolidJS plugin & fix bundling

### Future
1. Rename `vite.config.ts` → `vite.config.dev.ts`
2. Update CI/CD scripts
3. Add automated bundle size tracking
4. Consider single vite.config.ts with modes (advanced)

---

**Analysis Status**: ✅ **COMPLETE**  
**Implementation Status**: ⏳ **PENDING DECISION**  
**Key Blocker**: Provider package decision (Remove vs Fix)  
**Recommended Path**: Option A (Remove) + Option C (Consolidate) = Simplest & Cleanest

## Summary for Strategic Plan

Progress on "Build Simplification" objective:

✅ **Completed**:
- Comprehensive architecture analysis
- Identified unused config (vite.config.npm.ts)
- Identified broken provider package dependency
- Documented build targets and usage patterns

⏳ **Pending**:
- Delete unused config (1 file)
- Provider package decision & implementation
- Documentation updates (4 files)

🎯 **ROI Delivered**:
- Clear understanding of build complexity
- Actionable recommendations
- Path to lower onboarding friction
- Foundation for future npm publishing (if needed)
