import {integer,sqliteTable,text} from "drizzle-orm/sqlite-core";
export const appState=sqliteTable("app_state",{id:integer("id").primaryKey(),payload:text("payload").notNull(),updatedAt:text("updated_at").notNull()});
export const jobStateV2=sqliteTable("job_state_v2",{id:integer("id").primaryKey(),payload:text("payload").notNull(),revision:integer("revision").notNull()});
export const jobBackups=sqliteTable("job_backups",{id:text("id").primaryKey(),payload:text("payload").notNull(),reason:text("reason").notNull(),createdAt:text("created_at").notNull()});
