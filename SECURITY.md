# Security

Postwave handles user accounts, social publishing credentials, media and subscription payments. Please report suspected vulnerabilities responsibly.

## Reporting a vulnerability

Do not disclose suspected vulnerabilities in public issues or pull requests. Contact the repository owner privately through GitHub's **Report a vulnerability** feature when it is enabled for this repository.

Include:
- A clear description and impact.
- Reproduction steps or a proof of concept that does not access other users' data.
- The affected route, component or dependency.
- Any suggested mitigation.

Please allow time for investigation and a fix before public disclosure.

## Do not include secrets in reports

Never send passwords, session cookies, API keys, Paystack secrets, OAuth tokens or real customer data. Redact sensitive values from screenshots and logs.

## Security expectations

- Keep production secrets in the hosting provider's secret manager, never in source control.
- Use separate test and live payment credentials.
- Restrict access to production databases and worker services.
- Rotate credentials immediately if exposure is suspected.
