//
// Copyright © 2025 Agora
// This file is part of TEN Framework, an open source project.
// Licensed under the Apache License, Version 2.0, with certain conditions.
// Refer to the "LICENSE" file in the root directory for more information.
//
import * as React from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { PlayIcon, BrushCleaningIcon } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useWidgetStore, useAppStore } from "@/store";
import { AppFileManager } from "@/components/FileManager/AppFolder";
import { postLoadDir, useFetchApps } from "@/api/services/apps";
import { CONTAINER_DEFAULT_ID, GROUP_LOG_VIEWER_ID } from "@/constants/widgets";
import { getWSEndpointFromWindow } from "@/constants/utils";
import {
  AppsManagerWidget,
  AppTemplateWidget,
} from "@/components/Widget/AppsWidget";
import { TEN_PATH_WS_EXEC } from "@/constants";
import {
  ELogViewerScriptType,
  EWidgetDisplayType,
  EWidgetCategory,
  IWidget,
  IDefaultWidgetData,
  IDefaultWidget,
} from "@/types/widgets";
import { LogViewerPopupTitle } from "../LogViewer";

export const AppFolderPopupTitle = () => {
  const { t } = useTranslation();
  return t("header.menuApp.openAppFolder");
};

export const AppFolderPopupContent = (props: { widget: IWidget }) => {
  const { widget } = props;
  const [isSaving, setIsSaving] = React.useState<boolean>(false);

  const { t } = useTranslation();

  const { removeWidget } = useWidgetStore();
  const { folderPath } = useAppStore();

  const { mutate: mutateApps } = useFetchApps();

  const handleSetBaseDir = async (folderPath: string) => {
    try {
      await postLoadDir(folderPath.trim());
      mutateApps();
      toast.success(t("header.menuApp.loadAppSuccess"));
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(t("popup.default.errorOpenAppFolder"), {
          description: error.message,
        });
      } else {
        toast.error(t("popup.default.errorUnknown"));
      }
      console.error(error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!folderPath.trim()) {
        toast.error(t("popup.default.errorFolderPathEmpty"));
        throw new Error("errorFolderPathEmpty");
      }
      await handleSetBaseDir(folderPath.trim());
      removeWidget(widget.widget_id);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "errorFolderPathEmpty") {
        toast.error(t("popup.default.errorFolderPathEmpty"));
      } else {
        toast.error(t("popup.default.errorUnknown"));
      }
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppFileManager
      isSaveLoading={isSaving}
      onSave={handleSave}
      onCancel={() => removeWidget(widget.widget_id)}
    />
  );
};

export const LoadedAppsPopupTitle = () => {
  const { t } = useTranslation();
  return t("popup.apps.manager");
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const LoadedAppsPopupContent = (_props: { widget: IWidget }) => {
  return <AppsManagerWidget />;
};

export const AppRunPopupTitle = () => {
  const { t } = useTranslation();
  return t("popup.apps.run");
};

export const AppRunPopupContent = (props: { widget: IDefaultWidget }) => {
  const { widget } = props;
  const { base_dir: baseDir, scripts } = widget.metadata as IDefaultWidgetData;

  const { t } = useTranslation();

  const {
    removeWidget,
    appendWidget,
    removeBackstageWidget,
    removeLogViewerHistory,
  } = useWidgetStore();

  const [selectedScript, setSelectedScript] = React.useState<
    string | undefined
  >(scripts?.[0] || undefined);

  const handleRun = () => {
    removeWidget(widget.widget_id);

    const newAppStartWidgetId = "app-start-" + Date.now();

    appendWidget({
      container_id: CONTAINER_DEFAULT_ID,
      group_id: GROUP_LOG_VIEWER_ID,
      widget_id: newAppStartWidgetId,

      category: EWidgetCategory.LogViewer,
      display_type: EWidgetDisplayType.Popup,

      title: <LogViewerPopupTitle />,
      metadata: {
        wsUrl: getWSEndpointFromWindow() + TEN_PATH_WS_EXEC,
        scriptType: ELogViewerScriptType.RUN_SCRIPT,
        script: {
          type: ELogViewerScriptType.RUN_SCRIPT,
          base_dir: baseDir,
          name: selectedScript,
          stdout_is_log: true,
          stderr_is_log: true,
        },
      },
      popup: {
        width: 0.5,
        height: 0.8,
      },
      actions: {
        onClose: () => {
          removeBackstageWidget(newAppStartWidgetId);
        },
        custom_actions: [
          {
            id: "app-start-log-clean",
            label: t("popup.logViewer.cleanLogs"),
            Icon: BrushCleaningIcon,
            onClick: () => {
              removeLogViewerHistory(newAppStartWidgetId);
            },
          },
        ],
      },
    });
  };

  if (!baseDir || !scripts || scripts.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 w-full h-full">
      <div className="flex flex-col gap-2">
        <Label htmlFor="runapp_base_dir">{t("popup.apps.baseDir")}</Label>
        <Input id="runapp_base_dir" type="text" value={baseDir} disabled />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="runapp_script">{t("popup.apps.runScript")}</Label>
        <Select value={selectedScript} onValueChange={setSelectedScript}>
          <SelectTrigger id="runapp_script">
            <SelectValue placeholder={t("popup.apps.selectScript")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {scripts?.map((script) => (
                <SelectItem key={script} value={script}>
                  {script}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end gap-2 mt-auto">
        <Button
          variant="outline"
          onClick={() => removeWidget(widget.widget_id)}
        >
          {t("action.cancel")}
        </Button>
        <Button disabled={!selectedScript?.trim()} onClick={handleRun}>
          <PlayIcon className="size-4" />
          {t("action.run")}
        </Button>
      </div>
    </div>
  );
};

export const AppCreatePopupTitle = () => {
  const { t } = useTranslation();
  return t("popup.apps.create");
};

export const AppCreatePopupContent = (props: { widget: IWidget }) => {
  const { widget } = props;

  const { removeWidget } = useWidgetStore();

  const handleCreated = () => {
    removeWidget(widget.widget_id);
  };

  return (
    <AppTemplateWidget onCreated={handleCreated} className="w-full max-w-sm" />
  );
};
