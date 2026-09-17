import React from 'react';
import { ScrollView, StyleSheet, View, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Appbar, List, Text } from 'react-native-paper';
import dayjs from 'dayjs';
import { CoconutLogo } from '../components/coconut-logo';
import { useAppTheme } from '../theme';
import { releaseInfo } from '../config/release-info';
import { GITHUB_REPO_URL } from '../config/repository';

export default function AboutScreen() {
  const router = useRouter();
  const theme = useAppTheme();

  const builtVersion =
    releaseInfo.releasedAt === ''
      ? releaseInfo.version
      : `${releaseInfo.version} (build ${releaseInfo.versionCode})`;
  const releasedLabel =
    releaseInfo.releasedAt === ''
      ? 'Not yet released'
      : dayjs(releaseInfo.releasedAt).format('D MMM YYYY, HH:mm');

  const openGitHub = async () => {
    try {
      await Linking.openURL(GITHUB_REPO_URL);
    } catch {
      Alert.alert('Could not open the link');
    }
  };

  return (
    <>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="About" />
      </Appbar.Header>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.logo}>
          <CoconutLogo size={64} />
        </View>
        <Text variant="titleLarge" style={styles.name}>
          Coconut
        </Text>
        <Text variant="bodyMedium" style={styles.tagline}>
          Budget management
        </Text>

        <List.Section>
          <List.Item
            title="Developer"
            description="Henrik Kerezsi"
            left={(props) => <List.Icon {...props} icon="account-outline" />}
          />
          <List.Item
            title="Version"
            description={builtVersion}
            left={(props) => <List.Icon {...props} icon="tag-outline" />}
          />
          <List.Item
            title="Released"
            description={releasedLabel}
            left={(props) => <List.Icon {...props} icon="clock-outline" />}
          />
          <List.Item
            title="GitHub"
            description={GITHUB_REPO_URL}
            left={(props) => (
              <List.Icon {...props} icon="github" color={theme.colors.primary} />
            )}
            onPress={openGitHub}
          />
        </List.Section>

        <Text variant="bodySmall" style={styles.about}>
          Coconut is a private, offline-first budget app. Each month it compares your
          allowance against planned fixed expenses and flexible budgets, and it tracks a
          savings reserve. Everything stays on this device only — no network, no account,
          no tracking.
        </Text>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 24,
    paddingBottom: 32,
  },
  logo: {
    alignItems: 'center',
  },
  name: {
    textAlign: 'center',
    marginTop: 12,
  },
  tagline: {
    textAlign: 'center',
    opacity: 0.6,
    marginBottom: 12,
  },
  about: {
    textAlign: 'center',
    opacity: 0.6,
    marginTop: 24,
    paddingHorizontal: 32,
  },
});