# miniprogram-app Module

Native WeChat miniprogram client for RiceFinanceU.

## Responsibility

- Mobile layout for the same RiceFinanceU product model used by the desktop app.
- Login, overview, asset management, snapshot entry, and data management tabs.
- Calls the deployed Cloudflare Worker API directly.

## Main Entry Points

- `app.json`: page list, launch page, and tabBar source of truth.
- `pages/`: miniprogram pages.
- `utils/api.js`: API adapter around `wx.request`.
- `utils/finance.js`: current miniprogram finance helpers. New shared rules should move toward `modules/finance-core`.
- `assets/tabbar/`: local native tabBar icons.

## Local Development

1. Open WeChat Developer Tools.
2. Choose import project.
3. Use `modules/miniprogram-app/` as the project directory.
4. Use the AppID in `project.config.json`.
5. Compile and run.

The miniprogram calls the deployed Cloudflare Worker API:

```txt
https://ricefinanceu.ricemarch-finance.workers.dev/api
```

For real-device or production access, configure this request domain in the miniprogram admin console:

```txt
https://ricefinanceu.ricemarch-finance.workers.dev
```

For local debugging, WeChat Developer Tools can temporarily disable request-domain validation.

## Allowed Dependencies

- WeChat miniprogram APIs.
- `finance-core` once shared domain rules are extracted in a compatible form.

## Forbidden Dependencies

- React and browser-only modules.
- Cloudflare Worker runtime objects.
- Hidden product concepts that do not exist in the desktop app.

## Required Verification

```bash
npm run mini:test
```

## Common AI Mistakes

- Using `redirectTo` for tab pages instead of `wx.switchTab`.
- Changing mobile information architecture away from `总览 / 资产 / 录入 / 数据`.
- Creating a separate mobile product model instead of adapting the desktop semantics.
