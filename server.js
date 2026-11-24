

const express = require("express");

const cors = require("cors");

require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;

// Configuración del servidor

app.use(cors());

app.use(express.static("public"));

app.use(express.json());

const supabase = require("./config/supabase");

const { createClient } = require("@supabase/supabase-js");

const db = require("./config/firebase");

const { FieldValue } = require("firebase-admin/firestore");

const verificarToken = require("./middleware/auth");

const permitirRoles = require("./middleware/roles");

/* ==========================================

   AUTENTICACIÓN - VENTASPRO

========================================== */

// INICIAR SESIÓN

// AUDITORÍA DE ACTIVIDADES - FIRESTORE
function auditar(modulo, accion, descripcion, tipoOperacion) {
    return (req, res, next) => {
        res.once("finish", () => {
            const usuario = req.usuario;
            if (!usuario) return;
            const exitoso = res.statusCode >= 200 && res.statusCode < 300;
            const detalles = {
                origen: "aplicacion_web",
                tipo_operacion: tipoOperacion,
                codigo_http: res.statusCode
            };
            if (req.params.id) detalles.id_recurso = req.params.id;
            if (req.idRecursoAuditoria != null) detalles.id_recurso = String(req.idRecursoAuditoria);
            db.collection("historial_actividades").add({
                id_usuario: usuario.id_usuario,
                nombre_usuario: usuario.nombre,
                rol: usuario.rol,
                modulo, accion,
                descripcion: exitoso ? descripcion : `Operación no completada: ${descripcion}`,
                resultado: exitoso ? "exitoso" : "fallido",
                fecha: FieldValue.serverTimestamp(),
                detalles
            }).catch(error => console.error("Error de auditoría:", error.message));
        });
        next();
    };
}

app.post("/api/auth/login", auditar("autenticacion", "iniciar_sesion", "Inicio de sesión", "LOGIN"), async (req, res) => {

    try {

        const { correo, password } = req.body;

        // Validar campos

        if (

            typeof correo !== "string" ||

            typeof password !== "string" ||

            !correo.trim() ||

            !password

        ) {

            return res.status(400).json({

                error: "Correo y contraseña son obligatorios"

            });

        }

        // Cliente de autenticación independiente por solicitud

        const supabaseAuth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {

            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }

        });

        // Autenticar con Supabase Auth

        const { data: authData, error: authError } =

            await supabaseAuth.auth.signInWithPassword({

                email: correo.trim(),

                password: password

            });

        if (authError || !authData.user || !authData.session) {

            return res.status(401).json({

                error: "Correo o contraseña incorrectos"

            });

        }

        // Consultar el perfil asociado a la cuenta

        const { data: usuario, error: usuarioError } =

            await supabase

                .from("usuarios")

                .select(

                    "id_usuario, nombre, correo, rol, auth_user_id, estado"

                )

                .eq("auth_user_id", authData.user.id)

                .maybeSingle();

        if (usuarioError) {

            console.error("Error al consultar perfil:", usuarioError);

            return res.status(500).json({

                error: "No se pudo consultar el perfil del usuario"

            });

        }

        if (!usuario) {

            return res.status(403).json({

                error: "Esta cuenta no tiene un perfil autorizado"

            });

        }

        if (usuario.estado !== "activo") return res.status(403).json({error:"Cuenta desactivada"});

        const rolesPermitidos = [

            "administrador",

            "gerente",

            "vendedor",

            "cliente"

        ];

        if (!rolesPermitidos.includes(usuario.rol)) {

            return res.status(403).json({

                error: "El usuario no tiene un rol válido"

            });

        }

        req.usuario = usuario;
        // Responder sin exponer la contraseña

        res.status(200).json({

            mensaje: "Inicio de sesión exitoso",

            usuario: {

                id_usuario: usuario.id_usuario,

                nombre: usuario.nombre,

                correo: usuario.correo,

                rol: usuario.rol

            },

            access_token: authData.session.access_token,

            expires_in: authData.session.expires_in

        });

    } catch (error) {

        console.error("Error en login:", error);

        res.status(500).json({

            error: "Error interno al iniciar sesión"

        });

    }

});

