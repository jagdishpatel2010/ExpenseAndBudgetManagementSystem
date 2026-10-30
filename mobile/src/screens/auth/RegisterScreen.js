/**
 * Registration screen.
 *
 * Collects name, email, password and confirmation, validates them client-side
 * (mirroring the server rules: min 8-char password, valid email), then calls
 * the auth context's register(). Server-side validation errors are surfaced per
 * field when the API returns a details map.
 */
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { Button, Field, ErrorBanner } from '../../components/UI';
import { colors, spacing, font } from '../../theme';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);

  /** Update a single form field by key. */
  const setField = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const validate = () => {
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Name must be at least 2 characters';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = 'Enter a valid email';
    if (form.password.length < 8) next.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirm) next.confirm = 'Passwords do not match';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async () => {
    setSubmitError('');
    if (!validate()) return;
    setLoading(true);
    try {
      await register(form.name.trim(), form.email.trim(), form.password);
    } catch (err) {
      // Prefer field-level server errors when provided.
      if (err.details && typeof err.details === 'object') {
        setErrors((prev) => ({ ...prev, ...err.details }));
      }
      setSubmitError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ErrorBanner message={submitError} />
        <Field label="Full Name" value={form.name} onChangeText={setField('name')} error={errors.name} placeholder="Ananya Sharma" />
        <Field
          label="Email"
          value={form.email}
          onChangeText={setField('email')}
          error={errors.email}
          placeholder="you@example.in"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field label="Password" value={form.password} onChangeText={setField('password')} error={errors.password} placeholder="At least 8 characters" secureTextEntry />
        <Field label="Confirm Password" value={form.confirm} onChangeText={setField('confirm')} error={errors.confirm} placeholder="Re-enter password" secureTextEntry />
        <Button title="Create Account" onPress={onSubmit} loading={loading} />
        <Text style={styles.hint}>Your financial data is private and secured with authentication.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.xl, flexGrow: 1 },
  hint: { textAlign: 'center', color: colors.textMuted, fontSize: font.tiny, marginTop: spacing.lg },
});
