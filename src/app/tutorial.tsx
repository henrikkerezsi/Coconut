import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Appbar, Button, Icon, Text } from 'react-native-paper';

import { tutorialPages } from '../config/tutorial';
import { useAppTheme } from '../theme';
import { FadeIn } from '../components/fade-in';
import { setTutorialSeen } from '../database/tutorialPrefs';

export default function TutorialScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    void setTutorialSeen();
  }, []);

  const page = tutorialPages[index];
  const isLast = index === tutorialPages.length - 1;

  const close = () => {
    if (router.canGoBack()) {
      router.back();
    }
  };

  const next = () => {
    if (isLast) {
      close();
    } else {
      setIndex((current) => current + 1);
    }
  };

  return (
    <View style={styles.screen}>
      <Appbar.Header style={styles.header}>
        <Appbar.Action icon="close" onPress={close} />
        <Appbar.Content title="Coconut Tour" />
      </Appbar.Header>

      <View style={styles.content}>
        <FadeIn key={index} style={styles.page}>
          <View style={[styles.iconCircle, { backgroundColor: theme.colors.primaryContainer }]}>
            <Icon source={page.icon} size={46} color={theme.colors.onPrimaryContainer} />
          </View>
          <Text variant="headlineSmall" style={styles.title}>
            {page.title}
          </Text>
          <Text variant="bodyLarge" style={styles.body}>
            {page.body}
          </Text>
        </FadeIn>

        <View style={styles.dots}>
          {tutorialPages.map((_, dotIndex) => (
            <View
              key={dotIndex}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    dotIndex === index ? theme.colors.primary : theme.colors.outlineVariant,
                },
              ]}
            />
          ))}
        </View>

        <View style={styles.navRow}>
          <Button
            mode="text"
            disabled={index === 0}
            onPress={() => setIndex((current) => Math.max(0, current - 1))}
          >
            Back
          </Button>
          <Button mode="contained" onPress={next}>
            {isLast ? 'Get started' : 'Next'}
          </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  title: {
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    textAlign: 'center',
    opacity: 0.75,
    lineHeight: 24,
    maxWidth: 420,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});