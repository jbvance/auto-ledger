import * as SQLite from "expo-sqlite";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initialized = false;
let initializationPromise: Promise<void> | null = null;

const columnExists = async (
  db: SQLite.SQLiteDatabase,
  tableName: string,
  columnName: string,
) => {
  const columns = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${tableName})`,
  );

  return columns.some((column) => column.name === columnName);
};

export const getGuestDatabase = async () => {
  dbPromise ??= SQLite.openDatabaseAsync("autoledger_guest.db");
  const db = await dbPromise;

  if (!initialized) {
    initializationPromise ??= initializeGuestDatabase(db).catch((error) => {
      initializationPromise = null;
      throw error;
    });
    await initializationPromise;
  }

  return db;
};

const initializeGuestDatabase = async (db: SQLite.SQLiteDatabase) => {
  await db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS vehicles (
        id TEXT PRIMARY KEY NOT NULL,
        local_id TEXT NOT NULL,
        nickname TEXT NOT NULL,
        make TEXT NOT NULL,
        model TEXT NOT NULL,
        year INTEGER NOT NULL,
        trim TEXT,
        vin TEXT,
        license_plate TEXT,
        license_state TEXT,
        color TEXT,
        vehicle_type TEXT NOT NULL,
        initial_odometer INTEGER NOT NULL DEFAULT 0,
        current_odometer INTEGER NOT NULL,
        odometer_unit TEXT NOT NULL,
        purchase_date TEXT,
        purchase_odometer INTEGER,
        notes TEXT,
        archived_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS vehicles_archived_updated_idx
      ON vehicles (archived_at, updated_at);

      CREATE TABLE IF NOT EXISTS odometer_entries (
        id TEXT PRIMARY KEY NOT NULL,
        local_id TEXT NOT NULL,
        vehicle_id TEXT NOT NULL,
        reading INTEGER NOT NULL,
        reading_date TEXT NOT NULL,
        odometer_unit TEXT NOT NULL,
        source_type TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
      );

      CREATE INDEX IF NOT EXISTS odometer_entries_vehicle_date_idx
      ON odometer_entries (vehicle_id, reading_date DESC, created_at DESC);

      CREATE TABLE IF NOT EXISTS service_records (
        id TEXT PRIMARY KEY NOT NULL,
        local_id TEXT NOT NULL,
        vehicle_id TEXT NOT NULL,
        service_date TEXT NOT NULL,
        odometer_reading INTEGER,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        vendor_name TEXT,
        cost_amount REAL,
        cost_currency TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
      );

      CREATE INDEX IF NOT EXISTS service_records_vehicle_date_idx
      ON service_records (vehicle_id, service_date DESC, created_at DESC);

      CREATE TABLE IF NOT EXISTS repair_records (
        id TEXT PRIMARY KEY NOT NULL,
        local_id TEXT NOT NULL,
        vehicle_id TEXT NOT NULL,
        repair_date TEXT NOT NULL,
        odometer_reading INTEGER,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        vendor_name TEXT,
        cost_amount REAL,
        cost_currency TEXT NOT NULL,
        warranty_until_date TEXT,
        warranty_until_odometer INTEGER,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
      );

      CREATE INDEX IF NOT EXISTS repair_records_vehicle_date_idx
      ON repair_records (vehicle_id, repair_date DESC, created_at DESC);

      CREATE TABLE IF NOT EXISTS record_attachments (
        id TEXT PRIMARY KEY NOT NULL,
        local_id TEXT NOT NULL,
        vehicle_id TEXT NOT NULL,
        service_record_id TEXT,
        repair_record_id TEXT,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size_bytes INTEGER,
        storage_bucket TEXT,
        storage_path TEXT,
        local_uri TEXT NOT NULL,
        ocr_status TEXT NOT NULL,
        ocr_text TEXT,
        ocr_vendor TEXT,
        ocr_processed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
        FOREIGN KEY (service_record_id) REFERENCES service_records(id),
        FOREIGN KEY (repair_record_id) REFERENCES repair_records(id),
        CHECK (
          (service_record_id IS NOT NULL AND repair_record_id IS NULL)
          OR (service_record_id IS NULL AND repair_record_id IS NOT NULL)
        )
      );

      CREATE INDEX IF NOT EXISTS record_attachments_service_record_idx
      ON record_attachments (service_record_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS record_attachments_repair_record_idx
      ON record_attachments (repair_record_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS maintenance_reminders (
        id TEXT PRIMARY KEY NOT NULL,
        local_id TEXT NOT NULL,
        vehicle_id TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        reminder_type TEXT NOT NULL,
        due_date TEXT,
        due_odometer INTEGER,
        repeat_interval_months INTEGER,
        repeat_interval_miles INTEGER,
        is_completed INTEGER NOT NULL DEFAULT 0,
        completed_at TEXT,
        last_triggered_at TEXT,
        notes TEXT,
        scheduled_notification_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
      );

      CREATE INDEX IF NOT EXISTS maintenance_reminders_vehicle_completed_idx
      ON maintenance_reminders (vehicle_id, is_completed, due_date, due_odometer);

      CREATE INDEX IF NOT EXISTS maintenance_reminders_completed_idx
      ON maintenance_reminders (is_completed, due_date, due_odometer);

      CREATE TABLE IF NOT EXISTS notification_settings (
        id TEXT PRIMARY KEY NOT NULL,
        reminder_notifications_enabled INTEGER NOT NULL DEFAULT 0,
        days_before_due_date INTEGER NOT NULL DEFAULT 3,
        miles_before_due_odometer INTEGER NOT NULL DEFAULT 500,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS migration_runs (
        id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL,
        migration_scope TEXT NOT NULL DEFAULT 'full',
        started_at TEXT NOT NULL,
        completed_at TEXT,
        status TEXT NOT NULL,
        total_vehicles INTEGER NOT NULL DEFAULT 0,
        migrated_vehicles INTEGER NOT NULL DEFAULT 0,
        skipped_vehicles INTEGER NOT NULL DEFAULT 0,
        failed_vehicles INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS migration_runs_account_updated_idx
      ON migration_runs (account_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS migration_entity_mappings (
        id TEXT PRIMARY KEY NOT NULL,
        run_id TEXT,
        account_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        local_id TEXT NOT NULL,
        cloud_id TEXT,
        status TEXT NOT NULL,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (account_id, entity_type, local_id),
        FOREIGN KEY (run_id) REFERENCES migration_runs(id)
      );

      CREATE INDEX IF NOT EXISTS migration_entity_mappings_run_idx
      ON migration_entity_mappings (run_id, entity_type);

      CREATE INDEX IF NOT EXISTS migration_entity_mappings_account_status_idx
      ON migration_entity_mappings (account_id, status);
  `);

  if (!(await columnExists(db, "vehicles", "initial_odometer"))) {
    await db.execAsync(`
        ALTER TABLE vehicles
        ADD COLUMN initial_odometer INTEGER NOT NULL DEFAULT 0;

        UPDATE vehicles
        SET initial_odometer = current_odometer
        WHERE initial_odometer = 0;
      `);
  }

  if (!(await columnExists(db, "migration_runs", "migration_scope"))) {
    await db.execAsync(`
        ALTER TABLE migration_runs
        ADD COLUMN migration_scope TEXT NOT NULL DEFAULT 'full';
      `);
  }

  if (!(await columnExists(db, "migration_runs", "total_vehicles"))) {
    await db.execAsync(`
        ALTER TABLE migration_runs
        ADD COLUMN total_vehicles INTEGER NOT NULL DEFAULT 0;
      `);
  }

  if (!(await columnExists(db, "migration_runs", "migrated_vehicles"))) {
    await db.execAsync(`
        ALTER TABLE migration_runs
        ADD COLUMN migrated_vehicles INTEGER NOT NULL DEFAULT 0;
      `);
  }

  if (!(await columnExists(db, "migration_runs", "skipped_vehicles"))) {
    await db.execAsync(`
        ALTER TABLE migration_runs
        ADD COLUMN skipped_vehicles INTEGER NOT NULL DEFAULT 0;
      `);
  }

  if (!(await columnExists(db, "migration_runs", "failed_vehicles"))) {
    await db.execAsync(`
        ALTER TABLE migration_runs
        ADD COLUMN failed_vehicles INTEGER NOT NULL DEFAULT 0;
      `);
  }

  if (
    !(await columnExists(
      db,
      "maintenance_reminders",
      "scheduled_notification_id",
    ))
  ) {
    await db.execAsync(`
        ALTER TABLE maintenance_reminders
        ADD COLUMN scheduled_notification_id TEXT;
      `);
  }

  if (!(await columnExists(db, "service_records", "vendor_name"))) {
    await db.execAsync(`
        ALTER TABLE service_records
        ADD COLUMN vendor_name TEXT;
      `);
  }

  if (!(await columnExists(db, "repair_records", "vendor_name"))) {
    await db.execAsync(`
        ALTER TABLE repair_records
        ADD COLUMN vendor_name TEXT;
      `);
  }

  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT OR IGNORE INTO notification_settings (
        id,
        reminder_notifications_enabled,
        days_before_due_date,
        miles_before_due_odometer,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      "local",
      0,
      3,
      500,
      now,
      now,
  );

  initialized = true;
};

export const createLocalId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export const bindOptional = (value: number | string | null | undefined) =>
  value ?? null;
