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
      assignor_proposals: {
        Row: {
          assignor_id: string
          expires_at: string | null
          fee_amount: number | null
          fee_pct: number | null
          fee_type: string | null
          id: string
          invited_at: string | null
          message: string | null
          responded_at: string | null
          status: string | null
          submitted_at: string | null
          tournament_id: string
        }
        Insert: {
          assignor_id: string
          expires_at?: string | null
          fee_amount?: number | null
          fee_pct?: number | null
          fee_type?: string | null
          id?: string
          invited_at?: string | null
          message?: string | null
          responded_at?: string | null
          status?: string | null
          submitted_at?: string | null
          tournament_id: string
        }
        Update: {
          assignor_id?: string
          expires_at?: string | null
          fee_amount?: number | null
          fee_pct?: number | null
          fee_type?: string | null
          id?: string
          invited_at?: string | null
          message?: string | null
          responded_at?: string | null
          status?: string | null
          submitted_at?: string | null
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignor_proposals_assignor_id_fkey"
            columns: ["assignor_id"]
            isOneToOne: false
            referencedRelation: "active_assignors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignor_proposals_assignor_id_fkey"
            columns: ["assignor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignor_proposals_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignor_rosters: {
        Row: {
          assignor_id: string
          id: string
          invited_at: string | null
          ref_id: string
          removed_at: string | null
          responded_at: string | null
          status: string | null
        }
        Insert: {
          assignor_id: string
          id?: string
          invited_at?: string | null
          ref_id: string
          removed_at?: string | null
          responded_at?: string | null
          status?: string | null
        }
        Update: {
          assignor_id?: string
          id?: string
          invited_at?: string | null
          ref_id?: string
          removed_at?: string | null
          responded_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignor_rosters_assignor_id_fkey"
            columns: ["assignor_id"]
            isOneToOne: false
            referencedRelation: "active_assignors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignor_rosters_assignor_id_fkey"
            columns: ["assignor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignor_rosters_ref_id_fkey"
            columns: ["ref_id"]
            isOneToOne: false
            referencedRelation: "active_assignors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignor_rosters_ref_id_fkey"
            columns: ["ref_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_prefs: {
        Row: {
          available_days: number | null
          max_games_per_day: number | null
          min_pay_per_day: number | null
          min_pay_per_game: number | null
          ref_id: string
          travel_radius_miles: number | null
          updated_at: string | null
        }
        Insert: {
          available_days?: number | null
          max_games_per_day?: number | null
          min_pay_per_day?: number | null
          min_pay_per_game?: number | null
          ref_id: string
          travel_radius_miles?: number | null
          updated_at?: string | null
        }
        Update: {
          available_days?: number | null
          max_games_per_day?: number | null
          min_pay_per_day?: number | null
          min_pay_per_game?: number | null
          ref_id?: string
          travel_radius_miles?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "availability_prefs_ref_id_fkey"
            columns: ["ref_id"]
            isOneToOne: true
            referencedRelation: "active_assignors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_prefs_ref_id_fkey"
            columns: ["ref_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cert_bodies: {
        Row: {
          display_name: string
          full_name: string | null
          id: string
          is_active: boolean | null
          sort_order: number | null
        }
        Insert: {
          display_name: string
          full_name?: string | null
          id: string
          is_active?: boolean | null
          sort_order?: number | null
        }
        Update: {
          display_name?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          sort_order?: number | null
        }
        Relationships: []
      }
      certifications: {
        Row: {
          created_at: string | null
          document_url: string | null
          expires_date: string | null
          id: string
          is_verified: boolean | null
          issued_date: string | null
          license_number: string | null
          org_name: string
          ref_id: string | null
        }
        Insert: {
          created_at?: string | null
          document_url?: string | null
          expires_date?: string | null
          id?: string
          is_verified?: boolean | null
          issued_date?: string | null
          license_number?: string | null
          org_name: string
          ref_id?: string | null
        }
        Update: {
          created_at?: string | null
          document_url?: string | null
          expires_date?: string | null
          id?: string
          is_verified?: boolean | null
          issued_date?: string | null
          license_number?: string | null
          org_name?: string
          ref_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certifications_ref_id_fkey"
            columns: ["ref_id"]
            isOneToOne: false
            referencedRelation: "active_assignors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certifications_ref_id_fkey"
            columns: ["ref_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          joined_at: string | null
          last_read_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          joined_at?: string | null
          last_read_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          joined_at?: string | null
          last_read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_assignors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          job_id: string | null
          kind: string
          last_message_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          job_id?: string | null
          kind?: string
          last_message_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          job_id?: string | null
          kind?: string
          last_message_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "active_assignors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      hirers: {
        Row: {
          city: string | null
          contact_first_name: string | null
          contact_last_initial: string | null
          created_at: string | null
          id: string
          is_verified: boolean | null
          org_name: string
          org_type: string
          state: string | null
          stripe_customer_id: string | null
          user_id: string | null
        }
        Insert: {
          city?: string | null
          contact_first_name?: string | null
          contact_last_initial?: string | null
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          org_name: string
          org_type: string
          state?: string | null
          stripe_customer_id?: string | null
          user_id?: string | null
        }
        Update: {
          city?: string | null
          contact_first_name?: string | null
          contact_last_initial?: string | null
          created_at?: string | null
          id?: string
          is_verified?: boolean | null
          org_name?: string
          org_type?: string
          state?: string | null
          stripe_customer_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      job_assignments: {
        Row: {
          amount_due: number | null
          applied_at: string | null
          id: string
          job_id: string | null
          offered_at: string | null
          offered_by: string | null
          paid_at: string | null
          payout_status: string | null
          ref_id: string | null
          responded_at: string | null
          role: string | null
          status: string | null
          stripe_transfer_id: string | null
          withdrawn_at: string | null
          withdrew_late: boolean | null
        }
        Insert: {
          amount_due?: number | null
          applied_at?: string | null
          id?: string
          job_id?: string | null
          offered_at?: string | null
          offered_by?: string | null
          paid_at?: string | null
          payout_status?: string | null
          ref_id?: string | null
          responded_at?: string | null
          role?: string | null
          status?: string | null
          stripe_transfer_id?: string | null
          withdrawn_at?: string | null
          withdrew_late?: boolean | null
        }
        Update: {
          amount_due?: number | null
          applied_at?: string | null
          id?: string
          job_id?: string | null
          offered_at?: string | null
          offered_by?: string | null
          paid_at?: string | null
          payout_status?: string | null
          ref_id?: string | null
          responded_at?: string | null
          role?: string | null
          status?: string | null
          stripe_transfer_id?: string | null
          withdrawn_at?: string | null
          withdrew_late?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "job_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_ref_id_fkey"
            columns: ["ref_id"]
            isOneToOne: false
            referencedRelation: "active_assignors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_ref_id_fkey"
            columns: ["ref_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          age_group: string | null
          arrival_notes: string | null
          assignor_staffing_mode: string | null
          auto_accept: boolean | null
          away_team: string | null
          cancelled_at: string | null
          closes_at: string | null
          completed_at: string | null
          court: string | null
          created_at: string | null
          crew_size: number | null
          duration_minutes: number | null
          ends_at: string | null
          featured_until: string | null
          game_format: string | null
          gender: string | null
          hirer_id: string | null
          hirer_note: string | null
          home_team: string | null
          id: string
          is_featured: boolean | null
          job_type: string | null
          last_payment_event_at: string | null
          level: string
          num_games: number | null
          parking_info: string | null
          pay_per_game: number
          pay_total: number | null
          payment_dispute_status: string
          payment_intent_id: string | null
          payment_issue_requires_review: boolean
          payment_refund_status: string
          payment_review_reason: string | null
          payment_status: string | null
          payout_window_hours: number | null
          period_minutes: number | null
          prepaid_at: string | null
          prepaid_crew_cents: number
          prepaid_fee_cents: number
          prepay_required: boolean
          refunded_amount_cents: number
          ruleset: string | null
          ruleset_modifications: string | null
          sport_id: string
          starts_at: string
          starts_local: string | null
          status: string | null
          stripe_charge_id: string | null
          stripe_dispute_id: string | null
          team_level: string | null
          timezone: string | null
          title: string
          tournament_id: string | null
          uniform_requirements: string | null
          updated_at: string | null
          venue_address: string | null
          venue_city: string
          venue_lat: number | null
          venue_lng: number | null
          venue_name: string
          venue_state: string
          venue_zip: string | null
        }
        Insert: {
          age_group?: string | null
          arrival_notes?: string | null
          assignor_staffing_mode?: string | null
          auto_accept?: boolean | null
          away_team?: string | null
          cancelled_at?: string | null
          closes_at?: string | null
          completed_at?: string | null
          court?: string | null
          created_at?: string | null
          crew_size?: number | null
          duration_minutes?: number | null
          ends_at?: string | null
          featured_until?: string | null
          game_format?: string | null
          gender?: string | null
          hirer_id?: string | null
          hirer_note?: string | null
          home_team?: string | null
          id?: string
          is_featured?: boolean | null
          job_type?: string | null
          last_payment_event_at?: string | null
          level: string
          num_games?: number | null
          parking_info?: string | null
          pay_per_game: number
          pay_total?: number | null
          payment_dispute_status?: string
          payment_intent_id?: string | null
          payment_issue_requires_review?: boolean
          payment_refund_status?: string
          payment_review_reason?: string | null
          payment_status?: string | null
          payout_window_hours?: number | null
          period_minutes?: number | null
          prepaid_at?: string | null
          prepaid_crew_cents?: number
          prepaid_fee_cents?: number
          prepay_required?: boolean
          refunded_amount_cents?: number
          ruleset?: string | null
          ruleset_modifications?: string | null
          sport_id: string
          starts_at: string
          starts_local?: string | null
          status?: string | null
          stripe_charge_id?: string | null
          stripe_dispute_id?: string | null
          team_level?: string | null
          timezone?: string | null
          title: string
          tournament_id?: string | null
          uniform_requirements?: string | null
          updated_at?: string | null
          venue_address?: string | null
          venue_city: string
          venue_lat?: number | null
          venue_lng?: number | null
          venue_name: string
          venue_state: string
          venue_zip?: string | null
        }
        Update: {
          age_group?: string | null
          arrival_notes?: string | null
          assignor_staffing_mode?: string | null
          auto_accept?: boolean | null
          away_team?: string | null
          cancelled_at?: string | null
          closes_at?: string | null
          completed_at?: string | null
          court?: string | null
          created_at?: string | null
          crew_size?: number | null
          duration_minutes?: number | null
          ends_at?: string | null
          featured_until?: string | null
          game_format?: string | null
          gender?: string | null
          hirer_id?: string | null
          hirer_note?: string | null
          home_team?: string | null
          id?: string
          is_featured?: boolean | null
          job_type?: string | null
          last_payment_event_at?: string | null
          level?: string
          num_games?: number | null
          parking_info?: string | null
          pay_per_game?: number
          pay_total?: number | null
          payment_dispute_status?: string
          payment_intent_id?: string | null
          payment_issue_requires_review?: boolean
          payment_refund_status?: string
          payment_review_reason?: string | null
          payment_status?: string | null
          payout_window_hours?: number | null
          period_minutes?: number | null
          prepaid_at?: string | null
          prepaid_crew_cents?: number
          prepaid_fee_cents?: number
          prepay_required?: boolean
          refunded_amount_cents?: number
          ruleset?: string | null
          ruleset_modifications?: string | null
          sport_id?: string
          starts_at?: string
          starts_local?: string | null
          status?: string | null
          stripe_charge_id?: string | null
          stripe_dispute_id?: string | null
          team_level?: string | null
          timezone?: string | null
          title?: string
          tournament_id?: string | null
          uniform_requirements?: string | null
          updated_at?: string | null
          venue_address?: string | null
          venue_city?: string
          venue_lat?: number | null
          venue_lng?: number | null
          venue_name?: string
          venue_state?: string
          venue_zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_hirer_id_fkey"
            columns: ["hirer_id"]
            isOneToOne: false
            referencedRelation: "hirers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          display_name: string
          id: string
          sort_order: number | null
          tier: string
        }
        Insert: {
          display_name: string
          id: string
          sort_order?: number | null
          tier: string
        }
        Update: {
          display_name?: string
          id?: string
          sort_order?: number | null
          tier?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string | null
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string | null
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "active_assignors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      private_profiles: {
        Row: {
          background_check_completed_at: string | null
          background_check_expires_at: string | null
          background_check_id: string | null
          background_check_provider: string | null
          background_check_status: string | null
          city: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          id: string
          identity_verified_at: string | null
          legal_first_name: string | null
          legal_last_name: string | null
          persona_inquiry_id: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          street_address: string | null
          stripe_account_id: string | null
          stripe_account_status: string | null
          updated_at: string | null
        }
        Insert: {
          background_check_completed_at?: string | null
          background_check_expires_at?: string | null
          background_check_id?: string | null
          background_check_provider?: string | null
          background_check_status?: string | null
          city?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          id: string
          identity_verified_at?: string | null
          legal_first_name?: string | null
          legal_last_name?: string | null
          persona_inquiry_id?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          street_address?: string | null
          stripe_account_id?: string | null
          stripe_account_status?: string | null
          updated_at?: string | null
        }
        Update: {
          background_check_completed_at?: string | null
          background_check_expires_at?: string | null
          background_check_id?: string | null
          background_check_provider?: string | null
          background_check_status?: string | null
          city?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          id?: string
          identity_verified_at?: string | null
          legal_first_name?: string | null
          legal_last_name?: string | null
          persona_inquiry_id?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          street_address?: string | null
          stripe_account_id?: string | null
          stripe_account_status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          avg_days_to_fill: number | null
          city: string
          created_at: string | null
          display_name: string | null
          events_assigned: number | null
          fill_rate_pct: number | null
          first_name: string
          games_called_total: number | null
          home_lat: number | null
          home_lng: number | null
          id: string
          is_active: boolean | null
          is_available: boolean | null
          is_pro_assignor: boolean | null
          is_verified: boolean | null
          last_initial: string
          member_since: string | null
          primary_role: string | null
          rating: number | null
          rating_count: number | null
          ref_id_number: number
          show_rate_pct: number | null
          state: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          avg_days_to_fill?: number | null
          city: string
          created_at?: string | null
          display_name?: string | null
          events_assigned?: number | null
          fill_rate_pct?: number | null
          first_name: string
          games_called_total?: number | null
          home_lat?: number | null
          home_lng?: number | null
          id: string
          is_active?: boolean | null
          is_available?: boolean | null
          is_pro_assignor?: boolean | null
          is_verified?: boolean | null
          last_initial: string
          member_since?: string | null
          primary_role?: string | null
          rating?: number | null
          rating_count?: number | null
          ref_id_number?: number
          show_rate_pct?: number | null
          state: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          avg_days_to_fill?: number | null
          city?: string
          created_at?: string | null
          display_name?: string | null
          events_assigned?: number | null
          fill_rate_pct?: number | null
          first_name?: string
          games_called_total?: number | null
          home_lat?: number | null
          home_lng?: number | null
          id?: string
          is_active?: boolean | null
          is_available?: boolean | null
          is_pro_assignor?: boolean | null
          is_verified?: boolean | null
          last_initial?: string
          member_since?: string | null
          primary_role?: string | null
          rating?: number | null
          rating_count?: number | null
          ref_id_number?: number
          show_rate_pct?: number | null
          state?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          platform: string | null
          token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          platform?: string | null
          token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          platform?: string | null
          token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_assignors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string | null
          game_management: number | null
          hirer_id: string | null
          id: string
          job_id: string | null
          on_time: number | null
          professionalism: number | null
          rating: number | null
          ref_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          game_management?: number | null
          hirer_id?: string | null
          id?: string
          job_id?: string | null
          on_time?: number | null
          professionalism?: number | null
          rating?: number | null
          ref_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          game_management?: number | null
          hirer_id?: string | null
          id?: string
          job_id?: string | null
          on_time?: number | null
          professionalism?: number | null
          rating?: number | null
          ref_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_hirer_id_fkey"
            columns: ["hirer_id"]
            isOneToOne: false
            referencedRelation: "hirers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_ref_id_fkey"
            columns: ["ref_id"]
            isOneToOne: false
            referencedRelation: "active_assignors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_ref_id_fkey"
            columns: ["ref_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ref_levels: {
        Row: {
          level_id: string
          ref_id: string
          years_experience: number | null
        }
        Insert: {
          level_id: string
          ref_id: string
          years_experience?: number | null
        }
        Update: {
          level_id?: string
          ref_id?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ref_levels_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ref_levels_ref_id_fkey"
            columns: ["ref_id"]
            isOneToOne: false
            referencedRelation: "active_assignors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ref_levels_ref_id_fkey"
            columns: ["ref_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ref_sports: {
        Row: {
          ref_id: string
          sport_id: string
          years_experience: number | null
        }
        Insert: {
          ref_id: string
          sport_id: string
          years_experience?: number | null
        }
        Update: {
          ref_id?: string
          sport_id?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ref_sports_ref_id_fkey"
            columns: ["ref_id"]
            isOneToOne: false
            referencedRelation: "active_assignors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ref_sports_ref_id_fkey"
            columns: ["ref_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ref_sports_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      sports: {
        Row: {
          display_name: string
          id: string
          is_active: boolean | null
          launch_order: number | null
        }
        Insert: {
          display_name: string
          id: string
          is_active?: boolean | null
          launch_order?: number | null
        }
        Update: {
          display_name?: string
          id?: string
          is_active?: boolean | null
          launch_order?: number | null
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          attempts: number
          error: string | null
          event_id: string
          event_type: string
          livemode: boolean
          processed_at: string | null
          received_at: string
          status: string
        }
        Insert: {
          attempts?: number
          error?: string | null
          event_id: string
          event_type: string
          livemode?: boolean
          processed_at?: string | null
          received_at?: string
          status?: string
        }
        Update: {
          attempts?: number
          error?: string | null
          event_id?: string
          event_type?: string
          livemode?: boolean
          processed_at?: string | null
          received_at?: string
          status?: string
        }
        Relationships: []
      }
      tournaments: {
        Row: {
          age_groups: string[] | null
          arrival_notes: string | null
          assignor_fee: number | null
          assignor_fee_pct: number | null
          assignor_fee_type: string | null
          assignor_id: string | null
          assignor_proposal_message: string | null
          assignor_status: string | null
          courts: string[]
          created_at: string | null
          description: string | null
          ends_on: string
          game_format: string | null
          hirer_id: string
          id: string
          levels: string[] | null
          name: string
          pay_per_game: number | null
          period_minutes: number | null
          platform_fee_pct: number | null
          ruleset: string | null
          ruleset_modifications: string | null
          sport_id: string
          staffing_model: string | null
          starts_on: string
          status: string | null
          timezone: string
          total_games: number | null
          total_ref_budget: number | null
          uniform_requirements: string | null
          updated_at: string | null
          venue_address: string | null
          venue_city: string
          venue_lat: number | null
          venue_lng: number | null
          venue_name: string | null
          venue_state: string
          venue_zip: string | null
        }
        Insert: {
          age_groups?: string[] | null
          arrival_notes?: string | null
          assignor_fee?: number | null
          assignor_fee_pct?: number | null
          assignor_fee_type?: string | null
          assignor_id?: string | null
          assignor_proposal_message?: string | null
          assignor_status?: string | null
          courts?: string[]
          created_at?: string | null
          description?: string | null
          ends_on: string
          game_format?: string | null
          hirer_id: string
          id?: string
          levels?: string[] | null
          name: string
          pay_per_game?: number | null
          period_minutes?: number | null
          platform_fee_pct?: number | null
          ruleset?: string | null
          ruleset_modifications?: string | null
          sport_id: string
          staffing_model?: string | null
          starts_on: string
          status?: string | null
          timezone: string
          total_games?: number | null
          total_ref_budget?: number | null
          uniform_requirements?: string | null
          updated_at?: string | null
          venue_address?: string | null
          venue_city: string
          venue_lat?: number | null
          venue_lng?: number | null
          venue_name?: string | null
          venue_state: string
          venue_zip?: string | null
        }
        Update: {
          age_groups?: string[] | null
          arrival_notes?: string | null
          assignor_fee?: number | null
          assignor_fee_pct?: number | null
          assignor_fee_type?: string | null
          assignor_id?: string | null
          assignor_proposal_message?: string | null
          assignor_status?: string | null
          courts?: string[]
          created_at?: string | null
          description?: string | null
          ends_on?: string
          game_format?: string | null
          hirer_id?: string
          id?: string
          levels?: string[] | null
          name?: string
          pay_per_game?: number | null
          period_minutes?: number | null
          platform_fee_pct?: number | null
          ruleset?: string | null
          ruleset_modifications?: string | null
          sport_id?: string
          staffing_model?: string | null
          starts_on?: string
          status?: string | null
          timezone?: string
          total_games?: number | null
          total_ref_budget?: number | null
          uniform_requirements?: string | null
          updated_at?: string | null
          venue_address?: string | null
          venue_city?: string
          venue_lat?: number | null
          venue_lng?: number | null
          venue_name?: string | null
          venue_state?: string
          venue_zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_assignor_id_fkey"
            columns: ["assignor_id"]
            isOneToOne: false
            referencedRelation: "active_assignors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_assignor_id_fkey"
            columns: ["assignor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_hirer_id_fkey"
            columns: ["hirer_id"]
            isOneToOne: false
            referencedRelation: "hirers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          added_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          added_at?: string | null
          role: string
          user_id: string
        }
        Update: {
          added_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_assignors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_assignors: {
        Row: {
          avatar_url: string | null
          avg_days_to_fill: number | null
          city: string | null
          display_name: string | null
          events_assigned: number | null
          fill_rate_pct: number | null
          id: string | null
          is_pro_assignor: boolean | null
          rating: number | null
          rating_count: number | null
          state: string | null
        }
        Insert: {
          avatar_url?: string | null
          avg_days_to_fill?: number | null
          city?: string | null
          display_name?: string | null
          events_assigned?: number | null
          fill_rate_pct?: number | null
          id?: string | null
          is_pro_assignor?: boolean | null
          rating?: number | null
          rating_count?: number | null
          state?: string | null
        }
        Update: {
          avatar_url?: string | null
          avg_days_to_fill?: number | null
          city?: string | null
          display_name?: string | null
          events_assigned?: number | null
          fill_rate_pct?: number | null
          id?: string | null
          is_pro_assignor?: boolean | null
          rating?: number | null
          rating_count?: number | null
          state?: string | null
        }
        Relationships: []
      }
      assignor_roster_members: {
        Row: {
          assignor_id: string | null
          avatar_url: string | null
          city: string | null
          display_name: string | null
          first_name: string | null
          invited_at: string | null
          is_available: boolean | null
          last_initial: string | null
          rating: number | null
          rating_count: number | null
          ref_id: string | null
          responded_at: string | null
          roster_id: string | null
          state: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignor_rosters_assignor_id_fkey"
            columns: ["assignor_id"]
            isOneToOne: false
            referencedRelation: "active_assignors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignor_rosters_assignor_id_fkey"
            columns: ["assignor_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignor_rosters_ref_id_fkey"
            columns: ["ref_id"]
            isOneToOne: false
            referencedRelation: "active_assignors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignor_rosters_ref_id_fkey"
            columns: ["ref_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_send_to_conversation: {
        Args: { p_conversation_id: string; p_sender_id: string }
        Returns: boolean
      }
      cancel_game: { Args: { p_job_id: string }; Returns: Json }
      complete_game: { Args: { p_job_id: string }; Returns: Json }
      director_invite_assignor: {
        Args: {
          p_assignor_id: string
          p_fee_amount?: number
          p_fee_pct?: number
          p_fee_type?: string
          p_tournament_id: string
        }
        Returns: string
      }
      director_respond_to_application: {
        Args: { p_accept: boolean; p_job_id: string; p_ref_id: string }
        Returns: string
      }
      director_respond_to_assignor_proposal: {
        Args: { p_accept: boolean; p_proposal_id: string }
        Returns: string
      }
      get_crew_thread: { Args: { p_job_id: string }; Returns: Json }
      get_or_create_crew_thread: { Args: { p_job_id: string }; Returns: string }
      import_tournament_schedule: {
        Args: { p_games: Json; p_tournament_id: string }
        Returns: Json
      }
      invite_existing_ref_to_roster: {
        Args: { p_ref_id: string }
        Returns: string
      }
      invoke_run_payouts: { Args: never; Returns: undefined }
      is_accepted_crew_member: {
        Args: { p_job_id: string; p_user_id: string }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: boolean
      }
      offer_ref_to_game: {
        Args: { p_job_id: string; p_ref_id: string; p_role?: string }
        Returns: string
      }
      post_crew_note: {
        Args: { p_body: string; p_job_id: string }
        Returns: string
      }
      remove_ref_from_assignor_game: {
        Args: { p_assignment_id: string }
        Returns: undefined
      }
      remove_ref_from_roster: {
        Args: { p_roster_id: string }
        Returns: undefined
      }
      respond_to_job: {
        Args: { p_accept: boolean; p_job_id: string }
        Returns: string
      }
      respond_to_roster_invite: {
        Args: { p_accept: boolean; p_roster_id: string }
        Returns: string
      }
      set_assignor_staffing_mode: {
        Args: { p_job_id: string; p_mode: string }
        Returns: string
      }
      submit_assignor_proposal: {
        Args: {
          p_fee_amount?: number
          p_fee_pct?: number
          p_fee_type: string
          p_message?: string
          p_tournament_id: string
        }
        Returns: string
      }
      sweep_game_lifecycle: { Args: never; Returns: undefined }
      tz_for_region: { Args: { p_state: string }; Returns: string }
      withdraw_assignor_proposal: {
        Args: { p_tournament_id: string }
        Returns: string
      }
      withdraw_from_job: { Args: { p_job_id: string }; Returns: Json }
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
    Enums: {},
  },
} as const

