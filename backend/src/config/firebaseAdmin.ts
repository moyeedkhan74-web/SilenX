import { initializeApp, getApps, App, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';

let adminApp: App | null = null;

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
export function getAdminApp(): App | null {
  if (adminApp) return adminApp;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const appsList = getApps();

  // Already-initialised apps (e.g. tests calling multiple times)
  if (appsList.length > 0) {
    adminApp = appsList[0];
    return adminApp;
  }

  try {
    const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (saJson) {
      let credentialObj: any;
      try {
        // Accept raw JSON string or base-64 encoded JSON
        const raw = Buffer.from(saJson, 'base64').toString('utf8');
        credentialObj = JSON.parse(raw);
      } catch {
        credentialObj = JSON.parse(saJson);
      }
      adminApp = initializeApp({ credential: cert(credentialObj) });
      console.log('[FirebaseAdmin] Initialised using FIREBASE_SERVICE_ACCOUNT_JSON');
      return adminApp;
    }

    // Split key reassembly for platforms with environment variable size limits (like Back4app)
    const pk1 = process.env.FIREBASE_PRIVATE_KEY_1;
    const pk2 = process.env.FIREBASE_PRIVATE_KEY_2;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    if (pk1 && pk2 && clientEmail && projectId) {
      const privateKey = (pk1 + pk2).replace(/\\n/g, '\n');
      const credentialObj = {
        type: 'service_account',
        project_id: projectId,
        private_key: privateKey,
        client_email: clientEmail,
      };
      adminApp = initializeApp({ credential: cert(credentialObj as any) });
      console.log('[FirebaseAdmin] Initialised using split FIREBASE_PRIVATE_KEY Env Vars');
      return adminApp;
    }

    // Fall back to ADC (GOOGLE_APPLICATION_CREDENTIALS file or GCE metadata)
    adminApp = initializeApp({
      credential: applicationDefault(),
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
export function getAdminAuth(): Auth | null {
  const app = getAdminApp();
  return app ? getAuth(app) : null;
}
export { Auth };