/* ==========================================

   CONSULTAR SESIÓN ACTUAL - VENTASPRO

========================================== */

app.get("/api/auth/me", verificarToken, (req, res) => {

    return res.status(200).json({

        mensaje: "Sesión válida",

        usuario: {

            id_usuario: req.usuario.id_usuario,

            nombre: req.usuario.nombre,

            correo: req.usuario.correo,

            rol: req.usuario.rol

        }

    });

});

app.get(

    "/api/productos",

    verificarToken,

    permitirRoles("administrador", "gerente", "vendedor", "cliente"),

    async (req, res) => {

    try {

        const { data, error } = await supabase

            .from("productos")

            .select("*");

        if (error) {

            throw error;

        }

        res.json({

            mensaje: "Conexión con Supabase exitosa",

            productos: data

        });

    } catch (error) {

        console.error("Error de Supabase:", error.message);

        res.status(500).json({

            error: "No se pudo consultar Supabase"

        });

    }

});

// Consultar notificaciones de Firebase

app.get("/api/notificaciones", verificarToken, permitirRoles("administrador", "gerente"), async (req, res) => {

    try {

        const snapshot = await db

            .collection("notificaciones")

            .get();

        const notificaciones = snapshot.docs.map(doc => ({

            id: doc.id,

            ...doc.data()

        }));

        res.json({

            mensaje: "Conexión con Firebase exitosa",

            notificaciones: notificaciones

        });

    } catch (error) {

        console.error("Error de Firebase:", error.message);

        res.status(500).json({

            error: "No se pudo consultar Firebase"

        });

    }

});

// Ruta de prueba

app.get("/", (req, res) => {

    res.json({

        mensaje: "Sistema de Ventas Híbrido funcionando",

        estado: "correcto"

    });

});

app.post("/api/productos", verificarToken, permitirRoles("administrador", "gerente"), auditar("productos", "crear_producto", "Registrar producto", "INSERT"), async (req, res) => {

    try {

        const { nombre, descripcion, precio, stock } = req.body;

        // Validar los datos recibidos

        if (

            typeof nombre !== "string" ||

            !nombre.trim() ||

            typeof precio !== "number" ||

            !Number.isFinite(precio) ||

            precio < 0 ||

            !Number.isInteger(stock) ||

            stock < 0

        ) {

            return res.status(400).json({

                error: "Nombre, precio o stock inválidos"

            });

        }

        // Registrar producto en Supabase

        const { data, error } = await supabase

            .from("productos")

            .insert([{

                nombre: nombre.trim(),

                descripcion: descripcion || null,

                precio,

                stock,

                estado: "activo"

            }])

            .select()

            .single();

        if (error) {

            throw error;

        }

        res.status(201).json({

            mensaje: "Producto registrado correctamente",

            producto: data

        });

    } catch (error) {

        console.error("Error al registrar producto:", error.message);

        res.status(500).json({

            error: "No se pudo registrar el producto"

        });

    }

});

app.put("/api/productos/:id", verificarToken, permitirRoles("administrador", "gerente"), auditar("productos", "editar_producto", "Editar producto", "UPDATE"), async (req, res) => {

    try {

        const id = Number(req.params.id);

        const { nombre, descripcion, precio, stock, estado } = req.body;

        if (!Number.isSafeInteger(id) || id <= 0) {

            return res.status(400).json({

                error: "ID de producto inválido"

            });

        }

        const cambios = {};

        if (nombre !== undefined) {

            if (typeof nombre !== "string" || !nombre.trim()) {

                return res.status(400).json({ error: "Nombre inválido" });

            }

            cambios.nombre = nombre.trim();

        }

        if (descripcion !== undefined) {

            if (descripcion !== null && typeof descripcion !== "string") {

                return res.status(400).json({ error: "Descripción inválida" });

            }

            cambios.descripcion = descripcion;

        }

        if (precio !== undefined) {

            if (typeof precio !== "number" ||

                !Number.isFinite(precio) || precio < 0) {

                return res.status(400).json({ error: "Precio inválido" });

            }

            cambios.precio = precio;

        }

        if (stock !== undefined) {

            if (!Number.isInteger(stock) || stock < 0) {

                return res.status(400).json({ error: "Stock inválido" });

            }

            cambios.stock = stock;

        }

        if (estado !== undefined) {

            if (!["activo", "inactivo"].includes(estado)) {

                return res.status(400).json({ error: "Estado inválido" });

            }

            cambios.estado = estado;

        }

        if (Object.keys(cambios).length === 0) {

            return res.status(400).json({

                error: "No se enviaron cambios"

            });

        }

        const { data, error } = await supabase

            .from("productos")

            .update(cambios)

            .eq("id_producto", id)

            .select()

            .maybeSingle();

        if (error) throw error;

        if (!data) {

            return res.status(404).json({

                error: "Producto no encontrado"

            });

        }

        res.json({

            mensaje: "Producto actualizado correctamente",

            producto: data

        });

    } catch (error) {

        console.error("Error al actualizar:", error.message);

        res.status(500).json({

            error: "No se pudo actualizar el producto"

        });

    }

});

