# Google sign-in

[Start here](getting-started.md) · [Verification checklist](verification.md)

1. In [Google Auth Platform](https://console.cloud.google.com/auth/overview), configure branding and audience, then create an OAuth client of type **Web application**. For a project in Testing, add your Google account as a test user. Only basic identity scopes (`openid`, `email`, `profile`) are requested.
2. Add the JavaScript origin `http://localhost:3001` and exact authorized redirect URI `http://localhost:3001/api/auth/callback/google`.
3. Run `pnpm setup:local` if needed, then add these two values to the generated, gitignored `apps/api/.dev.vars`:

   ```dotenv
   GOOGLE_CLIENT_ID=your-client.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

   Keep the generated `BETTER_AUTH_SECRET`. `.dev.vars.example` documents all three values. Never put secrets in `VITE_` variables.

4. Restart `pnpm dev`, open the dashboard, and choose **Continue with Google**. First sign-in creates a D1 user and account; subsequent sign-ins reuse that identity. Signing out deletes the server session.

[Better Auth](https://www.better-auth.com/docs/authentication/google) handles OAuth state, PKCE, encrypted provider tokens, and signed HttpOnly session cookies. Sessions live in D1, expire after seven days, and use Secure cookies with HTTPS and SameSite=Lax. Password signup and automatic account linking are disabled. `AUTH_URL` is the **dashboard origin**, because its same-origin `/api/*` proxy handles the OAuth callback and cookies. It is not the API Worker's URL. Use one canonical dashboard origin per environment.

## Local and deployed addresses

A Google **origin** is the base address of the dashboard. The **redirect URI** is the address Google returns to after consent. Add each exact value to the same web client whose ID and secret you use. Paths, ports and trailing slashes matter.

| Environment     | Authorized JavaScript origin                            | Authorized redirect URI                                                          |
| --------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Local           | `http://localhost:3001`                                 | `http://localhost:3001/api/auth/callback/google`                                 |
| Your deployment | The dashboard URL printed by `pnpm cloud:up my-demo`    | That URL followed by `/api/auth/callback/google`                                 |
| Maintained demo | `https://starter-showcase-18d8b58f-dashboard.pages.dev` | `https://starter-showcase-18d8b58f-dashboard.pages.dev/api/auth/callback/google` |

The public marketing domain `devtemplate.leitware.com` does not handle login. `cloud:domain` changes the marketing address only. Google redirects through the dashboard's `/api` proxy to Better Auth in the Worker. `AUTH_URL` and the registered callback must describe that dashboard, even though the API has a separate address.

For a fresh project, use your own OAuth client. Separate development and production clients make their allowed users and callbacks easier to manage. A provider may require the account owner to sign in, pass MFA, or approve consent. Credentials alone do not prove that a callback is registered.

## Verify it in a browser

1. Open the dashboard in a fresh browser session. You should reach `/login` before any private data renders.
2. Choose **Continue with Google**, select an allowed account and complete consent. You should reach the workspace with your email shown.
3. Create a todo, reload, then sign out. Reloading the dashboard must return to `/login`.
4. Open `/checkout` while signed out. After Google sign-in you should return to checkout. An order link at `/checkout/success?session_id=cs_test_...` must keep its order reference through sign-in; only its owner can read it.
5. Cancel Google consent. The sign-in page should show a retry message and keep the checkout destination.

A first real sign-in creates the user's D1 user/account records. Automated browser tests seed temporary sessions and check OAuth initiation, cancellation and redirects; they do not complete Google's token exchange.

## If sign-in fails

| What you see                            | What to check                                                                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Google sign-in is unavailable           | Both Google values in `apps/api/.dev.vars`; restart `pnpm dev` or rerun `pnpm cloud:up my-demo`.                                                                         |
| `redirect_uri_mismatch` at Google       | Copy the exact `redirect_uri` from Google's error details into that web client's authorized redirect URIs. Check that you edited the client matching `GOOGLE_CLIENT_ID`. |
| Access blocked / testing restriction    | Configure the Google audience and add the signing-in account as a test user.                                                                                             |
| Sign-in returns but no session persists | Use one dashboard hostname throughout. Check `AUTH_URL`, `ALLOWED_ORIGINS` and HTTPS; do not start on a temporary Pages preview hostname.                                |
| Could not load sign-in settings         | Visit the dashboard's `/api/health`; the app-to-Worker proxy must work first.                                                                                            |
| Google sign-in could not be completed   | Retry from `/login`; expired or invalid OAuth state cannot be reused. Check Worker logs for the matching request, without logging tokens.                                |
