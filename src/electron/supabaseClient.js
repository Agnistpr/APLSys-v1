import 'dotenv/config';  // or require('dotenv').config() if using CJS
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase credentials missing. Check .env file.");
}

const supabase = createClient(supabaseUrl, supabaseKey);
export default supabase;