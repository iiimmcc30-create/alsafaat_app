import { AppIcon } from '@/components/ui/FlaticonIcon';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export type PublishSuccessAction = {
  label: string;
  icon?: string;
  onPress: () => void;
};

type PublishSuccessModalProps = {
  visible: boolean;
  title?: string;
  message?: string;
  primaryAction: PublishSuccessAction;
  secondaryAction: PublishSuccessAction;
  onRequestClose?: () => void;
};

export function PublishSuccessModal({
  visible,
  title = 'تم نشر إعلانك بنجاح',
  message = 'إعلانك متاح الآن في السوق ويمكن للمشترين مشاهدته والتواصل معك.',
  primaryAction,
  secondaryAction,
  onRequestClose,
}: PublishSuccessModalProps) {
  const { gradients, shadow } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, shadow.card]}>
          <LinearGradient
            colors={gradients.card}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardInner}
          >
            <LinearGradient
              colors={gradients.rim}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.rim}
            />

            <View style={styles.iconWrap}>
              <LinearGradient
                colors={gradients.royal}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGradient}
              >
                <AppIcon name="checkmark-circle" size={42} color="#FFFFFF" />
              </LinearGradient>
            </View>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>

            <View style={styles.actions}>
              <PrimaryButton
                title={primaryAction.label}
                icon={primaryAction.icon}
                onPress={primaryAction.onPress}
                fullWidth
              />
              <PrimaryButton
                title={secondaryAction.label}
                icon={secondaryAction.icon}
                variant="outline"
                onPress={secondaryAction.onPress}
                fullWidth
              />
            </View>
          </LinearGradient>
        </View>

        {onRequestClose ? (
          <Pressable style={styles.dismissBtn} onPress={onRequestClose} hitSlop={12}>
            <Text style={styles.dismissText}>إغلاق</Text>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.bgOverlay,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    card: {
      width: '100%',
      maxWidth: 380,
      borderRadius: radius.xxl,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderSoft,
    },
    cardInner: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xxl,
      paddingBottom: spacing.xl,
      alignItems: 'center',
      gap: spacing.md,
      position: 'relative',
    },
    rim: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 1,
    },
    iconWrap: {
      marginBottom: spacing.xs,
    },
    iconGradient: {
      width: 84,
      height: 84,
      borderRadius: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.22)',
    },
    title: {
      ...typography.h2,
      color: colors.textPrimary,
      textAlign: 'center',
    },
    message: {
      ...typography.body,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: spacing.sm,
    },
    actions: {
      width: '100%',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    dismissBtn: {
      marginTop: spacing.lg,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    dismissText: {
      ...typography.caption,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
}

export default PublishSuccessModal;
