export const swaggerDocument = {
  openapi: "3.0.0",
  info: {
    title: "XPer Finance API",
    description: "API documentation for XPer Finance - Personal finance and trading journal",
    version: "1.0.0",
  },
  servers: [
    {
      url: "http://localhost:3005/api",
      description: "Development server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Supabase JWT token",
      },
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          id: { type: "string" },
          email: { type: "string" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Transaction: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: ["income", "expense"] },
          amount: { type: "number" },
          currency: { type: "string" },
          note: { type: "string" },
          transaction_time: { type: "string", format: "date-time" },
          category: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              type: { type: "string" },
            },
          },
          account: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              currency: { type: "string" },
            },
          },
        },
      },
      Debt: {
        type: "object",
        properties: {
          id: { type: "string" },
          partner_id: { type: "string" },
          amount: { type: "number" },
          type: { type: "string", enum: ["borrow", "lend"] },
          status: { type: "string", enum: ["pending", "paid"] },
          note: { type: "string" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Partner: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          note: { type: "string" },
          category_id: { type: "string", nullable: true },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Account: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          currency: { type: "string" },
          balance: { type: "number" },
        },
      },
      Category: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          type: { type: "string", enum: ["income", "expense", "transfer", "debt"] },
          parent_id: { type: "string", nullable: true },
        },
      },
      Order: {
        type: "object",
        properties: {
          id: { type: "string" },
          symbol: { type: "string" },
          side: { type: "string", enum: ["buy", "sell"] },
          quantity: { type: "number" },
          price: { type: "number" },
          status: { type: "string" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
                required: ["email", "password"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Successful login",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: { $ref: "#/components/schemas/User" },
                    session: { type: "object" },
                  },
                },
              },
            },
          },
          400: {
            description: "Invalid credentials",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register new user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
                required: ["email", "password"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Successful registration",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
          },
          400: {
            description: "Registration failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current user",
        responses: {
          200: {
            description: "Current user info",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user: { $ref: "#/components/schemas/User" },
                  },
                },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/cashflow/transactions": {
      get: {
        tags: ["Cashflow"],
        summary: "Get transactions",
        parameters: [
          {
            name: "range",
            in: "query",
            schema: { type: "string", enum: ["day", "week", "month", "year"] },
          },
          {
            name: "shift",
            in: "query",
            schema: { type: "integer" },
          },
        ],
        responses: {
          200: {
            description: "List of transactions",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Transaction" },
                },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
      post: {
        tags: ["Cashflow"],
        summary: "Create transaction",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["income", "expense"] },
                  amount: { type: "number" },
                  currency: { type: "string" },
                  note: { type: "string" },
                  transaction_time: { type: "string", format: "date-time" },
                  category_id: { type: "string" },
                  account_id: { type: "string" },
                },
                required: ["type", "amount", "transaction_time"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Transaction created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Transaction" },
              },
            },
          },
          400: {
            description: "Invalid payload",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
      put: {
        tags: ["Cashflow"],
        summary: "Update transaction",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  type: { type: "string", enum: ["income", "expense"] },
                  amount: { type: "number" },
                  currency: { type: "string" },
                  note: { type: "string" },
                  transaction_time: { type: "string", format: "date-time" },
                  category_id: { type: "string" },
                  account_id: { type: "string" },
                },
                required: ["id"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Transaction updated",
            content: {
              "application/json": {
                schema: { type: "object", properties: { success: { type: "boolean" } } },
              },
            },
          },
          400: {
            description: "Invalid payload",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
      delete: {
        tags: ["Cashflow"],
        summary: "Delete transaction",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  id: { type: "string" },
                },
                required: ["id"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Transaction deleted",
            content: {
              "application/json": {
                schema: { type: "object", properties: { success: { type: "boolean" } } },
              },
            },
          },
          400: {
            description: "Invalid payload",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Error" },
              },
            },
          },
        },
      },
    },
    "/cashflow/accounts": {
      get: {
        tags: ["Cashflow"],
        summary: "Get accounts",
        responses: {
          200: {
            description: "List of accounts",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Account" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Cashflow"],
        summary: "Create account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  currency: { type: "string" },
                  initial_balance: { type: "number" },
                },
                required: ["name", "currency"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Account created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Account" },
              },
            },
          },
        },
      },
    },
    "/cashflow/categories": {
      get: {
        tags: ["Cashflow"],
        summary: "Get categories",
        responses: {
          200: {
            description: "List of categories",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Category" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Cashflow"],
        summary: "Create category",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  type: { type: "string", enum: ["income", "expense", "transfer", "debt"] },
                  parent_id: { type: "string", nullable: true },
                },
                required: ["name", "type"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Category created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Category" },
              },
            },
          },
        },
      },
    },
    "/debts": {
      get: {
        tags: ["Debts"],
        summary: "Get debts",
        responses: {
          200: {
            description: "List of debts",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Debt" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Debts"],
        summary: "Create debt",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  partner_id: { type: "string" },
                  amount: { type: "number" },
                  type: { type: "string", enum: ["borrow", "lend"] },
                  note: { type: "string" },
                },
                required: ["partner_id", "amount", "type"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Debt created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Debt" },
              },
            },
          },
        },
      },
    },
    "/debts/payments": {
      post: {
        tags: ["Debts"],
        summary: "Make debt payment",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  debt_id: { type: "string" },
                  amount: { type: "number" },
                  note: { type: "string" },
                },
                required: ["debt_id", "amount"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Payment recorded",
            content: {
              "application/json": {
                schema: { type: "object", properties: { success: { type: "boolean" } } },
              },
            },
          },
        },
      },
    },
    "/debts/partners": {
      get: {
        tags: ["Debts"],
        summary: "Get debt partners",
        responses: {
          200: {
            description: "List of partners",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Partner" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Debts"],
        summary: "Create partner",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  note: { type: "string" },
                },
                required: ["name"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Partner created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Partner" },
              },
            },
          },
        },
      },
    },
    "/partners": {
      get: {
        tags: ["Partners"],
        summary: "Get all partners",
        responses: {
          200: {
            description: "List of partners",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Partner" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Partners"],
        summary: "Create partner",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  note: { type: "string" },
                },
                required: ["name"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Partner created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Partner" },
              },
            },
          },
        },
      },
    },
    "/partners/transactions": {
      get: {
        tags: ["Partners"],
        summary: "Get partner transactions",
        parameters: [
          {
            name: "partnerId",
            in: "query",
            schema: { type: "string" },
            required: true,
          },
        ],
        responses: {
          200: {
            description: "List of transactions",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Transaction" },
                },
              },
            },
          },
        },
      },
    },
    "/reports/transactions-by-category": {
      get: {
        tags: ["Reports"],
        summary: "Get transactions by category report",
        parameters: [
          {
            name: "range",
            in: "query",
            schema: { type: "string", enum: ["day", "week", "month", "year"] },
          },
          {
            name: "shift",
            in: "query",
            schema: { type: "integer" },
          },
        ],
        responses: {
          200: {
            description: "Report data",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    income: { type: "array", items: { type: "object" } },
                    expense: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/report-runs": {
      get: {
        tags: ["Reports"],
        summary: "Get report runs",
        responses: {
          200: {
            description: "List of report runs",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { type: "object" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Reports"],
        summary: "Create report run",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  report_type: { type: "string" },
                  parameters: { type: "object" },
                },
                required: ["report_type"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Report run created",
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
        },
      },
    },
    "/trading/orders": {
      get: {
        tags: ["Trading"],
        summary: "Get trading orders",
        responses: {
          200: {
            description: "List of orders",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Order" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Trading"],
        summary: "Create trading order",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  symbol: { type: "string" },
                  side: { type: "string", enum: ["buy", "sell"] },
                  quantity: { type: "number" },
                  price: { type: "number" },
                  type: { type: "string", enum: ["market", "limit"] },
                },
                required: ["symbol", "side", "quantity"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Order created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Order" },
              },
            },
          },
        },
      },
    },
    "/trading/orders/import": {
      post: {
        tags: ["Trading"],
        summary: "Import trading orders",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  orders: {
                    type: "array",
                    items: { type: "object" },
                  },
                },
                required: ["orders"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Orders imported",
            content: {
              "application/json": {
                schema: { type: "object", properties: { success: { type: "boolean" } } },
              },
            },
          },
        },
      },
    },
    "/trading/orders/sync-ledger": {
      post: {
        tags: ["Trading"],
        summary: "Sync orders with ledger",
        responses: {
          200: {
            description: "Sync completed",
            content: {
              "application/json": {
                schema: { type: "object", properties: { success: { type: "boolean" } } },
              },
            },
          },
        },
      },
    },
    "/trading/balance-accounts": {
      get: {
        tags: ["Trading"],
        summary: "Get trading balance accounts",
        responses: {
          200: {
            description: "List of balance accounts",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { type: "object" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Trading"],
        summary: "Create balance account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  currency: { type: "string" },
                  initial_balance: { type: "number" },
                },
                required: ["name", "currency"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Account created",
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
        },
      },
    },
    "/trading/funding": {
      get: {
        tags: ["Trading"],
        summary: "Get funding history",
        responses: {
          200: {
            description: "List of funding records",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { type: "object" },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Trading"],
        summary: "Add funding",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  amount: { type: "number" },
                  type: { type: "string", enum: ["deposit", "withdrawal"] },
                  note: { type: "string" },
                },
                required: ["amount", "type"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Funding added",
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
        },
      },
    },
    "/telegram/webhook": {
      post: {
        tags: ["Telegram"],
        summary: "Telegram webhook endpoint",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  update_id: { type: "integer" },
                  message: { type: "object" },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: "Webhook processed",
            content: {
              "application/json": {
                schema: { type: "object" },
              },
            },
          },
        },
      },
    },
  },
};
