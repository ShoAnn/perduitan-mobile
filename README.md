# perduitan-mobile

An [Expo](https://expo.dev) app built with [Expo Router](https://docs.expo.dev/router/introduction) and React Native.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

You can open the app in a development build, an Android emulator, an iOS simulator, or Expo Go.

## Project structure

- `src/app/index.tsx` — home screen
- `src/app/add-income.tsx` — add income screen
- `src/app/add-expense.tsx` — add expense screen
- `src/app/new-category.tsx` — new category modal
- `src/app/_layout.tsx` — root stack layout
- `src/components/` — shared components
- `src/components/form/` — form controls (text field, option chips)
- `src/constants/theme.ts` — colors and spacing
- `src/constants/sample-data.ts` — placeholder accounts and categories
- `src/stores/categories.ts` — in-memory category list shared by screens
- `src/types/api.ts` — request/response types from `openapi.yaml`
- `src/utils/transactions.ts` — date formatting and transaction payload helpers

## Scripts

- `npm start` — start the dev server
- `npm run android` — run on Android
- `npm run ios` — run on iOS
- `npm run web` — run on the web
- `npm run lint` — lint the project
