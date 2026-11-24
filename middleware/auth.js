const supabase = require("../config/supabase");
async function verificarToken(req, res, next) {
    try {
        const authorization = req.headers.authorization;
        if (!authorization || !authorization.startsWith("Bearer ")) return res.status(401).json({error:"Token de autenticación requerido"});
        const token = authorization.slice(7).trim();
        const {data,error} = await supabase.auth.getUser(token);
        if (error || !data.user) return res.status(401).json({error:"Token inválido o expirado"});
        const {data:usuario,error:usuarioError} = await supabase.from("usuarios").select("id_usuario, nombre, correo, rol, estado").eq("auth_user_id",data.user.id).maybeSingle();
        if (usuarioError) return res.status(500).json({error:"Error al consultar el usuario"});
        if (!usuario) return res.status(403).json({error:"Usuario no autorizado"});
        if (usuario.estado !== "activo") return res.status(403).json({error:"Cuenta desactivada"});
        if (!["administrador","gerente","vendedor","cliente"].includes(usuario.rol)) return res.status(403).json({error:"Rol no válido"});
        req.usuario = usuario;
        next();
    } catch(error) {
        console.error("Error de autenticación:",error);
        return res.status(500).json({error:"Error interno de autenticación"});
    }
}
module.exports = verificarToken;
