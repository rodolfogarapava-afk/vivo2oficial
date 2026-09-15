export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_tokens: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          note: string | null
          plan: string
          revoked: boolean
          updated_at: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          note?: string | null
          plan?: string
          revoked?: boolean
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          note?: string | null
          plan?: string
          revoked?: boolean
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      client_payments: {
        Row: {
          amount: number | null
          client_id: string
          created_at: string
          id: string
          month: string
          paid: boolean
          paid_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          client_id: string
          created_at?: string
          id?: string
          month: string
          paid?: boolean
          paid_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          client_id?: string
          created_at?: string
          id?: string
          month?: string
          paid?: boolean
          paid_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          account: number | null
          blocked: boolean
          bonus: boolean
          company: string
          created_at: string
          data_gb: number
          data_used_gb: number
          due_day: number | null
          id: string
          is_resale: boolean
          name: string
          phone: string
          user_id: string | null
          value_paid: number
          virtual_chip: boolean
          whatsapp: string | null
        }
        Insert: {
          account?: number | null
          blocked?: boolean
          bonus?: boolean
          company?: string
          created_at?: string
          data_gb?: number
          data_used_gb?: number
          due_day?: number | null
          id?: string
          is_resale?: boolean
          name: string
          phone: string
          user_id?: string | null
          value_paid: number
          virtual_chip?: boolean
          whatsapp?: string | null
        }
        Update: {
          account?: number | null
          blocked?: boolean
          bonus?: boolean
          company?: string
          created_at?: string
          data_gb?: number
          data_used_gb?: number
          due_day?: number | null
          id?: string
          is_resale?: boolean
          name?: string
          phone?: string
          user_id?: string | null
          value_paid?: number
          virtual_chip?: boolean
          whatsapp?: string | null
        }
        Relationships: []
      }
      panel_links: {
        Row: {
          created_at: string
          id: string
          owner_user_id: string
          partner_label: string
          partner_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_user_id: string
          partner_label?: string
          partner_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_user_id?: string
          partner_label?: string
          partner_user_id?: string
        }
        Relationships: []
      }
      panel_names: {
        Row: {
          created_at: string
          label: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          label: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          label?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          access_expires_at: string | null
          access_plan: string | null
          created_at: string
          fixed_expense: number | null
          id: string
          updated_at: string
          user_id: string
          whatsapp: string | null
          whatsapp_client_message: string | null
          whatsapp_show_card: boolean | null
        }
        Insert: {
          access_expires_at?: string | null
          access_plan?: string | null
          created_at?: string
          fixed_expense?: number | null
          id?: string
          updated_at?: string
          user_id: string
          whatsapp?: string | null
          whatsapp_client_message?: string | null
          whatsapp_show_card?: boolean | null
        }
        Update: {
          access_expires_at?: string | null
          access_plan?: string | null
          created_at?: string
          fixed_expense?: number | null
          id?: string
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
          whatsapp_client_message?: string | null
          whatsapp_show_card?: boolean | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_panel_client: {
        Args: {
          p_account?: number
          p_bonus?: boolean
          p_company?: string
          p_due_day?: number
          p_is_resale?: boolean
          p_name: string
          p_panel_user: string
          p_phone: string
          p_value: number
          p_virtual_chip?: boolean
          p_whatsapp?: string
        }
        Returns: {
          account: number | null
          blocked: boolean
          bonus: boolean
          company: string
          created_at: string
          data_gb: number
          data_used_gb: number
          due_day: number | null
          id: string
          is_resale: boolean
          name: string
          phone: string
          user_id: string | null
          value_paid: number
          virtual_chip: boolean
          whatsapp: string | null
        }
        SetofOptions: {
          from: "*"
          to: "clients"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      find_phone_across_panels: {
        Args: { p_phone: string }
        Returns: {
          client_name: string
          client_phone: string
          panel: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      list_panel_clients: {
        Args: { p_panel_user: string }
        Returns: {
          account: number | null
          blocked: boolean
          bonus: boolean
          company: string
          created_at: string
          data_gb: number
          data_used_gb: number
          due_day: number | null
          id: string
          is_resale: boolean
          name: string
          phone: string
          user_id: string | null
          value_paid: number
          virtual_chip: boolean
          whatsapp: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "clients"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
