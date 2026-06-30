// Powered by OnSpace.AI
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { rtlDirection, rtlRow } from '@/lib/rtl';
import { Country, countries } from '@/services/types';

interface CountryChipsProps {
  value: Country | 'ALL';
  onChange: (c: Country | 'ALL') => void;
}

const order: (Country | 'ALL')[] = ['ALL', 'SA', 'EG', 'AE', 'KW', 'QA', 'BH', 'OM'];

export function CountryChips({ value, onChange }: CountryChipsProps) {
  return (
    <View style={[styles.wrap, rtlDirection]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.content, rtlDirection]}
      >
        {order.map((code) => {
          const isSelected = value === code;
          const label = code === 'ALL' ? 'الكل' : countries[code as Country].ar;
          const flag = code === 'ALL' ? '🌐' : countries[code as Country].flag;
          return (
            <Pressable
              key={code}
              onPress={() => onChange(code)}
              style={({ pressed }) => [
                styles.chip,
                isSelected && styles.chipSelected,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.flag}>{flag}</Text>
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 50,
    paddingVertical: spacing.sm,
  },
  content: {
    ...rtlRow,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  chip: {
    ...rtlRow,
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bgGlass,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    height: 36,
  },
  chipSelected: {
    backgroundColor: colors.electric,
    borderColor: colors.glow,
  },
  flag: {
    fontSize: 14,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },
});

export default CountryChips;