app.delete("/api/productos/:id", verificarToken, permitirRoles("administrador", "gerente"), auditar("productos", "eliminar_producto", "Eliminar producto", "DELETE"), async (req, res) => {

    try {

        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id <= 0) {

            return res.status(400).json({

                error: "ID inválido"

            });

        }

        const { data, error } = await supabase

            .from("productos")

            .delete()

            .eq("id_producto", id)

            .select()

            .maybeSingle();

        if (error) throw error;

        if (!data) {

            return res.status(404).json({

                error: "Producto no encontrado"

            });

        }

        res.json({

            mensaje: "Producto eliminado correctamente",

            producto: data

        });

    } catch (error) {

        console.error("Error al eliminar:", error.message);

        res.status(500).json({

            error: "No se pudo eliminar el producto"

        });

    }

});

// Registrar una nueva venta

// Registrar una nueva venta en Supabase

app.post("/api/ventas", verificarToken, permitirRoles("administrador", "gerente", "vendedor"), auditar("ventas", "crear_venta", "Registrar venta", "INSERT"), async (req, res) => {

    try {

        const { id_cliente, productos } = req.body;

        const id_usuario = req.usuario.id_usuario;

        // Validar los datos

        if (

            !Number.isSafeInteger(id_cliente) ||

            id_cliente <= 0 ||

            !Number.isSafeInteger(id_usuario) ||

            id_usuario <= 0 ||

            !Array.isArray(productos) ||

            productos.length !== 1 ||

            !productos[0] ||

            !Number.isSafeInteger(productos[0].id_producto) ||

            productos[0].id_producto <= 0 ||

            !Number.isSafeInteger(productos[0].cantidad) ||

            productos[0].cantidad <= 0

        ) {

            return res.status(400).json({

                error: "Datos de venta inválidos. Se admite un producto por venta."

            });

        }

        const producto = productos[0];

        // Ejecutar la función de PostgreSQL

        const { data, error } = await supabase.rpc(

            "registrar_venta",

            {

                p_id_cliente: id_cliente,

                p_id_usuario: id_usuario,

                p_id_producto: producto.id_producto,

                p_cantidad: producto.cantidad

            }

        );

        if (error) {

            console.error("Error de Supabase:", error.message);

            return res.status(400).json({

                error: error.message

            });

        }

        // Registrar notificación en Firebase

let notificacionCreada = false;

try {

    await db.collection("notificaciones").add({

        id_venta: data,

        tipo: "venta",

        titulo: "Nueva venta registrada",

        mensaje: `Se registró correctamente la venta #${data}`,

        leida: false,

        fecha: FieldValue.serverTimestamp(),

        detalles: {

            categoria: "ventas",

            prioridad: "normal",

            origen: "sistema"

        }

    });

    notificacionCreada = true;

    console.log("Notificación guardada en Firebase");

} catch (firebaseError) {

    console.error(

        "Error al crear notificación:",

        firebaseError.message

    );

}

// Responder al cliente
req.idRecursoAuditoria = data;

res.status(201).json({

    mensaje: "Venta registrada correctamente",

    id_venta: data,

    notificacion_creada: notificacionCreada

});

    } catch (error) {

        console.error("Error al registrar venta:", error.message);

        res.status(500).json({

            error: "No se pudo registrar la venta"

        });

    }

});

