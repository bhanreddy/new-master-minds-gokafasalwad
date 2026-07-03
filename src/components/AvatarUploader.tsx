import React, { forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from '../utils/haptics';
import { Avatar } from './Avatar';
import { uploadProfilePhoto, removeProfilePhoto } from '../services/profilePhotoService';
import { useAuth } from '../hooks/useAuth';

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
  style?: StyleProp<ViewStyle>;
}

async function pickFromCamera(): Promise<ImagePicker.ImagePickerResult> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Camera permission needed', 'Please allow camera access to take a profile photo.');
    return { canceled: true, assets: null };
  }
  return ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.9,
  });
}

async function pickFromLibrary(): Promise<ImagePicker.ImagePickerResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert('Photos permission needed', 'Please allow photo library access to choose a profile photo.');
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
  style,
}, ref) {
  const { updateUserPhoto } = useAuth();
  const [busy, setBusy] = React.useState(false);

  const handleResult = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets || result.assets.length === 0) return;
    const uri = result.assets[0].uri;
    setBusy(true);
    try {
      const newUrl = await uploadProfilePhoto(uri);
      await updateUserPhoto(newUrl);
      onUploaded?.(newUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message || 'Could not update your profile picture. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    try {
      await removeProfilePhoto();
      await updateUserPhoto(null);
      onRemoved?.();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Could not remove', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const openMenu = () => {
    if (busy) return;
    Haptics.selectionAsync();

    // Web has no native camera flow — go straight to the library picker.
    if (Platform.OS === 'web') {
      void pickFromLibrary().then(handleResult);
      return;
    }

    const options: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }> = [
      { text: 'Take Photo', onPress: () => void pickFromCamera().then(handleResult) },
      { text: 'Choose from Library', onPress: () => void pickFromLibrary().then(handleResult) },
    ];
    if (allowRemove && photoUrl) {
      options.push({ text: 'Remove Photo', style: 'destructive', onPress: handleRemove });
    }
    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert('Profile Picture', 'Update your profile picture', options);
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
      accessibilityLabel="Change profile picture"
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
