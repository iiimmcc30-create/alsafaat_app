// SAFAT — Butcher Application Draft Wizard (معالج تعديل المسودة)
import { AppIcon } from '@/components/ui/FlaticonIcon';

import { LinearGradient } from '@/components/ui/AppLinearGradient';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LoadingState } from '@/components/butcherApplication/LoadingState';
import { DocumentsStep } from '@/components/butcherApplication/DocumentsStep';
import { WizardStepBar } from '@/components/butcherApplication/WizardStepBar';
import { ButcherLocationPicker } from '@/components/feature/ButcherLocationPicker';
import { AppTextInput } from '@/components/ui/AppTextInput';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { colors, gradients, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useButcherApplication } from '@/hooks/useButcherApplication';
import { presentActionSheet } from '@/lib/actionSheet';
import {
  applicationDisplayName,
  countryLabel,
  formatApplicationDate,
} from '@/lib/butcherApplicationLabels';
import {
  issuesByField,
  normalizeCommercialReg,
  normalizeShopPhone,
  validateSubmitInput,
  validateSubmitReady,
  validateWizardStep1,
  validateWizardStep2,
  validateWizardStep3,
} from '@/lib/butcherApplicationValidation';
import { hasValidCoords } from '@/lib/butcherLocation';
import { rtlBackIcon, rtlRow } from '@/lib/rtl';
import type {
  ApplicationDetail,
  ApplicationSnapshotInput,
  GccCountry,
} from '@/services/butcherApplicationTypes';
import { toApiError } from '@/services/butcherApplications';
import type { Country } from '@/services/types';

type WizardForm = {
  nameAr: string;
  nameEn: string;
  shopPhone: string;
  commercialReg: string;
  country: GccCountry;
  city: string;
  cityAr: string;
  address: string;
  addressAr: string;
  lat: string;
  lng: string;
  bioAr: string;
  bioEn: string;
  specialtiesText: string;
  openTime: string;
  closeTime: string;
};

function emptyForm(): WizardForm {
  return {
    nameAr: '',
    nameEn: '',
    shopPhone: '',
    commercialReg: '',
    country: 'SA',
    city: '',
    cityAr: '',
    address: '',
    addressAr: '',
    lat: '',
    lng: '',
    bioAr: '',
    bioEn: '',
    specialtiesText: '',
    openTime: '06:00',
    closeTime: '22:00',
  };
}

function applicationToForm(app: ApplicationDetail): WizardForm {
  const city = app.cityAr || app.city || '';
  const address = app.addressAr || app.address || '';
  return {
    nameAr: app.nameAr ?? '',
    nameEn: app.nameEn ?? app.nameAr ?? '',
    shopPhone: app.shopPhone ?? '',
    commercialReg: app.commercialReg ?? '',
    country: 'SA',
    city,
    cityAr: city,
    address,
    addressAr: address,
    lat: app.lat != null ? String(app.lat) : '',
    lng: app.lng != null ? String(app.lng) : '',
    bioAr: app.bioAr ?? '',
    bioEn: app.bioEn ?? app.bioAr ?? '',
    specialtiesText: app.specialties?.length ? app.specialties.join('، ') : '',
    openTime: app.openTime || '06:00',
    closeTime: app.closeTime || '22:00',
  };
}

