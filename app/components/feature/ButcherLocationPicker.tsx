// SAFAT — Butcher location picker (map + GPS + reverse geocode)
import { AppIcon } from '@/components/ui/FlaticonIcon';

import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { radius, spacing, typography, type ThemeColors } from '@/constants/theme';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useTheme } from '@/hooks/useTheme';
import { Country } from '@/services/types';
import { formatCoords, hasValidCoords } from '@/lib/butcherLocation';
import { formatLocationLabel, reverseGeocodeToAddress, type ResolvedAddress } from '@/lib/formatAddress';
import { LocationMapPreview } from '@/components/feature/LocationMapPreview';

export interface LocationCoords {
  lat: number;
  lng: number;
}

interface ButcherLocationPickerProps {
  country?: Country;
  lat?: number | null;
  lng?: number | null;
  cityLabel?: string;
  addressLabel?: string;
  onChange: (coords: LocationCoords) => void;
  onAddressResolved?: (address: ResolvedAddress) => void;
  height?: number;
}

export function ButcherLocationPicker({
  country = 'SA',
  lat,
  lng,
  cityLabel,
  addressLabel,
  onChange,
  onAddressResolved,
  height = 220,
}: ButcherLocationPickerProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(({ colors }) => createStyles(colors));
  const [locating, setLocating] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<ResolvedAddress | null>(
    cityLabel || addressLabel
      ? { cityAr: cityLabel ?? '', addressAr: addressLabel ?? cityLabel ?? '' }
      : null,
  );

  const marker = useMemo<LocationCoords | null>(() => {
    if (hasValidCoords(lat, lng)) return { lat: lat!, lng: lng! };
    return null;
  }, [lat, lng]);

  const resolveAddress = useCallback(
    async (latitude: number, longitude: number) => {
      setResolving(true);
      try {
        const address = await reverseGeocodeToAddress(latitude, longitude);
        if (address) {
          setResolved(address);
          onAddressResolved?.(address);
        }
      } finally {
        setResolving(false);
      }
    },
    [onAddressResolved],
  );

  const setPin = useCallback(
    async (latitude: number, longitude: number) => {
      const rounded = {
        lat: Math.round(latitude * 1_000_000) / 1_000_000,
        lng: Math.round(longitude * 1_000_000) / 1_000_000,
      };
      onChange(rounded);
      await resolveAddress(rounded.lat, rounded.lng);
    },
    [onChange, resolveAddress],
  );

  useEffect(() => {
    if (cityLabel || addressLabel) {
      setResolved({
        cityAr: cityLabel ?? '',
        addressAr: addressLabel ?? cityLabel ?? '',
      });
    }
  }, [cityLabel, addressLabel]);

  useEffect(() => {
    if (marker && !resolved && !resolving) {
      void resolveAddress(marker.lat, marker.lng);
    }
  }, [marker, resolved, resolving, resolveAddress]);

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('إذن الموقع', 'يرجى السماح بالوصول للموقع لتحديد مكان الملحمة');
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      await setPin(pos.coords.latitude, pos.coords.longitude);
    } catch {
      Alert.alert('خطأ', 'تعذّر الحصول على موقعك. حاول مجدداً.');
    } finally {
      setLocating(false);
    }
  };

  const displayLabel = resolved
    ? formatLocationLabel(resolved.cityAr, resolved.addressAr, lat, lng)
    : marker
      ? formatCoords(marker.lat, marker.lng)
      : '';

  const mapCityLabel = resolved?.cityAr || cityLabel;

  return (
    <View style={styles.box}>
      <LocationMapPreview
        country={country}
        cityLabel={mapCityLabel}
        lat={lat}
        lng={lng}
        height={height}
        showLocateButton
        onLocate={useCurrentLocation}
        locating={locating || resolving}
      />

      {marker ? (
        <View style={styles.coordsPill}>
          <AppIcon name="checkmark-circle" size={16} color={colors.success} />
          <View style={{ flex: 1 }}>
            <Text style={styles.coordsText}>{displayLabel}</Text>
            {resolved ? (
              <Text style={styles.coordsSub}>
                {formatCoords(marker.lat, marker.lng)}
              </Text>
            ) : resolving ? (
              <Text style={styles.coordsSub}>جارٍ تحديد العنوان...</Text>
            ) : null}
          </View>
        </View>
      ) : (
        <Text style={styles.hint}>اضغط «موقعي الحالي» لتحديد موقع الملحمة على الخريطة</Text>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  box: {
    gap: spacing.sm,
  },
  coordsPill: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.success + '18',
    borderWidth: 1,
    borderColor: colors.success + '33',
  },
  coordsText: {
    ...typography.caption,
    color: colors.textPrimary,
    textAlign: 'right',
    fontWeight: '600',
  },
  coordsSub: {
    ...typography.micro,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: 2,
  },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: 'right' },
});
}
