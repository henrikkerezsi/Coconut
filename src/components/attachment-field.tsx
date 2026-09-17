import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Button, Card, IconButton, List, Text } from 'react-native-paper';
import type { Attachment } from '../models';
import { formatBytes, isImageMime } from '../utils/attachment';
import { attachmentPreviewUri, openAttachment } from '../utils/attachment-display';
import { captureAttachmentPhoto, pickAttachmentFile } from '../utils/attachment-source';
import { useAppTheme } from '../theme';

interface AttachmentFieldProps {
  value: Attachment | null;
  onChange: (attachment: Attachment | null) => void;
}

export function AttachmentField({ value, onChange }: AttachmentFieldProps) {
  const theme = useAppTheme();
  const [busy, setBusy] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const uri = value && isImageMime(value.mime) ? await attachmentPreviewUri(value) : null;
      if (active) {
        setPreviewUri(uri);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [value]);

  const capture = async () => {
    setBusy(true);
    try {
      const result = await captureAttachmentPhoto();
      if (result) {
        onChange(result);
      }
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async () => {
    setBusy(true);
    try {
      const result = await pickAttachmentFile();
      if (result) {
        onChange(result);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card mode="outlined" style={styles.card}>
      {value ? (
        <List.Item
          title={value.name}
          titleNumberOfLines={1}
          description={`${value.mime} • ${formatBytes(value.bytes.length)}`}
          left={() =>
            isImageMime(value.mime) && previewUri ? (
              <View style={[styles.thumbnail, { borderRadius: theme.radii.small }]}>
                <Image source={{ uri: previewUri }} style={styles.thumbnailImage} />
              </View>
            ) : (
              <List.Icon icon={value.mime === 'application/pdf' ? 'file-pdf-box' : 'file-outline'} />
            )
          }
          right={() => (
            <View style={styles.actions}>
              <IconButton
                icon="eye-outline"
                size={18}
                onPress={() => void openAttachment(value)}
                disabled={busy}
              />
              <IconButton
                icon="trash-can-outline"
                size={18}
                onPress={() => onChange(null)}
                disabled={busy}
              />
            </View>
          )}
        />
      ) : (
        <Card.Content>
          <Text variant="labelMedium" style={[styles.label, { color: theme.colors.outline }]}>
            Receipt attachment
          </Text>
          <View style={styles.buttonRow}>
            <Button
              mode="outlined"
              icon="camera-outline"
              onPress={() => void capture()}
              loading={busy}
              disabled={busy}
              style={styles.button}
            >
              Take photo
            </Button>
            <Button
              mode="outlined"
              icon="paperclip"
              onPress={() => void pickFile()}
              loading={busy}
              disabled={busy}
              style={styles.button}
            >
              Choose file
            </Button>
          </View>
        </Card.Content>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
  },
  label: {
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
  },
  button: {
    marginRight: 8,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  thumbnail: {
    marginLeft: 8,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  thumbnailImage: {
    width: 48,
    height: 48,
    resizeMode: 'cover',
  },
});