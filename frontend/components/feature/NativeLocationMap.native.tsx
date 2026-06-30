import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '@/constants/theme';
import { COUNTRY_MAP_CENTER } from '@/lib/butcherLocation';

export interface NativeLocationMapProps {
  lat: number;
  lng: number;
  cityLabel?: string;
  height: number;
}

export function NativeLocationMap({ lat, lng, cityLabel, height }: NativeLocationMapProps) {
  const [MapModule, setMapModule] = useState<typeof import('react-native-maps') | null>(null);

  useEffect(() => {
    let active = true;
    import('react-native-maps')
      .then((mod) => { if (active) setMapModule(mod); })
      .catch(() => { if (active) setMapModule(null); });
    return () => { active = false; };
  }, []);

  if (!MapModule) {
    return (
      <View style={[styles.map, styles.loading, { height }]}>
        <ActivityIndicator color={colors.electricBright} />
      </View>
    );
  }

  const { default: MapView, Marker } = MapModule;
  const center = COUNTRY_MAP_CENTER.SA;

  return (
    <View style={[styles.map, { height }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: lat,
          longitude: lng,
          latitudeDelta: center.delta,
          longitudeDelta: center.delta,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <Marker coordinate={{ latitude: lat, longitude: lng }} title={cityLabel} />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