// Consultar historial de ventas

app.get("/api/ventas", verificarToken, permitirRoles("administrador", "gerente", "vendedor"), async (req, res) => {

    try {

        const { data, error } = await supabase

            .from("ventas")

            .select(`

                id_venta,

                fecha_venta,

                total,

                estado,

                clientes(nombre, apellidos),

                usuarios(nombre),

                detalle_ventas(

                    cantidad,

                    precio_unitario,

                    subtotal,

                    productos(nombre)

                )

            `)

            .order("fecha_venta", { ascending: false });

        if (error) throw error;

        res.json({

            mensaje: "Historial de ventas consultado correctamente",

            ventas: data

        });

    } catch (error) {

        console.error("Error al consultar ventas:", error.message);

        res.status(500).json({

            error: "No se pudo consultar el historial de ventas"

        });

    }

});

// Marcar una notificación como leída

app.put("/api/notificaciones/:id/leida", verificarToken, permitirRoles("administrador", "gerente"), auditar("notificaciones", "marcar_leida", "Marcar notificación como leída", "UPDATE"), async (req, res) => {

    try {

        const { id } = req.params;

        const referencia = db.collection("notificaciones").doc(id);

        const documento = await referencia.get();

        if (!documento.exists) {

            return res.status(404).json({

                error: "Notificación no encontrada"

            });

        }

        await referencia.update({

            leida: true

        });

        res.json({

            mensaje: "Notificación marcada como leída",

            id_notificacion: id

        });

    } catch (error) {

        console.error("Error al actualizar notificación:", error.message);

        res.status(500).json({

            error: "No se pudo actualizar la notificación"

        });

    }

});

/* ==========================================

   CRUD COMPLETO DE CLIENTES - SUPABASE

========================================== */

function validarCliente(datos) {

    const { nombre, apellidos, correo, telefono } = datos;

    if (

        typeof nombre !== "string" ||

        !nombre.trim() ||

        typeof apellidos !== "string" ||

        !apellidos.trim() ||

        typeof correo !== "string" ||

        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim()) ||

        typeof telefono !== "string" ||

        !/^\d{10}$/.test(telefono.trim())

    ) {

        return "Verifica nombre, apellidos, correo y teléfono de 10 dígitos";

    }

    return null;

}

// CONSULTAR CLIENTES

app.get("/api/clientes", verificarToken, permitirRoles("administrador", "gerente", "vendedor"), async (req, res) => {

    try {

        const { data, error } = await supabase

            .from("clientes")

            .select("*")

            .order("id_cliente", { ascending: true });

        if (error) throw error;

        res.json(data);

    } catch (error) {

        console.error("Error al consultar clientes:", error.message);

        res.status(500).json({

            error: "No se pudieron consultar los clientes"

        });

    }

});

// REGISTRAR CLIENTE

app.post("/api/clientes", verificarToken, permitirRoles("administrador", "gerente"), auditar("clientes", "crear_cliente", "Registrar cliente", "INSERT"), async (req, res) => {

    try {

        const validacion = validarCliente(req.body);

        if (validacion) {

            return res.status(400).json({ error: validacion });

        }

        const { nombre, apellidos, correo, telefono } = req.body;

        const { data, error } = await supabase

            .from("clientes")

            .insert([{

                nombre: nombre.trim(),

                apellidos: apellidos.trim(),

                correo: correo.trim(),

                telefono: telefono.trim()

            }])

            .select()

            .single();

        if (error) throw error;

        res.status(201).json({

            mensaje: "Cliente registrado correctamente",

            cliente: data

        });

    } catch (error) {

        console.error("Error al registrar cliente:", error.message);

        res.status(500).json({

            error: "No se pudo registrar el cliente"

        });

    }

});

// ACTUALIZAR CLIENTE

