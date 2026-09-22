export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      analytics_events: {
        Row: {
          created_at: string;
          event_name: string;
          id: string;
          properties: Json;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          event_name: string;
          id?: string;
          properties?: Json;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          event_name?: string;
          id?: string;
          properties?: Json;
          user_id?: string | null;
        };
        Relationships: [];
      };
      applications: {
        Row: {
          applied_at: string | null;
          company: string;
          created_at: string;
          id: string;
          job_id: string | null;
          location: string | null;
          notes: string | null;
          role: string;
          salary: string | null;
          status: Database["public"]["Enums"]["application_status"];
          updated_at: string;
          url: string | null;
          user_id: string;
        };
        Insert: {
          applied_at?: string | null;
          company: string;
          created_at?: string;
          id?: string;
          job_id?: string | null;
          location?: string | null;
          notes?: string | null;
          role: string;
          salary?: string | null;
          status?: Database["public"]["Enums"]["application_status"];
          updated_at?: string;
          url?: string | null;
          user_id: string;
        };
        Update: {
          applied_at?: string | null;
          company?: string;
          created_at?: string;
          id?: string;
          job_id?: string | null;
          location?: string | null;
          notes?: string | null;
          role?: string;
          salary?: string | null;
          status?: Database["public"]["Enums"]["application_status"];
          updated_at?: string;
          url?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_messages: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          message: string;
          name: string;
          status: string;
          subject: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          message: string;
          name: string;
          status?: string;
          subject?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          message?: string;
          name?: string;
          status?: string;
          subject?: string | null;
        };
        Relationships: [];
      };
      assessment_attempts: {
        Row: {
          answers: Json;
          assessment_id: string;
          created_at: string;
          id: string;
          resulting_level: Database["public"]["Enums"]["proficiency_level"] | null;
          score: number;
          total_questions: number;
          user_id: string;
        };
        Insert: {
          answers?: Json;
          assessment_id: string;
          created_at?: string;
          id?: string;
          resulting_level?: Database["public"]["Enums"]["proficiency_level"] | null;
          score: number;
          total_questions: number;
          user_id: string;
        };
        Update: {
          answers?: Json;
          assessment_id?: string;
          created_at?: string;
          id?: string;
          resulting_level?: Database["public"]["Enums"]["proficiency_level"] | null;
          score?: number;
          total_questions?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_attempts_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "assessments";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_questions: {
        Row: {
          assessment_id: string;
          correct_index: number;
          explanation: string | null;
          id: string;
          options: string[];
          prompt: string;
          sort_order: number;
        };
        Insert: {
          assessment_id: string;
          correct_index: number;
          explanation?: string | null;
          id?: string;
          options: string[];
          prompt: string;
          sort_order?: number;
        };
        Update: {
          assessment_id?: string;
          correct_index?: number;
          explanation?: string | null;
          id?: string;
          options?: string[];
          prompt?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_questions_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "assessments";
            referencedColumns: ["id"];
          },
        ];
      };
      assessments: {
        Row: {
          created_at: string;
          description: string | null;
          difficulty: Database["public"]["Enums"]["difficulty_level"];
          id: string;
          pass_score: number;
          skill_id: string | null;
          slug: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          difficulty?: Database["public"]["Enums"]["difficulty_level"];
          id?: string;
          pass_score?: number;
          skill_id?: string | null;
          slug: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          difficulty?: Database["public"]["Enums"]["difficulty_level"];
          id?: string;
          pass_score?: number;
          skill_id?: string | null;
          slug?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessments_skill_id_fkey";
            columns: ["skill_id"];
            isOneToOne: false;
            referencedRelation: "skills";
            referencedColumns: ["id"];
          },
        ];
      };
      career_skills: {
        Row: {
          career_id: string;
          created_at: string;
          demand_percentage: number | null;
          id: string;
          importance: Database["public"]["Enums"]["skill_importance"];
          required_level: Database["public"]["Enums"]["proficiency_level"];
          skill_id: string;
          sort_order: number;
        };
        Insert: {
          career_id: string;
          created_at?: string;
          demand_percentage?: number | null;
          id?: string;
          importance?: Database["public"]["Enums"]["skill_importance"];
          required_level?: Database["public"]["Enums"]["proficiency_level"];
          skill_id: string;
          sort_order?: number;
        };
        Update: {
          career_id?: string;
          created_at?: string;
          demand_percentage?: number | null;
          id?: string;
          importance?: Database["public"]["Enums"]["skill_importance"];
          required_level?: Database["public"]["Enums"]["proficiency_level"];
          skill_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "career_skills_career_id_fkey";
            columns: ["career_id"];
            isOneToOne: false;
            referencedRelation: "careers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "career_skills_skill_id_fkey";
            columns: ["skill_id"];
            isOneToOne: false;
            referencedRelation: "skills";
            referencedColumns: ["id"];
          },
        ];
      };
      careers: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          salary_currency: string | null;
          seo_description: string | null;
          seo_title: string | null;
          short_description: string | null;
          slug: string;
          title: string;
          typical_salary_max: number | null;
          typical_salary_min: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          salary_currency?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          short_description?: string | null;
          slug: string;
          title: string;
          typical_salary_max?: number | null;
          typical_salary_min?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          salary_currency?: string | null;
          seo_description?: string | null;
          seo_title?: string | null;
          short_description?: string | null;
          slug?: string;
          title?: string;
          typical_salary_max?: number | null;
          typical_salary_min?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      job_matches: {
        Row: {
          created_at: string;
          education_score: number;
          experience_score: number;
          id: string;
          job_id: string;
          location_score: number;
          matched_skill_ids: string[];
          missing_skill_ids: string[];
          overall_score: number;
          salary_score: number;
          skills_score: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          education_score: number;
          experience_score: number;
          id?: string;
          job_id: string;
          location_score: number;
          matched_skill_ids?: string[];
          missing_skill_ids?: string[];
          overall_score: number;
          salary_score: number;
          skills_score: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          education_score?: number;
          experience_score?: number;
          id?: string;
          job_id?: string;
          location_score?: number;
          matched_skill_ids?: string[];
          missing_skill_ids?: string[];
          overall_score?: number;
          salary_score?: number;
          skills_score?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_matches_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      job_skills: {
        Row: {
          id: string;
          is_required: boolean;
          job_id: string;
          raw_text: string | null;
          skill_id: string;
        };
        Insert: {
          id?: string;
          is_required?: boolean;
          job_id: string;
          raw_text?: string | null;
          skill_id: string;
        };
        Update: {
          id?: string;
          is_required?: boolean;
          job_id?: string;
          raw_text?: string | null;
          skill_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_skills_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_skills_skill_id_fkey";
            columns: ["skill_id"];
            isOneToOne: false;
            referencedRelation: "skills";
            referencedColumns: ["id"];
          },
        ];
      };
      job_sources: {
        Row: {
          adapter: string;
          base_url: string | null;
          created_at: string;
          id: string;
          is_demo: boolean;
          is_enabled: boolean;
          last_synced_at: string | null;
          name: string;
          notes: string | null;
          slug: string;
          updated_at: string;
        };
        Insert: {
          adapter?: string;
          base_url?: string | null;
          created_at?: string;
          id?: string;
          is_demo?: boolean;
          is_enabled?: boolean;
          last_synced_at?: string | null;
          name: string;
          notes?: string | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          adapter?: string;
          base_url?: string | null;
          created_at?: string;
          id?: string;
          is_demo?: boolean;
          is_enabled?: boolean;
          last_synced_at?: string | null;
          name?: string;
          notes?: string | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          career_id: string | null;
          company: string;
          country: string | null;
          created_at: string;
          description: string | null;
          education_requirement: Database["public"]["Enums"]["education_level"] | null;
          experience_years_min: number | null;
          external_id: string | null;
          id: string;
          is_demo: boolean;
          location: string | null;
          posted_at: string | null;
          retrieved_at: string;
          salary_currency: string | null;
          salary_max: number | null;
          salary_min: number | null;
          source_id: string | null;
          source_url: string | null;
          title: string;
          updated_at: string;
          work_mode: Database["public"]["Enums"]["work_mode"] | null;
        };
        Insert: {
          career_id?: string | null;
          company: string;
          country?: string | null;
          created_at?: string;
          description?: string | null;
          education_requirement?: Database["public"]["Enums"]["education_level"] | null;
          experience_years_min?: number | null;
          external_id?: string | null;
          id?: string;
          is_demo?: boolean;
          location?: string | null;
          posted_at?: string | null;
          retrieved_at?: string;
          salary_currency?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          source_id?: string | null;
          source_url?: string | null;
          title: string;
          updated_at?: string;
          work_mode?: Database["public"]["Enums"]["work_mode"] | null;
        };
        Update: {
          career_id?: string | null;
          company?: string;
          country?: string | null;
          created_at?: string;
          description?: string | null;
          education_requirement?: Database["public"]["Enums"]["education_level"] | null;
          experience_years_min?: number | null;
          external_id?: string | null;
          id?: string;
          is_demo?: boolean;
          location?: string | null;
          posted_at?: string | null;
          retrieved_at?: string;
          salary_currency?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          source_id?: string | null;
          source_url?: string | null;
          title?: string;
          updated_at?: string;
          work_mode?: Database["public"]["Enums"]["work_mode"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_career_id_fkey";
            columns: ["career_id"];
            isOneToOne: false;
            referencedRelation: "careers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "job_sources";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          category: string;
          created_at: string;
          id: string;
          is_read: boolean;
          link: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          category?: string;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          link?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          category?: string;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          link?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          career_id: string | null;
          city: string | null;
          country: string | null;
          created_at: string;
          degree: string | null;
          education_level: Database["public"]["Enums"]["education_level"] | null;
          email: string | null;
          experience: Database["public"]["Enums"]["experience_level"] | null;
          field_of_study: string | null;
          full_name: string | null;
          graduation_year: number | null;
          hours_per_week: number | null;
          id: string;
          learning_style: string | null;
          onboarding_completed: boolean;
          plan: Database["public"]["Enums"]["plan_tier"];
          plan_source: string;
          plan_updated_at: string | null;
          plan_updated_by: string | null;
          salary_currency: string | null;
          salary_min: number | null;
          salary_target: number | null;
          target_role: string | null;
          updated_at: string;
          work_mode: Database["public"]["Enums"]["work_mode"] | null;
        };
        Insert: {
          avatar_url?: string | null;
          career_id?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          degree?: string | null;
          education_level?: Database["public"]["Enums"]["education_level"] | null;
          email?: string | null;
          experience?: Database["public"]["Enums"]["experience_level"] | null;
          field_of_study?: string | null;
          full_name?: string | null;
          graduation_year?: number | null;
          hours_per_week?: number | null;
          id: string;
          learning_style?: string | null;
          onboarding_completed?: boolean;
          plan?: Database["public"]["Enums"]["plan_tier"];
          plan_source?: string;
          plan_updated_at?: string | null;
          plan_updated_by?: string | null;
          salary_currency?: string | null;
          salary_min?: number | null;
          salary_target?: number | null;
          target_role?: string | null;
          updated_at?: string;
          work_mode?: Database["public"]["Enums"]["work_mode"] | null;
        };
        Update: {
          avatar_url?: string | null;
          career_id?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          degree?: string | null;
          education_level?: Database["public"]["Enums"]["education_level"] | null;
          email?: string | null;
          experience?: Database["public"]["Enums"]["experience_level"] | null;
          field_of_study?: string | null;
          full_name?: string | null;
          graduation_year?: number | null;
          hours_per_week?: number | null;
          id?: string;
          learning_style?: string | null;
          onboarding_completed?: boolean;
          plan?: Database["public"]["Enums"]["plan_tier"];
          plan_source?: string;
          plan_updated_at?: string | null;
          plan_updated_by?: string | null;
          salary_currency?: string | null;
          salary_min?: number | null;
          salary_target?: number | null;
          target_role?: string | null;
          updated_at?: string;
          work_mode?: Database["public"]["Enums"]["work_mode"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_career_fk";
            columns: ["career_id"];
            isOneToOne: false;
            referencedRelation: "careers";
            referencedColumns: ["id"];
          },
        ];
      };
      progress_events: {
        Row: {
          created_at: string;
          event_type: string;
          id: string;
          label: string | null;
          metadata: Json;
          readiness_score: number | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_type: string;
          id?: string;
          label?: string | null;
          metadata?: Json;
          readiness_score?: number | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_type?: string;
          id?: string;
          label?: string | null;
          metadata?: Json;
          readiness_score?: number | null;
          user_id?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          career_id: string | null;
          created_at: string;
          dataset_suggestion: string | null;
          difficulty: Database["public"]["Enums"]["difficulty_level"];
          estimated_hours: number;
          expected_output: string | null;
          id: string;
          readme_outline: string[];
          requirements: string[];
          resume_bullet: string | null;
          skills: string[];
          slug: string;
          summary: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          career_id?: string | null;
          created_at?: string;
          dataset_suggestion?: string | null;
          difficulty?: Database["public"]["Enums"]["difficulty_level"];
          estimated_hours?: number;
          expected_output?: string | null;
          id?: string;
          readme_outline?: string[];
          requirements?: string[];
          resume_bullet?: string | null;
          skills?: string[];
          slug: string;
          summary?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          career_id?: string | null;
          created_at?: string;
          dataset_suggestion?: string | null;
          difficulty?: Database["public"]["Enums"]["difficulty_level"];
          estimated_hours?: number;
          expected_output?: string | null;
          id?: string;
          readme_outline?: string[];
          requirements?: string[];
          resume_bullet?: string | null;
          skills?: string[];
          slug?: string;
          summary?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_career_id_fkey";
            columns: ["career_id"];
            isOneToOne: false;
            referencedRelation: "careers";
            referencedColumns: ["id"];
          },
        ];
      };
      resources: {
        Row: {
          career_id: string | null;
          created_at: string;
          description: string | null;
          estimated_hours: number | null;
          id: string;
          is_free: boolean;
          provider: string | null;
          skill_id: string | null;
          title: string;
          type: Database["public"]["Enums"]["resource_type"];
          updated_at: string;
          url: string;
        };
        Insert: {
          career_id?: string | null;
          created_at?: string;
          description?: string | null;
          estimated_hours?: number | null;
          id?: string;
          is_free?: boolean;
          provider?: string | null;
          skill_id?: string | null;
          title: string;
          type?: Database["public"]["Enums"]["resource_type"];
          updated_at?: string;
          url: string;
        };
        Update: {
          career_id?: string | null;
          created_at?: string;
          description?: string | null;
          estimated_hours?: number | null;
          id?: string;
          is_free?: boolean;
          provider?: string | null;
          skill_id?: string | null;
          title?: string;
          type?: Database["public"]["Enums"]["resource_type"];
          updated_at?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "resources_career_id_fkey";
            columns: ["career_id"];
            isOneToOne: false;
            referencedRelation: "careers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "resources_skill_id_fkey";
            columns: ["skill_id"];
            isOneToOne: false;
            referencedRelation: "skills";
            referencedColumns: ["id"];
          },
        ];
      };
      roadmap_months: {
        Row: {
          assessment_skill: string | null;
          created_at: string;
          estimated_hours: number;
          goal: string | null;
          id: string;
          milestone: string | null;
          month_number: number;
          project_description: string | null;
          project_title: string | null;
          roadmap_id: string;
          skills: string[];
          title: string;
          topics: string[];
          user_id: string;
        };
        Insert: {
          assessment_skill?: string | null;
          created_at?: string;
          estimated_hours?: number;
          goal?: string | null;
          id?: string;
          milestone?: string | null;
          month_number: number;
          project_description?: string | null;
          project_title?: string | null;
          roadmap_id: string;
          skills?: string[];
          title: string;
          topics?: string[];
          user_id: string;
        };
        Update: {
          assessment_skill?: string | null;
          created_at?: string;
          estimated_hours?: number;
          goal?: string | null;
          id?: string;
          milestone?: string | null;
          month_number?: number;
          project_description?: string | null;
          project_title?: string | null;
          roadmap_id?: string;
          skills?: string[];
          title?: string;
          topics?: string[];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roadmap_months_roadmap_id_fkey";
            columns: ["roadmap_id"];
            isOneToOne: false;
            referencedRelation: "roadmaps";
            referencedColumns: ["id"];
          },
        ];
      };
      roadmap_tasks: {
        Row: {
          completed_at: string | null;
          created_at: string;
          description: string | null;
          estimated_hours: number;
          id: string;
          is_completed: boolean;
          month_id: string;
          roadmap_id: string;
          skill_name: string | null;
          title: string;
          user_id: string;
          week_number: number;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          estimated_hours?: number;
          id?: string;
          is_completed?: boolean;
          month_id: string;
          roadmap_id: string;
          skill_name?: string | null;
          title: string;
          user_id: string;
          week_number: number;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          estimated_hours?: number;
          id?: string;
          is_completed?: boolean;
          month_id?: string;
          roadmap_id?: string;
          skill_name?: string | null;
          title?: string;
          user_id?: string;
          week_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "roadmap_tasks_month_id_fkey";
            columns: ["month_id"];
            isOneToOne: false;
            referencedRelation: "roadmap_months";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "roadmap_tasks_roadmap_id_fkey";
            columns: ["roadmap_id"];
            isOneToOne: false;
            referencedRelation: "roadmaps";
            referencedColumns: ["id"];
          },
        ];
      };
      roadmaps: {
        Row: {
          career_id: string | null;
          created_at: string;
          data_mode: string;
          generated_by: string;
          hours_per_week: number;
          id: string;
          is_active: boolean;
          jobs_analyzed: number;
          model: string | null;
          readiness_score: number;
          summary: string | null;
          target_role: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          career_id?: string | null;
          created_at?: string;
          data_mode?: string;
          generated_by?: string;
          hours_per_week?: number;
          id?: string;
          is_active?: boolean;
          jobs_analyzed?: number;
          model?: string | null;
          readiness_score?: number;
          summary?: string | null;
          target_role: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          career_id?: string | null;
          created_at?: string;
          data_mode?: string;
          generated_by?: string;
          hours_per_week?: number;
          id?: string;
          is_active?: boolean;
          jobs_analyzed?: number;
          model?: string | null;
          readiness_score?: number;
          summary?: string | null;
          target_role?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "roadmaps_career_id_fkey";
            columns: ["career_id"];
            isOneToOne: false;
            referencedRelation: "careers";
            referencedColumns: ["id"];
          },
        ];
      };
      saved_jobs: {
        Row: {
          created_at: string;
          id: string;
          job_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          job_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          job_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      skills: {
        Row: {
          aliases: string[];
          category: string | null;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          aliases?: string[];
          category?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          aliases?: string[];
          category?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_projects: {
        Row: {
          completed_at: string | null;
          id: string;
          notes: string | null;
          project_id: string | null;
          repo_url: string | null;
          started_at: string;
          status: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          id?: string;
          notes?: string | null;
          project_id?: string | null;
          repo_url?: string | null;
          started_at?: string;
          status?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          id?: string;
          notes?: string | null;
          project_id?: string | null;
          repo_url?: string | null;
          started_at?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_projects_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      user_skills: {
        Row: {
          created_at: string;
          custom_skill_name: string | null;
          id: string;
          level: Database["public"]["Enums"]["proficiency_level"];
          skill_id: string | null;
          source: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          custom_skill_name?: string | null;
          id?: string;
          level?: Database["public"]["Enums"]["proficiency_level"];
          skill_id?: string | null;
          source?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          custom_skill_name?: string | null;
          id?: string;
          level?: Database["public"]["Enums"]["proficiency_level"];
          skill_id?: string | null;
          source?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_skills_skill_id_fkey";
            columns: ["skill_id"];
            isOneToOne: false;
            referencedRelation: "skills";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "moderator" | "user";
      application_status: "saved" | "applied" | "interview" | "offer" | "rejected";
      difficulty_level: "beginner" | "intermediate" | "advanced";
      education_level: "high_school" | "diploma" | "bachelors" | "masters" | "phd" | "other";
      experience_level: "none" | "lt_1" | "1_2" | "2_5" | "5_plus";
      plan_tier: "free" | "pro" | "premium";
      proficiency_level: "none" | "beginner" | "intermediate" | "advanced" | "expert";
      resource_type: "documentation" | "course" | "video" | "book" | "practice" | "project";
      skill_importance: "nice_to_have" | "medium" | "high" | "critical";
      work_mode: "remote" | "hybrid" | "onsite" | "any";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      application_status: ["saved", "applied", "interview", "offer", "rejected"],
      difficulty_level: ["beginner", "intermediate", "advanced"],
      education_level: ["high_school", "diploma", "bachelors", "masters", "phd", "other"],
      experience_level: ["none", "lt_1", "1_2", "2_5", "5_plus"],
      plan_tier: ["free", "pro", "premium"],
      proficiency_level: ["none", "beginner", "intermediate", "advanced", "expert"],
      resource_type: ["documentation", "course", "video", "book", "practice", "project"],
      skill_importance: ["nice_to_have", "medium", "high", "critical"],
      work_mode: ["remote", "hybrid", "onsite", "any"],
    },
  },
} as const;
