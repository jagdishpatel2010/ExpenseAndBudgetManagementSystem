/**
 * Category management screen.
 *
 * Lists predefined (global) and the user's own custom categories, and lets the
 * user add a new custom category or delete one they own. Predefined categories
 * are shown as read-only (managed by admins) and cannot be deleted here.
 */
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CategoryApi } from '../../api/services';
import { Button, Card, Field, Badge, ErrorBanner, Loading } from '../../components/UI';
import { colors, spacing, font, radius } from '../../theme';

export default function CategoryScreen() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New-category form state.
  const [name, setName] = useState('');
  const [type, setType] = useState('expense');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await CategoryApi.list();
      setCategories(data.categories);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onAdd = async () => {
    setFormError('');
    if (name.trim().length < 1) {
      setFormError('Enter a category name');
      return;
    }
    setSaving(true);
    try {
      await CategoryApi.create({ name: name.trim(), type, icon: 'tag' });
      setName('');
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (cat) => {
    Alert.alert('Delete category', `Delete "${cat.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await CategoryApi.remove(cat.id);
            await load();
          } catch (err) {
            setError(err.message);
          }
        },
      },
    ]);
  };

  if (loading) return <Loading />;

  const predefined = categories.filter((c) => c.isPredefined);
  const custom = categories.filter((c) => !c.isPredefined);

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <ErrorBanner message={error} onRetry={load} />

      <Card>
        <Text style={styles.sectionTitle}>Add custom category</Text>
        <ErrorBanner message={formError} />
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Gym, Pets" />
        <View style={styles.typeToggle}>
          <Pressable style={[styles.typeBtn, type === 'expense' && styles.typeActive]} onPress={() => setType('expense')}>
            <Text style={[styles.typeText, type === 'expense' && styles.typeTextActive]}>Expense</Text>
          </Pressable>
          <Pressable style={[styles.typeBtn, type === 'income' && styles.typeActive]} onPress={() => setType('income')}>
            <Text style={[styles.typeText, type === 'income' && styles.typeTextActive]}>Income</Text>
          </Pressable>
        </View>
        <Button title="Add Category" onPress={onAdd} loading={saving} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Your categories</Text>
        {custom.length === 0 ? (
          <Text style={styles.muted}>No custom categories yet.</Text>
        ) : (
          custom.map((c) => (
            <View key={c.id} style={styles.catRow}>
              <View style={styles.catInfo}>
                <Text style={styles.catName}>{c.name}</Text>
                <Badge label={c.type} color={c.type === 'income' ? colors.income : colors.expense} />
              </View>
              <Pressable onPress={() => onDelete(c)} accessibilityRole="button">
                <Text style={styles.delete}>Delete</Text>
              </Pressable>
            </View>
          ))
        )}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Predefined categories</Text>
        <Text style={styles.muted}>Managed by the administrator and shared by everyone.</Text>
        <View style={styles.chipWrap}>
          {predefined.map((c) => (
            <View key={c.id} style={styles.readonlyChip}>
              <Text style={styles.readonlyChipText}>{c.name}</Text>
            </View>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg },
  sectionTitle: { fontSize: font.h3, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  muted: { color: colors.textMuted, fontSize: font.small, marginBottom: spacing.sm },
  typeToggle: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  typeBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  typeActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeText: { color: colors.textMuted, fontWeight: '600' },
  typeTextActive: { color: '#fff' },
  catRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  catInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  catName: { fontSize: font.body, color: colors.text, fontWeight: '600' },
  delete: { color: colors.danger, fontWeight: '700', fontSize: font.small },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  readonlyChip: { backgroundColor: colors.chip, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  readonlyChipText: { color: colors.primary, fontSize: font.small, fontWeight: '600' },
});
