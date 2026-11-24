
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;

// Utilizar la clave pública de Supabase Auth.
// No utilizar aquí la service_role key.
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        "Faltan SUPABASE_URL o SUPABASE_ANON_KEY en .env"
    );
}

const supabaseAuth = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    }
);

module.exports = supabaseAuth;
