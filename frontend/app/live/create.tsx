// app/live/create.tsx — إعداد البث المباشر (معاينة + عنوان + فئة + تعهد)

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AgoraVideoView } from '@/components/live/AgoraVideoView';
import { LiveBroadcastPledgeModal } from '@/components/live/LiveBroadcastPledgeModal';
import { VideoSourceType } from '@/lib/agora';
import { useLiveStream } from '@/hooks/useLiveStream';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { rtlBackIcon } from '@/lib/rtl';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE } from '@/services/api';
import {
  fetchLiveStreamEligibility,
  showLiveStreamEligibilityDeniedAlert,
} from '@/lib/liveStreamAccess';

const AGORA_APP_ID = process.env.EXPO_PUBLIC_AGORA_APP_ID ?? '';

const CATEGORIES = [
  { id: 'camels', ar: 'إبل' },
  { id: 'sheep', ar: 'أغنام' },
  { id: 'goats', ar: 'ماعز' },
  { id: 'cattle', ar: 'أبقار' },
  { id: 'horses', ar: 'خيل' },
  { id: 'falcons', ar: 'طيور' },
  { id: 'feed', ar: 'أعلاف' },
  { id: 'equipment', ar: 'معدات' },
  { id: 'general_other', ar: 'أخرى' },
];

function mapCategory(id: string): string {
  if (id === 'general_other' || id === 'equipment') return 'general';
  return id;
}

