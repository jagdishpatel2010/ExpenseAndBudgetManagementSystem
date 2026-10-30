/**
 * Profile screen.
 *
 * Lets the user view and edit their display name and preferred currency, jump
 * to the change-password screen, open category/budget/report management, and
 * log out. Editing name/currency calls the profile API and updates the cached
 * user in AuthContext so the change is reflected app-wide.
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { ProfileApi } from '../../api/services';
import { Button, Field, Card, ErrorBanner, Loading } from '../../components/UI';
import { colors, spacing, font } from '../../theme';

export default function ProfileScreen({ navigation }) {
  const { user, logout, updateUser } = useAuth();
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    // Load the authoritative profile from the server on mount.
    (async () => {
      try {
        const data = await ProfileApi.get();
        setName(data.user.name);
        setCurrency(data.user.currency || 'INR');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onSave = async () => {
    setError('');
    setSavedMsg('');
    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    setSaving(true);
    try {
      const data = await ProfileApi.update({ name: name.trim(), currency: currency.trim() });
      updateUser({ name: data.user.name });
      setSavedMsg('Profile updated');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Card>
        <View style={styles.avatarRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.name || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.identity}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Edit profile</Text>
        <ErrorBanner message={error} />
        {savedMsg ? <Text style={styles.savedMsg}>{savedMsg}</Text> : null}
        <Field label="Display name" value={name} onChangeText={setName} />
        <Field label="Preferred currency" value={currency} onChangeText={setCurrency} autoCapitalize="characters" maxLength={8} />
        <Button title="Save changes" onPress={onSave} loading={saving} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Manage</Text>
        <View style={styles.linkGroup}>
          <Button title="Manage Categories" variant="secondary" onPress={() => navigation.navigate('Categories')} />
          <View style={styles.gap} />
          <Button title="Monthly Budgets" variant="secondary" onPress={() => navigation.navigate('Budgets')} />
          <View style={styles.gap} />
          <Button title="Monthly Report" variant="secondary" onPress={() => navigation.navigate('Report')} />
          <View style={styles.gap} />
          <Button title="Change Password" variant="secondary" onPress={() => navigation.navigate('ChangePassword')} />
        </View>
      </Card>

      <Button title="Log Out" variant="danger" onPress={logout} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg },
  avatarRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.md,
  },
  avatarText: { color: '#fff', fontSize: font.h2, fontWeight: '800' },
  identity: { flex: 1 },
  name: { fontSize: font.h3, fontWeight: '700', color: colors.text },
  email: { fontSize: font.small, color: colors.textMuted },
  sectionTitle: { fontSize: font.h3, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  linkGroup: {},
  gap: { height: spacing.sm },
  savedMsg: { color: colors.success, marginBottom: spacing.sm, fontSize: font.small },
});
