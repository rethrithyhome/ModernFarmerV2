/** Generated from cloud/schema.json by scripts/gen-sql.mjs — do not edit. */
import type { SchemaDoc } from "./schemaTypes";

export const schema = {
  "workspaceColumn": "workspace_id",
  "metaTable": "app_meta",
  "metaId": "app",
  "tables": [
    {
      "table": "materials",
      "collection": "materials",
      "pk": "id",
      "orderBy": "created_at, id",
      "columns": [
        {
          "field": "id",
          "column": "id",
          "type": "text"
        },
        {
          "field": "name",
          "column": "name",
          "type": "text"
        },
        {
          "field": "category",
          "column": "category",
          "type": "text"
        },
        {
          "field": "unit",
          "column": "unit",
          "type": "text"
        },
        {
          "field": "costPerUnit",
          "column": "cost_per_unit",
          "type": "numeric"
        },
        {
          "field": "nPct",
          "column": "n_pct",
          "type": "numeric",
          "nullable": true
        },
        {
          "field": "pPct",
          "column": "p_pct",
          "type": "numeric",
          "nullable": true
        },
        {
          "field": "kPct",
          "column": "k_pct",
          "type": "numeric",
          "nullable": true
        },
        {
          "field": "cnRatio",
          "column": "cn_ratio",
          "type": "numeric",
          "nullable": true
        },
        {
          "field": "moisturePct",
          "column": "moisture_pct",
          "type": "numeric",
          "nullable": true
        },
        {
          "field": "supplier",
          "column": "supplier",
          "type": "text",
          "nullable": true
        },
        {
          "field": "reorderQty",
          "column": "reorder_qty",
          "type": "numeric"
        },
        {
          "field": "note",
          "column": "note",
          "type": "text",
          "nullable": true
        },
        {
          "field": "archived",
          "column": "archived",
          "type": "boolean",
          "default": "false"
        },
        {
          "field": "createdAt",
          "column": "created_at",
          "type": "date"
        }
      ],
      "writeRoles": [
        "admin",
        "stock"
      ]
    },
    {
      "table": "material_movements",
      "collection": "materialMovements",
      "pk": "id",
      "orderBy": "date, id",
      "columns": [
        {
          "field": "id",
          "column": "id",
          "type": "text"
        },
        {
          "field": "materialId",
          "column": "material_id",
          "type": "text"
        },
        {
          "field": "dir",
          "column": "direction",
          "type": "text"
        },
        {
          "field": "qty",
          "column": "qty",
          "type": "numeric"
        },
        {
          "field": "unitCost",
          "column": "unit_cost",
          "type": "numeric"
        },
        {
          "field": "reason",
          "column": "reason",
          "type": "text"
        },
        {
          "field": "lotId",
          "column": "lot_id",
          "type": "text",
          "nullable": true
        },
        {
          "field": "operator",
          "column": "operator",
          "type": "text",
          "nullable": true
        },
        {
          "field": "date",
          "column": "date",
          "type": "date"
        },
        {
          "field": "note",
          "column": "note",
          "type": "text",
          "nullable": true
        }
      ],
      "writeRoles": [
        "admin",
        "stock"
      ]
    },
    {
      "table": "recipes",
      "collection": "recipes",
      "pk": "id",
      "orderBy": "created_at, id",
      "columns": [
        {
          "field": "id",
          "column": "id",
          "type": "text"
        },
        {
          "field": "name",
          "column": "name",
          "type": "text"
        },
        {
          "field": "productName",
          "column": "product_name",
          "type": "text"
        },
        {
          "field": "targetKg",
          "column": "target_kg",
          "type": "numeric"
        },
        {
          "field": "yieldPct",
          "column": "yield_pct",
          "type": "numeric"
        },
        {
          "field": "fermentationDays",
          "column": "fermentation_days",
          "type": "integer"
        },
        {
          "field": "spec",
          "column": "spec",
          "type": "jsonb"
        },
        {
          "field": "lines",
          "column": "lines",
          "type": "jsonb"
        },
        {
          "field": "status",
          "column": "status",
          "type": "text"
        },
        {
          "field": "note",
          "column": "note",
          "type": "text",
          "nullable": true
        },
        {
          "field": "createdAt",
          "column": "created_at",
          "type": "date"
        }
      ],
      "writeRoles": [
        "admin",
        "stock"
      ]
    },
    {
      "table": "lots",
      "collection": "lots",
      "pk": "id",
      "orderBy": "start_date, code",
      "columns": [
        {
          "field": "id",
          "column": "id",
          "type": "text"
        },
        {
          "field": "code",
          "column": "code",
          "type": "text"
        },
        {
          "field": "recipeId",
          "column": "recipe_id",
          "type": "text"
        },
        {
          "field": "windrow",
          "column": "windrow",
          "type": "text",
          "nullable": true
        },
        {
          "field": "plannedKg",
          "column": "planned_kg",
          "type": "numeric"
        },
        {
          "field": "actualKg",
          "column": "actual_kg",
          "type": "numeric",
          "nullable": true
        },
        {
          "field": "stage",
          "column": "stage",
          "type": "text"
        },
        {
          "field": "status",
          "column": "status",
          "type": "text"
        },
        {
          "field": "startDate",
          "column": "start_date",
          "type": "date"
        },
        {
          "field": "targetDate",
          "column": "target_date",
          "type": "date"
        },
        {
          "field": "closedDate",
          "column": "closed_date",
          "type": "date",
          "nullable": true
        },
        {
          "field": "operator",
          "column": "operator",
          "type": "text",
          "nullable": true
        },
        {
          "field": "inputs",
          "column": "inputs",
          "type": "jsonb"
        },
        {
          "field": "extraCosts",
          "column": "extra_costs",
          "type": "jsonb"
        },
        {
          "field": "note",
          "column": "note",
          "type": "text",
          "nullable": true
        },
        {
          "field": "createdAt",
          "column": "created_at",
          "type": "date"
        }
      ],
      "writeRoles": [
        "admin",
        "stock"
      ]
    },
    {
      "table": "process_logs",
      "collection": "processLogs",
      "pk": "id",
      "orderBy": "date, id",
      "columns": [
        {
          "field": "id",
          "column": "id",
          "type": "text"
        },
        {
          "field": "lotId",
          "column": "lot_id",
          "type": "text"
        },
        {
          "field": "date",
          "column": "date",
          "type": "date"
        },
        {
          "field": "tempC",
          "column": "temp_c",
          "type": "numeric",
          "nullable": true
        },
        {
          "field": "moisturePct",
          "column": "moisture_pct",
          "type": "numeric",
          "nullable": true
        },
        {
          "field": "ph",
          "column": "ph",
          "type": "numeric",
          "nullable": true
        },
        {
          "field": "turned",
          "column": "turned",
          "type": "boolean",
          "default": "false"
        },
        {
          "field": "operator",
          "column": "operator",
          "type": "text",
          "nullable": true
        },
        {
          "field": "note",
          "column": "note",
          "type": "text",
          "nullable": true
        }
      ],
      "writeRoles": [
        "admin",
        "stock"
      ]
    },
    {
      "table": "qc_tests",
      "collection": "qcTests",
      "pk": "id",
      "orderBy": "test_date, id",
      "columns": [
        {
          "field": "id",
          "column": "id",
          "type": "text"
        },
        {
          "field": "lotId",
          "column": "lot_id",
          "type": "text"
        },
        {
          "field": "date",
          "column": "test_date",
          "type": "date"
        },
        {
          "field": "sampleType",
          "column": "sample_type",
          "type": "text"
        },
        {
          "field": "omPct",
          "column": "om_pct",
          "type": "numeric",
          "nullable": true
        },
        {
          "field": "nPct",
          "column": "n_pct",
          "type": "numeric",
          "nullable": true
        },
        {
          "field": "pPct",
          "column": "p_pct",
          "type": "numeric",
          "nullable": true
        },
        {
          "field": "kPct",
          "column": "k_pct",
          "type": "numeric",
          "nullable": true
        },
        {
          "field": "cnRatio",
          "column": "cn_ratio",
          "type": "numeric",
          "nullable": true
        },
        {
          "field": "ph",
          "column": "ph",
          "type": "numeric",
          "nullable": true
        },
        {
          "field": "moisturePct",
          "column": "moisture_pct",
          "type": "numeric",
          "nullable": true
        },
        {
          "field": "ecMs",
          "column": "ec_ms",
          "type": "numeric",
          "nullable": true
        },
        {
          "field": "impurityPct",
          "column": "impurity_pct",
          "type": "numeric",
          "nullable": true
        },
        {
          "field": "result",
          "column": "result",
          "type": "text"
        },
        {
          "field": "grade",
          "column": "grade",
          "type": "text",
          "nullable": true
        },
        {
          "field": "tester",
          "column": "tester",
          "type": "text",
          "nullable": true
        },
        {
          "field": "note",
          "column": "note",
          "type": "text",
          "nullable": true
        },
        {
          "field": "createdAt",
          "column": "created_at",
          "type": "date"
        }
      ],
      "writeRoles": [
        "admin",
        "stock"
      ]
    },
    {
      "table": "products",
      "collection": "products",
      "pk": "id",
      "orderBy": "created_at, id",
      "columns": [
        {
          "field": "id",
          "column": "id",
          "type": "text"
        },
        {
          "field": "name",
          "column": "name",
          "type": "text"
        },
        {
          "field": "recipeId",
          "column": "recipe_id",
          "type": "text",
          "nullable": true
        },
        {
          "field": "bagSizeKg",
          "column": "bag_size_kg",
          "type": "numeric"
        },
        {
          "field": "pricePerBag",
          "column": "price_per_bag",
          "type": "numeric"
        },
        {
          "field": "pricePerBagB",
          "column": "price_per_bag_b",
          "type": "numeric",
          "nullable": true
        },
        {
          "field": "pricePerBagC",
          "column": "price_per_bag_c",
          "type": "numeric",
          "nullable": true
        },
        {
          "field": "note",
          "column": "note",
          "type": "text",
          "nullable": true
        },
        {
          "field": "createdAt",
          "column": "created_at",
          "type": "date"
        }
      ],
      "writeRoles": [
        "admin",
        "stock",
        "sale"
      ]
    },
    {
      "table": "product_movements",
      "collection": "productMovements",
      "pk": "id",
      "orderBy": "date, id",
      "columns": [
        {
          "field": "id",
          "column": "id",
          "type": "text"
        },
        {
          "field": "productId",
          "column": "product_id",
          "type": "text"
        },
        {
          "field": "dir",
          "column": "direction",
          "type": "text"
        },
        {
          "field": "qtyKg",
          "column": "qty_kg",
          "type": "numeric"
        },
        {
          "field": "unitPrice",
          "column": "unit_price",
          "type": "numeric"
        },
        {
          "field": "lotId",
          "column": "lot_id",
          "type": "text",
          "nullable": true
        },
        {
          "field": "customerId",
          "column": "customer_id",
          "type": "text",
          "nullable": true
        },
        {
          "field": "party",
          "column": "party",
          "type": "text",
          "nullable": true
        },
        {
          "field": "amount",
          "column": "amount",
          "type": "numeric",
          "nullable": true
        },
        {
          "field": "paid",
          "column": "paid",
          "type": "numeric",
          "nullable": true
        },
        {
          "field": "paymentMethod",
          "column": "payment_method",
          "type": "text",
          "nullable": true
        },
        {
          "field": "reason",
          "column": "reason",
          "type": "text"
        },
        {
          "field": "operator",
          "column": "operator",
          "type": "text",
          "nullable": true
        },
        {
          "field": "date",
          "column": "date",
          "type": "date"
        },
        {
          "field": "note",
          "column": "note",
          "type": "text",
          "nullable": true
        }
      ],
      "writeRoles": [
        "admin",
        "stock",
        "sale"
      ]
    },
    {
      "table": "customers",
      "collection": "customers",
      "pk": "id",
      "orderBy": "created_at, id",
      "columns": [
        {
          "field": "id",
          "column": "id",
          "type": "text"
        },
        {
          "field": "name",
          "column": "name",
          "type": "text"
        },
        {
          "field": "phone",
          "column": "phone",
          "type": "text",
          "nullable": true
        },
        {
          "field": "type",
          "column": "type",
          "type": "text"
        },
        {
          "field": "location",
          "column": "location",
          "type": "text",
          "nullable": true
        },
        {
          "field": "creditLimit",
          "column": "credit_limit",
          "type": "numeric",
          "nullable": true
        },
        {
          "field": "note",
          "column": "note",
          "type": "text",
          "nullable": true
        },
        {
          "field": "createdAt",
          "column": "created_at",
          "type": "date"
        }
      ],
      "writeRoles": [
        "admin",
        "sale"
      ]
    },
    {
      "table": "plans",
      "collection": "plans",
      "pk": "month",
      "orderBy": "month",
      "columns": [
        {
          "field": "month",
          "column": "month",
          "type": "text"
        },
        {
          "field": "targetKg",
          "column": "target_kg",
          "type": "numeric"
        },
        {
          "field": "note",
          "column": "note",
          "type": "text",
          "nullable": true
        }
      ],
      "writeRoles": [
        "admin",
        "stock"
      ]
    },
    {
      "table": "overheads",
      "collection": "overheads",
      "pk": "id",
      "orderBy": "month, id",
      "columns": [
        {
          "field": "id",
          "column": "id",
          "type": "text"
        },
        {
          "field": "month",
          "column": "month",
          "type": "text"
        },
        {
          "field": "category",
          "column": "category",
          "type": "text"
        },
        {
          "field": "amount",
          "column": "amount",
          "type": "numeric"
        },
        {
          "field": "note",
          "column": "note",
          "type": "text",
          "nullable": true
        },
        {
          "field": "createdAt",
          "column": "created_at",
          "type": "date"
        }
      ],
      "writeRoles": [
        "admin",
        "stock"
      ]
    }
  ]
} as const satisfies SchemaDoc;
