// Supabase generated types (trimmed to the tables used in this project).
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: string | null;
          currency: string;
          is_default: boolean;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type?: string | null;
          currency?: string;
          is_default?: boolean;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: string | null;
          currency?: string;
          is_default?: boolean;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "accounts_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      categories: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: "income" | "expense";
          is_default: boolean;
          parent_id: string | null;
          level: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: "income" | "expense";
          is_default?: boolean;
          parent_id?: string | null;
          level?: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: "income" | "expense";
          is_default?: boolean;
          parent_id?: string | null;
          level?: number;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "categories_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          account_id: string | null;
          category_id: string | null;
          type: "income" | "expense";
          amount: number;
          currency: string;
          note: string | null;
          transaction_time: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_id?: string | null;
          category_id?: string | null;
          type: "income" | "expense";
          amount: number;
          currency?: string;
          note?: string | null;
          transaction_time?: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_id?: string | null;
          category_id?: string | null;
          type?: "income" | "expense";
          amount?: number;
          currency?: string;
          note?: string | null;
          transaction_time?: string;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey";
            columns: ["account_id"];
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_category_id_fkey";
            columns: ["category_id"];
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      partners: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: string | null;
          phone: string | null;
          note: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type?: string | null;
          phone?: string | null;
          note?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: string | null;
          phone?: string | null;
          note?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "partners_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      debts: {
        Row: {
          id: string;
          user_id: string;
          partner_id: string;
          direction: "lend" | "borrow";
          principal_amount: number;
          currency: string;
          start_date: string;
          due_date: string | null;
          interest_type: "none" | "fixed" | "percent";
          interest_rate: number | null;
          interest_cycle: "day" | "month" | "year" | null;
          status: "ongoing" | "paid_off" | "overdue" | "cancelled";
          description: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          partner_id: string;
          direction: "lend" | "borrow";
          principal_amount: number;
          currency: string;
          start_date: string;
          due_date?: string | null;
          interest_type?: "none" | "fixed" | "percent";
          interest_rate?: number | null;
          interest_cycle?: "day" | "month" | "year" | null;
          status?: "ongoing" | "paid_off" | "overdue" | "cancelled";
          description?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          partner_id?: string;
          direction?: "lend" | "borrow";
          principal_amount?: number;
          currency?: string;
          start_date?: string;
          due_date?: string | null;
          interest_type?: "none" | "fixed" | "percent";
          interest_rate?: number | null;
          interest_cycle?: "day" | "month" | "year" | null;
          status?: "ongoing" | "paid_off" | "overdue" | "cancelled";
          description?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "debts_partner_id_fkey";
            columns: ["partner_id"];
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "debts_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      debt_payments: {
        Row: {
          id: string;
          user_id: string;
          debt_id: string;
          transaction_id: string;
          payment_type: "disbursement" | "repayment" | "receive";
          amount: number;
          principal_amount: number | null;
          interest_amount: number | null;
          payment_date: string;
          note: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          debt_id: string;
          transaction_id: string;
          payment_type: "disbursement" | "repayment" | "receive";
          amount: number;
          principal_amount?: number | null;
          interest_amount?: number | null;
          payment_date?: string;
          note?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          debt_id?: string;
          transaction_id?: string;
          payment_type?: "disbursement" | "repayment" | "receive";
          amount?: number;
          principal_amount?: number | null;
          interest_amount?: number | null;
          payment_date?: string;
          note?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "debt_payments_debt_id_fkey";
            columns: ["debt_id"];
            referencedRelation: "debts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "debt_payments_transaction_id_fkey";
            columns: ["transaction_id"];
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "debt_payments_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      partner_transactions: {
        Row: {
          id: string;
          user_id: string;
          partner_id: string;
          transaction_id: string;
          direction: "lend" | "borrow" | "repay" | "receive";
          amount: number;
          principal_amount: number | null;
          interest_amount: number | null;
          date: string;
          note: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          partner_id: string;
          transaction_id: string;
          direction: "lend" | "borrow" | "repay" | "receive";
          amount: number;
          principal_amount?: number | null;
          interest_amount?: number | null;
          date?: string;
          note?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          partner_id?: string;
          transaction_id?: string;
          direction?: "lend" | "borrow" | "repay" | "receive";
          amount?: number;
          principal_amount?: number | null;
          interest_amount?: number | null;
          date?: string;
          note?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "partner_transactions_partner_id_fkey";
            columns: ["partner_id"];
            referencedRelation: "partners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_transactions_transaction_id_fkey";
            columns: ["transaction_id"];
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "partner_transactions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      trading_funding: {
        Row: {
          amount: number;
          created_at: string | null;
          currency: string;
          id: string;
          method: string;
          note: string | null;
          transaction_time: string;
          type: "deposit" | "withdraw";
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string | null;
          currency: string;
          id?: string;
          method: string;
          note?: string | null;
          transaction_time: string;
          type: "deposit" | "withdraw";
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string | null;
          currency?: string;
          id?: string;
          method?: string;
          note?: string | null;
          transaction_time?: string;
          type?: "deposit" | "withdraw";
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trading_funding_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      trading_orders: {
        Row: {
          is_imported: boolean;
          ticket: string | null;
          close_price: number | null;
          close_time: string | null;
          created_at: string | null;
          commission_usd: number | null;
          entry_price: number;
          equity_usd: number | null;
          id: string;
          leverage: number | null;
          margin_level: number | null;
          note: string | null;
          original_position_size: number | null;
          open_time: string;
          close_reason: string | null;
          pnl_amount: number | null;
          pnl_percent: number | null;
          side: "buy" | "sell";
          sl_price: number | null;
          status: "open" | "closed" | "cancelled";
          symbol: string;
          tp_price: number | null;
          swap_usd: number | null;
          user_id: string;
          volume: number;
        };
        Insert: {
          ticket?: string | null;
          close_price?: number | null;
          close_time?: string | null;
          created_at?: string | null;
          commission_usd?: number | null;
          entry_price: number;
          equity_usd?: number | null;
          id?: string;
          leverage?: number | null;
          margin_level?: number | null;
          note?: string | null;
          original_position_size?: number | null;
          open_time: string;
          close_reason?: string | null;
          pnl_amount?: number | null;
          pnl_percent?: number | null;
          side: "buy" | "sell";
          sl_price?: number | null;
          status?: "open" | "closed" | "cancelled";
          symbol: string;
          tp_price?: number | null;
          swap_usd?: number | null;
          user_id: string;
          volume: number;
        };
        Update: {
          ticket?: string | null;
          close_price?: number | null;
          close_time?: string | null;
          created_at?: string | null;
          commission_usd?: number | null;
          entry_price?: number;
          equity_usd?: number | null;
          id?: string;
          leverage?: number | null;
          margin_level?: number | null;
          note?: string | null;
          original_position_size?: number | null;
          open_time?: string;
          close_reason?: string | null;
          pnl_amount?: number | null;
          pnl_percent?: number | null;
          side?: "buy" | "sell";
          sl_price?: number | null;
          status?: "open" | "closed" | "cancelled";
          symbol?: string;
          tp_price?: number | null;
          swap_usd?: number | null;
          user_id?: string;
          volume?: number;
        };
        Relationships: [
          {
            foreignKeyName: "trading_orders_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      partner_balances: {
        Row: {
          partner_id: string | null;
          total_lent: number | null;
          total_borrowed: number | null;
          total_receive: number | null;
          total_repay: number | null;
          balance: number | null;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
