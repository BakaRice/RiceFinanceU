# Asset Profile Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional type-specific asset profile fields to asset management without changing snapshot valuation or portfolio calculations.

**Architecture:** Store profile data as an optional `Asset.profile` object. Centralize field definitions, cleanup, labels, and list identity formatting in `src/domain/assets.ts`, then reuse those helpers in server routes and asset pages.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Express route handlers, local JSON storage.

---

## File Structure

- Modify `src/types/finance.ts`: add `AssetProfile` types and attach `profile?: AssetProfile` to `Asset`.
- Modify `src/domain/assets.ts`: define profile field metadata, sanitize profile data by asset type, and format list identity text.
- Modify `src/domain/assets.test.ts`: add tests for sanitization and list identity formatting.
- Modify `server/routes/dataRoutes.ts`: sanitize asset profiles during create, update, and inline asset creation.
- Modify `server/routes/importExportRoutes.ts`: validate optional asset profiles during import.
- Modify `worker/index.js`: mirror profile cleanup behavior for Cloudflare Worker API routes.
- Modify `worker/worker.test.mjs`: cover Worker profile cleanup and clearing.
- Modify `src/api/client.ts`: allow `createAsset` to send profile data.
- Modify `src/pages/AssetsPage.tsx`: add profile state, type-specific profile form fields, save profile data, and show a list identity column.
- Modify `src/pages/AssetsPage.css`: add compact profile form and identifier styling.
- Modify `src/pages/AssetDetailPage.tsx`: show a type-specific asset profile section.
- Modify `src/pages/AssetDetailPage.css`: keep the asset profile section visually aligned with the current financial terminal style.

---

### Task 1: Domain Types And Helpers

**Files:**
- Modify: `src/types/finance.ts`
- Modify: `src/domain/assets.ts`
- Test: `src/domain/assets.test.ts`

- [ ] **Step 1: Write failing tests for profile cleanup and identifiers**

Add these tests to `src/domain/assets.test.ts`:

```ts
import {
  ASSET_TYPE_LABELS,
  formatAssetProfileIdentifier,
  getAssetProfileFields,
  isBalanceType,
  isInvestmentType,
  sanitizeAssetProfile,
  filterActiveAssets,
  groupAssetsByType,
} from './assets'

describe('asset profile fields', () => {
  it('lists type-specific profile fields', () => {
    expect(getAssetProfileFields('fund').map((field) => field.key)).toEqual([
      'fundCode',
      'fundCategory',
      'marketTheme',
      'holdingPlatform',
    ])
    expect(getAssetProfileFields('deposit').map((field) => field.key)).toContain('maturityDate')
  })

  it('keeps only non-empty fields allowed by the selected asset type', () => {
    const profile = sanitizeAssetProfile('fund', {
      fundCode: ' 513100 ',
      marketTheme: ' 美股 ',
      maturityDate: '2027-01-01',
      brokerAccount: 'hidden',
      empty: '',
    })

    expect(profile).toEqual({
      fundCode: '513100',
      marketTheme: '美股',
    })
  })

  it('returns undefined when a profile has no usable values', () => {
    expect(sanitizeAssetProfile('cash', { accountChannel: '   ' })).toBeUndefined()
  })

  it('formats compact identifiers for asset lists', () => {
    expect(formatAssetProfileIdentifier(makeAsset({
      type: 'stock',
      profile: { exchange: 'NASDAQ', ticker: 'AAPL' },
    }))).toBe('NASDAQ AAPL')
    expect(formatAssetProfileIdentifier(makeAsset({
      type: 'housing_fund',
      profile: { contributionCity: '上海' },
    }))).toBe('上海')
    expect(formatAssetProfileIdentifier(makeAsset({ type: 'other' }))).toBe('-')
  })
})
```

- [ ] **Step 2: Run the domain test and verify it fails**

Run: `npm run test:app -- src/domain/assets.test.ts`

Expected: FAIL because `Asset.profile`, `getAssetProfileFields`, `sanitizeAssetProfile`, and `formatAssetProfileIdentifier` do not exist yet.

- [ ] **Step 3: Add minimal profile types and helpers**

Add profile types to `src/types/finance.ts`, then add the helpers to `src/domain/assets.ts`. Use exact field keys from the design:

```ts
export type AssetProfile = Partial<Record<
  | 'fundCode'
  | 'fundCategory'
  | 'marketTheme'
  | 'holdingPlatform'
  | 'ticker'
  | 'exchange'
  | 'brokerAccount'
  | 'industryTag'
  | 'holdingForm'
  | 'custodian'
  | 'unit'
  | 'sourceNote'
  | 'bank'
  | 'depositType'
  | 'term'
  | 'maturityDate'
  | 'annualRate'
  | 'accountChannel'
  | 'purposeTag'
  | 'availabilityNote'
  | 'contributionCity'
  | 'accountOwner'
  | 'managementNote'
  | 'customCategory'
  | 'ownershipNote'
  | 'reminderDate',
  string
>>
```

- [ ] **Step 4: Run the domain test and verify it passes**

Run: `npm run test:app -- src/domain/assets.test.ts`

Expected: PASS.

---

### Task 2: Server And Import Support

**Files:**
- Modify: `server/routes/dataRoutes.ts`
- Modify: `server/routes/importExportRoutes.ts`
- Optional Test: extend an existing server route test only if a route-level test harness already exists.

- [ ] **Step 1: Reuse domain cleanup in asset writes**

Import `sanitizeAssetProfile` from `src/domain/assets.ts`.

