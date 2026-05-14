# Security Policy

## Supported Versions

GMI Cloud currently supports the latest published version of `@gmicloud/ai-sdk-provider`.

| Version | Supported |
| --- | --- |
| `0.1.x` | Yes |

## Reporting a Vulnerability

Please do not report security vulnerabilities through public GitHub issues.

To report a vulnerability, contact GMI Cloud at:

```text
security@gmicloud.ai
```

Include as much detail as possible:

- A description of the issue and potential impact.
- Steps to reproduce or a minimal proof of concept.
- Affected package version.
- Any logs or request/response examples with secrets removed.

We will acknowledge reports as soon as possible and coordinate fixes privately before public disclosure.

## Handling Secrets

Never commit API keys, bearer tokens, credentials, or `.env` files to this repository. The provider reads credentials from the `GMI_CLOUD_APIKEY` environment variable or from explicit runtime configuration.
