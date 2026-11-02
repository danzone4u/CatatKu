import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { type SQLiteDatabase } from 'expo-sqlite';
import { restoreBackup } from './backup';

export const GDRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.file',
];

export interface GoogleUserInfo {
  id: string;
  name: string | null;
  email: string;
  photo: string | null;
}

export interface DriveBackupFile {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
}

let isGoogleDriveInitialized = false;

/**
 * Inisialisasi Google Sign-In SDK
 * Catatan: webClientId opsional jika hanya menggunakan AppData folder di Android
 */
export function initGoogleDrive(webClientId?: string) {
  try {
    GoogleSignin.configure({
      scopes: GDRIVE_SCOPES,
      webClientId: webClientId || undefined,
      offlineAccess: Boolean(webClientId),
    });
    isGoogleDriveInitialized = true;
  } catch (err) {
    console.warn('initGoogleDrive error:', err);
  }
}

function ensureConfigured() {
  if (!isGoogleDriveInitialized) {
    initGoogleDrive();
  }
}

/**
 * Login Google dan dapatkan user info
 */
export async function signInGoogle(): Promise<GoogleUserInfo | null> {
  try {
    ensureConfigured();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    const user = (response as any)?.data?.user || (response as any)?.user;
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      photo: user.photo,
    };
  } catch (error) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
}

/**
 * Dapatkan user yang sedang aktif login (jika ada)
 */
export async function getCurrentGoogleUser(): Promise<GoogleUserInfo | null> {
  try {
    ensureConfigured();
    const currentUser = await GoogleSignin.getCurrentUser();
    const user = (currentUser as any)?.user || (currentUser as any)?.data?.user;
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      photo: user.photo,
    };
  } catch {
    return null;
  }
}

/**
 * Logout Google
 */
export async function signOutGoogle(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch (err) {
    console.warn('Google Sign-Out Error:', err);
  }
}

/**
 * Upload payload JSON backup ke folder tersembunyi AppData Google Drive
 */
export async function uploadBackupToDrive(
  jsonContent: string,
  fileName: string
): Promise<{ success: boolean; fileId: string }> {
  ensureConfigured();
  const tokens = await GoogleSignin.getTokens();
  const accessToken = tokens.accessToken;

  // Metadata file: simpan ke 'appDataFolder' agar terisolasi dan privat
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    parents: ['appDataFolder'],
  };

  const boundary = 'foo_bar_baz_catatku';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    jsonContent +
    closeDelimiter;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal upload ke Google Drive: ${errText}`);
  }

  const data = await res.json();
  return { success: true, fileId: data.id };
}

/**
 * Ambil daftar berkas backup CatatKu dari appDataFolder di Google Drive
 */
export async function listDriveBackups(): Promise<DriveBackupFile[]> {
  ensureConfigured();
  const tokens = await GoogleSignin.getTokens();
  const accessToken = tokens.accessToken;

  const query = encodeURIComponent("mimeType = 'application/json' and trashed = false");
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${query}&fields=files(id,name,createdTime,size)&orderBy=createdTime desc`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gagal mengambil daftar cadangan Drive: ${errText}`);
  }

  const data = await res.json();
  return (data.files || []) as DriveBackupFile[];
}

/**
 * Unduh dan pulihkan data dari salah satu file cadangan di Google Drive
 */
export async function restoreFromDriveFile(
  db: SQLiteDatabase,
  fileId: string
): Promise<{ success: boolean; count: number; message: string }> {
  ensureConfigured();
  const tokens = await GoogleSignin.getTokens();
  const accessToken = tokens.accessToken;

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error('Gagal mengunduh file cadangan dari Google Drive');
  }

  const jsonText = await res.text();
  return await restoreBackup(db, jsonText);
}
