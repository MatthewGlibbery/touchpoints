import { supabase } from './supabase';

const BUCKET = 'action-media';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export type UploadResult = { url: string } | { error: string };

/**
 * Upload an image/gif/video file to Supabase Storage and return its public URL.
 * Path: `{userId}/{blueprintId}/{actionId}/{timestamp}-{filename}`
 */
export async function uploadActionMedia(
  file: File,
  blueprintId: string,
  actionId: string,
): Promise<UploadResult> {
  if (file.size > MAX_FILE_SIZE) {
    return { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 10 MB.` };
  }

  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
    return { error: 'Only image and video files are supported.' };
  }

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) {
    return { error: 'You must be signed in to upload files.' };
  }

  // Sanitize filename: keep extension, replace spaces/special chars
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${userId}/${blueprintId}/${actionId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error('[upload] storage error:', uploadError);
    return { error: uploadError.message || 'Upload failed.' };
  }

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(path);

  return { url: publicUrl };
}

/**
 * Infer ActionMedia type from a File's MIME type.
 */
export function mediaTypeFromFile(file: File): 'image' | 'gif' | 'video' {
  if (file.type === 'image/gif') return 'gif';
  if (file.type.startsWith('video/')) return 'video';
  return 'image';
}
