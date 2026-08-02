import React, { forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from '../utils/haptics';
import { Avatar } from './Avatar';
import { uploadProfilePhoto, removeProfilePhoto } from '../services/profilePhotoService';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

/**
 * Self-service profile picture control shared by all five portals. Shows the
 * current avatar (photo or initials) with an edit affordance; tapping it lets
 * the user take a photo or pick from the library, then uploads to
 * PATCH /users/me/photo and propagates the new URL into AuthContext so every
 * avatar in the app updates immediately.
 */

export interface AvatarUploaderHandle {
  open: () => void;
}

export interface AvatarUploaderProps {
  photoUrl?: string | null;
  name?: string | null;
  size?: number;
  /** Corner radius override. Defaults to size/2 (full circle). */
  borderRadius?: number;
  ringColor?: string;
  ringWidth?: number;
  /** Colour of the small edit badge (defaults to indigo). */
  accentColor?: string;
  /** Allow removing the photo (reverts to initials). Default true. */
  allowRemove?: boolean;
  /** Called with the new URL after a successful upload (for local screen state). */
  onUploaded?: (photoUrl: string) => void;
  /** Called after a successful removal. */
  onRemoved?: () => void;
  /** False for delegated admin edits so the admin's own AuthContext photo is not overwritten. */
  syncAuthContext?: boolean;
  style?: StyleProp<ViewStyle>;
}

async function pickFromCamera(t: TFunction): Promise<ImagePicker.ImagePickerResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(t('driver_ui.camera_permission_needed'), t('driver_ui.allow_camera_profile_photo'));
    return { canceled: true, assets: null };
  }
  return ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.9,
  });
}

async function pickFromLibrary(t: TFunction): Promise<ImagePicker.ImagePickerResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(t('driver_ui.photos_permission_needed'), t('driver_ui.allow_library_profile_photo'));
    return { canceled: true, assets: null };
  }
  return ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.9,
  });
}

export const AvatarUploader = forwardRef<AvatarUploaderHandle, AvatarUploaderProps>(function AvatarUploader({
  photoUrl,
  name,
  size = 96,
  borderRadius,
  ringColor,
  ringWidth,
  accentColor = '#4F46E5',
  allowRemove = true,
  onUploaded,
  onRemoved,
  syncAuthContext = true,
  style,
}, ref) {
  const { updateUserPhoto } = useAuth();
  const { t } = useTranslation();
  const [busy, setBusy] = React.useState(false);

  const handleResult = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets || result.assets.length === 0) return;
    const uri = result.assets[0].uri;
    setBusy(true);
    try {
      const newUrl = await uploadProfilePhoto(uri);
      if (syncAuthContext) await updateUserPhoto(newUrl);
      onUploaded?.(newUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(t('driver_ui.upload_failed'), t('driver_ui.could_not_update_profile_picture'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      await removeProfilePhoto();
      if (syncAuthContext) await updateUserPhoto(null);
      onRemoved?.();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert(t('driver_ui.could_not_remove'), t('driver_ui.please_try_again'));
    } finally {
      setBusy(false);
    }
  };

  const openMenu = () => {
    if (busy) return;
    Haptics.selectionAsync();

    // Web has no native camera flow — go straight to the library picker.
    if (Platform.OS === 'web') {
      void pickFromLibrary(t).then(handleResult);
      return;
    }

    const options: { text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }[] = [
      { text: t('driver_ui.take_photo'), onPress: () => void pickFromCamera(t).then(handleResult) },
      { text: t('driver_ui.choose_from_library'), onPress: () => void pickFromLibrary(t).then(handleResult) },
    ];
    if (allowRemove && photoUrl) {
      options.push({ text: t('driver_ui.remove_photo'), style: 'destructive', onPress: handleRemove });
    }
    options.push({ text: t('driver_ui.cancel'), style: 'cancel' });

    Alert.alert(t('driver_ui.profile_picture'), t('driver_ui.update_profile_picture'), options);
  };

  useImperativeHandle(ref, () => ({ open: openMenu }), [busy, photoUrl, allowRemove]);

  const badgeSize = Math.max(24, Math.round(size * 0.3));

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={openMenu}
      disabled={busy}
      style={[styles.wrap, style]}
      accessibilityRole="button"
      accessibilityLabel={t('driver_ui.change_profile_picture')}
    >
      <Avatar photoUrl={photoUrl} name={name} size={size} borderRadius={borderRadius} ringColor={ringColor} ringWidth={ringWidth} />

      {busy && (
        <View style={[styles.overlay, { width: size, height: size, borderRadius: borderRadius ?? size / 2 }]}>
          <ActivityIndicator color="#fff" />
        </View>
      )}

      <View
        style={[
          styles.badge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            backgroundColor: accentColor,
          },
        ]}
      >
        <Ionicons name="camera" size={Math.round(badgeSize * 0.55)} color="#fff" />
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
});

export default AvatarUploader;
