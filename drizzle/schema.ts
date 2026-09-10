import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// A client company using the system (e.g. a municipality contractor).
export const employers = pgTable("employers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  taxNumber: text("tax_number"),
  companyRegNumber: text("company_reg_number"),
  uifEnabled: boolean("uif_enabled").notNull().default(false),
  uifEmployeeRate: numeric("uif_employee_rate", { precision: 5, scale: 2 }).notNull().default("1.00"),
  uifEmployerRate: numeric("uif_employer_rate", { precision: 5, scale: 2 }).notNull().default("1.00"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Platform-level admins (the app owner). Not tied to any one employer;
// they manage the list of companies as a whole.
export const platformAdmins = pgTable("platform_admins", {
  id: uuid("id").primaryKey(), // matches supabase auth.users.id
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Admin/supervisor accounts. Tied 1:1 to a Supabase Auth user id.
export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey(), // matches supabase auth.users.id
  employerId: uuid("employer_id").references(() => employers.id, { onDelete: "cascade" }).notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  role: text("role", { enum: ["owner", "supervisor"] }).notNull().default("supervisor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A designated worksite. Supervisor sets the GPS point + a reference photo
// showing where employees should stand for the selfie.
export const sites = pgTable("sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  employerId: uuid("employer_id").references(() => employers.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  radiusMeters: integer("radius_meters").notNull().default(150),
  referencePhotoUrl: text("reference_photo_url"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const employees = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  employerId: uuid("employer_id").references(() => employers.id, { onDelete: "cascade" }).notNull(),
  siteId: uuid("site_id").references(() => sites.id, { onDelete: "set null" }),
  employeeCode: text("employee_code").notNull(), // short id/badge number employee types in to log in
  fullName: text("full_name").notNull(),
  idNumber: text("id_number"),
  taxNumber: text("tax_number"),
  physicalAddress: text("physical_address"),
  phone: text("phone"),
  email: text("email"),
  pinHash: text("pin_hash").notNull(), // bcrypt hash of a 4-6 digit PIN
  hourlyRateWeekday: numeric("hourly_rate_weekday", { precision: 10, scale: 2 }).notNull(),
  hourlyRateWeekend: numeric("hourly_rate_weekend", { precision: 10, scale: 2 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per clock-in or clock-out tap, with the evidence captured at that moment.
export const timeEntries = pgTable("time_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  siteId: uuid("site_id").references(() => sites.id, { onDelete: "set null" }),
  entryType: text("entry_type", { enum: ["clock_in", "clock_out"] }).notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  selfieUrl: text("selfie_url").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  distanceMeters: doublePrecision("distance_meters").notNull(),
  withinGeofence: boolean("within_geofence").notNull(),
  gpsAccuracyMeters: doublePrecision("gps_accuracy_meters"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A completed clock_in -> clock_out pair, with hours pre-computed.
// Built the moment a clock_out is recorded, so reports/payslips never
// have to re-derive pairing logic.
export const shifts = pgTable("shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  siteId: uuid("site_id").references(() => sites.id, { onDelete: "set null" }),
  clockInEntryId: uuid("clock_in_entry_id").references(() => timeEntries.id).notNull(),
  clockOutEntryId: uuid("clock_out_entry_id").references(() => timeEntries.id).notNull(),
  clockInAt: timestamp("clock_in_at", { withTimezone: true }).notNull(),
  clockOutAt: timestamp("clock_out_at", { withTimezone: true }).notNull(),
  shiftDate: date("shift_date").notNull(), // calendar date of clock-in, used for daily/weekly grouping
  hours: numeric("hours", { precision: 6, scale: 2 }).notNull(),
  isWeekend: boolean("is_weekend").notNull(),
  bothWithinGeofence: boolean("both_within_geofence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payslips = pgTable("payslips", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  employerId: uuid("employer_id").references(() => employers.id, { onDelete: "cascade" }).notNull(),
  periodYear: integer("period_year").notNull(),
  periodMonth: integer("period_month").notNull(), // 1-12
  weekdayHours: numeric("weekday_hours", { precision: 8, scale: 2 }).notNull(),
  weekendHours: numeric("weekend_hours", { precision: 8, scale: 2 }).notNull(),
  totalHours: numeric("total_hours", { precision: 8, scale: 2 }).notNull(),
  hourlyRateWeekday: numeric("hourly_rate_weekday", { precision: 10, scale: 2 }).notNull(),
  hourlyRateWeekend: numeric("hourly_rate_weekend", { precision: 10, scale: 2 }).notNull(),
  grossPay: numeric("gross_pay", { precision: 10, scale: 2 }).notNull(),
  uifDeduction: numeric("uif_deduction", { precision: 10, scale: 2 }).notNull().default("0"),
  netPay: numeric("net_pay", { precision: 10, scale: 2 }).notNull(),
  pdfPath: text("pdf_path").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  uniquePeriod: sql`UNIQUE (${t.employeeId}, ${t.periodYear}, ${t.periodMonth})`,
}));
