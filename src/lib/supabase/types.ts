export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      children: {
        Row: {
          birth_date: string
          birth_place: string
          created_at: string
          first_name: string
          id: string
          last_name: string
          pesel: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          birth_date: string
          birth_place: string
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          pesel: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          birth_date?: string
          birth_place?: string
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          pesel?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "children_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "family_map"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "children_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          consent_type: string
          granted: boolean
          granted_at: string
          id: string
          policy_version: string
          profile_id: string
          revoked_at: string | null
        }
        Insert: {
          consent_type: string
          granted?: boolean
          granted_at?: string
          id?: string
          policy_version: string
          profile_id: string
          revoked_at?: string | null
        }
        Update: {
          consent_type?: string
          granted?: boolean
          granted_at?: string
          id?: string
          policy_version?: string
          profile_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "family_map"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "consents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_children: {
        Row: {
          birth_date: string
          birth_place: string
          child_id: string
          city: string
          created_at: string
          enrollment_id: string
          first_name: string
          house_number: string
          id: string
          last_name: string
          pesel: string
          postal_code: string
          school_class: string
          street: string
          voivodeship: string
        }
        Insert: {
          birth_date: string
          birth_place: string
          child_id: string
          city: string
          created_at?: string
          enrollment_id: string
          first_name: string
          house_number: string
          id?: string
          last_name: string
          pesel: string
          postal_code: string
          school_class: string
          street: string
          voivodeship: string
        }
        Update: {
          birth_date?: string
          birth_place?: string
          child_id?: string
          city?: string
          created_at?: string
          enrollment_id?: string
          first_name?: string
          house_number?: string
          id?: string
          last_name?: string
          pesel?: string
          postal_code?: string
          school_class?: string
          street?: string
          voivodeship?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_children_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_children_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          parent_email: string
          parent_fb_link: string | null
          parent_first_name: string
          parent_last_name: string
          parent_phone: string
          parent_phone_country: string
          profile_id: string
          school_year: string
          status: Database["public"]["Enums"]["enrollment_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          parent_email: string
          parent_fb_link?: string | null
          parent_first_name: string
          parent_last_name: string
          parent_phone: string
          parent_phone_country?: string
          profile_id: string
          school_year: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          parent_email?: string
          parent_fb_link?: string | null
          parent_first_name?: string
          parent_last_name?: string
          parent_phone?: string
          parent_phone_country?: string
          profile_id?: string
          school_year?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "family_map"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "enrollments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      map_locations: {
        Row: {
          city: string
          created_at: string
          geo_status: "exact" | "approximate" | "failed"
          latitude: number | null
          longitude: number | null
          postal_code: string
          retry_after: string | null
          updated_at: string
          voivodeship: string
        }
        Insert: {
          city: string
          created_at?: string
          geo_status: "exact" | "approximate" | "failed"
          latitude?: number | null
          longitude?: number | null
          postal_code: string
          retry_after?: string | null
          updated_at?: string
          voivodeship: string
        }
        Update: {
          city?: string
          created_at?: string
          geo_status?: "exact" | "approximate" | "failed"
          latitude?: number | null
          longitude?: number | null
          postal_code?: string
          retry_after?: string | null
          updated_at?: string
          voivodeship?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_path: string | null
          children_ages: number[]
          city: string
          contact_email: string | null
          contact_fb: string | null
          contact_instagram: string | null
          contact_phone: string | null
          contact_phone_country: string
          created_at: string
          id: string
          interests: string[]
          map_visible: boolean
          num_children: number
          postal_code: string
          profile_name: string
          updated_at: string
          voivodeship: string
        }
        Insert: {
          avatar_path?: string | null
          children_ages?: number[]
          city?: string
          contact_email?: string | null
          contact_fb?: string | null
          contact_instagram?: string | null
          contact_phone?: string | null
          contact_phone_country?: string
          created_at?: string
          id: string
          interests?: string[]
          map_visible?: boolean
          num_children?: number
          postal_code?: string
          profile_name?: string
          updated_at?: string
          voivodeship?: string
        }
        Update: {
          avatar_path?: string | null
          children_ages?: number[]
          city?: string
          contact_email?: string | null
          contact_fb?: string | null
          contact_instagram?: string | null
          contact_phone?: string | null
          contact_phone_country?: string
          created_at?: string
          id?: string
          interests?: string[]
          map_visible?: boolean
          num_children?: number
          postal_code?: string
          profile_name?: string
          updated_at?: string
          voivodeship?: string
        }
        Relationships: []
      }
    }
    Views: {
      family_map: {
        Row: {
          avatar_path: string | null
          children_ages: number[] | null
          city: string | null
          contact_email: string | null
          contact_fb: string | null
          contact_instagram: string | null
          contact_phone: string | null
          geo_status: "exact" | "approximate" | "failed" | null
          interests: string[] | null
          latitude: number | null
          longitude: number | null
          marker_seed: number | null
          num_children: number | null
          postal_code: string | null
          profile_id: string | null
          profile_name: string | null
          updated_at: string | null
          voivodeship: string | null
        }
        Insert: {
          avatar_path?: string | null
          children_ages?: number[] | null
          city?: string | null
          contact_email?: string | null
          contact_fb?: string | null
          contact_instagram?: string | null
          contact_phone?: string | null
          geo_status?: "exact" | "approximate" | "failed" | null
          interests?: string[] | null
          latitude?: number | null
          longitude?: number | null
          marker_seed?: number | null
          num_children?: number | null
          postal_code?: string | null
          profile_id?: string | null
          profile_name?: string | null
          updated_at?: string | null
          voivodeship?: string | null
        }
        Update: {
          avatar_path?: string | null
          children_ages?: number[] | null
          city?: string | null
          contact_email?: string | null
          contact_fb?: string | null
          contact_instagram?: string | null
          contact_phone?: string | null
          geo_status?: "exact" | "approximate" | "failed" | null
          interests?: string[] | null
          latitude?: number | null
          longitude?: number | null
          marker_seed?: number | null
          num_children?: number | null
          postal_code?: string | null
          profile_id?: string | null
          profile_name?: string | null
          updated_at?: string | null
          voivodeship?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_child: { Args: { payload: Json }; Returns: string }
      admin_set_enrollment_status: {
        Args: { new_status: string; target_enrollment: string }
        Returns: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          parent_email: string
          parent_fb_link: string | null
          parent_first_name: string
          parent_last_name: string
          parent_phone: string
          parent_phone_country: string
          profile_id: string
          school_year: string
          status: Database["public"]["Enums"]["enrollment_status"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "enrollments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_role: {
        Args: { make_admin: boolean; target_user: string }
        Returns: undefined
      }
      complete_registration: { Args: { payload: Json }; Returns: string }
      create_enrollment: { Args: { payload: Json }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      purge_rejected_enrollments: { Args: never; Returns: number }
      set_map_visibility: { Args: { visible: boolean }; Returns: undefined }
    }
    Enums: {
      enrollment_status: "pending" | "accepted" | "rejected"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database
}
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (Database["public"]["Tables"] &
        Database["public"]["Views"])
    ? (Database["public"]["Tables"] &
        Database["public"]["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database
}
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database
}
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof Database
}
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof Database["public"]["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof Database
}
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof Database["public"]["CompositeTypes"]
    ? Database["public"]["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      enrollment_status: ["pending", "accepted", "rejected"],
    },
  },
} as const
