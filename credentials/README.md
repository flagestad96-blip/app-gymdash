# credentials/

This folder holds the **Google Play service account key** used by EAS Submit to
upload builds to the Play Console automatically.

## Required file

```
credentials/google-play-service-account.json
```

This file is **git-ignored** (see `.gitignore`) and must **never** be committed —
it grants write access to your Play Console. The path is referenced from
`eas.json` → `submit.production.android.serviceAccountKeyPath`.

## How to create it (one-time)

See [`docs/RELEASE.md`](../docs/RELEASE.md) for the full step-by-step. In short:

1. Play Console → **Users and permissions** / **API access** → link a Google
   Cloud project.
2. In Google Cloud Console, create a **service account** + a **JSON key**.
3. Back in Play Console, invite that service account and grant it the
   **"Release to testing tracks"** permission for the Gymdash app.
4. Download the JSON key and save it here as `google-play-service-account.json`.

> Lost the file? It's not in git. Re-download the key from Google Cloud Console
> (or generate a new one and revoke the old).
