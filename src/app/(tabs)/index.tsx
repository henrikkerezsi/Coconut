import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

export default function OverviewScreen() {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name="wallet-outline" size={64} color="#90674c" />
      <Text style={styles.title}>Coconut</Text>
      <Text style={styles.subtitle}>Overview</Text>
      <Text style={styles.placeholder}>
        The current-month overview screen will be implemented here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 18,
    opacity: 0.7,
    marginTop: 4,
  },
  placeholder: {
    fontSize: 14,
    opacity: 0.5,
    marginTop: 24,
    textAlign: 'center',
  },
});