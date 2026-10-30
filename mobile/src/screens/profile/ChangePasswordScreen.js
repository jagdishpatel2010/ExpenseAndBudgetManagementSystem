/**
 * Change-password screen.
 *
 * Requires the current password plus a new password and confirmation. Mirrors
 * the server validation (min 8 chars). On success it shows a confirmation and
 * navigates back.
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { ProfileApi } from '../../api/services';
import { Button, Field, ErrorBanner } from '../../components/UI';
import { colors, spacing, font } from '../../theme';

export default function ChangePasswordScreen({ navigation }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e = {};
    if (!current) e.current = 'Enter your current password';
    if (next.length < 8) e.next = 'New password must be at least 8 characters';
    if (next !== confirm) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async () => {
    setError('');
    setMsg('');
    if (!validate()) return;
    setLoading(true);
    try {
      await ProfileApi.changePassword(current, next);
      setMsg('Password changed successfully');
      setCurrent('');
      setNext('');
      setConfirm('');
      setTimeout(() => navigation.goBack(), 800);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <ErrorBanner message={error} />
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}
      <Field label="Current password" value={current} onChangeText={setCurrent} error={errors.current} secureTextEntry />
      <Field label="New password" value={next} onChangeText={setNext} error={errors.next} secureTextEntry />
      <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} error={errors.confirm} secureTextEntry />
      <Button title="Update Password" onPress={onSubmit} loading={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg },
  msg: { color: colors.success, marginBottom: spacing.md, fontSize: font.small },
});