For `POST /assets`, build:

```ts
const profile = sanitizeAssetProfile(type, req.body.profile)
const newAsset: Asset = {
  id: uuidv4(),
  name: name.trim(),
  type,
  currency: assetCurrency,
  institution,
  isActive: true,
  note,
  ...(profile ? { profile } : {}),
  createdAt: now,
  updatedAt: now,
}
```

For `PATCH /assets/:id`, compute `nextType`, sanitize the submitted or existing profile against that type, and overwrite `profile` with the sanitized value.

For inline snapshot-created assets, sanitize `v.asset.profile` if that shape exists in the type after Task 1.

- [ ] **Step 2: Validate import profiles**

In `validateAsset`, add checks:

```ts
if (a.profile !== undefined && a.profile !== null) {
  if (typeof a.profile !== 'object' || Array.isArray(a.profile)) {
    errs.push(tag('profile', 'must be an object if present'))
  } else {
    for (const [key, value] of Object.entries(a.profile)) {
      if (typeof value !== 'string') {
        errs.push(tag(`profile.${key}`, 'must be a string if present'))
      }
    }
  }
}
```

- [ ] **Step 3: Run app tests**

Run: `npm run test:app -- src/domain/assets.test.ts`

Expected: PASS.

---

### Task 3: Worker API Parity

**Files:**
- Modify: `worker/index.js`
- Test: `worker/worker.test.mjs`

- [ ] **Step 1: Write failing Worker profile test**

Add a Worker test that creates a `cash` asset with `profile.accountChannel`, includes unrelated `fundCode`, and verifies only the cash field is stored. Then patch the asset with `profile: {}` and verify the profile is cleared.

- [ ] **Step 2: Run Worker test to verify it fails**

Run: `npm run worker:test`

Expected: FAIL because Worker asset routes do not save `profile` yet.

- [ ] **Step 3: Add Worker profile cleanup**

Add an `ASSET_PROFILE_FIELDS` map and `sanitizeAssetProfile(type, profile)` helper to `worker/index.js`. Reuse it in:

- `POST /api/assets`.
- `PATCH /api/assets/:id`.
- inline asset creation inside `POST /api/snapshots`.
- import normalization inside `POST /api/import`.

- [ ] **Step 4: Run Worker test to verify it passes**

Run: `npm run worker:test`

Expected: PASS.

---

### Task 4: Web Asset Management UI

**Files:**
- Modify: `src/api/client.ts`
- Modify: `src/pages/AssetsPage.tsx`
- Modify: `src/pages/AssetsPage.css`

- [ ] **Step 1: Add UI state and payload support**

Allow `api.createAsset` to accept `profile?: AssetProfile`.

In `AssetsPage.tsx`, add profile state as `Record<string, string>`, reset it on create, populate it on edit, and include `profile: sanitizeAssetProfile(type, profileDraft)` in create/update payloads.

- [ ] **Step 2: Render profile fields by type**

Below the common fields, render a compact “类型档案” section:

```tsx
<div className="profile-fields">
  <div className="profile-fields-title">类型档案</div>
  {getAssetProfileFields(type).map((field) => (
    <label className="form-label" key={field.key}>
      {field.label}
      <input
        type={field.inputType || 'text'}
        className="form-input"
        value={profileDraft[field.key] || ''}
        onChange={(e) => setProfileDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
        placeholder={field.placeholder}
      />
    </label>
  ))}
</div>
```

- [ ] **Step 3: Add list identifier column**

Use `formatAssetProfileIdentifier(a)` in a new “标识” table column between `类型` and `机构`.

- [ ] **Step 4: Add compact CSS**

Add CSS for `.profile-fields`, `.profile-fields-title`, and `.asset-profile-identifier` using existing borders, small type, and muted text.

- [ ] **Step 5: Run app tests**

Run: `npm run test:app`

Expected: PASS.

---

### Task 5: Asset Detail Profile Section

**Files:**
- Modify: `src/pages/AssetDetailPage.tsx`
- Modify: `src/pages/AssetDetailPage.css`

- [ ] **Step 1: Render type-specific profile details**

In `AssetDetailPage.tsx`, use `getAssetProfileFields(asset.type)` and `asset.profile` to build visible rows. Add a “资产档案” section near basic information.

If no profile values exist, show `未补充档案信息`.

- [ ] **Step 2: Keep detail layout stable**

Update CSS so the three detail sections can wrap cleanly on desktop and stack on mobile. Keep border-based sections and avoid nested cards.

- [ ] **Step 3: Run app tests and build**

Run: `npm run test:app`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

---

### Task 6: Final Verification

**Files:**
- Review all modified files.

- [ ] **Step 1: Run full verification**

Run: `npm run test`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 2: Inspect git diff**

Run: `git diff -- docs/superpowers/specs/2026-07-05-asset-profile-fields-design.md docs/superpowers/plans/2026-07-05-asset-profile-fields.md src/types/finance.ts src/domain/assets.ts src/domain/assets.test.ts server/routes/dataRoutes.ts server/routes/importExportRoutes.ts worker/index.js worker/worker.test.mjs src/api/client.ts src/pages/AssetsPage.tsx src/pages/AssetsPage.css src/pages/AssetsPage.test.tsx src/pages/AssetDetailPage.tsx src/pages/AssetDetailPage.css src/pages/AssetDetailPage.test.tsx`

Expected: Diff contains only the asset profile feature, with no changes to unrelated dirty miniprogram data files.
