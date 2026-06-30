// OAuth callback — completes Google sign-in when the app returns from the browser.

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '@/contexts/AuthContext';
import { extractOAuthParams } from '@/lib/googleOAuthCallback';
import { resolveIdTokenFromCallbackUrl } from '@/services/googleOAuth';
import { colors, typography } from '@/constants/theme';

export default function ExpoAuthSessionScreen() {
  const router = useRouter();
  const { signInWithGoogle } = useAuth();
  const url = Linking.useURL();
  const handled = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (handled.current) return;

    const complete = async () => {
      WebBrowser.maybeCompleteAuthSession();

      const callbackUrl = url ?? (await Linking.getInitialURL());
      if (!callbackUrl) {
        router.replace('/auth/phone' as any);
        return;
      }

      const params = extractOAuthParams(callbackUrl);
      if (params.error) {
        handled.current = true;
        setError(params.error_description ?? params.error ?? 'فشل تسجيل Google');
        return;
      }

      if (!params.id_token && !params.code) {
        return;
      }

      handled.current = true;

      const idToken = await resolveIdTokenFromCallbackUrl(callbackUrl);
      if (!idToken) {
        setError('تعذّر الحصول على رمز Google');
        return;
      }

      const authResult = await signInWithGoogle(idToken);

      if (!authResult.success) {
        setError(authResult.error ?? 'تعذّر الدخول عبر Google');
        return;
      }

      if (authResult.isNew) {
        router.replace({
          pathname: '/auth/register',
          params: {
            googleId:    authResult.googleData?.googleId ?? '',
            email:       authResult.googleData?.email ?? '',
            displayName: authResult.googleData?.displayName ?? '',
            avatar:      authResult.googleData?.avatar ?? '',
            via_google:  '1',
          },
        } as any);
        return;
      }

      router.replace('/(tabs)' as any);
    };

    complete();
  }, [url, signInWithGoogle, router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bgDeep, padding: 24 }}>
      {error ? (
        <>
          <Text style={{ color: colors.danger, textAlign: 'center', marginBottom: 16, ...typography.body }}>
            {error}
          </Text>
          <Text
            style={{ color: colors.gold, ...typography.body }}
            onPress={() => router.replace('/auth/phone' as any)}
          >
            العودة لتسجيل الدخول
          </Text>
        </>
      ) : (
        <ActivityIndicator size="large" color={colors.gold} />
      )}
    </View>
  );
}