export default function CreateStreamScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ listingId?: string; listingTitle?: string }>();
  const { accessToken } = useAuth();

  const [arabicTitle, setArabicTitle] = useState(params.listingTitle ?? '');
  const [category, setCategory] = useState('camels');
  const [loading, setLoading] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showPledge, setShowPledge] = useState(false);
  const [pledgeChecked, setPledgeChecked] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [micOff, setMicOff] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [permissionError, setPermissionError] = useState(false);

  const {
    isJoined,
    localUid,
    error: agoraError,
    startLocalPreview,
    stopLocalPreview,
    switchCamera,
    muteAudio,
    muteVideo,
    destroy,
  } = useLiveStream({
    role: 'host',
    onError: () => setPermissionError(true),
  });

  useEffect(() => {
    let active = true;

    (async () => {
      if (!accessToken) {
        if (active) {
          setAccessDenied(true);
          setCheckingAccess(false);
        }
        return;
      }

      const eligibility = await fetchLiveStreamEligibility(accessToken);
      if (!active) return;

      if (!eligibility.canStream) {
        setAccessDenied(true);
        showLiveStreamEligibilityDeniedAlert(router, eligibility);
      }
      setCheckingAccess(false);
    })();

    return () => {
      active = false;
    };
  }, [accessToken, router]);

  const requestPreview = useCallback(async () => {
    if (!AGORA_APP_ID) {
      setPermissionError(true);
      return;
    }
    setPermissionError(false);
    const ok = await startLocalPreview(AGORA_APP_ID);
    setPreviewReady(ok);
    if (!ok) setPermissionError(true);
  }, [startLocalPreview]);

  useEffect(() => {
    if (!checkingAccess && !accessDenied && AGORA_APP_ID) {
      requestPreview();
    }
    return () => {
      destroy().catch(() => {});
    };
  }, [checkingAccess, accessDenied]);

  const toggleCam = () => {
    const next = !camOff;
    setCamOff(next);
    muteVideo(next);
  };

  const toggleMic = () => {
    const next = !micOff;
    setMicOff(next);
    muteAudio(next);
  };

  const titleReady = arabicTitle.trim().length >= 3;
  const canStart = titleReady && !accessDenied;

  const handleStartPress = () => {
    if (!canStart) return;
    setPledgeChecked(false);
    setShowPledge(true);
  };

  const handlePledgeConfirm = async () => {
    if (!accessToken || !pledgeChecked) return;
    setLoading(true);

    try {
      const titleEn = arabicTitle.trim();
      const resp = await fetch(`${API_BASE}/api/livestreams`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          arabicTitle: titleEn,
          title: titleEn,
          category: mapCategory(category),
          topic: params.listingId ? `listing:${params.listingId}` : undefined,
        }),
      });

      const json = await resp.json();

      if (!json.success) {
        const msg = json.messageAr ?? json.message ?? 'حدث خطأ';
        if (['listing_required', 'plan_required', 'weekly_limit', 'live_minutes_limit'].includes(json.error)) {
          showLiveStreamEligibilityDeniedAlert(router, {
            reason: json.reason ?? json.error,
            messageAr: msg,
          });
          setAccessDenied(true);
        } else {
          Alert.alert('خطأ', msg);
        }
        setLoading(false);
        setShowPledge(false);
        return;
      }

      const { streamId, agoraAppId, agoraChannel, agoraToken, agoraUid } = json.data;

      await destroy();

      router.replace({
        pathname: '/live/broadcast',
        params: {
          streamId,
          agoraAppId,
          agoraChannel,
          agoraToken,
          agoraUid: String(agoraUid ?? 0),
          arabicTitle: titleEn,
          category: mapCategory(category),
          autoStart: '1',
          camOff: camOff ? '1' : '0',
          micOff: micOff ? '1' : '0',
        },
      });
    } catch {
      Alert.alert('خطأ في الاتصال', 'تأكد من الإنترنت وحاول مجدداً');
      setLoading(false);
      setShowPledge(false);
    }
  };

  if (checkingAccess) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]} edges={['top', 'bottom']}>
        <ActivityIndicator size="large" color={colors.liveRed} />
        <Text style={styles.muted}>جاري التحقق...</Text>
      </SafeAreaView>
    );
  }

  if (accessDenied) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]} edges={['top', 'bottom']}>
        <Text style={styles.blockedIcon}>📋</Text>
        <Text style={styles.blockedTitle}>إعلان مطلوب للبث</Text>
        <Text style={styles.muted}>انشر إعلاناً واحداً على الأقل في السوق، ثم يمكنك بدء بث مباشر.</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.replace('/create/listing')}>
          <Text style={styles.primaryBtnText}>إنشاء إعلان</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} style={{ marginTop: spacing.md }}>
          <Text style={styles.link}>رجوع</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.topBar}>
          <Pressable onPress={() => { destroy(); router.back(); }} hitSlop={8} style={styles.backBtn}>
            <Ionicons name={rtlBackIcon} size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.topTitle}>إعداد البث المباشر</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Preview */}
          <View style={styles.previewBox}>
            {isJoined && !camOff ? (
              <AgoraVideoView
                local
                canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCamera }}
                style={StyleSheet.absoluteFillObject}
              />
            ) : (
              <View style={styles.previewPlaceholder}>
                <MaterialCommunityIcons name="broadcast" size={40} color={colors.electricBright} />
                {!previewReady && !permissionError ? (
                  <ActivityIndicator color={colors.electricBright} style={{ marginTop: spacing.md }} />
                ) : null}
              </View>
            )}

            <View style={styles.previewTop}>
              <View style={styles.viewerPill}>
                <Ionicons name="eye-outline" size={14} color="#fff" />
                <Text style={styles.viewerPillText}>0</Text>
              </View>
              <View style={styles.previewBadge}>
                <Text style={styles.previewBadgeText}># معاينة</Text>
              </View>
            </View>

            <View style={styles.previewSide}>
              <Pressable style={styles.sideBtn} onPress={() => switchCamera()}>
                <Ionicons name="camera-reverse-outline" size={20} color="#fff" />
              </Pressable>
              <Pressable
                style={[styles.sideBtn, camOff && styles.sideBtnOff]}
                onPress={toggleCam}
              >
                <Ionicons name={camOff ? 'videocam-off' : 'videocam'} size={20} color="#fff" />
              </Pressable>
              <Pressable
                style={[styles.sideBtn, micOff && styles.sideBtnOff]}
                onPress={toggleMic}
              >
                <Ionicons name={micOff ? 'mic-off' : 'mic'} size={20} color="#fff" />
              </Pressable>
            </View>

            {(permissionError || agoraError) && !previewReady ? (
              <View style={styles.previewCenter}>
                <Pressable style={styles.allowBtn} onPress={requestPreview}>
                  <MaterialCommunityIcons name="broadcast" size={22} color="#fff" />
                  <Text style={styles.allowBtnText}>السماح بالكاميرا والميكروفون</Text>
                </Pressable>
              </View>
            ) : null}

            {(permissionError || agoraError) ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorBannerText}>
                  تعذّر الوصول للكاميرا/الميكروفون. يمكنك البدء بدونهما أو السماح من إعدادات الجهاز.
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.hint}>
            الكاميرا والميكروفون اختياريان — يمكنك إغلاقهما قبل البدء أو البدء بدونهما
          </Text>

          <TextInput
            style={styles.titleInput}
            placeholder="عنوان البث (مثال: مزاد المغانيم المباشر)"
            placeholderTextColor={colors.textMuted}
            value={arabicTitle}
            onChangeText={setArabicTitle}
            maxLength={100}
            textAlign="right"
          />

          <View style={styles.catHeader}>
            <Ionicons name="pricetag-outline" size={16} color={colors.textMuted} />
            <Text style={styles.catHeaderText}>فئة البث</Text>
          </View>
          <View style={styles.catGrid}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.id + cat.ar}
                style={[styles.catChip, category === cat.id && styles.catChipActive]}
                onPress={() => setCategory(cat.id)}
              >
                <Text style={[styles.catChipText, category === cat.id && styles.catChipTextActive]}>
                  {cat.ar}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.statusRow}>
            <StatusPill
              label="كاميرا (اختياري)"
              ok={previewReady && !camOff}
            />
            <StatusPill
              label="ميكروفون (اختياري)"
              ok={previewReady && !micOff}
            />
            <StatusPill label="العنوان" ok={titleReady} />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
            onPress={handleStartPress}
            disabled={!canStart || loading}
          >
            <LinearGradient
              colors={canStart ? ['#7F1D1D', '#991B1B'] : [colors.bgSurface, colors.bgSurface]}
              style={styles.startBtnInner}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="broadcast" size={20} color="#fff" />
                  <Text style={styles.startBtnText}>ابدأ البث المباشر</Text>
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        <LiveBroadcastPledgeModal
          visible={showPledge}
          checked={pledgeChecked}
          onToggleCheck={() => setPledgeChecked((v) => !v)}
          onConfirm={handlePledgeConfirm}
          onClose={() => !loading && setShowPledge(false)}
          confirming={loading}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StatusPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <View style={[styles.statusPill, ok && styles.statusPillOk]}>
      <Text style={[styles.statusPillText, ok && styles.statusPillTextOk]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  centered: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.md },
  muted: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  blockedIcon: { fontSize: 48 },
  blockedTitle: { ...typography.h2, color: colors.textPrimary, textAlign: 'center' },
  primaryBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.electric,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  primaryBtnText: { ...typography.bodyStrong, color: '#fff' },
  link: { ...typography.caption, color: colors.textMuted },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.bgGlass,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  topTitle: { ...typography.h3, color: colors.textPrimary },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  previewBox: {
    height: 220,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  previewPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a',
  },
  previewTop: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  viewerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  viewerPillText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  previewBadge: {
    backgroundColor: colors.electric,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  previewBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  previewSide: {
    position: 'absolute',
    left: spacing.md,
    top: '30%',
    gap: spacing.sm,
  },
  sideBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  sideBtnOff: { backgroundColor: colors.liveRed },
  previewCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  allowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.electric,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  allowBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  errorBanner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.liveRed,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorBannerText: { color: '#fff', fontSize: 11, textAlign: 'center', lineHeight: 16 },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: 'right', lineHeight: 18 },
  titleInput: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontSize: 15,
  },
  catHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end' },
  catHeaderText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'flex-end' },
  catChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  catChipActive: { backgroundColor: colors.electric, borderColor: colors.electric },
  catChipText: { ...typography.caption, color: colors.textMuted },
  catChipTextActive: { color: '#fff', fontWeight: '700' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'flex-end' },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  statusPillOk: { borderColor: `${colors.success}55`, backgroundColor: `${colors.success}15` },
  statusPillText: { ...typography.micro, color: colors.textMuted },
  statusPillTextOk: { color: colors.textBrandSuccess },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  startBtn: { borderRadius: radius.xl, overflow: 'hidden' },
  startBtnDisabled: { opacity: 0.45 },
  startBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 16,
    borderRadius: radius.xl,
  },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
