/**
 * Administrator console screen.
 *
 * Shown instead of the regular user app when an admin logs in. Provides:
 * - aggregate usage statistics (no individual user transaction detail)
 * - management of predefined (global) categories
 * - support request handling
 * - a recent system-activity feed (financial detail withheld for privacy)
 *
 * This mirrors the backend's privacy guarantee: admins see aggregates and
 * metadata only, never a user's personal transaction values.
 */
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { AdminApi } from '../../api/services';
import { Button, Card, Field, ErrorBanner, Loading, Badge } from '../../components/UI';
import { colors, spacing, font, radius } from '../../theme';

export default function AdminDashboardScreen() {
  const { logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [support, setSupport] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New predefined category form.
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState('expense');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // User management.
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'user' });
  const [userErrors, setUserErrors] = useState({});
  const [userFormError, setUserFormError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  /** Update a single new-user field by key. */
  const setUserField = (key) => (value) =>
    setNewUser((u) => ({ ...u, [key]: value }));

  const load = useCallback(async () => {
    setError('');
    try {
      const [s, c, sup, act, usr] = await Promise.all([
        AdminApi.stats(),
        AdminApi.categories(),
        AdminApi.support(),
        AdminApi.activity(20),
        AdminApi.users(),
      ]);
      setStats(s);
      setCategories(c.categories);
      setSupport(sup.requests);
      setActivity(act.activity);
      setUsers(usr.users);
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

  const onAddCategory = async () => {
    setFormError('');
    if (catName.trim().length < 1) {
      setFormError('Enter a category name');
      return;
    }
    setSaving(true);
    try {
      await AdminApi.createCategory({ name: catName.trim(), type: catType, icon: 'tag' });
      setCatName('');
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const resolveTicket = async (id) => {
    try {
      await AdminApi.resolveSupport(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  /** Validate and submit the new-user form (mirrors server rules). */
  const onAddUser = async () => {
    setUserFormError('');
    setUserSuccess('');
    const errs = {};
    if (newUser.name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUser.email.trim()))
      errs.email = 'Enter a valid email';
    if (newUser.password.length < 8) errs.password = 'Password must be at least 8 characters';
    setUserErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setCreatingUser(true);
    try {
      const data = await AdminApi.createUser({
        name: newUser.name.trim(),
        email: newUser.email.trim(),
        password: newUser.password,
        role: newUser.role,
      });
      setUserSuccess(`Created ${data.user.role}: ${data.user.email}`);
      // Reset the form, keeping the role selection for convenience.
      setNewUser((u) => ({ name: '', email: '', password: '', role: u.role }));
      await load();
    } catch (err) {
      // Surface per-field server errors when present.
      if (err.details && typeof err.details === 'object') {
        setUserErrors((prev) => ({ ...prev, ...err.details }));
      }
      setUserFormError(err.message);
    } finally {
      setCreatingUser(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <ErrorBanner message={error} onRetry={load} />

      {/* Usage statistics */}
      <Card>
        <Text style={styles.sectionTitle}>Usage statistics</Text>
        <View style={styles.statGrid}>
          <Stat label="Users" value={stats?.users.total} />
          <Stat label="Admins" value={stats?.users.admins} />
          <Stat label="New (7d)" value={stats?.users.signupsLast7Days} />
          <Stat label="Transactions" value={stats?.activity.totalTransactions} />
          <Stat label="Budgets" value={stats?.activity.totalBudgets} />
          <Stat label="Open tickets" value={stats?.support.open} />
        </View>
        <Text style={styles.privacyNote}>{stats?.note}</Text>
      </Card>

      {/* User management */}
      <Card>
        <Text style={styles.sectionTitle}>Add user</Text>
        <ErrorBanner message={userFormError} />
        {userSuccess ? <Text style={styles.successMsg}>{userSuccess}</Text> : null}
        <Field
          label="Full name"
          value={newUser.name}
          onChangeText={setUserField('name')}
          error={userErrors.name}
          placeholder="e.g. Meera Iyer"
        />
        <Field
          label="Email"
          value={newUser.email}
          onChangeText={setUserField('email')}
          error={userErrors.email}
          placeholder="user@example.in"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field
          label="Temporary password"
          value={newUser.password}
          onChangeText={setUserField('password')}
          error={userErrors.password}
          placeholder="At least 8 characters"
          secureTextEntry
        />
        <Text style={styles.label}>Role</Text>
        <View style={styles.typeToggle}>
          <Pressable
            style={[styles.typeBtn, newUser.role === 'user' && styles.typeActive]}
            onPress={() => setUserField('role')('user')}
          >
            <Text style={[styles.typeText, newUser.role === 'user' && styles.typeTextActive]}>User</Text>
          </Pressable>
          <Pressable
            style={[styles.typeBtn, newUser.role === 'admin' && styles.typeActive]}
            onPress={() => setUserField('role')('admin')}
          >
            <Text style={[styles.typeText, newUser.role === 'admin' && styles.typeTextActive]}>Admin</Text>
          </Pressable>
        </View>
        <Button title="Create account" onPress={onAddUser} loading={creatingUser} />

        <Text style={[styles.sectionTitle, styles.listHeading]}>Accounts ({users.length})</Text>
        {users.map((u) => (
          <View key={u.id} style={styles.userRow}>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{u.name}</Text>
              <Text style={styles.userEmail}>{u.email}</Text>
            </View>
            <Badge label={u.role} color={u.role === 'admin' ? colors.primary : colors.textMuted} />
          </View>
        ))}
        <Text style={styles.privacyNote}>
          Account details only. Admins cannot view any user&apos;s transactions.
        </Text>
      </Card>

      {/* Predefined category management */}
      <Card>
        <Text style={styles.sectionTitle}>Predefined categories</Text>
        <ErrorBanner message={formError} />
        <Field label="New category name" value={catName} onChangeText={setCatName} placeholder="e.g. Insurance" />
        <View style={styles.typeToggle}>
          <Pressable style={[styles.typeBtn, catType === 'expense' && styles.typeActive]} onPress={() => setCatType('expense')}>
            <Text style={[styles.typeText, catType === 'expense' && styles.typeTextActive]}>Expense</Text>
          </Pressable>
          <Pressable style={[styles.typeBtn, catType === 'income' && styles.typeActive]} onPress={() => setCatType('income')}>
            <Text style={[styles.typeText, catType === 'income' && styles.typeTextActive]}>Income</Text>
          </Pressable>
        </View>
        <Button title="Add predefined category" onPress={onAddCategory} loading={saving} />
        <View style={styles.chipWrap}>
          {categories.map((c) => (
            <View key={c.id} style={styles.chip}>
              <Text style={styles.chipText}>{c.name}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Support requests */}
      <Card>
        <Text style={styles.sectionTitle}>Support requests</Text>
        {support.length === 0 ? (
          <Text style={styles.muted}>No support requests.</Text>
        ) : (
          support.map((t) => (
            <View key={t.id} style={styles.ticket}>
              <View style={styles.ticketHead}>
                <Text style={styles.ticketSubject}>{t.subject}</Text>
                <Badge
                  label={t.status}
                  color={t.status === 'open' ? colors.warning : colors.success}
                />
              </View>
              <Text style={styles.ticketMsg}>{t.message}</Text>
              <Text style={styles.ticketMeta}>From: {t.userName} ({t.userEmail})</Text>
              {t.status === 'open' ? (
                <Pressable onPress={() => resolveTicket(t.id)}>
                  <Text style={styles.resolve}>Mark resolved</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        )}
      </Card>

      {/* System activity (privacy-preserving) */}
      <Card>
        <Text style={styles.sectionTitle}>Recent activity</Text>
        {activity.length === 0 ? (
          <Text style={styles.muted}>No recent activity.</Text>
        ) : (
          activity.map((a) => (
            <View key={a.id} style={styles.activityRow}>
              <Text style={styles.activityText}>
                <Text style={styles.activityOp}>{a.operation}</Text> {a.entityType} #{a.entityId}
              </Text>
              <Text style={styles.activityMeta}>
                {a.changedBy} · {a.changedAt}
              </Text>
            </View>
          ))
        )}
      </Card>

      <Button title="Log Out" variant="danger" onPress={logout} />
    </ScrollView>
  );
}

/**
 * A single stat tile.
 * @param {object} props
 * @param {string} props.label - Stat label.
 * @param {number} props.value - Stat value.
 */
function Stat({ label, value }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value ?? 0}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg },
  sectionTitle: { fontSize: font.h3, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statCell: { width: '33.33%', alignItems: 'center', paddingVertical: spacing.sm },
  statValue: { fontSize: font.h2, fontWeight: '800', color: colors.primary },
  statLabel: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },
  privacyNote: { fontSize: font.tiny, color: colors.textMuted, marginTop: spacing.sm, fontStyle: 'italic' },
  successMsg: { color: colors.success, fontSize: font.small, marginBottom: spacing.sm, fontWeight: '600' },
  label: { fontSize: font.small, color: colors.textMuted, marginBottom: spacing.sm },
  listHeading: { marginTop: spacing.lg },
  userRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  userInfo: { flex: 1, marginRight: spacing.sm },
  userName: { fontSize: font.body, fontWeight: '600', color: colors.text },
  userEmail: { fontSize: font.small, color: colors.textMuted },
  typeToggle: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  typeBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  typeActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeText: { color: colors.textMuted, fontWeight: '600' },
  typeTextActive: { color: '#fff' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  chip: { backgroundColor: colors.chip, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chipText: { color: colors.primary, fontSize: font.small, fontWeight: '600' },
  muted: { color: colors.textMuted, fontSize: font.small },
  ticket: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  ticketHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ticketSubject: { fontSize: font.body, fontWeight: '700', color: colors.text, flex: 1 },
  ticketMsg: { fontSize: font.small, color: colors.text, marginTop: spacing.xs },
  ticketMeta: { fontSize: font.tiny, color: colors.textMuted, marginTop: spacing.xs },
  resolve: { color: colors.primary, fontWeight: '700', fontSize: font.small, marginTop: spacing.sm },
  activityRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  activityText: { fontSize: font.small, color: colors.text },
  activityOp: { fontWeight: '800', color: colors.primary },
  activityMeta: { fontSize: font.tiny, color: colors.textMuted, marginTop: 2 },
});
