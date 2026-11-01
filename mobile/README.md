# Postwave mobile (Expo / React Native)

Native Android app for Postwave. Lives outside the pnpm workspace on purpose.
Backend: the Railway web service (`extra.apiUrl` in app.json). Auth: bearer token from `/api/auth/login` (header `x-postwave-client: mobile`).

Build (EAS): `cd mobile && npm install && eas build -p android --profile preview`
