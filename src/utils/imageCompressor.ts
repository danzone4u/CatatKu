import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * Kompresi foto struk agar hemat penyimpanan dan cepat disinkronkan.
 * Menyesuaikan lebar maksimal 1024px dan kompresi JPEG 0.6 (~100-250 KB).
 */
export async function compressReceiptImage(uri: string): Promise<string> {
  try {
    const manipulated = await manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.6, format: SaveFormat.JPEG }
    );
    return manipulated.uri;
  } catch (err) {
    console.warn('Kompresi gambar gagal, menggunakan berkas asli:', err);
    return uri;
  }
}
