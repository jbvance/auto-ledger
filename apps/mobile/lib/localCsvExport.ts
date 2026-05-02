import {
  exportCombinedLocalCsv,
  hasLocalCsvExportData,
  type LocalCsvExportData,
} from "@autoledger/shared";
import * as FileSystem from "expo-file-system/legacy";

import { listMaintenanceReminders } from "./maintenanceReminders";
import { listOdometerEntries } from "./odometerEntries";
import {
  listAttachmentsForRepairRecord,
  listAttachmentsForServiceRecord,
} from "./recordAttachments";
import { listRepairRecords } from "./repairRecords";
import { listServiceRecords } from "./serviceRecords";
import { listArchivedVehicles, listVehicles } from "./vehicles";

const exportDirectory = `${FileSystem.cacheDirectory ?? ""}exports/`;

const timestampForFileName = () =>
  new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

export type LocalCsvExportSummary = {
  fileUri: string;
  hasData: boolean;
  recordCounts: {
    attachments: number;
    maintenanceReminders: number;
    odometerEntries: number;
    repairRecords: number;
    serviceRecords: number;
    vehicles: number;
  };
};

export const collectLocalCsvExportData =
  async (): Promise<LocalCsvExportData> => {
    const [activeVehicles, archivedVehicles] = await Promise.all([
      listVehicles(),
      listArchivedVehicles(),
    ]);
    const vehicles = [...activeVehicles, ...archivedVehicles];
    const perVehicleData = await Promise.all(
      vehicles.map(async (vehicle) => {
        const [
          odometerEntries,
          serviceRecords,
          repairRecords,
          maintenanceReminders,
        ] = await Promise.all([
          listOdometerEntries(vehicle.id),
          listServiceRecords(vehicle.id),
          listRepairRecords(vehicle.id),
          listMaintenanceReminders(vehicle.id),
        ]);
        const [serviceAttachments, repairAttachments] = await Promise.all([
          Promise.all(
            serviceRecords.map((record) =>
              listAttachmentsForServiceRecord(record.id),
            ),
          ),
          Promise.all(
            repairRecords.map((record) =>
              listAttachmentsForRepairRecord(record.id),
            ),
          ),
        ]);

        return {
          maintenanceReminders,
          odometerEntries,
          recordAttachments: [
            ...serviceAttachments.flat(),
            ...repairAttachments.flat(),
          ],
          repairRecords,
          serviceRecords,
        };
      }),
    );

    return {
      maintenanceReminders: perVehicleData.flatMap(
        (item) => item.maintenanceReminders,
      ),
      odometerEntries: perVehicleData.flatMap((item) => item.odometerEntries),
      recordAttachments: perVehicleData.flatMap(
        (item) => item.recordAttachments,
      ),
      repairRecords: perVehicleData.flatMap((item) => item.repairRecords),
      serviceRecords: perVehicleData.flatMap((item) => item.serviceRecords),
      vehicles,
    };
  };

export const getLocalCsvExportSummary = async () => {
  const data = await collectLocalCsvExportData();

  return {
    hasData: hasLocalCsvExportData(data),
    recordCounts: {
      attachments: data.recordAttachments.length,
      maintenanceReminders: data.maintenanceReminders.length,
      odometerEntries: data.odometerEntries.length,
      repairRecords: data.repairRecords.length,
      serviceRecords: data.serviceRecords.length,
      vehicles: data.vehicles.length,
    },
  };
};

export const createLocalCsvExportFile =
  async (): Promise<LocalCsvExportSummary> => {
    if (!FileSystem.cacheDirectory) {
      throw new Error("Local file storage is unavailable.");
    }

    const data = await collectLocalCsvExportData();
    const csv = exportCombinedLocalCsv(data);
    const fileUri = `${exportDirectory}autoledger-local-export-${timestampForFileName()}.csv`;

    await FileSystem.makeDirectoryAsync(exportDirectory, {
      intermediates: true,
    });
    await FileSystem.writeAsStringAsync(fileUri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return {
      fileUri,
      hasData: hasLocalCsvExportData(data),
      recordCounts: {
        attachments: data.recordAttachments.length,
        maintenanceReminders: data.maintenanceReminders.length,
        odometerEntries: data.odometerEntries.length,
        repairRecords: data.repairRecords.length,
        serviceRecords: data.serviceRecords.length,
        vehicles: data.vehicles.length,
      },
    };
  };