app.put("/api/clientes/:id", verificarToken, permitirRoles("administrador", "gerente"), auditar("clientes", "editar_cliente", "Editar cliente", "UPDATE"), async (req, res) => {

    try {

        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id <= 0) {

            return res.status(400).json({

                error: "ID de cliente inválido"

            });

        }

        const validacion = validarCliente(req.body);

        if (validacion) {

            return res.status(400).json({ error: validacion });

        }

        const { nombre, apellidos, correo, telefono } = req.body;

        const { data, error } = await supabase

            .from("clientes")

            .update({

                nombre: nombre.trim(),

                apellidos: apellidos.trim(),

                correo: correo.trim(),

                telefono: telefono.trim()

            })

            .eq("id_cliente", id)

            .select()

            .maybeSingle();

        if (error) throw error;

        if (!data) {

            return res.status(404).json({

                error: "Cliente no encontrado"

            });

        }

        res.json({

            mensaje: "Cliente actualizado correctamente",

            cliente: data

        });

    } catch (error) {

        console.error("Error al actualizar cliente:", error.message);

        res.status(500).json({

            error: "No se pudo actualizar el cliente"

        });

    }

});

// ELIMINAR CLIENTE

app.delete("/api/clientes/:id", verificarToken, permitirRoles("administrador"), auditar("clientes", "eliminar_cliente", "Eliminar cliente", "DELETE"), async (req, res) => {

    try {

        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id <= 0) {

            return res.status(400).json({

                error: "ID de cliente inválido"

            });

        }

        // Evitar eliminar clientes con ventas registradas

        const { data: ventas, error: errorVentas } = await supabase

            .from("ventas")

            .select("id_cliente")

            .eq("id_cliente", id)

            .limit(1);

        if (errorVentas) throw errorVentas;

        if (ventas.length > 0) {

            return res.status(409).json({

                error: "No puedes eliminar este cliente porque tiene ventas registradas"

            });

        }

        const { data, error } = await supabase

            .from("clientes")

            .delete()

            .eq("id_cliente", id)

            .select("id_cliente")

            .maybeSingle();

        if (error) throw error;

        if (!data) {

            return res.status(404).json({

                error: "Cliente no encontrado"

            });

        }

        res.json({

            mensaje: "Cliente eliminado correctamente"

        });

    } catch (error) {

        console.error("Error al eliminar cliente:", error.message);

        res.status(500).json({

            error: "No se pudo eliminar el cliente. Revisa si tiene registros relacionados"

        });

    }

});

