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
      balance_accounts: {
        Row: {
          id: string;
          user_id: string;
          account_type: "TRADING" | "FUNDING";
          name: string;
          currency: string;
          is_active: boolean;
          created_at: string | null;
          broker: string | null;
          platform: string | null;
          account_number: string | null;
          is_demo: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          account_type: "TRADING" | "FUNDING";
          name: string;
          currency: string;
          is_active?: boolean;
          created_at?: string | null;
          broker?: string | null;
          platform?: string | null;
          account_number?: string | null;
          is_demo?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          account_type?: "TRADING" | "FUNDING";
          name?: string;
          currency?: string;
          is_active?: boolean;
          created_at?: string | null;
          broker?: string | null;
          platform?: string | null;
          account_number?: string | null;
          is_demo?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "balance_accounts_user_id_fkey";
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
          type: "income" | "expense" | "transfer";
          category_focus:"NE" | "SE" | "INV" | "EDU" | "ENJ" | "KHAC";
          is_default: boolean;
          parent_id: string | null;
          level: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: "income" | "expense" | "transfer";
          category_focus?: "NE" | "SE" | "INV" | "EDU" | "ENJ" | "khac";
          is_default?: boolean;
          parent_id?: string | null;
          level?: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: "income" | "expense" | "transfer";
          category_focus?: "NE" | "SE" | "INV" | "EDU" | "ENJ" | "KHAC";
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
          type: "income" | "expense" | "transfer";
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
          type: "income" | "expense" | "transfer";
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
          type?: "income" | "expense" | "transfer";
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
      report_runs: {
        Row: {
          id: string;
          user_id: string;
          type: "cashflow" | "trading" | "funding";
          report_date: string;
          note: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: "cashflow" | "trading" | "funding";
          report_date: string;
          note?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: "cashflow" | "trading" | "funding";
          report_date?: string;
          note?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "report_runs_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      funding_accounts: {
        Row: {
          id: string;
          balance_account_id: string;
          provider: string | null;
          note: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          balance_account_id: string;
          provider?: string | null;
          note?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          balance_account_id?: string;
          provider?: string | null;
          note?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "funding_accounts_balance_account_id_fkey";
            columns: ["balance_account_id"];
            referencedRelation: "balance_accounts";
            referencedColumns: ["id"];
          }
        ];
      };
      telegram_link_codes: {
        Row: {
          id: string;
          user_id: string;
          code: string;
          expires_at: string;
          used_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          code: string;
          expires_at?: string;
          used_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          code?: string;
          expires_at?: string;
          used_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "telegram_link_codes_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      telegram_links: {
        Row: {
          id: string;
          user_id: string;
          telegram_user_id: number;
          telegram_chat_id: number;
          username: string | null;
          first_name: string | null;
          last_name: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          telegram_user_id: number;
          telegram_chat_id: number;
          username?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          telegram_user_id?: number;
          telegram_chat_id?: number;
          username?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "telegram_links_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      trading_balance_ledger: {
        Row: {
          id: string;
          balance_account_id: string;
          source_type:
          | "DEPOSIT"
          | "WITHDRAW"
          | "TRANSFER_IN"
          | "TRANSFER_OUT"
          | "TRADE_PNL"
          | "COMMISSION"
          | "SWAP"
          | "BONUS"
          | "BONUS_REMOVAL"
          | "ADJUSTMENT";
          source_ref_id: string | null;
          amount: number;
          balance_after: number;
          occurred_at: string;
          currency: string;
          meta: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          balance_account_id: string;
          source_type:
          | "DEPOSIT"
          | "WITHDRAW"
          | "TRANSFER_IN"
          | "TRANSFER_OUT"
          | "TRADE_PNL"
          | "COMMISSION"
          | "SWAP"
          | "BONUS"
          | "BONUS_REMOVAL"
          | "ADJUSTMENT";
          source_ref_id?: string | null;
          amount: number;
          balance_after: number;
          occurred_at: string;
          currency: string;
          meta?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          balance_account_id?: string;
          source_type?:
          | "DEPOSIT"
          | "WITHDRAW"
          | "TRANSFER_IN"
          | "TRANSFER_OUT"
          | "TRADE_PNL"
          | "COMMISSION"
          | "SWAP"
          | "BONUS"
          | "BONUS_REMOVAL"
          | "ADJUSTMENT";
          source_ref_id?: string | null;
          amount?: number;
          balance_after?: number;
          occurred_at?: string;
          currency?: string;
          meta?: Json | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "trading_balance_ledger_balance_account_id_fkey";
            columns: ["balance_account_id"];
            referencedRelation: "balance_accounts";
            referencedColumns: ["id"];
          }
        ];
      };
      trading_daily_balance_snapshots: {
        Row: {
          id: string;
          balance_account_id: string;
          date: string;
          opening_balance: number;
          closing_balance: number;
          net_change: number;
          deposit_amount: number;
          withdraw_amount: number;
          transfer_in_amount: number;
          transfer_out_amount: number;
          trading_net_result: number;
          adjustment_amount: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          balance_account_id: string;
          date: string;
          opening_balance?: number;
          closing_balance?: number;
          net_change?: number;
          deposit_amount?: number;
          withdraw_amount?: number;
          transfer_in_amount?: number;
          transfer_out_amount?: number;
          trading_net_result?: number;
          adjustment_amount?: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          balance_account_id?: string;
          date?: string;
          opening_balance?: number;
          closing_balance?: number;
          net_change?: number;
          deposit_amount?: number;
          withdraw_amount?: number;
          transfer_in_amount?: number;
          transfer_out_amount?: number;
          trading_net_result?: number;
          adjustment_amount?: number;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "trading_daily_balance_snapshots_balance_account_id_fkey";
            columns: ["balance_account_id"];
            referencedRelation: "balance_accounts";
            referencedColumns: ["id"];
          }
        ];
      };
      trading_funding: {
        Row: {
          amount: number;
          balance_account_id: string | null;
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
          balance_account_id?: string | null;
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
          balance_account_id?: string | null;
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
          },
          {
            foreignKeyName: "trading_funding_balance_account_id_fkey";
            columns: ["balance_account_id"];
            referencedRelation: "balance_accounts";
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
          balance_account_id: string | null;
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
          balance_account_id?: string | null;
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
          balance_account_id?: string | null;
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
          },
          {
            foreignKeyName: "trading_orders_balance_account_id_fkey";
            columns: ["balance_account_id"];
            referencedRelation: "balance_accounts";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      balance_account_latest_balances: {
        Row: {
          balance_account_id: string | null;
          user_id: string | null;
          account_type: "TRADING" | "FUNDING" | null;
          name: string | null;
          currency: string | null;
          is_active: boolean | null;
          created_at: string | null;
          current_balance: number | null;
          balance_at: string | null;
        };
        Relationships: [];
      };
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
    Functions: {
      report_cashflow_summary: {
        Args: {
          p_user_id: string;
          p_start_time: string;
        };
        Returns: {
          total_income: number;
          total_expense: number;
          net_amount: number;
          transaction_count: number;
        };
      };
      report_trading_summary: {
        Args: {
          p_user_id: string;
          p_start_time: string;
        };
        Returns: {
          pnl_total: number;
          commission_total: number;
          swap_total: number;
          win_trades: number;
          loss_trades: number;
          neutral_trades: number;
          trade_count: number;
          average_pnl: number;
        };
      };
      report_funding_summary: {
        Args: {
          p_user_id: string;
          p_start_time: string;
        };
        Returns: {
          deposit_total: number;
          withdraw_total: number;
          net_amount: number;
          transaction_count: number;
        };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
