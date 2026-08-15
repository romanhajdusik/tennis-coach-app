export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      drill_codes: {
        Row: {
          category: string
          coach_id: string | null
          code: string | null
          created_at: string
          id: string
          organization_id: string | null
          slot: number
          updated_at: string
        }
        Insert: {
          category: string
          coach_id?: string | null
          code?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          slot: number
          updated_at?: string
        }
        Update: {
          category?: string
          coach_id?: string | null
          code?: string | null
          created_at?: string
          id?: string
          organization_id?: string | null
          slot?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drill_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_connections: {
        Row: {
          access_token: string
          calendar_id: string
          coach_id: string
          created_at: string
          refresh_token: string
          token_expires_at: string
          updated_at: string
        }
        Insert: {
          access_token: string
          calendar_id?: string
          coach_id: string
          created_at?: string
          refresh_token: string
          token_expires_at: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          calendar_id?: string
          coach_id?: string
          created_at?: string
          refresh_token?: string
          token_expires_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      metrics_and_tests: {
        Row: {
          coach_id: string
          created_at: string
          discipline: string
          id: string
          notes: string | null
          organization_id: string | null
          player_id: string
          results: Json | null
          test_type: string
          tested_at: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          discipline?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          player_id: string
          results?: Json | null
          test_type: string
          tested_at?: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          discipline?: string
          id?: string
          notes?: string | null
          organization_id?: string | null
          player_id?: string
          results?: Json | null
          test_type?: string
          tested_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metrics_and_tests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metrics_and_tests_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          discipline: string
          id: string
          invite_code: string | null
          organization_id: string
          role: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          discipline?: string
          id?: string
          invite_code?: string | null
          organization_id: string
          role: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          discipline?: string
          id?: string
          invite_code?: string | null
          organization_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          seat_limit: number
          slug: string
          sport: string
          subscription_status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          seat_limit?: number
          slug: string
          sport?: string
          subscription_status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          seat_limit?: number
          slug?: string
          sport?: string
          subscription_status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      parent_session_drill_records: {
        Row: {
          category: string
          character: string | null
          drill_code: string | null
          duration_minutes: number
          id: string
          parent_record_id: string
          source_drill_id: string
          status: string
        }
        Insert: {
          category: string
          character?: string | null
          drill_code?: string | null
          duration_minutes: number
          id?: string
          parent_record_id: string
          source_drill_id: string
          status: string
        }
        Update: {
          category?: string
          character?: string | null
          drill_code?: string | null
          duration_minutes?: number
          id?: string
          parent_record_id?: string
          source_drill_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_session_drill_records_parent_record_id_fkey"
            columns: ["parent_record_id"]
            isOneToOne: false
            referencedRelation: "parent_session_records"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_session_records: {
        Row: {
          actual_data: Json | null
          coach_id: string
          id: string
          notes: string | null
          parent_id: string
          planned_data: Json | null
          source_session_id: string
          status: string
          synced_at: string
        }
        Insert: {
          actual_data?: Json | null
          coach_id: string
          id?: string
          notes?: string | null
          parent_id: string
          planned_data?: Json | null
          source_session_id: string
          status: string
          synced_at?: string
        }
        Update: {
          actual_data?: Json | null
          coach_id?: string
          id?: string
          notes?: string | null
          parent_id?: string
          planned_data?: Json | null
          source_session_id?: string
          status?: string
          synced_at?: string
        }
        Relationships: []
      }
      player_assignments: {
        Row: {
          coach_id: string
          created_at: string
          discipline: string
          id: string
          organization_id: string
          player_id: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          discipline: string
          id?: string
          organization_id: string
          player_id: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          discipline?: string
          id?: string
          organization_id?: string
          player_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_assignments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_connections: {
        Row: {
          coach_id: string
          connect_code: string
          connected_role: string | null
          created_at: string
          id: string
          parent_id: string | null
          player_id: string
          status: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          connect_code: string
          connected_role?: string | null
          created_at?: string
          id?: string
          parent_id?: string | null
          player_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          connect_code?: string
          connected_role?: string | null
          created_at?: string
          id?: string
          parent_id?: string | null
          player_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_connections_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_links: {
        Row: {
          created_at: string
          id: string
          link_code: string
          source_coach_id: string
          source_discipline: string
          source_player_id: string
          status: string
          target_coach_id: string | null
          target_player_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          link_code: string
          source_coach_id: string
          source_discipline: string
          source_player_id: string
          status?: string
          target_coach_id?: string | null
          target_player_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          link_code?: string
          source_coach_id?: string
          source_discipline?: string
          source_player_id?: string
          status?: string
          target_coach_id?: string | null
          target_player_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_links_source_player_id_fkey"
            columns: ["source_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_links_target_player_id_fkey"
            columns: ["target_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          birth_date: string | null
          birth_year: number | null
          coach_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          birth_year?: number | null
          coach_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          birth_year?: number | null
          coach_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          player_limit: number
          role: string
          subscription_status: string
          trial_ends_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          player_limit?: number
          role?: string
          subscription_status?: string
          trial_ends_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          player_limit?: number
          role?: string
          subscription_status?: string
          trial_ends_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      session_drills: {
        Row: {
          category: string
          character: string | null
          coach_id: string
          created_at: string
          drill_code: string | null
          duration_minutes: number
          id: string
          organization_id: string | null
          replaces_drill_id: string | null
          session_id: string
          sort_order: number
          status: string
        }
        Insert: {
          category: string
          character?: string | null
          coach_id: string
          created_at?: string
          drill_code?: string | null
          duration_minutes: number
          id?: string
          organization_id?: string | null
          replaces_drill_id?: string | null
          session_id: string
          sort_order: number
          status?: string
        }
        Update: {
          category?: string
          character?: string | null
          coach_id?: string
          created_at?: string
          drill_code?: string | null
          duration_minutes?: number
          id?: string
          organization_id?: string | null
          replaces_drill_id?: string | null
          session_id?: string
          sort_order?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_drills_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_drills_replaces_drill_id_fkey"
            columns: ["replaces_drill_id"]
            isOneToOne: false
            referencedRelation: "session_drills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_drills_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          actual_data: Json | null
          coach_id: string
          created_at: string
          discipline: string
          google_event_id: string | null
          id: string
          notes: string | null
          organization_id: string | null
          planned_data: Json | null
          player_id: string
          status: string
          updated_at: string
        }
        Insert: {
          actual_data?: Json | null
          coach_id: string
          created_at?: string
          discipline?: string
          google_event_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          planned_data?: Json | null
          player_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          actual_data?: Json | null
          coach_id?: string
          created_at?: string
          discipline?: string
          google_event_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string | null
          planned_data?: Json | null
          player_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_player_to_coach: {
        Args: { p_coach_id: string; p_player_id: string }
        Returns: undefined
      }
      claim_organization_invite: {
        Args: { p_code: string }
        Returns: {
          member_role: string
          organization_id: string
          organization_slug: string
        }[]
      }
      claim_player_connection: {
        Args: { p_code: string }
        Returns: {
          coach_id: string
          player_id: string
        }[]
      }
      claim_player_link: {
        Args: { p_code: string; p_discipline: string; p_player_id: string }
        Returns: string
      }
      copy_session_to_org_player: {
        Args: { p_session_id: string; p_target_player_id: string }
        Returns: string
      }
      current_org_discipline: { Args: never; Returns: string }
      current_org_id: { Args: never; Returns: string }
      current_org_role: { Args: never; Returns: string }
      delete_organization_member: {
        Args: { p_member_id: string }
        Returns: undefined
      }
      is_assigned_player: { Args: { p_player_id: string }; Returns: boolean }
      is_member_of_my_org: { Args: { p_user_id: string }; Returns: boolean }
      org_players_for_copy: {
        Args: never
        Returns: {
          coach_id: string
          coach_name: string
          id: string
          name: string
        }[]
      }
      organization_by_slug: {
        Args: { p_slug: string }
        Returns: {
          id: string
          name: string
          slug: string
          sport: string
        }[]
      }
      owns_personal_player: { Args: { p_player_id: string }; Returns: boolean }
      reads_linked_player: { Args: { p_player_id: string }; Returns: boolean }
      reads_linked_session: { Args: { p_session_id: string }; Returns: boolean }
      revoke_player_link: { Args: { p_link_id: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

