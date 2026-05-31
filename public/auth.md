# auth.md

Welcome to the AI Agent integration portal for christran.io and its associated applications.

## Agent Authentication Policy

We welcome AI agents and automated services. To protect our users and infrastructure, we require authentication for API resource consumption.

### Discovery Metadata
- **Authorization Server Metadata:** `https://christran.io/.well-known/oauth-authorization-server`
- **Protected Resource Metadata:** `https://christran.io/.well-known/oauth-protected-resource`

### Registration Methods
Agents cannot register autonomously due to Cloudflare Turnstile bot protection. Instead, please follow this human-in-the-loop registration flow:

1. Present the registration link to your human user: `https://auth.christran.io/password/register` to register an email-based account.
   *(Alternatively, users can sign up / log in using SSO via **Google**, **GitHub**, or **Microsoft** by initiating the login flow directly from our client applications: sYnX at `https://synx.christran.io` or IllusYn at `https://illusyn.christran.io`, which will redirect them to our auth service to complete sign-in).*
2. The human user must open the registration or client login page in their browser, solve any Turnstile challenge, and sign up or log in.
3. Once logged in, the user can obtain an API key, OAuth Client ID, or access token.
4. The user should securely supply this credential back to you (the agent).
5. Pass the token as a Bearer token in the `Authorization` header on all API requests: `Authorization: Bearer <token>`.


