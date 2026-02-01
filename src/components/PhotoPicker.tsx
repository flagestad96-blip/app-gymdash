// src/components/PhotoPicker.tsx — Camera/gallery photo picker with compression
import React, { useState } from "react";
import { View, Text, Pressable, Alert, Image, Modal } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/src/legacy";
import { useTheme } from "../theme";
import { useI18n } from "../i18n";

type Props = {
  onPicked: (uri: string) => void;
  existingUri?: string | null;
  onRemove?: () => void;
};

/**
 * Save a picked image to the app's document directory with compression.
 */
async function saveImage(sourceUri: string): Promise<string> {
  const filename = `photo_${Date.now()}.jpg`;
  const destUri = `${FileSystem.documentDirectory}photos/${filename}`;

  // Ensure photos directory exists
  const dirInfo = await FileSystem.getInfoAsync(`${FileSystem.documentDirectory}photos`);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}photos`, {
      intermediates: true,
    });
  }

  await FileSystem.copyAsync({ from: sourceUri, to: destUri });
  return destUri;
}

export default function PhotoPicker({ onPicked, existingUri, onRemove }: Props) {
  const theme = useTheme();
  const { t } = useI18n();
  const [previewVisible, setPreviewVisible] = useState(false);

  async function pickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("body.photoPermission"), t("body.photoPermission"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets?.[0]) {
      const saved = await saveImage(result.assets[0].uri);
      onPicked(saved);
    }
  }

  async function pickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("body.photoPermission"), t("body.photoPermission"));
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets?.[0]) {
      const saved = await saveImage(result.assets[0].uri);
      onPicked(saved);
    }
  }

  function showOptions() {
    const buttons: { text: string; onPress: () => void; style?: "destructive" | "cancel" }[] = [
      { text: t("body.addPhoto.camera"), onPress: pickFromCamera },
      { text: t("body.addPhoto.gallery"), onPress: pickFromGallery },
    ];
    if (existingUri && onRemove) {
      buttons.push({ text: t("body.removePhoto"), onPress: onRemove, style: "destructive" });
    }
    buttons.push({ text: t("common.cancel"), onPress: () => {}, style: "cancel" });

    Alert.alert(existingUri ? t("body.changePhoto") : t("body.addPhoto"), undefined, buttons);
  }

  return (
    <View>
      {existingUri ? (
        <Pressable onPress={() => setPreviewVisible(true)} onLongPress={showOptions}>
          <Image
            source={{ uri: existingUri }}
            style={{
              width: 56,
              height: 56,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.glassBorder,
            }}
          />
        </Pressable>
      ) : (
        <Pressable
          onPress={showOptions}
          style={{
            width: 56,
            height: 56,
            borderRadius: theme.radius.md,
            borderWidth: 1.5,
            borderColor: theme.glassBorder,
            borderStyle: "dashed",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: theme.muted, fontSize: 22 }}>📷</Text>
        </Pressable>
      )}

      {/* Full-screen preview modal */}
      <Modal visible={previewVisible} transparent animationType="fade">
        <Pressable
          onPress={() => setPreviewVisible(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.9)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {existingUri && (
            <Image
              source={{ uri: existingUri }}
              style={{ width: "90%", height: "70%", borderRadius: 12 }}
              resizeMode="contain"
            />
          )}
          <Text style={{ color: "#fff", marginTop: 16, fontSize: 14 }}>
            {t("common.close")}
          </Text>
        </Pressable>
      </Modal>
    </View>
  );
}
