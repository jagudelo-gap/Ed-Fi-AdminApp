# Ed-Fi Admin App Developer's Guide

First, read the [SBAA Developer's Guide](./development.md) - but ignore anything about AWS. Take that as the appropriate starting point. Where typical Ed-Fi practices have differed from the SBAA practices, the Alliance will try to adapt to the "SBAA way" for consistency with the existing source code.

## Creating Releases

Two differences to highlight:

- `main` is only used for releases. Daily work goes into `develop` as the default branch, which is merged into `main` when a release is made.
  - Thus `main` always has the last release in it, making it easy to patch that release if needed when `develop` is not ready for public use.
- PR naming convention: add an appropriate prefix _before_ a Jira ticket number. Example: "feature: AC-264 feature flag for non-SBE deployments".

## Running Locally

Use the [compose/readme.md](../compose/readme.md) to start the main services, using the `.\start-local-dev.ps1` command.

> [!NOTE]
> The `odsV7-*-db-ods` containers are built locally and restore ODS data from
> your own `.sql` backup files on first run. Before starting services for the
> first time, see
> [compose/readme.md#ods-database-image-composedb-ods](../compose/readme.md#ods-database-image-composedb-ods)
> to configure `SQL_BACKUPS_FOLDER` and provide `EdFi.Ods.Minimal.Template.sql`
> / `EdFi.Ods.Populated.Template.sql`.

Once you have the services running, the Keycloak client `edfiadminapp-dev` will be created automatically during the Keycloak setup process. For details, see [compose/readme.md#setup-keycloak](../compose/readme.md#setup-keycloak).

### Setup Local Configuration for Admin App

In `packages/api/config`, copy `local.js-edfi` to create `local.js`.

- If you changed anything in your `.env` or `realm-config.json`, then be sure to update those values in this file as well.
- Ensure that `ADMIN_USERNAME` matches the email address you used when creating a new user in Keycloak (above).

> [!NOTE]
> `local.js` should not be kept in source control.

In `packages/fe`, copy `.copyme.env.local` to create `.env`.

### Install Node Dependencies

```shell
npm i
```

See [section](../docs/ed-fi-development.md#troubleshooting) for troublshooting tips.

### Start the Admin App Services in Development Mode

If you are signed into Keycloak with the default `admin` user, then either impersonate the new user or sign out and sign-in as that user.

Run each application in separate terminal windows. In the API terminal, setup Node to trust the self-signed cert.

```pwsh
# Terminal 1
$env:NODE_EXTRA_CA_CERTS="d:\ed-fi\AdminApp-v4\compose\ssl\server.crt"
npm run start:api:dev

# Terminal 2
npm run start:fe:dev
```

To verify the API service is running, call the [Healthcheck endpoint](http://localhost:3333/api/healthcheck).

```http
GET http://localhost:3333/api/healthcheck
```

If all went well, you can open [http://localhost:4200](http://localhost:4200) with your bootstrapped initial user. This will start you in "Global scope" mode for initial configuration.

If you have any issue, See [section](../docs/ed-fi-development.md#troubleshooting) for troublshooting tips.

## File Headers

This repository does not use file headers, as found in other Ed-Fi repositories.

## Linting

`npm run prettier:check` and `npm run prettier:write` can find and fix a lot of format errors. And these commands can take a long time to run, since they scan every file in the repository.

It is also easy to test / fix a specific file, for example:

```shell
npx prettier compose/readme.md
npx prettier --write compose/readme.md
```

### Pre-commit ESLint hook (Husky)

This repo uses `husky` to run a pre-commit hook (`.husky/pre-commit`) that invokes `lint-staged`. `lint-staged` runs `eslint --max-warnings 0` against staged `.ts`/`.tsx`/`.js`/`.jsx` files (config in `package.json`'s `lint-staged` field), so a commit is blocked if any staged file has ESLint errors or warnings.

- Run `npm run lint:check` locally before committing to catch issues early.
- Fix the reported lint errors/warnings rather than bypassing the hook with `git commit --no-verify`.

## Troubleshooting

### The Nx Daemon is unsupported in WebAssembly environments

The error message `The Nx Daemon is unsupported in WebAssembly environments` seems to occur when the package-lock.json has an OS-dependent version of some library. For example, it might be installing a Linux or MacOS binary, and you need Windows. Try obliterating local copy of all node files and reinstalling.

```shell
rm -r node_modules package-lock.json .nx
npm cache clear --force
npm install
```

### ERESOLVE unable to resolve dependency tree

There is some deep peer dependency problem that results in an error like this:

```none
npm error code ERESOLVE
npm error ERESOLVE unable to resolve dependency tree
npm error
npm error While resolving: ts-app-base-se@2.0.1
npm error Found: @storybook/components@8.6.14
npm error node_modules/@storybook/components
npm error   dev @storybook/components@"8.6.14" from the root project
npm error
npm error Could not resolve dependency:
npm error peer @storybook/components@"^7.0.0" from storybook-addon-react-router-v6@2.0.15
npm error node_modules/storybook-addon-react-router-v6
npm error   dev storybook-addon-react-router-v6@"^2.0.4" from the root project
npm error
npm error Fix the upstream dependency conflict, or retry
npm error this command with --force or --legacy-peer-deps
npm error to accept an incorrect (and potentially broken) dependency resolution.
```

Although it is not ideal, go ahead and run:

```shell
npm install --legacy-peer-deps
```

### Login page is not working or redirecting to `Not found`

- Did you set Node to trust the certificate _before_ starting the API service?
  
- This error usually means the required OIDC record is missing from the
`public.oidc` table in your database. The API startup process copies OIDC
configuration from the config file into the database, but if the record is
missing or incorrect, authentication will fail.

1. How to Fix:
   Check that the correct OIDC record exists in the `public.oidc` table.

   - For local-dev (`edfiadminapp-dev`  client):

    ```shell
     id |               issuer               |     clientId     |  clientSecret  | scope
    ----+------------------------------------+------------------+----------------+-------
      1 | https://localhost/auth/realms/edfi | edfiadminapp-dev | big-secret-123 |
    ```

   - For main services (`edfiadminapp` client):

    ```shell

     id |               issuer               |     clientId     |  clientSecret  | scope
    ----+------------------------------------+------------------+----------------+-------
      1 | https://localhost/auth/realms/edfi | edfiadminapp     | big-secret-123 |
    ```

2. If the required OIDC record is missing, you can manually insert it, or run the helper script:  

   - Run `./settings/populate-oidc.ps1` with parameters to add a oidc:

     ```powershell
     ./settings/populate-oidc.ps1 -ClientId "edfiadminapp" -ClientSecret "big-secret-123" -Issuer "https://localhost/auth/realms/edfi"

     OR

     ./settings/populate-oidc.ps1 -ClientId "edfiadminapp-dev" -ClientSecret "big-secret-123" -Issuer "https://localhost/auth/realms/edfi"
     
      ```

3. Make sure the `VITE_OIDC_ID` variable in your `.env` file matches the correct
   OIDC record id for your client. For example, set `VITE_OIDC_ID=1` for
   `edfiadminapp` or `edfiadminapp-dev`.

4. In Keycloak, confirm that the client configuration matches your OIDC settings:

     1. Open [Keycloak](https://localhost/auth).
     2. Sign-in with the credentials from your `.env` file.
     3. Select the realm called `edfi`.
     4. Go the clients and select `edfiadminapp` or `edfiadminapp-dev`, make sure the `Valid redirect
        URIs` has the correct url included
        `https://localhost/adminapp-api/api/auth/callback/{your_oidc_id}`, in
        this case should be `https://localhost/adminapp-api/api/auth/callback/1`

5. Start the services again

  ```pwsh
  # Terminal 1
  $env:NODE_EXTRA_CA_CERTS="d:\ed-fi\AdminApp-v4\compose\ssl\server.crt"
  npm run start:api:dev

  # Terminal 2
  npm run start:fe:dev
  ```

## Tips for Understanding the Repository

### Routing

How does URL routing work in this application? The following snippet sets up the UI routing for the Tenant creation page, for example:

```javascript
export const edfiTenantCreateRoute: RouteObject = {
  path: '/as/:asId/sb-environments/:sbEnvironmentId/edfi-tenants/create/',
  element: <CreateEdfiTenantPage />,
};
```

If the user is working with environment 1, then this route definition becomes this URL: `http://localhost:4200/sb-environments/1/edfi-tenants/create`.
