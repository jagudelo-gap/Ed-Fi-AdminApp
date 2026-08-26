# Authentication and Authorization

At a high level, here is how auth is handled:

- User logs in via one of the login [options](#authentication-options).
- App looks up the appropriate user record and [saves it in a cache](#session-cache).
- App creates a random opaque "Session ID" (`sid`), which is basically the key for that cache record, and passes it to the client in the [`Set-Cookie` response header](#http-cookies).
- If the client is a browser (as opposed to someone running cURL, say), that cookie is [automatically included](#credentials-inclusion) in all subsequent requests to the API's domain.
- The rest of the API requests are authenticated by using that `Cookie` request header to [look up the user's session](#normal-request-authentication).
- To cause a logout, the cached [session record is destroyed](#logout).

## Authentication options

Unlike other apps SBAA only supports OIDC. Multiple IdPs can be registered, each operating behind a `/:id` path section.

1. Go to the `/login` route (anybody can go here).
1. Get redirected to an external IdP.
   - ...do things...
1. Get redirected back, this time to the `/callback` route
   - The data that you might call the authentication "result" is in the redirect URL, and it's parsed by PassportJS,
   - and then used by the OIDC library to complete the OIDC flow (called the private client authorization code flow)

A strategy other than OIDC could have any kind of unique logic in it, but the end result for Passport is always the same: a user object to store in the authenticated session cache.

## Session cache

This could be any number of things, including trivial options such as a JavaScript variable or more elaborate ones like Redis.

The usual reasons to stay away from in-memory options like a JS variable or a Redis emulator are: (a) volatility, or the issue of losing all the data in a crash and restart, and (b) an in-memory cache would be impossible to share if there are multiple parallel instances.

SBAA uses the Postgres server that already exists for the main app database.

## HTTP cookies

There is a kind of cookie called "HTTP-only" which is not accessible by JavaScript. Instead, it's set by the browser itself automatically whenever an API response includes a `Set-Cookie` header, and front-end JS can't even see it.

### Credentials inclusion

Although HTTP cookie sessions are opaque to the front-end code, there are still some things that need to be configured:

- Front-end API requests need to be sent using `credentials = include`, which tells the browser to include its HTTP-only cookie.
- API responses need to include the header `Access-Control-Allow-Credentials = true`, which tells the browser to let JavaScript access the response.

There are various ways to botch the setup of this, and we won't try to make this doc a source of truth on it. Suffice it to say, there are various ways a hacker can trick a user into sending (via their browser) a malicious request to the API from some starting point other than your front-end app, and it's critical that (a) the hacker shouldn't be able to steal the `sid`, and (b) those requests shouldn't be able to "do anything" in the app.

## Normal request authentication

The login and login-callback routes have their own unique handlers, but normal API requests are authenticated simply by attempting to look up a session using the `sid` cookie from the request header.

While Passport itself doesn't care if its lookup fails, there's a Guard that checks for the result, and _that's_ where the requests actually get rejected if there's no session. There's also a very simple `@Public()` decorator which just adds a property telling the guard not to run on a given route.

> If there's' no `Cookie` header, or there's no `sid` value _in_ the header, or the `sid` doesn't work, or if for any reason the lookup fails, then the request is deemed unauthenticated and returns a 401. The front-end of this app is built to catch 401s and redirect the user to login.

The retrieved session value is then stored in the NestJS request pipeline for any subsquent handlers to use. In general, this will include authorization checkers and the ultimate route controller. Controllers are given access to the session object by the `@ReqUser()` decorator which pulls it out of the request pipeline and puts it into a handler parameter.

## Logout

Because of the way request authentication works, deleting the session is all that's needed to log a user out of the app itself, because that guarantees that all subsequent requests using their old `sid` will fail.

In addition to destroying the local session, the logout route performs OIDC RP-Initiated Logout against the IdP the user logged in with. At login, the session records the provider (`oidcId`) and the `id_token`; at logout, the app redirects to that provider's `end_session_endpoint` (taken from its discovered metadata) with `id_token_hint` and `post_logout_redirect_uri` (the latter must be registered in the IdP). Providers that don't expose an `end_session_endpoint` (e.g. Google) get a local-only logout, and the user is shown a message explaining that the IdP session may still be active.

We don't currently implement back-channel logout (IdP-initiated), so signing out at the IdP does not end the app session.

### Security notes

- **`id_token_hint` exposure.** RP-Initiated Logout sends the `id_token` as the `id_token_hint` query parameter on a browser redirect, so the JWT is briefly visible in the browser `Location` header (and therefore in history, referrer, and any proxy logs). This is inherent to the OIDC RP-Initiated Logout spec and applies to every provider that advertises an `end_session_endpoint`; providers without one (e.g. Google) take the local-only path and never receive the hint. The token is otherwise kept server-side on the session and is never exposed to front-end JavaScript. Keep `id_token` lifetimes short at the IdP to limit the value of a leaked hint.
- **Logout CSRF.** `GET /auth/logout` has no CSRF protection, so a forged cross-site request can sign a user out both locally and, now, at the IdP. We accept this as a low-impact nuisance: it can force a logout but never a login, and the recovery path is simply to sign back in. If this becomes a concern, switch logout to `POST` with CSRF protection.
