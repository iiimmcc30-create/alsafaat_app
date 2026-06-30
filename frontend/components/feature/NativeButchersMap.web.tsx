import type { ButcherProfile } from '@/services/butcherData';

export interface NativeButchersMapProps {
  region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  butchers: ButcherProfile[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/** Web stub — schematic map is used instead; no react-native-maps on web */
export function NativeButchersMap(_props: NativeButchersMapProps) {
  return null;
}
