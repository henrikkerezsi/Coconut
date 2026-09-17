import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Attachment } from '../models';
import { attachmentExtension, bytesToBase64, mimeToExtension } from './attachment';

const isBrowser = typeof document !== 'undefined';

function stageAttachment(attachment: Attachment): File {
  const extension = attachmentExtension(attachment.name) || mimeToExtension(attachment.mime);
  const file = new File(Paths.cache, `coconut-attachment-${Date.now()}${extension}`);
  file.create({ intermediates: true, overwrite: true });
  file.write(attachment.bytes);
  return file;
}

export async function attachmentPreviewUri(attachment: Attachment): Promise<string> {
  if (isBrowser) {
    return `data:${attachment.mime};base64,${bytesToBase64(attachment.bytes)}`;
  }
  return stageAttachment(attachment).uri;
}

export async function openAttachment(attachment: Attachment): Promise<void> {
  if (isBrowser) {
    window.open(await attachmentPreviewUri(attachment), '_blank');
    return;
  }
  const file = stageAttachment(attachment);
  await Sharing.shareAsync(file.uri, { mimeType: attachment.mime, dialogTitle: attachment.name });
}