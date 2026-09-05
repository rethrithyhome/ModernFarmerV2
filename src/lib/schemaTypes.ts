/** Shape of cloud/schema.json, shared by the generated TS module and the SQL generator. */
export type ColumnDef = {
  field: string;
  column: string;
  type: "text" | "numeric" | "integer" | "boolean" | "date" | "jsonb";
  nullable?: boolean;
  default?: string;
};

export type TableDefJson = {
  table: string;
  collection: string;
  pk: string;
  orderBy: string;
  columns: ColumnDef[];
  /** Roles (from profiles.role) allowed to insert/update/delete rows. Omit = any authenticated user. */
  writeRoles?: string[];
};

export type SchemaDoc = {
  workspaceColumn: string;
  metaTable: string;
  metaId: string;
  tables: TableDefJson[];
};

export type TableDef = TableDefJson;
