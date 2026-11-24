
/* ==========================================
   CONTROL DE ACCESO RBAC - VENTASPRO
========================================== */

function permitirRoles(...rolesPermitidos) {

    return (req, res, next) => {

        // Verificar que el usuario esté autenticado
        if (!req.usuario) {

            return res.status(401).json({
                error: "Usuario no autenticado"
            });

        }

        // Obtener el rol verificado del usuario
        const rolUsuario = req.usuario.rol;

        // Comprobar si tiene permisos
        if (!rolesPermitidos.includes(rolUsuario)) {

            return res.status(403).json({
                error: "No tienes permisos para realizar esta operación"
            });

        }

        // Permitir la operación
        next();

    };

}

module.exports = permitirRoles;
