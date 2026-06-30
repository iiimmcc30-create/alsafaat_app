// Powered by OnSpace.AI
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';

export type CategoryKey =
  | 'all'
  | 'camels'
  | 'sheep'
  | 'goats'
  | 'cows'
  | 'horses'
  | 'birds'
  | 'feed'
  | 'equipment';

interface CategoryDef {
  key: CategoryKey;
  label: string;
  arabic: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}

const categories: CategoryDef[] = [
  { key: 'all', label: 'All', arabic: 'الكل', icon: 'view-grid-outline' },
  { key: 'camels', label: 'Camels', arabic: 'إبل', icon: 'horse' },
  { key: 'sheep', label: 'Sheep', arabic: 'أغنام', icon: 'sheep' },
  { key: 'goats', label: 'Goats', arabic: 'ماعز', icon: 'paw' },
  { key: 'cows', label: 'Cows', arabic: 'أبقار', icon: 'cow' },
  { key: 'horses', label: 'Horses', arabic: 'خيول', icon: 'horse-variant' },
  { key: 'birds', label: 'Birds', arabic: 'طيور', icon: 'bird' },
  { key: 'feed', label: 'Feed', arabic: 'علف', icon: 'food-apple-outline' },
  { key: 'equipment', label: 'Equipment', arabic: 'معدات', icon: 'tools' },
];

interface Props {
  value: CategoryKey;
  onChange: (k: CategoryKey) => void;
}

export function CategoryChips({ value, onChange }: Props) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {categories.map((c) => {
          const isSelected = c.key === value;
          return (
            <Pressable
              key={c.key}
              onPress={() => onChange(c.key)}
              style={({ pressed }) => [
                styles.chip,
                isSelected && styles.chipSelected,
                pressed && { opacity: 0.85 },
              ]}
            >
              <MaterialCommunityIcons
                name={c.icon}
                size={16}
                color={isSelected ? '#fff' : colors.glow}
              />
              <Text style={[styles.text, isSelected && styles.textSelected]}>{c.arabic}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: colors.bgGlass,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  chipSelected: {
    backgroundColor: colors.royal,
    borderColor: colors.electricBright,
  },
  text: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  textSelected: {
    color: '#fff',
    fontWeight: '700',
  },
});

export default CategoryChips;
