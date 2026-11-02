import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { type SQLiteDatabase } from 'expo-sqlite';
import { generateBackupJson, restoreBackup, mergeBackupData } from './backup';
import { getSetting, setSetting } from '../database/queries';

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

  // Otomatis bersihkan cadangan lama agar kuota & daftar tetap ramping (simpan 5 terbaru)
  cleanOldDriveBackups(5).catch((err) => console.warn('cleanOldDriveBackups warning:', err));

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
 * Hapus berkas cadangan dari Google Drive berdasarkan ID
 */
export async function deleteDriveFile(fileId: string): Promise<boolean> {
  try {
    ensureConfigured();
    const tokens = await GoogleSignin.getTokens();
    const accessToken = tokens.accessToken;

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

/**
 * Kebijakan Retensi: Hapus berkas backup lama jika melebihi batas keepCount
 */
export async function cleanOldDriveBackups(keepCount: number = 5): Promise<number> {
  try {
    const files = await listDriveBackups();
    if (files.length <= keepCount) return 0;

    const toDelete = files.slice(keepCount);
    let deletedCount = 0;
    for (const f of toDelete) {
      const ok = await deleteDriveFile(f.id);
      if (ok) deletedCount++;
    }
    return deletedCount;
  } catch (e) {
    console.warn('cleanOldDriveBackups error:', e);
    return 0;
  }
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

/**
 * Status lock auto sync
 */
let isAutoSyncing = false;

/**
 * Unduh dan lebur (merge) data dari cloud Drive tanpa menghapus data lokal
 */
export async function mergeFromDriveFile(
  db: SQLiteDatabase,
  fileId: string
): Promise<{ success: boolean; insertedCount: number; message: string }> {
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
  return await mergeBackupData(db, jsonText);
}

/**
 * Auto-Pull & Merge: Periksa apakah ada data baru di cloud dari HP lain
 * Dijalankan saat aplikasi dibuka / resume
 */
export async function autoPullAndMergeIfNeeded(db: SQLiteDatabase): Promise<boolean> {
  if (isAutoSyncing) return false;
  try {
    const autoSyncSetting = await getSetting(db, 'auto_gdrive_sync');
    if (autoSyncSetting !== '1' && autoSyncSetting !== 'true') {
      return false;
    }

    const user = await getCurrentGoogleUser();
    if (!user) return false;

    const files = await listDriveBackups();
    if (!files || files.length === 0) return false;

    const latestRemote = files[0];
    const latestRemoteTime = new Date(latestRemote.createdTime).getTime();

    const lastMergedTimeStr = await getSetting(db, 'last_merged_remote_time');
    const lastLocalBackupStr = await getSetting(db, 'last_gdrive_backup');

    const lastLocalTime = lastLocalBackupStr ? new Date(lastLocalBackupStr).getTime() : 0;
    const lastMergedTime = lastMergedTimeStr ? new Date(lastMergedTimeStr).getTime() : 0;

    // Jika file remote lebih baru daripada yang pernah di-merge atau di-upload lokal
    if (latestRemoteTime > lastMergedTime && latestRemoteTime > lastLocalTime + 5000) {
      isAutoSyncing = true;
      const res = await mergeFromDriveFile(db, latestRemote.id);
      await setSetting(db, 'last_merged_remote_time', latestRemote.createdTime);

      // Jika ada data baru yang masuk dari HP lain, re-upload versi gabungan agar sinkron sempurna
      if (res.insertedCount > 0) {
        const { jsonContent, filename } = await generateBackupJson(db);
        await uploadBackupToDrive(jsonContent, filename);
        await setSetting(db, 'last_gdrive_backup', new Date().toISOString());
      }
      return true;
    }

    return false;
  } catch (err) {
    console.warn('autoPullAndMergeIfNeeded warning:', err);
    return false;
  } finally {
    isAutoSyncing = false;
  }
}

/**
 * Lakukan Auto-Sync Google Drive di latar belakang jika toggle aktif dan user login
 */
export async function autoSyncToDriveIfNeeded(db: SQLiteDatabase): Promise<boolean> {
  if (isAutoSyncing) return false;
  try {
    isAutoSyncing = true;
    const autoSyncSetting = await getSetting(db, 'auto_gdrive_sync');
    if (autoSyncSetting !== '1' && autoSyncSetting !== 'true') {
      return false;
    }

    const user = await getCurrentGoogleUser();
    if (!user) {
      return false;
    }

    // Hindari upload ganda bertubi-tubi dalam waktu singkat (minimal jeda 1 menit)
    const lastSyncTimeStr = await getSetting(db, 'last_gdrive_backup');
    const now = Date.now();
    if (lastSyncTimeStr) {
      const lastSyncTime = new Date(lastSyncTimeStr).getTime();
      if (!isNaN(lastSyncTime) && now - lastSyncTime < 60 * 1000) {
        return false;
      }
    }

    const { jsonContent, filename } = await generateBackupJson(db);
    await uploadBackupToDrive(jsonContent, filename);
    const nowIso = new Date().toISOString();
    await setSetting(db, 'last_gdrive_backup', nowIso);
    return true;
  } catch (err) {
    console.warn('autoSyncToDriveIfNeeded warning:', err);
    return false;
  } finally {
    isAutoSyncing = false;
  }
}

