# Tenant Mode Validation

At the moment of environment creation we need a way to find out if the Admin Api is running on Single-Tenant mode or Multi-Tenant mode. And in case it is running on Multi-Tenant mode then include the tenant names as well.

Currently we send a request to Ods Api Discovery Url and based on the presence of the text `tenantIdentifier` we collect that information.
If the text is part of the response anywhere we assume the environment is multitenant, single tenant otherwise.

The response looks currently like this:

```json
{
  "version": "2.0",
  "build": "2.2.3.0"
}
```

With the new information, a Multi-Tenant response will look like this:

```json
{
  "tenancy": {
    "multitenantMode": true,
    "tenants": [
      "tenant1",
      "tenant2"
    ]
  },
  "version": "2.0",
  "build": "0.1.0.0"
}
```

While a Single-Tenant will look like this (Notice the empty tenants list):

```json
{
  "tenancy": {
    "multitenantMode": false,
    "tenants": []
  },
  "version": "2.0",
  "build": "0.1.0.0"
}
```

## Benefits of the new field

1. Easy integration with what we currently have on Admin App.
2. Easy implementation on Admin Api.
3. No authentication required.

## What about Ods Api 6x?

For Ods Api 6x the response for the info endpoint won't include the new field given that the concept
of multitenancy was introduced on Ods Api 7x.

## The implementation on Admin Api

To implement these changes on Admin Api, we have [ADMINAPI-1329](https://edfi.atlassian.net/browse/ADMINAPI-1329)

Create a new class that inherits from `InformationResult`. It might look something like this:

```Code
public class InformationResultV2 : InformationResult
{
    [SwaggerSchema("Tenancy", Nullable = false)]
    public TenancyInformation tenancy { get; }


    public InformationResultV2(string version, string build, bool multitenantMode, IList<string> tenants) : base(version, build)
    {

        tenancy = new TenancyInformation(multitenantMode, multitenantMode ? tenants : new List<string>());
    }
}
```

And then GetInformation on ReadInformation endpoint implementation might look something like this:

```Code
internal static async Task<InformationResult> GetInformation(IOptions<AppSettings> options, [FromServices] ITenantsService tenantsService)
{
    var tenants = await tenantsService.GetTenantsAsync(true);

    if (!Enum.TryParse<AdminApiMode>(options.Value.AdminApiMode, true, out var adminApiMode))
    {
        throw new InvalidOperationException($"Invalid adminApiMode: {options.Value.AdminApiMode}");
    }
    return adminApiMode switch
    {
        AdminApiMode.V1 => new InformationResult(V1.Infrastructure.Helpers.ConstantsHelpers.Version, V1.Infrastructure.Helpers.ConstantsHelpers.Build),
        AdminApiMode.V2 => new InformationResultV2(ConstantsHelpers.Version, ConstantsHelpers.Build, options.Value.MultiTenancy, tenants.Select(t => t.TenantName).ToList()),
        _ => throw new InvalidOperationException($"Invalid adminApiMode: {adminApiMode}")
    };
}
```

New TenancyInformation class:

```Code
public class TenancyInformation
{
    public TenancyInformation(bool multitenantMode, IList<string> tenants)
    {
        MultitenantMode = multitenantMode;
        Tenants = tenants;
    }

    [SwaggerSchema("MultitenantMode", Nullable = false)]
    public bool MultitenantMode { get; }


    [SwaggerSchema("Tenants", Nullable = false)]
    public IList<string> Tenants { get; }
}
```

Notice how for V1 we return the original `InformationResult`, and for V2 we return the new `InformationResultV2` result.

## The implementation on Admin App

To implement these changes on Admin App, we have [AC-447](https://edfi.atlassian.net/browse/AC-447)

### Some notes

1. On api-metadata-utils.ts change the `determineTenantModeFromMetadata` function to use the new field.
   1. This function should receive the response from calling the Admin Api information endpoint.
   2. Which means this call should have had happened previously.
2. This function is mainly used when creating or editing an environment. On both scenarios we make calls to the info Admin Api endpoint, and the Ods Api discovery endpoint. Make sure these calls happen just once for each Api so we don’t impact performance.

## Implications

**Important:** Once this feature is released on Admin App, this forces the user upgrade Admin Api as well.
