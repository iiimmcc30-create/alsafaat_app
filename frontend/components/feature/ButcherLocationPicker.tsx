// SAFAT — Butcher location picker (map + GPS)

import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { Country } from '@/services/types';
import { formatCoords, hasValidCoords } from '@/lib/butcherLocation';
import { LocationMapPreview } from '@/components/feature/LocationMapPreview';

export interface LocationCoords {
  lat: number;
  lng: number;
}

interface ButcherLocationPickerProps {
  country?: Country;
  lat?: number | null;
  lng?: number | null;
  onChange: (coords: LocationCoords) => void;
  height?: number;
}

export function ButcherLocationPicker({
  country = 'SA',
  lat,
  lng,
  onChange,
  height = 220,
}: ButcherLocationPickerProps) {
  const [locating, setLocating] = useState(false);

  const marker = useMemo<LocationCoords | null>(() => {
    if (hasValidCoords(lat, lng)) return { lat: lat!, lng: lng! };
    return null;
  }, [lat, lng]);

  const setPin = useCallback((latitude: number, longitude: number) => {
    onChange({
      lat: Math.round(latitude * 1_000_000) / 1_000_000,
      lng: Math.round(longitude * 1_000_000) / 1_000_000,
    });
  }, [onChange]);

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

      setPin(pos.coords.latitude, pos.coords.longitude);
    } catch {
      Alert.alert('خطأ', 'تعذّر الحصول على موقعك. حاول مجدداً.');
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={styles.box}>
      <LocationMapPreview
        country={country}
        lat={lat}
        lng={lng}
        height={height}
        showLocateButton
        onLocate={useCurrentLocation}
        locating={locating}
      />

      {marker ? (
        <View style={styles.coordsPill}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text style={styles.coordsText}>{formatCoords(marker.lat, marker.lng)}</Text>
        </View>
      ) : (
        <Text style={styles.hint}>اضغط «موقعي الحالي» لتحديد موقع الملحمة على الخريطة</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: spacing.sm,
  },
  coordsPill: {
    flexDirection: 'row',
    alignItems: 'center',
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
    color: colors.textBrandSuccess,
    textAlign: 'right',
  },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: 'right' },
});