function parseSpecialties(text: string): string[] {
  return text
    .split(/[,،]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function step1Snapshot(form: WizardForm): ApplicationSnapshotInput {
  const name = form.nameAr.trim();
  const city = form.cityAr.trim();
  const address = form.addressAr.trim();
  return {
    nameAr: name,
    nameEn: name,
    shopPhone: normalizeShopPhone(form.shopPhone),
    commercialReg: normalizeCommercialReg(form.commercialReg),
    country: 'SA',
    city,
    cityAr: city,
    address,
    addressAr: address,
  };
}

function step2Snapshot(form: WizardForm): ApplicationSnapshotInput {
  const latRaw = form.lat.trim();
  const lngRaw = form.lng.trim();
  const snapshot: ApplicationSnapshotInput = {};
  if (latRaw !== '') {
    const lat = Number(latRaw);
    snapshot.lat = Number.isFinite(lat) ? lat : Number.NaN;
  }
  if (lngRaw !== '') {
    const lng = Number(lngRaw);
    snapshot.lng = Number.isFinite(lng) ? lng : Number.NaN;
  }
  return snapshot;
}

function step3Snapshot(form: WizardForm): ApplicationSnapshotInput {
  const specialties = parseSpecialties(form.specialtiesText);
  const bio = form.bioAr.trim() || undefined;
  return {
    bioAr: bio,
    bioEn: bio,
    specialties: specialties.length > 0 ? specialties : undefined,
    openTime: form.openTime.trim(),
    closeTime: form.closeTime.trim(),
  };
}

function snapshotForStep(step: number, form: WizardForm): ApplicationSnapshotInput {
  if (step === 0) return step1Snapshot(form);
  if (step === 1) return step2Snapshot(form);
  if (step === 2) return step3Snapshot(form);
  return {};
}

function validateStep(step: number, form: WizardForm) {
  const snapshot = snapshotForStep(step, form);
  if (step === 0) return validateWizardStep1(snapshot);
  if (step === 1) return validateWizardStep2(snapshot);
  if (step === 2) return validateWizardStep3(snapshot);
  return { valid: true, issues: [] };
}

function mapCountryForMap(): Country {
  return 'SA';
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={rv.row}>
      <Text style={rv.label}>{label}</Text>
      <Text style={rv.value}>{value || '—'}</Text>
    </View>
  );
}

function CheckboxRow({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={[rv.checkboxRow, checked && rv.checkboxRowActive]}
    >
      <View style={[rv.checkbox, checked && rv.checkboxChecked]}>
        {checked ? <AppIcon name="checkmark" size={14} color="#fff" /> : null}
      </View>
      <Text style={rv.checkboxText}>{label}</Text>
    </Pressable>
  );
}

export default function ButcherApplicationEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { get, updateDraft, submit, loading, error } = useButcherApplication();

  const applicationId = typeof id === 'string' ? id : id?.[0];

  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [form, setForm] = useState<WizardForm>(emptyForm());
  const [step, setStep] = useState(0);
  const [initialLoad, setInitialLoad] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [confirmAccuracy, setConfirmAccuracy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [documentsBusy, setDocumentsBusy] = useState(false);

  const dirtyRef = useRef(dirty);
  const savingRef = useRef(saving);
  const formRef = useRef(form);
  const stepRef = useRef(step);
  const updatedAtRef = useRef<string | null>(null);

  dirtyRef.current = dirty;
  savingRef.current = saving;
  formRef.current = form;
  stepRef.current = step;
  updatedAtRef.current = application?.updatedAt ?? null;

  const patchForm = useCallback((patch: Partial<WizardForm>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setDirty(true);
    setFieldErrors({});
  }, []);

  const loadApplication = useCallback(async () => {
    if (!applicationId) return;
    const detail = await get(applicationId);
    if (detail.status !== 'DRAFT') {
      router.replace({
        pathname: '/butchers/application/[id]',
        params: { id: detail.id },
      });
      return;
    }
    setApplication(detail);
    setForm(applicationToForm(detail));
    setDirty(false);
  }, [applicationId, get, router]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/auth/phone');
      return;
    }
    if (!applicationId) return;
    (async () => {
      try {
        await loadApplication();
      } catch {
        // hook.error
      } finally {
        setInitialLoad(false);
      }
    })();
  }, [authLoading, isAuthenticated, applicationId, router, loadApplication]);

  const saveCurrentStep = useCallback(async (): Promise<ApplicationDetail | null> => {
    if (!applicationId || !application) return null;
    const snapshot = snapshotForStep(stepRef.current, formRef.current);
    setSaving(true);
    setSyncNotice(null);
    try {
      const attemptSave = async (expectedAt?: string | null) =>
        updateDraft(applicationId, snapshot, expectedAt ?? undefined);

      try {
        const updated = await attemptSave(updatedAtRef.current);
        setApplication(updated);
        setForm(applicationToForm(updated));
        setDirty(false);
        return updated;
      } catch (err) {
        const apiErr = toApiError(err);
        if (apiErr?.code === 'APPLICATION_CONFLICT' || apiErr?.status === 409) {
          const refreshed = await get(applicationId);
          setApplication(refreshed);
          const updated = await attemptSave(refreshed.updatedAt);
          setApplication(updated);
          setForm(applicationToForm(updated));
          setDirty(false);
          setSyncNotice('تم تحديث الطلب تلقائياً بعد تعديل متزامن. تم حفظ تغييراتك.');
          return updated;
        }
        throw err;
      }
    } finally {
      setSaving(false);
    }
  }, [application, applicationId, get, updateDraft]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!dirtyRef.current || savingRef.current) return;
      e.preventDefault();
      void (async () => {
        const key = await presentActionSheet({
          title: 'تغييرات غير محفوظة',
          message: 'هل تريد حفظ التغييرات قبل المغادرة؟',
          items: [
            {
              key: 'save-exit',
              label: 'حفظ والمغادرة',
              subtitle: 'سيتم حفظ التغييرات الحالية قبل الخروج',
              icon: 'checkmark-done-outline',
            },
            {
              key: 'discard',
              label: 'تجاهل',
              subtitle: 'الخروج بدون حفظ التغييرات',
              icon: 'trash-outline',
              destructive: true,
            },
            { key: 'stay', label: 'البقاء', cancel: true },
          ],
        });

        if (key === 'discard') {
          setDirty(false);
          dirtyRef.current = false;
          navigation.dispatch(e.data.action);
          return;
        }

        if (key === 'save-exit') {
          try {
            await saveCurrentStep();
            setDirty(false);
            dirtyRef.current = false;
            navigation.dispatch(e.data.action);
          } catch {
            Alert.alert('خطأ', 'تعذّر حفظ التغييرات');
          }
        }
      })();
    });
    return unsubscribe;
  }, [navigation, saveCurrentStep]);

  const goNext = async () => {
    // Normalize phone / commercial reg so common Saudi input formats pass validation
    const phone = normalizeShopPhone(form.shopPhone);
    const commercialReg = normalizeCommercialReg(form.commercialReg);
    let working = form;
    if (phone !== form.shopPhone || commercialReg !== form.commercialReg) {
      working = { ...form, shopPhone: phone, commercialReg };
      setForm(working);
      formRef.current = working;
      setDirty(true);
      dirtyRef.current = true;
    }

    const validation = validateStep(step, working);
    if (!validation.valid) {
      setFieldErrors(issuesByField(validation.issues));
      Alert.alert(
        'أكمل البيانات',
        validation.issues[0]?.message ?? 'يرجى تعبئة الحقول المطلوبة قبل المتابعة',
      );
      return;
    }

    try {
      // Skip network save when nothing changed — allows advancing if API is slow/down
      // after a previous successful save. Always save when there are local edits.
      if (step !== 3 && (dirtyRef.current || dirty)) {
        const saved = await saveCurrentStep();
        if (!saved) {
          throw new Error('تعذّر حفظ المسودة');
        }
      } else if (step === 3 && applicationId) {
        try {
          const refreshed = await get(applicationId);
          setApplication(refreshed);
        } catch {
          // Keep local draft state so the user can still reach review
        }
      }
      setStep((s) => Math.min(s + 1, 4));
      setFieldErrors({});
      setSubmitError(null);
    } catch (err) {
      const apiErr = toApiError(err);
      const message =
        apiErr?.messageAr ||
        (err instanceof Error ? err.message : null) ||
        error ||
        'تعذّر حفظ البيانات. تحقق من الاتصال ثم حاول مجدداً.';
      setSubmitError(message);
      Alert.alert('تعذّر المتابعة', message);
    }
  };

  const goBack = async () => {
    if (step === 0) {
      if (dirty) {
        const key = await presentActionSheet({
          title: 'تغييرات غير محفوظة',
          message: 'هل تريد حفظ التغييرات؟',
          items: [
            {
              key: 'save',
              label: 'حفظ',
              subtitle: 'حفظ التعديلات ثم الرجوع',
              icon: 'checkmark-done-outline',
            },
            {
              key: 'discard',
              label: 'تجاهل',
              subtitle: 'الرجوع بدون حفظ',
              icon: 'trash-outline',
              destructive: true,
            },
            { key: 'cancel', label: 'إلغاء', cancel: true },
          ],
        });
        if (key === 'discard') {
          router.back();
        } else if (key === 'save') {
          try {
            await saveCurrentStep();
            router.back();
          } catch {
            Alert.alert('خطأ', 'تعذّر حفظ التغييرات');
          }
        }
      } else {
        router.back();
      }
      return;
    }

    if (dirty) {
      try {
        await saveCurrentStep();
      } catch {
        return;
      }
    }
    setStep((s) => s - 1);
    setFieldErrors({});
  };

  const handleSubmit = async () => {
    if (!applicationId || !application) return;
    setSubmitError(null);

    if (!acceptedTerms || !confirmAccuracy) {
      setSubmitError('يجب الموافقة على الشروط وتأكيد صحة البيانات');
      return;
    }

    const termsValidation = validateSubmitInput({
      acceptedTerms: true,
      confirmAccuracy: true,
    });
    if (!termsValidation.valid) {
      setSubmitError(termsValidation.issues[0]?.message ?? 'يرجى الموافقة على الشروط');
      return;
    }

    let latest = application;
    try {
      if (dirty) {
        const saved = await saveCurrentStep();
        if (saved) latest = saved;
      }
    } catch {
      return;
    }

    const ready = validateSubmitReady(latest);
    if (!ready.valid) {
      setSubmitError(ready.issues[0]?.message ?? 'الطلب غير مكتمل');
      return;
    }

    try {
      await submit(applicationId, { acceptedTerms: true, confirmAccuracy: true });
      router.replace({
        pathname: '/butchers/application/[id]',
        params: { id: applicationId },
      });
    } catch (err) {
      const apiErr = toApiError(err);
      setSubmitError(apiErr?.messageAr ?? 'تعذّر تقديم الطلب');
    }
  };

  const mapCountry = mapCountryForMap();
  const canUseMap = true;
  const latNum = form.lat ? Number(form.lat) : null;
  const lngNum = form.lng ? Number(form.lng) : null;

  if (authLoading || initialLoad) {
    return (
      <SafeAreaView style={s.screen} edges={['top']}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <LoadingState message="جاري تحميل المسودة..." />
      </SafeAreaView>
    );
  }

  if (!applicationId || !application) {
    return (
      <SafeAreaView style={s.screen} edges={['top']}>
        <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
        <LoadingState message={error ?? 'تعذّر تحميل الطلب'} />
      </SafeAreaView>
    );
  }

  let stepContent: ReactNode = null;

  if (step === 0) {
    stepContent = (
      <View style={s.stepBody}>
        <Text style={s.stepTitle}>معلومات المحل</Text>
        <Text style={s.stepSub}>أدخل بيانات ملحمتك الأساسية كما ستظهر للعملاء</Text>

        <AppTextInput
          label="اسم المحل *"
          value={form.nameAr}
          onChangeText={(v) => patchForm({ nameAr: v, nameEn: v })}
          error={fieldErrors.nameAr || fieldErrors.nameEn}
        />
        <AppTextInput
          label="هاتف المحل *"
          value={form.shopPhone}
          onChangeText={(v) => patchForm({ shopPhone: v })}
          onBlur={() => {
            const next = normalizeShopPhone(form.shopPhone);
            if (next !== form.shopPhone) patchForm({ shopPhone: next });
          }}
          keyboardType="phone-pad"
          ltr
          hint="مثال: 05XXXXXXXX أو +9665XXXXXXXX"
          error={fieldErrors.shopPhone}
        />
        <AppTextInput
          label="رقم السجل التجاري *"
          value={form.commercialReg}
          onChangeText={(v) => patchForm({ commercialReg: v })}
          onBlur={() => {
            const next = normalizeCommercialReg(form.commercialReg);
            if (next !== form.commercialReg) patchForm({ commercialReg: next });
          }}
          ltr
          error={fieldErrors.commercialReg}
        />

        <Text style={s.fieldLabel}>الدولة</Text>
        <View style={s.countryFixed}>
          <Text style={s.countryFixedText}>🇸🇦 السعودية</Text>
        </View>

        <AppTextInput
          label="المدينة *"
          value={form.cityAr}
          onChangeText={(v) => patchForm({ cityAr: v, city: v })}
          error={fieldErrors.cityAr || fieldErrors.city}
        />
        <AppTextInput
          label="العنوان *"
          value={form.addressAr}
          onChangeText={(v) => patchForm({ addressAr: v, address: v })}
          multiline
          error={fieldErrors.addressAr || fieldErrors.address}
        />
      </View>
    );
  } else if (step === 1) {
    stepContent = (
      <View style={s.stepBody}>
        <Text style={s.stepTitle}>موقع المحل</Text>
        <Text style={s.stepSub}>حدد إحداثيات موقع ملحمتك على الخريطة</Text>

        {canUseMap ? (
          <ButcherLocationPicker
            country={mapCountry}
            lat={hasValidCoords(latNum, lngNum) ? latNum : null}
            lng={hasValidCoords(latNum, lngNum) ? lngNum : null}
            onChange={({ lat, lng }) => patchForm({ lat: String(lat), lng: String(lng) })}
            height={240}
          />
        ) : (
          <>
            <AppTextInput
              label="خط العرض (Latitude) *"
              value={form.lat}
              onChangeText={(v) => patchForm({ lat: v })}
              keyboardType="decimal-pad"
              ltr
              hint="مثال: 24.7136"
              error={fieldErrors.lat}
            />
            <AppTextInput
              label="خط الطول (Longitude) *"
              value={form.lng}
              onChangeText={(v) => patchForm({ lng: v })}
              keyboardType="decimal-pad"
              ltr
              hint="مثال: 46.6753"
              error={fieldErrors.lng}
            />
          </>
        )}
        {fieldErrors.lat ? <Text style={s.inlineError}>{fieldErrors.lat}</Text> : null}
        {fieldErrors.lng ? <Text style={s.inlineError}>{fieldErrors.lng}</Text> : null}
      </View>
    );
  } else if (step === 2) {
    stepContent = (
      <View style={s.stepBody}>
        <Text style={s.stepTitle}>تفاصيل العمل</Text>
        <Text style={s.stepSub}>نبذة عن ملحمتك وساعات العمل</Text>

        <AppTextInput
          label="نبذة"
          value={form.bioAr}
          onChangeText={(v) => patchForm({ bioAr: v, bioEn: v })}
          multiline
          error={fieldErrors.bioAr}
        />
        <AppTextInput
          label="التخصصات"
          value={form.specialtiesText}
          onChangeText={(v) => patchForm({ specialtiesText: v })}
          placeholder="مثال: ذبح يومي، خروف كامل، توصيل"
          hint="افصل بين التخصصات بفاصلة"
          error={fieldErrors.specialties}
        />
        <AppTextInput
          label="وقت الفتح *"
          value={form.openTime}
          onChangeText={(v) => patchForm({ openTime: v })}
          placeholder="06:00"
          ltr
          hint="صيغة HH:mm"
          error={fieldErrors.openTime}
        />
        <AppTextInput
          label="وقت الإغلاق *"
          value={form.closeTime}
          onChangeText={(v) => patchForm({ closeTime: v })}
          placeholder="22:00"
          ltr
          hint="صيغة HH:mm"
          error={fieldErrors.closeTime}
        />
      </View>
    );
  } else if (step === 3) {
    stepContent = (
      <DocumentsStep
        applicationId={applicationId}
        application={application}
        onApplicationUpdated={setApplication}
        onBusyChange={setDocumentsBusy}
        disabled={saving || loading}
      />
    );
  } else {
    const snap = { ...step1Snapshot(form), ...step2Snapshot(form), ...step3Snapshot(form) };
    stepContent = (
      <View style={s.stepBody}>
        <Text style={s.stepTitle}>مراجعة الطلب</Text>
        <Text style={s.stepSub}>تأكد من صحة البيانات قبل التقديم</Text>

        <View style={rv.card}>
          <Text style={rv.cardTitle}>
            {applicationDisplayName(snap.nameAr ?? null, snap.nameEn ?? null)}
          </Text>
          <ReviewRow label="الهاتف" value={snap.shopPhone ?? ''} />
          <ReviewRow label="السجل التجاري" value={snap.commercialReg ?? ''} />
          <ReviewRow label="الدولة" value={countryLabel(snap.country ?? null)} />
          <ReviewRow label="المدينة" value={snap.cityAr ?? snap.city ?? ''} />
          <ReviewRow label="العنوان" value={snap.addressAr ?? snap.address ?? ''} />
          <ReviewRow
            label="الموقع"
            value={
              snap.lat != null && snap.lng != null
                ? `${snap.lat.toFixed(5)}, ${snap.lng.toFixed(5)}`
                : '—'
            }
          />
          <ReviewRow label="ساعات العمل" value={`${snap.openTime} — ${snap.closeTime}`} />
          {snap.bioAr ? <ReviewRow label="نبذة" value={snap.bioAr} /> : null}
          {snap.specialties?.length ? (
            <ReviewRow label="التخصصات" value={snap.specialties.join(' · ')} />
          ) : null}
          <ReviewRow label="تاريخ الإنشاء" value={formatApplicationDate(application.createdAt)} />
        </View>

        <CheckboxRow
          checked={acceptedTerms}
          onToggle={() => setAcceptedTerms((v) => !v)}
          label="أوافق على الشروط والأحكام"
        />
        <CheckboxRow
          checked={confirmAccuracy}
          onToggle={() => setConfirmAccuracy((v) => !v)}
          label="أؤكد صحة البيانات"
        />

        {syncNotice ? <Text style={s.syncNotice}>{syncNotice}</Text> : null}
        {submitError ? <Text style={s.inlineError}>{submitError}</Text> : null}
        {error ? <Text style={s.inlineError}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />

      <View style={s.header}>
        <Pressable onPress={goBack} hitSlop={12} style={s.backBtn}>
          <AppIcon name={rtlBackIcon} size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>إكمال الطلب</Text>
          <Text style={s.headerSub}>#{application.applicationNumber}</Text>
        </View>
        <View style={s.backBtn}>
          {(saving || loading) && !initialLoad ? (
            <Text style={s.savingText}>حفظ...</Text>
          ) : dirty ? (
            <View style={s.unsavedDot} />
          ) : null}
        </View>
      </View>

      <WizardStepBar current={step} />

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {stepContent}
        </ScrollView>

        <View
          style={[
            s.footer,
            { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.lg },
          ]}
        >
          {submitError || error ? (
            <Text style={s.inlineError}>{submitError || error}</Text>
          ) : null}
          {step < 4 ? (
            <PrimaryButton
              title={step === 3 ? 'متابعة للمراجعة' : 'التالي'}
              onPress={goNext}
              disabled={saving || loading || documentsBusy}
            />
          ) : (
            <PrimaryButton
              title="تقديم الطلب"
              variant="gold"
              onPress={handleSubmit}
              disabled={saving || loading || documentsBusy || !acceptedTerms || !confirmAccuracy}
            />
          )}
          {step > 0 && step < 4 ? (
            <PrimaryButton
              title="السابق"
              variant="outline"
              onPress={goBack}
              disabled={saving || loading || documentsBusy}
              style={s.secondaryBtn}
            />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgDeep },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backBtn: {
    width: 48,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  headerSub: {
    ...typography.caption,
    color: colors.textMuted,
  },
  savingText: {
    ...typography.micro,
    color: colors.textBrand,
  },
  unsavedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.amber,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  stepBody: {
    gap: spacing.md,
  },
  stepTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  stepSub: {
    ...typography.body,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    lineHeight: 22,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    textAlign: 'right',
  },
  countryFixed: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderMid,
    backgroundColor: colors.bgElevated,
    marginBottom: spacing.sm,
  },
  countryFixedText: {
    ...typography.bodyStrong,
    color: colors.textPrimary,
  },
  inlineError: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'right',
  },
  syncNotice: {
    ...typography.caption,
    color: colors.textBrandSuccess,
    textAlign: 'right',
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderHairline,
    backgroundColor: colors.bgGlassStrong,
  },
  secondaryBtn: {
    marginTop: spacing.xs,
  },
});

const rv = StyleSheet.create({
  card: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  row: {
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
  },
  value: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  checkboxRow: {
    ...rtlRow,
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.bgGlass,
    marginBottom: spacing.sm,
  },
  checkboxRowActive: {
    borderColor: colors.electric,
    backgroundColor: `${colors.electric}10`,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.borderMid,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.electric,
    borderColor: colors.electric,
  },
  checkboxText: {
    flex: 1,
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    textAlign: 'right',
  },
});
