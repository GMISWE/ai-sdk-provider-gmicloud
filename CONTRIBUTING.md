# Contributing

Thanks for your interest in contributing to the GMI Cloud AI SDK provider.

## Development Setup

Install dependencies:

```bash
npm ci
```

Run the full verification suite:

```bash
npm run verify
```

This runs TypeScript type checking, the Vitest test suite, and the package build.

## Pull Request Guidelines

- Keep changes focused and scoped to the provider behavior being updated.
- Add or update tests for request mapping, response mapping, streaming behavior, and error handling.
- Do not include live API keys, bearer tokens, `.env` files, or credentials in commits.
- Use mock `fetch` tests for default CI coverage. Live API checks should remain opt-in.
- Update `README.md` when user-facing behavior or supported capabilities change.

## Release Process

Releases are published to npm as `@gmicloud/ai-sdk-provider`.

Before publishing:

```bash
npm run verify
npm pack --dry-run
```

Confirm that the npm tarball contains only the package metadata, README, and built `dist` files.

## Maintainers

This provider is maintained by GMI Cloud. For questions about security issues, see `SECURITY.md`.
