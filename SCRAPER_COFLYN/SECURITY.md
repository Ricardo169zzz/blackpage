# Security policy

## Supported versions

| Version | Supported |
| :--- | :--- |
| 1.x | Yes |
| < 1.0 | No |

## Reporting a vulnerability

If you find a security vulnerability in scrapr (such as remote code execution, prototype pollution, unsafe deserialization, or SSRF in network handlers):

1. Do not create a public GitHub issue.
2. Report the vulnerability privately through the GitHub Security Advisories tab under `Security` > `Advisories` > `Report a vulnerability`.
3. If GitHub Advisories is unavailable, email the maintainer at `riazrepo@gmail.com`.

### What to include

- Description of the issue
- Minimal reproduction code or proof of concept
- Potential impact and affected platforms or methods

### Scope note

Upstream websites changing their HTML markup, anti-bot mechanisms, or breaking endpoints are functional bugs, not security vulnerabilities. Report broken scrapers through public issues.
