// Hands this app's Supabase client to @refee/core, which holds the backend
// calls both apps share. Modules re-exported from core import this first.
import { configureSupabase } from "@refee/core/client";
import { supabase } from "@/lib/supabase";

configureSupabase(supabase);
