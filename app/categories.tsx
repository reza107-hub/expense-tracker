import { ArchiveRestore, Check, Lock, Pencil, Plus, X } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import Button from "@/components/button";
import { TextField } from "@/components/fields";
import { Row } from "@/components/pieces";
import Screen, { QueryState } from "@/components/screen";
import { Body, Card, ErrorText, Heading, Muted } from "@/components/ui";
import { useI18n } from "@/i18n";
import { ApiError, post, put } from "@/lib/api";
import { messageFor } from "@/lib/errors";
import type { Category } from "@/lib/types";
import { colors } from "@/theme/colors";
import { useApi } from "@/lib/use-api";

export default function CategoriesScreen() {
  const { t } = useI18n();
  const { data, error, loading, refreshing, refresh, reload } = useApi<{ active: Category[]; archived: Category[] }>("/categories");
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function add() {
    setNameError(null);
    try {
      await post("/categories", { name });
      setName("");
      await reload();
    } catch (failure) {
      setNameError(failure instanceof ApiError && failure.fieldErrors.name ? failure.fieldErrors.name : messageFor(failure, t));
    }
  }

  async function change(category: Category, action: "archive" | "restore") {
    setProblem(null);
    try {
      await post(`/categories/${category.id}/${action}`);
      await reload();
    } catch (failure) {
      setProblem(messageFor(failure, t));
    }
  }

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Muted>{t("categories.description")}</Muted>
      <Card>
        <Heading>{t("categories.add.title")}</Heading>
        <TextField label={t("categories.name")} value={name} onChangeText={setName} error={nameError ?? undefined} maxLength={40} autoCapitalize="words" />
        <Button label={t("categories.add.submit")} pendingLabel={t("common.adding")} icon={Plus} onPress={add} />
      </Card>
      <QueryState loading={loading} error={error} hasData={!!data} onRetry={reload}>
        {data ? (
          <>
            <ErrorText>{problem}</ErrorText>
            <Heading>{t("categories.yourCategories")}</Heading>
            {data.active.map((category) => (
              <CategoryCard key={category.id} category={category} onArchive={() => change(category, "archive")} onChanged={reload} />
            ))}
            {data.archived.length > 0 ? (
              <>
                <Heading>{t("common.archived")}</Heading>
                {data.archived.map((category) => (
                  <Card key={category.id}>
                    <Row
                      left={<Body>{category.name}</Body>}
                      right={
                        <Button
                          label={t("common.restore")}
                          pendingLabel={t("common.restoring")}
                          icon={ArchiveRestore}
                          variant="quiet"
                          small
                          onPress={() => change(category, "restore")}
                        />
                      }
                    />
                  </Card>
                ))}
              </>
            ) : null}
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}

function CategoryCard({ category, onArchive, onChanged }: { category: Category; onArchive: () => Promise<void>; onChanged: () => Promise<void> }) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string | null>(null);

  if (category.isReserved) {
    return (
      <Card>
        <Row left={<Body>{category.name}</Body>} right={<Lock size={16} color={colors.mutedForeground} />} />
        <Muted>{t("categories.reservedNote")}</Muted>
      </Card>
    );
  }

  if (editing) {
    return (
      <Card>
        <TextField label={t("categories.rename.title")} value={name} onChangeText={setName} error={error ?? undefined} maxLength={40} autoCapitalize="words" />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button
            label={t("common.save")}
            pendingLabel={t("common.saving")}
            icon={Check}
            small
            onPress={async () => {
              setError(null);
              try {
                await put(`/categories/${category.id}`, { name });
                setEditing(false);
                await onChanged();
              } catch (failure) {
                setError(failure instanceof ApiError && failure.fieldErrors.name ? failure.fieldErrors.name : messageFor(failure, t));
              }
            }}
          />
          <Button label={t("common.cancel")} icon={X} variant="quiet" small onPress={() => { setEditing(false); setName(category.name); setError(null); }} />
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <Body>{category.name}</Body>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label={t("categories.rename")} icon={Pencil} variant="quiet" small onPress={() => setEditing(true)} />
        <Button label={t("common.archive")} pendingLabel={t("common.archiving")} variant="quiet" small onPress={onArchive} />
      </View>
    </Card>
  );
}
