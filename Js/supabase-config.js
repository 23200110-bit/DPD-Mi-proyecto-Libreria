/* ==========================================================================
   js/supabase-config.js - CONFIGURACIÓN CENTRAL DE SUPABASE
   ========================================================================== */

const SUPABASE_URL = "https://wajeholcbjckwolyyaei.supabase.co";
const SUPABASE_KEY = "sb_publishable_rC_cpr7bQFk9KmPc8roEuw_fEjaTF_s"; 

// Inicializamos el cliente global usando la librería que cargamos en el HTML
export const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);