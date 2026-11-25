# Security Policy

## Supported versions

The latest commit on `main` is the supported version. There are no maintained
release branches yet.

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub's
[private vulnerability reporting](../../security/advisories/new) instead of
opening a public issue. Include the affected route or flow, a way to reproduce
it, and what an attacker could do with it.

You can expect an acknowledgement within a few days. Once a fix lands on
`main`, the advisory is credited to you unless you prefer to stay anonymous.

## Scope notes

- The app displays data from third-party GitHub repositories. Rendering
  issues (XSS through README-derived content, open redirects) are in scope.
- Sessions are random 256-bit tokens, stored hashed. Session theft or
  fixation issues are in scope.
- The GitHub token is server-side only; anything that leaks it to the browser
  is critical.
