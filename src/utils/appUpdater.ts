import Constants from 'expo-constants';
import * as Linking from 'expo-linking';

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  downloadUrl?: string;
  releaseNotes?: string;
  publishedAt?: string;
  error?: string;
}

const GITHUB_REPO_OWNER = 'danzone4u';
const GITHUB_REPO_NAME = 'CatatKu';
const LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`;
const RELEASES_PAGE_URL = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases`;

/**
 * Normalisasi versi string (contoh: "v1.0.1" -> [1, 0, 1])
 */
function parseVersion(versionStr: string): number[] {
  return versionStr
    .replace(/^v/i, '')
    .trim()
    .split('.')
    .map((num) => parseInt(num, 10) || 0);
}

/**
 * Bandingkan apakah latest > current
 */
export function isNewerVersion(current: string, latest: string): boolean {
  const currentParts = parseVersion(current);
  const latestParts = parseVersion(latest);
  const maxLen = Math.max(currentParts.length, latestParts.length);

  for (let i = 0; i < maxLen; i++) {
    const cur = currentParts[i] || 0;
    const lat = latestParts[i] || 0;
    if (lat > cur) return true;
    if (lat < cur) return false;
  }
  return false;
}

/**
 * Periksa pembaruan aplikasi ke GitHub Releases
 */
export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = Constants.expoConfig?.version || '1.0.0';

  try {
    const response = await fetch(LATEST_RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'CatatKu-App',
      },
    });

    if (response.status === 404) {
      // Belum ada rilis yang dipublikasikan di repo
      return {
        hasUpdate: false,
        currentVersion,
        latestVersion: currentVersion,
        releaseNotes: 'Belum ada rilis versi baru di GitHub.',
      };
    }

    if (!response.ok) {
      throw new Error(`Gagal menghubungi server rilis (${response.status})`);
    }

    const data = await response.json();
    const latestTag: string = data.tag_name || data.name || '';
    const cleanLatestVersion = latestTag.replace(/^v/i, '').trim();

    // Cari aset file berekstensi .apk
    let apkDownloadUrl = '';
    if (Array.isArray(data.assets) && data.assets.length > 0) {
      const apkAsset = data.assets.find((asset: any) =>
        asset.name?.toLowerCase().endsWith('.apk')
      );
      if (apkAsset && apkAsset.browser_download_url) {
        apkDownloadUrl = apkAsset.browser_download_url;
      }
    }

    // Jika tidak ada aset APK langsung, arahkan ke halaman release
    if (!apkDownloadUrl) {
      apkDownloadUrl = data.html_url || RELEASES_PAGE_URL;
    }

    const hasUpdate = isNewerVersion(currentVersion, cleanLatestVersion);

    return {
      hasUpdate,
      currentVersion,
      latestVersion: cleanLatestVersion || currentVersion,
      downloadUrl: apkDownloadUrl,
      releaseNotes: data.body?.trim() || 'Pembaruan stabilitas dan peningkatan performa.',
      publishedAt: data.published_at,
    };
  } catch (error: any) {
    return {
      hasUpdate: false,
      currentVersion,
      latestVersion: currentVersion,
      error: error?.message || 'Gagal memeriksa pembaruan. Periksa koneksi internet Anda.',
    };
  }
}

/**
 * Buka link unduh APK / rilis di browser
 */
export async function openDownloadPage(url?: string): Promise<void> {
  const targetUrl = url || RELEASES_PAGE_URL;
  const canOpen = await Linking.canOpenURL(targetUrl);
  if (canOpen) {
    await Linking.openURL(targetUrl);
  }
}
