import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import type { Attachment } from '../models';
import { attachmentExtension, mimeToExtension } from './attachment';

const isBrowser = typeof document !== 'undefined';

function pickDomFile(capture: boolean): Promise<Attachment | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (capture) {
      input.capture = 'environment';
      input.accept = 'image/*';
    }
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      void file.arrayBuffer().then((buffer) => {
        resolve({
          name: file.name,
          mime: file.type || 'application/octet-stream',
          bytes: new Uint8Array(buffer),
        });
      });
    };
    input.click();
  });
}

export async function pickAttachmentFile(): Promise<Attachment | null> {
  if (isBrowser) {
    return pickDomFile(false);
  }
  const result = await File.pickFileAsync();
  if (result.canceled || !result.result) {
    return null;
  }
  const file = result.result;
  const bytes = await file.bytes();
  return {
    name: file.name,
    mime: file.type ?? 'application/octet-stream',
    bytes,
  };
}

export async function captureAttachmentPhoto(): Promise<Attachment | null> {
  if (isBrowser) {
    return pickDomFile(true);
  }
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
  });
  const asset = result.assets?.[0];
  if (result.canceled || !asset) {
    return null;
  }
  const bytes = await new File(asset.uri).bytes();
  const mime = asset.mimeType ?? 'image/jpeg';
  const extension = asset.fileName
    ? attachmentExtension(asset.fileName)
    : mimeToExtension(mime);
  const name = asset.fileName ?? `receipt-${Date.now()}${extension}`;
  return { name, mime, bytes };
}