// GESTIÓN DE USUARIOS - SOLO ADMINISTRADORES
const camposUsuario = 'id_usuario,nombre,correo,rol,estado,fecha_registro';
const rolesUsuarios = ['administrador','gerente','vendedor','cliente'];
const soloAdmin = permitirRoles('administrador');
const rutaUsuarios = fn => async (req,res) => {
    try { await fn(req,res); }
    catch (e) { console.error('Error gestión usuarios:', e.code || e.status || 'interno'); res.status(500).json({error:'No se pudo completar la operación'}); }
};
app.get('/api/usuarios', verificarToken, soloAdmin, rutaUsuarios(async (req,res) => {
    const {data,error} = await supabase.from('usuarios').select(camposUsuario).order('id_usuario');
    if(error) throw error;
    res.json({usuarios:data});
}));
app.post('/api/usuarios', verificarToken, soloAdmin, auditar("usuarios", "crear_usuario", "Registrar usuario", "INSERT"), rutaUsuarios(async (req,res) => {
    const {nombre,correo,password,rol} = req.body || {};
    if(typeof nombre !== 'string' || !nombre.trim() || typeof correo !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim()) || typeof password !== 'string' || password.length < 8 || !rolesUsuarios.includes(rol)) return res.status(400).json({error:'Nombre, correo, contraseña o rol inválidos'});
    const email = correo.trim().toLowerCase();
    const {data:existente,error:consulta} = await supabase.from('usuarios').select('id_usuario').eq('correo',email).limit(1);
    if(consulta) throw consulta;
    if(existente.length) return res.status(409).json({error:'El correo ya está registrado'});
    const {data:cuenta,error:authError} = await supabase.auth.admin.createUser({email,password,email_confirm:true});
    if(authError) return res.status(authError.code === 'email_exists' ? 409 : 400).json({error:'No se pudo crear la cuenta de autenticación; revisa el correo y la contraseña'});
    const {data,error} = await supabase.from('usuarios').insert({nombre:nombre.trim(),correo:email,rol,estado:'activo',auth_user_id:cuenta.user.id}).select(camposUsuario).single();
    if(error) {
        const {error:limpieza} = await supabase.auth.admin.deleteUser(cuenta.user.id);
        if(limpieza) console.error('No se pudo revertir la creación de cuenta',cuenta.user.id);
        throw error;
    }
    req.idRecursoAuditoria = data.id_usuario;
    res.status(201).json({mensaje:'Usuario registrado correctamente',usuario:data});
}));
async function buscarUsuario(id) {
    const {data,error} = await supabase.from('usuarios').select(camposUsuario+',auth_user_id').eq('id_usuario',id).maybeSingle();
    if(error) throw error;
    return data;
}
app.put('/api/usuarios/:id', verificarToken, soloAdmin, auditar("usuarios", "editar_usuario", "Editar usuario o rol", "UPDATE"), rutaUsuarios(async (req,res) => {
    const id = Number(req.params.id);
    const {nombre,rol,password} = req.body || {};
    if(!Number.isSafeInteger(id) || id <= 0 || typeof nombre !== 'string' || !nombre.trim() || !rolesUsuarios.includes(rol) || (password !== undefined && (typeof password !== 'string' || password.length < 8))) return res.status(400).json({error:'Datos de usuario inválidos'});
    const usuario = await buscarUsuario(id);
    if(!usuario) return res.status(404).json({error:'Usuario no encontrado'});
    if(id === Number(req.usuario.id_usuario) && rol !== 'administrador') return res.status(403).json({error:'No puedes cambiar tu propio rol'});
    // Proteger las cuentas administrativas de cambios por otros administradores.
    if(usuario.rol === 'administrador' && id !== Number(req.usuario.id_usuario)) return res.status(403).json({error:'No puedes modificar otra cuenta administrativa'});
    if(password !== undefined && !usuario.auth_user_id) return res.status(409).json({error:'El usuario no tiene una cuenta de autenticación vinculada'});
    const {data,error} = await supabase.from('usuarios').update({nombre:nombre.trim(),rol}).eq('id_usuario',id).select(camposUsuario).single();
    if(error) throw error;
    if(password !== undefined) {
        const {error:authError} = await supabase.auth.admin.updateUserById(usuario.auth_user_id,{password});
        if(authError) return res.status(400).json({error:'Nombre y rol guardados, pero no se pudo cambiar la contraseña'});
    }
    res.json({mensaje:'Usuario actualizado correctamente',usuario:data});
}));
app.put('/api/usuarios/:id/estado', verificarToken, soloAdmin, auditar("usuarios", "cambiar_estado", "Cambiar estado de usuario", "UPDATE"), rutaUsuarios(async (req,res) => {
    const id = Number(req.params.id);
    const {estado} = req.body || {};
    if(!Number.isSafeInteger(id) || id <= 0 || !['activo','inactivo'].includes(estado)) return res.status(400).json({error:'ID o estado inválido'});
    const usuario = await buscarUsuario(id);
    if(!usuario) return res.status(404).json({error:'Usuario no encontrado'});
    if(estado === 'inactivo' && (id === Number(req.usuario.id_usuario) || usuario.rol === 'administrador')) return res.status(403).json({error:'No puedes desactivar una cuenta administrativa'});
    const {data,error} = await supabase.from('usuarios').update({estado}).eq('id_usuario',id).select(camposUsuario).single();
    if(error) throw error;
    res.json({mensaje:'Estado actualizado correctamente',usuario:data});
}));

// CONSULTAR ACTIVIDADES - SOLO ADMINISTRADOR Y GERENTE
app.get("/api/actividades", verificarToken, permitirRoles("administrador", "gerente"), async (req, res) => {
    try {
        const snapshot = await db.collection("historial_actividades")
            .orderBy("fecha", "desc").limit(500).get();
        const actividades = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        res.json({ actividades });
    } catch (error) {
        console.error("Error al consultar actividades:", error.message);
        res.status(500).json({ error: "No se pudieron consultar las actividades" });
    }
});

// Iniciar servidor

app.listen(PORT, () => {

    console.log(`Servidor funcionando en http://localhost:${PORT}`);

});
