import { useState, type ComponentRef, type ReactNode, type Ref } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextStyle,
} from "react-native";

import { fonts } from "@/theme/fonts";
import { useAppTheme } from "@/theme/useAppTheme";

/** A titled group of settings. */
export function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.section, { backgroundColor: colors.surface }]}>
      <Text
        accessibilityRole="header"
        style={[styles.sectionTitle, { color: colors.ink }]}
      >
        {title}
      </Text>
      {note ? (
        <Text style={[styles.note, { color: colors.inkSoft }]}>{note}</Text>
      ) : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

/** Small label above a control. */
export function FieldLabel({ children }: { children: ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <Text style={[styles.fieldLabel, { color: colors.inkSoft }]}>
      {children}
    </Text>
  );
}

/** Helper text under a control. */
export function Help({
  children,
  warning = false,
}: {
  children: ReactNode;
  warning?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <Text
      accessibilityRole={warning ? "alert" : undefined}
      style={[styles.note, { color: warning ? colors.accent : colors.inkSoft }]}
    >
      {children}
    </Text>
  );
}

type Option<T> = { value: T; label: string; disabled?: boolean };

/** Pick exactly one of a few options. */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
  label: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={styles.segRow}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: !!o.disabled }}
            disabled={o.disabled}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [
              styles.seg,
              {
                backgroundColor: selected ? colors.ink : "transparent",
                borderColor: selected ? colors.ink : colors.line,
                opacity: o.disabled ? 0.35 : pressed ? 0.75 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.segText,
                { color: selected ? colors.onInk : colors.ink },
              ]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A pill that can be switched on and off (used to pick several word packs). */
export function Chip({
  label,
  sub,
  selected,
  onPress,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.ink : "transparent",
          borderColor: selected ? colors.ink : colors.line,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          { color: selected ? colors.onInk : colors.ink },
        ]}
      >
        {label}
      </Text>
      {sub ? (
        <Text
          style={[
            styles.chipSub,
            { color: selected ? colors.onInk : colors.inkSoft },
          ]}
        >
          {sub}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Minus, number, plus. */
export function Stepper({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const { colors } = useAppTheme();
  const btn = (sign: "−" | "+", disabled: boolean, next: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${sign === "−" ? "Fewer" : "More"} ${label}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onChange(next)}
      style={({ pressed }) => [
        styles.stepBtn,
        {
          borderColor: colors.ink,
          opacity: disabled ? 0.3 : pressed ? 0.6 : 1,
        },
      ]}
    >
      <Text style={[styles.stepSign, { color: colors.ink }]}>{sign}</Text>
    </Pressable>
  );
  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ now: value, min, max }}
      style={styles.stepper}
    >
      {btn("−", value <= min, value - 1)}
      <Text style={[styles.stepValue, { color: colors.ink }]}>{value}</Text>
      {btn("+", value >= max, value + 1)}
    </View>
  );
}

/** A label with an on/off switch. */
export function ToggleRow({
  label,
  hint,
  value,
  onValueChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleTexts}>
        <Text style={[styles.toggleLabel, { color: colors.ink }]}>{label}</Text>
        {hint ? (
          <Text style={[styles.note, { color: colors.inkSoft }]}>{hint}</Text>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.line, true: colors.accent }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const noOutline = (Platform.OS === "web"
  ? { outlineStyle: "none" }
  : {}) as unknown as TextStyle;

/** What a ref to a TextField points at. Use it to move focus between fields. */
export type TextFieldHandle = ComponentRef<typeof TextInput>;

/** Text box that highlights when focused. */
export function TextField({
  ref,
  style,
  ...props
}: TextInputProps & { ref?: Ref<TextFieldHandle> }) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.inkSoft}
      selectionColor={colors.accent}
      autoCorrect={false}
      {...props}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      style={[
        styles.input,
        {
          color: colors.ink,
          borderColor: focused ? colors.accent : colors.line,
          backgroundColor: colors.bg,
        },
        noOutline,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  section: { borderRadius: 16, padding: 16, gap: 8 },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 18,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  sectionBody: { gap: 12 },
  fieldLabel: { fontSize: 13, fontWeight: "600" },
  note: { fontSize: 13, lineHeight: 19 },
  segRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  seg: {
    flexGrow: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  segText: { fontSize: 15, fontWeight: "600" },
  chip: {
    borderRadius: 999,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  chipLabel: { fontSize: 15, fontWeight: "600" },
  chipSub: { fontSize: 11, opacity: 0.85 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 20 },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  stepSign: { fontSize: 28, lineHeight: 30 },
  stepValue: {
    fontFamily: fonts.display,
    fontSize: 32,
    minWidth: 32,
    textAlign: "center",
  },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleTexts: { flex: 1, gap: 2 },
  toggleLabel: { fontSize: 15, fontWeight: "600" },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 14,
    fontSize: 17,
  },
});
