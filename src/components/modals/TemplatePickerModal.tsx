// src/components/modals/TemplatePickerModal.tsx — Pick or manage workout templates
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Modal, FlatList, Alert } from "react-native";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { listTemplates, deleteTemplate, type WorkoutTemplate } from "../../templates";
import { displayNameFor } from "../../exerciseLibrary";
import { Btn } from "../../ui";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (template: WorkoutTemplate) => void;
};

export default function TemplatePickerModal({ visible, onClose, onSelect }: Props) {
  const theme = useTheme();
  const { t } = useI18n();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setLoading(true);
    listTemplates()
      .then((t) => { if (alive) setTemplates(t); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [visible]);

  function handleDelete(id: string) {
    Alert.alert(t("templates.delete"), t("templates.deleteConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          await deleteTemplate(id);
          setTemplates((prev) => prev.filter((tp) => tp.id !== id));
        },
      },
    ]);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          justifyContent: "flex-end",
        }}
        onPress={onClose}
      >
        <View
          onStartShouldSetResponder={() => true}
          style={{
            backgroundColor: theme.bg,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: "70%",
            paddingBottom: 30,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: theme.glassBorder,
            }}
          >
            <Text style={{ color: theme.text, fontSize: 18, fontWeight: "600" }}>
              {t("templates.title")}
            </Text>
            <Pressable onPress={onClose}>
              <Text style={{ color: theme.accent, fontSize: 16 }}>{t("common.close")}</Text>
            </Pressable>
          </View>

          {/* List */}
          {loading ? (
            <View style={{ padding: 24, alignItems: "center" }}>
              <Text style={{ color: theme.muted }}>{t("common.loading")}</Text>
            </View>
          ) : templates.length === 0 ? (
            <View style={{ padding: 24, alignItems: "center" }}>
              <Text style={{ color: theme.muted }}>{t("templates.empty")}</Text>
            </View>
          ) : (
            <FlatList
              data={templates}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => onSelect(item)}
                  onLongPress={() => handleDelete(item.id)}
                  style={({ pressed }) => ({
                    padding: 14,
                    marginHorizontal: 12,
                    marginTop: 8,
                    backgroundColor: pressed ? theme.panel2 : theme.panel,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.glassBorder,
                  })}
                >
                  <Text style={{ color: theme.text, fontWeight: "600", fontSize: 15 }}>
                    {item.name}
                  </Text>
                  {item.description ? (
                    <Text style={{ color: theme.muted, fontSize: 12, marginTop: 2 }}>
                      {item.description}
                    </Text>
                  ) : null}
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
                    <Text style={{ color: theme.muted, fontSize: 12 }}>
                      {t("templates.exercises", { count: item.exercises.length })}
                    </Text>
                    {item.lastUsedAt ? (
                      <Text style={{ color: theme.muted, fontSize: 12 }}>
                        {t("templates.lastUsed", { date: item.lastUsedAt.split("T")[0] })}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                    {item.exercises.slice(0, 5).map((ex, i) => (
                      <Text
                        key={`${item.id}_ex_${i}`}
                        style={{
                          color: theme.accent,
                          fontSize: 11,
                          backgroundColor: theme.panel2,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 4,
                          overflow: "hidden",
                        }}
                      >
                        {displayNameFor(ex.exerciseId)}
                      </Text>
                    ))}
                    {item.exercises.length > 5 ? (
                      <Text style={{ color: theme.muted, fontSize: 11 }}>
                        +{item.exercises.length - 5}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              )}
            />
          )}
        </View>
      </Pressable>
    </Modal>
  );
}
