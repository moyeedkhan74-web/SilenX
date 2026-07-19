import * as admin from 'firebase-admin';

let adminApp: admin.app.App | null = null;

/**
 * Lazily initialise Firebase Admin SDK.
 *
 * Priority order for credentials:
 *   1. FIREBASE_SERVICE_ACCOUNT_JSON env var (base-64 or raw JSON string)
 *      — recommended for Render / Railway / Docker
 *   2. GOOGLE_APPLICATION_CREDENTIALS env var (path to service-account file)
 *      — standard ADC flow, works locally when file exists
 *   3. Application Default Credentials (GCE / Cloud Run)
 *
 * NEVER hard-code service-account keys in source files.
 */
export function getAdminApp(): admin.app.App | null {
  if (adminApp) return adminApp;

  const projectId = process.env.FIREBASE_PROJECT_ID;

  // Already-initialised apps (e.g. tests calling multiple times)
  if (admin.apps.length > 0) {
    adminApp = admin.apps[0] as admin.app.App;
    return adminApp;
  }

  try {
    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (saJson) {
      let credential: admin.ServiceAccount;
      try {
        // Accept raw JSON string or base-64 encoded JSON
        const raw = Buffer.from(saJson, 'base64').toString('utf8');
        credential = JSON.parse(raw);
      } catch {
        credential = JSON.parse(saJson);
      }
      adminApp = admin.initializeApp({ credential: admin.credential.cert(credential) });
      console.log('[FirebaseAdmin] Initialised using FIREBASE_SERVICE_ACCOUNT_JSON');
      return adminApp;
    }

    // Fall back to ADC (GOOGLE_APPLICATION_CREDENTIALS file or GCE metadata)
    adminApp = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      ...(projectId ? { projectId } : {}),
    });
    console.log('[FirebaseAdmin] Initialised using Application Default Credentials');
    return adminApp;
  } catch (err: any) {
    console.error('[FirebaseAdmin] Initialisation failed:', err?.message);
    return null;
  }
}

/** Returns the Admin Auth service, or null if SDK is not configured. */
export function getAdminAuth(): admin.auth.Auth | null {
  const app = getAdminApp();
  return app ? admin.auth(app) : null;
}
