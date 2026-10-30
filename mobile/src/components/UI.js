/**
 * Shared presentational UI components.
 *
 * Small, reusable building blocks (buttons, inputs, cards, badges, loading and
 * empty states) used across every screen so the app has a consistent look and
 * the screens stay focused on behavior rather than styling.
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius, spacing, font } from '../theme';

/**
 * Primary action button with loading and disabled states.
 *
 * @param {object} props
 * @param {string} props.title - Button label.
 * @param {() => void} props.onPress - Press handler (ignored while loading).
 * @param {boolean} [props.loading=false] - Shows a spinner and disables press.
 * @param {boolean} [props.disabled=false] - Disables the button.
 * @param {'primary'|'secondary'|'danger'} [props.variant='primary'] - Style.
 */
export function Button({ title, onPress, loading = false, disabled = false, variant = 'primary' }) {
  const isDisabled = disabled || loading;
  const variantStyle =
    variant === 'secondary'
      ? styles.btnSecondary
      : variant === 'danger'
      ? styles.btnDanger
      : styles.btnPrimary;
  const textStyle = variant === 'secondary' ? styles.btnTextSecondary : styles.btnText;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.btn,
        variantStyle,
        isDisabled && styles.btnDisabled,
        pressed && !isDisabled && styles.btnPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.primary : '#fff'} />
      ) : (
        <Text style={textStyle}>{title}</Text>
      )}
    </Pressable>
  );
}

/**
 * Labeled text input with optional error message.
 *
 * @param {object} props
 * @param {string} props.label - Field label.
 * @param {string} props.value - Controlled value.
 * @param {(text: string) => void} props.onChangeText - Change handler.
 * @param {string} [props.error] - Validation error shown under the field.
 */
export function Field({ label, value, onChangeText, error, ...rest }) {
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, error && styles.inputError]}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
        {...rest}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

/** A rounded surface card used to group content. */
export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/**
 * Small colored badge/chip for statuses and category types.
 * @param {object} props
 * @param {string} props.label - Text to display.
 * @param {string} [props.color] - Text/border color.
 */
export function Badge({ label, color = colors.primary }) {
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

/** Centered loading spinner for whole-screen loading states. */
export function Loading({ label = 'Loading...' }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.mutedText}>{label}</Text>
    </View>
  );
}

/**
 * Friendly empty-state placeholder.
 * @param {object} props
 * @param {string} props.title - Headline.
 * @param {string} [props.message] - Supporting text.
 * @param {string} [props.emoji='📭'] - Decorative glyph.
 */
export function EmptyState({ title, message, emoji = '📭' }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.mutedText}>{message}</Text> : null}
    </View>
  );
}

/** Inline error banner for recoverable request errors. */
export function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorBannerText}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button">
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.primary },
  btnDanger: { backgroundColor: colors.danger },
  btnDisabled: { opacity: 0.5 },
  btnPressed: { opacity: 0.85 },
  btnText: { color: '#fff', fontSize: font.body, fontWeight: '600' },
  btnTextSecondary: { color: colors.primary, fontSize: font.body, fontWeight: '600' },

  fieldWrap: { marginBottom: spacing.md },
  label: { fontSize: font.small, color: colors.textMuted, marginBottom: spacing.xs },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: font.body,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: font.small, marginTop: spacing.xs },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  badge: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: font.tiny, fontWeight: '700', textTransform: 'uppercase' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  mutedText: { color: colors.textMuted, fontSize: font.body, marginTop: spacing.sm, textAlign: 'center' },
  emptyEmoji: { fontSize: 44, marginBottom: spacing.sm },
  emptyTitle: { fontSize: font.h3, fontWeight: '700', color: colors.text, textAlign: 'center' },

  errorBanner: {
    backgroundColor: '#fef2f2',
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorBannerText: { color: colors.danger, flex: 1, fontSize: font.small },
  retryText: { color: colors.primary, fontWeight: '700', marginLeft: spacing.sm },
});
