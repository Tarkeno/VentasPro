
/* ==========================================
   SISTEMA DE VENTAS HÍBRIDO - VENTASPRO
   Frontend: HTML + CSS + JavaScript
   Backend: Node.js + Supabase + Firebase
========================================== */




/* ==========================================
   PETICIONES AUTENTICADAS - VENTASPRO
========================================== */

let usuarioActual = null;
function rolActual() { return usuarioActual?.rol; }
function tieneRol(...roles) { return roles.includes(rolActual()); }
function puedeVer(elemento) {
    return !!usuarioActual && !!elemento && (!elemento.dataset.roles ||
        elemento.dataset.roles.split(/\s+/).includes(rolActual()));
}
function aplicarPermisos() {
    document.querySelectorAll('[data-roles]').forEach(elemento => {
        if (puedeVer(elemento)) elemento.style.removeProperty('display');
        else elemento.style.setProperty('display', 'none', 'important');
    });
    const inicio = rolActual() === 'cliente' ? 'productos' : 'dashboard';
    document.querySelectorAll('.sidebar nav a').forEach(a => {
        a.classList.toggle('activo', a.dataset.seccion === inicio && puedeVer(a));
    });
    document.querySelectorAll('.seccion').forEach(seccion => {
        seccion.classList.toggle('activa', seccion.id === inicio && puedeVer(seccion));
    });
    const titulo = document.querySelector('.encabezado h1');
    if (titulo) titulo.textContent = rolActual() === 'cliente' ? 'Catálogo de productos' : 'Panel de control';
}

async function fetchAutenticado(url, opciones = {}) {

    const token = sessionStorage.getItem("ventaspro_token");

    if (!token || !usuarioActual) throw new Error("Inicia sesión primero");

    const headers = new Headers(opciones.headers || {});

    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    const respuesta = await fetch(url, {
        ...opciones,
        headers
    });

    // Sesión inválida o expirada
    if (respuesta.status === 401) {

        sessionStorage.removeItem("ventaspro_token");
        sessionStorage.removeItem("ventaspro_usuario");

        window.location.reload();

        throw new Error("La sesión ha expirado");

    }

    return respuesta;

}


document.addEventListener("DOMContentLoaded", () => {

    // ======================================
    // 1. NAVEGACIÓN DEL MENÚ
    // ======================================

    const enlaces = document.querySelectorAll(".sidebar nav a");
    const secciones = document.querySelectorAll(".seccion");

    enlaces.forEach(enlace => {
        enlace.addEventListener("click", (evento) => {
            evento.preventDefault();

            const seccionDestino = enlace.dataset.seccion;
            const destino = document.getElementById(seccionDestino);

            if (!puedeVer(enlace) || !puedeVer(destino)) return;

            enlaces.forEach(item => item.classList.remove("activo"));
            secciones.forEach(item => item.classList.remove("activa"));

            enlace.classList.add("activo");
            destino.classList.add("activa");

            const titulo = destino.querySelector("h2");
            const encabezado = document.querySelector(".encabezado h1");

            if (titulo && encabezado) {
                encabezado.textContent = titulo.textContent;
            }

            if (seccionDestino === "dashboard") {
                cargarDashboard();
            }

            if (seccionDestino === "productos") {
                cargarProductos();
            }
        });
    });


    // ======================================
    // 2. REFERENCIAS DEL FORMULARIO
    // ======================================

    const formulario = document.getElementById("form-producto");
    const mensaje = document.getElementById("mensaje-producto");

    const idProducto = document.getElementById("id-producto");
    const nombreProducto = document.getElementById("nombre-producto");
    const descripcionProducto = document.getElementById("descripcion-producto");
    const precioProducto = document.getElementById("precio-producto");
    const stockProducto = document.getElementById("stock-producto");

    const tituloFormulario = document.getElementById("titulo-form-producto");
    const btnGuardar = document.getElementById("btn-guardar-producto");
    const btnCancelar = document.getElementById("btn-cancelar-edicion");


    // ======================================
    // 3. RESTABLECER FORMULARIO
    // ======================================

    function restablecerFormulario() {
        if (!formulario) return;

        formulario.reset();

        if (idProducto) idProducto.value = "";

        if (tituloFormulario) {
            tituloFormulario.textContent = "Agregar nuevo producto";
        }

        if (btnGuardar) {
            btnGuardar.textContent = "+ Guardar producto";
        }

        if (btnCancelar) {
            btnCancelar.style.display = "none";
        }
    }


    // ======================================
    // 4. EDITAR PRODUCTO
    // ======================================

    function editarProducto(producto) {
        if (!tieneRol("administrador", "gerente")) return;

        if (
            !formulario ||
            !idProducto ||
            !nombreProducto ||
            !descripcionProducto ||
            !precioProducto ||
            !stockProducto
        ) {
            console.error("Faltan elementos del formulario en index.html");
            alert("No se encontró el formulario de edición.");
            return;
        }

        idProducto.value = producto.id_producto;

        nombreProducto.value = producto.nombre ?? "";
        descripcionProducto.value = producto.descripcion ?? "";
        precioProducto.value = producto.precio ?? "";
        stockProducto.value = producto.stock ?? "";

        if (tituloFormulario) {
            tituloFormulario.textContent = "Editar producto";
        }

        if (btnGuardar) {
            btnGuardar.textContent = "💾 Guardar cambios";
        }

        if (btnCancelar) {
            btnCancelar.style.display = "inline-block";
        }

        if (mensaje) {
            mensaje.textContent = "";
        }

        formulario.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }


    // ======================================
    // 5. CANCELAR EDICIÓN
    // ======================================

    if (btnCancelar) {
        btnCancelar.addEventListener("click", () => {
            restablecerFormulario();

            if (mensaje) {
                mensaje.textContent = "";
            }
        });
    }


    // ======================================
    // 6. CONSULTAR PRODUCTOS
    // ======================================

    async function cargarProductos() {

        const tabla = document.getElementById("lista-productos");

        if (!tabla) return;

        try {
            const respuesta = await fetchAutenticado("/api/productos");

            if (!respuesta.ok) {
                throw new Error("No se pudieron consultar los productos");
            }

            const resultado = await respuesta.json();

            const productos = Array.isArray(resultado)
                ? resultado
                : resultado.productos || [];

            tabla.innerHTML = "";

            if (productos.length === 0) {
                const fila = document.createElement("tr");
                const celda = document.createElement("td");

                celda.colSpan = tieneRol("administrador", "gerente") ? 5 : 4;
                celda.style.padding = "20px";
                celda.textContent = "No hay productos registrados.";

                fila.appendChild(celda);
                tabla.appendChild(fila);
                return;
            }

            productos.forEach(producto => {

                const fila = document.createElement("tr");

                const valores = [
                    producto.id_producto,
                    producto.nombre,
                    Number(producto.precio).toLocaleString("es-MX", {
                        style: "currency",
                        currency: "MXN"
                    }),
                    producto.stock
                ];

                valores.forEach(valor => {
                    const celda = document.createElement("td");

                    celda.style.padding = "15px";
                    celda.textContent = valor ?? "";

                    fila.appendChild(celda);
                });

                // Columna de acciones
                const acciones = document.createElement("td");
                acciones.style.padding = "15px";

                // Botón editar
                const btnEditar = document.createElement("button");

                btnEditar.type = "button";
                btnEditar.className = "btn-editar";
                btnEditar.textContent = "✏️ Editar";

                btnEditar.addEventListener("click", () => {
                    editarProducto(producto);
                });

                // Botón eliminar
                const btnEliminar = document.createElement("button");

                btnEliminar.type = "button";
                btnEliminar.className = "btn-eliminar";
                btnEliminar.textContent = "🗑️ Eliminar";

                
btnEliminar.addEventListener("click", async () => {

    const confirmar = confirm(
        `¿Estás seguro de eliminar el producto "${producto.nombre}"?`
    );

    if (!confirmar) return;

    btnEliminar.disabled = true;
    btnEliminar.textContent = "Eliminando...";

    try {
        const respuesta = await fetchAutenticado(
            `/api/productos/${producto.id_producto}`,
            {
                method: "DELETE"
            }
        );

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                resultado.error || "No se pudo eliminar el producto"
            );
        }

        alert("✅ Producto eliminado correctamente");

        // Actualizar la tabla y el dashboard
        await cargarProductos();
        await cargarDashboard();

    } catch (error) {
        console.error("Error al eliminar producto:", error);

        alert("❌ " + error.message);

        btnEliminar.disabled = false;
        btnEliminar.textContent = "🗑️ Eliminar";
    }
});


                if (tieneRol("administrador", "gerente")) {
                    acciones.appendChild(btnEditar);
                    acciones.appendChild(btnEliminar);
                    fila.appendChild(acciones);
                }
                tabla.appendChild(fila);
            });

        } catch (error) {
            console.error("Error al cargar productos:", error);

            tabla.innerHTML = "";

            const fila = document.createElement("tr");
            const celda = document.createElement("td");

            celda.colSpan = tieneRol("administrador", "gerente") ? 5 : 4;
            celda.style.padding = "20px";
            celda.style.color = "red";
            celda.textContent = "No se pudieron cargar los productos.";

            fila.appendChild(celda);
            tabla.appendChild(fila);
        }
    }


    // ======================================
    // 7. REGISTRAR Y ACTUALIZAR PRODUCTOS
    // ======================================

    if (formulario) {

        formulario.addEventListener("submit", async (evento) => {
            evento.preventDefault();

            if (!tieneRol("administrador", "gerente")) return;
            const id = idProducto?.value || "";
            const editando = id !== "";

            const nombre = nombreProducto.value.trim();
            const descripcion = descripcionProducto.value.trim();
            const precio = Number(precioProducto.value);
            const stock = Number(stockProducto.value);

            if (
                !nombre ||
                !precioProducto.value ||
                !Number.isFinite(precio) ||
                precio <= 0 ||
                !stockProducto.value ||
                !Number.isSafeInteger(stock) ||
                stock < 0
            ) {
                mensaje.textContent = "❌ Ingresa datos válidos.";
                mensaje.style.color = "red";
                return;
            }

            if (btnGuardar) {
                btnGuardar.disabled = true;
            }

            mensaje.textContent = editando
                ? "Actualizando producto..."
                : "Guardando producto...";

            mensaje.style.color = "#475569";

            try {

                const url = editando
                    ? `/api/productos/${encodeURIComponent(id)}`
                    : "/api/productos";

                const respuesta = await fetchAutenticado(url, {
                    method: editando ? "PUT" : "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        nombre,
                        descripcion,
                        precio,
                        stock
                    })
                });

                const resultado = await respuesta.json();

                if (!respuesta.ok) {
                    throw new Error(
                        resultado.error || "No se pudo guardar el producto"
                    );
                }

                restablecerFormulario();

                mensaje.textContent = editando
                    ? "✅ Producto actualizado correctamente"
                    : "✅ Producto registrado correctamente";

                mensaje.style.color = "green";

                await cargarProductos();
                await cargarDashboard();

            } catch (error) {

                console.error("Error al guardar producto:", error);

                mensaje.textContent = "❌ " + error.message;
                mensaje.style.color = "red";

            } finally {

                if (btnGuardar) {
                    btnGuardar.disabled = false;
                }
            }
        });
    }


    // ======================================
    // 8. DASHBOARD - ESTADÍSTICAS
    // ======================================

    async function cargarDashboard() {
        if (!tieneRol("administrador", "gerente", "vendedor")) return;

        try {

            const [
                respuestaProductos,
                respuestaVentas,
                respuestaNotificaciones
            ] = await Promise.all([
                fetchAutenticado("/api/productos"),
                fetchAutenticado("/api/ventas"),
                ["administrador", "gerente"].includes(rolActual())
                    ? fetchAutenticado("/api/notificaciones")
                    : Promise.resolve({ok: true, json: async () => ({notificaciones: []})})
            ]);

            if (
                !respuestaProductos.ok ||
                !respuestaVentas.ok ||
                !respuestaNotificaciones.ok
            ) {
                throw new Error("No se pudieron consultar las estadísticas");
            }

            const datosProductos = await respuestaProductos.json();
            const datosVentas = await respuestaVentas.json();
            const datosNotificaciones = await respuestaNotificaciones.json();

            const productos = Array.isArray(datosProductos)
                ? datosProductos
                : datosProductos.productos || [];

            const ventas = datosVentas.ventas || [];
            const notificaciones = datosNotificaciones.notificaciones || [];

            const ingresos = ventas.reduce(
                (total, venta) => total + Number(venta.total || 0),
                0
            );

            const pendientes = notificaciones.filter(
                notificacion => notificacion.leida === false
            ).length;

            const formatoMoneda = ingresos.toLocaleString("es-MX", {
                style: "currency",
                currency: "MXN"
            });

            const totalProductos = document.getElementById("total-productos");
            const totalVentas = document.getElementById("total-ventas");
            const totalIngresos = document.getElementById("total-ingresos");
            const totalNotificaciones = document.getElementById(
                "total-notificaciones"
            );

            if (totalProductos) {
                totalProductos.textContent = productos.length;
            }

            if (totalVentas) {
                totalVentas.textContent = ventas.length;
            }

            if (totalIngresos) {
                totalIngresos.textContent = formatoMoneda;
            }

            if (totalNotificaciones) {
                totalNotificaciones.textContent = ["administrador", "gerente"].includes(rolActual()) ? pendientes : "—";
            }

        } catch (error) {
            console.error("Error al cargar dashboard:", error);
        }
    }


    // ======================================
    // 9. CARGAR DATOS INICIALES
    // ======================================

    document.addEventListener("ventaspro:sesion", () => {
        if (rolActual() !== "cliente") cargarDashboard();
        cargarProductos();
    });

});


/* ==========================================
   CRUD DE CLIENTES - FRONTEND
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    const formCliente = document.getElementById("form-cliente");
    const idCliente = document.getElementById("id-cliente");
    const nombreCliente = document.getElementById("nombre-cliente");
    const apellidosCliente = document.getElementById("apellidos-cliente");
    const correoCliente = document.getElementById("correo-cliente");
    const telefonoCliente = document.getElementById("telefono-cliente");

    const tituloCliente = document.getElementById("titulo-form-cliente");
    const btnGuardarCliente = document.getElementById("btn-guardar-cliente");
    const btnCancelarCliente = document.getElementById("btn-cancelar-cliente");
    const mensajeCliente = document.getElementById("mensaje-cliente");
    const listaClientes = document.getElementById("lista-clientes");

    if (!formCliente || !listaClientes) {
        console.error("No se encontró el formulario o la tabla de clientes");
        return;
    }

    // Mostrar mensajes
    function mostrarMensajeCliente(texto, esError = false) {
        mensajeCliente.textContent = texto;
        mensajeCliente.style.color = esError ? "#dc2626" : "#16a34a";
    }

    // Restaurar formulario
    function limpiarFormularioCliente() {
        formCliente.reset();
        idCliente.value = "";
        tituloCliente.textContent = "Agregar nuevo cliente";
        btnGuardarCliente.textContent = "+ Guardar cliente";
        btnCancelarCliente.style.display = "none";
        mostrarMensajeCliente("");
    }

    // Crear celda de texto de forma segura
    function crearCeldaCliente(fila, valor) {
        const celda = document.createElement("td");
        celda.textContent = valor ?? "";
        fila.appendChild(celda);
        return celda;
    }

    // CONSULTAR CLIENTES
    async function cargarClientes() {
        if (!tieneRol("administrador", "gerente", "vendedor")) return;

        listaClientes.replaceChildren();

        try {
            const respuesta = await fetchAutenticado("/api/clientes");

            if (!respuesta.ok) {
                throw new Error("No se pudieron cargar los clientes");
            }

            const clientes = await respuesta.json();

            if (clientes.length === 0) {
                const fila = document.createElement("tr");
                const celda = document.createElement("td");

                celda.colSpan = tieneRol("administrador", "gerente") ? 6 : 5;
                celda.textContent = "No hay clientes registrados";
                fila.appendChild(celda);
                listaClientes.appendChild(fila);
                return;
            }

            clientes.forEach(cliente => {

                const fila = document.createElement("tr");

                crearCeldaCliente(fila, cliente.id_cliente);
                crearCeldaCliente(fila, cliente.nombre);
                crearCeldaCliente(fila, cliente.apellidos);
                crearCeldaCliente(fila, cliente.correo);
                crearCeldaCliente(fila, cliente.telefono);

                const celdaAcciones = document.createElement("td");

                // BOTÓN EDITAR
                const btnEditar = document.createElement("button");
                btnEditar.type = "button";
                btnEditar.className = "btn-editar";
                btnEditar.textContent = "✏️ Editar";

                btnEditar.addEventListener("click", () => {
                    idCliente.value = cliente.id_cliente;
                    nombreCliente.value = cliente.nombre ?? "";
                    apellidosCliente.value = cliente.apellidos ?? "";
                    correoCliente.value = cliente.correo ?? "";
                    telefonoCliente.value = cliente.telefono ?? "";

                    tituloCliente.textContent = "Editar cliente";
                    btnGuardarCliente.textContent = "💾 Guardar cambios";
                    btnCancelarCliente.style.display = "inline-block";

                    mostrarMensajeCliente("");

                    formCliente.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });
                });

                // BOTÓN ELIMINAR
                const btnEliminar = document.createElement("button");
                btnEliminar.type = "button";
                btnEliminar.className = "btn-eliminar";
                btnEliminar.textContent = "🗑️ Eliminar";

                btnEliminar.addEventListener("click", async () => {

                    const confirmar = confirm(
                        `¿Eliminar al cliente "${cliente.nombre} ${cliente.apellidos}"?`
                    );

                    if (!confirmar) return;

                    btnEliminar.disabled = true;
                    btnEliminar.textContent = "Eliminando...";

                    try {
                        const respuesta = await fetchAutenticado(
                            `/api/clientes/${cliente.id_cliente}`,
                            { method: "DELETE" }
                        );

                        const resultado = await respuesta.json();

                        if (!respuesta.ok) {
                            throw new Error(
                                resultado.error || "No se pudo eliminar"
                            );
                        }

                        if (idCliente.value === String(cliente.id_cliente)) {
                            limpiarFormularioCliente();
                        }

                        mostrarMensajeCliente("Cliente eliminado correctamente");
                        await cargarClientes();

                    } catch (error) {
                        mostrarMensajeCliente(error.message, true);
                        btnEliminar.disabled = false;
                        btnEliminar.textContent = "🗑️ Eliminar";
                    }
                });

                if (tieneRol("administrador", "gerente")) {
                    celdaAcciones.appendChild(btnEditar);
                    if (tieneRol("administrador")) celdaAcciones.appendChild(btnEliminar);
                    fila.appendChild(celdaAcciones);
                }
                listaClientes.appendChild(fila);

            });

        } catch (error) {
            console.error("Error al cargar clientes:", error);
            mostrarMensajeCliente(error.message, true);
        }
    }

    // REGISTRAR O ACTUALIZAR
    formCliente.addEventListener("submit", async (evento) => {

        evento.preventDefault();

        if (!tieneRol("administrador", "gerente")) return;
        const id = idCliente.value.trim();
        const editando = id !== "";

        const datos = {
            nombre: nombreCliente.value.trim(),
            apellidos: apellidosCliente.value.trim(),
            correo: correoCliente.value.trim(),
            telefono: telefonoCliente.value.trim()
        };

        if (!/^\d{10}$/.test(datos.telefono)) {
            mostrarMensajeCliente(
                "El teléfono debe contener exactamente 10 dígitos",
                true
            );
            return;
        }

        btnGuardarCliente.disabled = true;
        btnGuardarCliente.textContent = "Guardando...";

        try {
            const respuesta = await fetchAutenticado(
                editando ? `/api/clientes/${id}` : "/api/clientes",
                {
                    method: editando ? "PUT" : "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(datos)
                }
            );

            const resultado = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(
                    resultado.error || "No se pudo guardar el cliente"
                );
            }

            limpiarFormularioCliente();

            mostrarMensajeCliente(
                editando
                    ? "Cliente actualizado correctamente"
                    : "Cliente registrado correctamente"
            );

            await cargarClientes();

        } catch (error) {
            console.error("Error al guardar cliente:", error);
            mostrarMensajeCliente(error.message, true);

        } finally {
            btnGuardarCliente.disabled = false;
            btnGuardarCliente.textContent = editando && idCliente.value
                ? "💾 Guardar cambios"
                : "+ Guardar cliente";
        }
    });

    // CANCELAR EDICIÓN
    btnCancelarCliente.addEventListener("click", limpiarFormularioCliente);

    // CARGAR CLIENTES AL ABRIR LA PÁGINA
    document.addEventListener("ventaspro:sesion", () => {
        if (["administrador", "gerente", "vendedor"].includes(rolActual())) cargarClientes();
    });

});


/* ==========================================
   REGISTRO DE VENTAS - FRONTEND
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    const formVenta = document.getElementById("form-venta");
    const clienteVenta = document.getElementById("cliente-venta");
    const productoVenta = document.getElementById("producto-venta");
    const cantidadVenta = document.getElementById("cantidad-venta");
    const precioVenta = document.getElementById("precio-venta");
    const stockVenta = document.getElementById("stock-venta");
    const totalVenta = document.getElementById("total-venta");
    const mensajeVenta = document.getElementById("mensaje-venta");

    if (!formVenta) return;

    let productosDisponibles = [];

    const moneda = valor =>
        Number(valor).toLocaleString("es-MX", {
            style: "currency",
            currency: "MXN"
        });

    function mostrarMensajeVenta(texto, error = false) {
        mensajeVenta.textContent = texto;
        mensajeVenta.style.color = error ? "#dc2626" : "#16a34a";
    }

    function actualizarTotalVenta() {

        const producto = productosDisponibles.find(
            p => String(p.id_producto) === productoVenta.value
        );

        const cantidad = Number(cantidadVenta.value);

        if (!producto) {
            precioVenta.value = moneda(0);
            stockVenta.value = "0";
            totalVenta.value = moneda(0);
            return;
        }

        precioVenta.value = moneda(producto.precio);
        stockVenta.value = producto.stock;

        const total = Number.isInteger(cantidad) && cantidad > 0
            ? Number(producto.precio) * cantidad
            : 0;

        totalVenta.value = moneda(total);
    }

    async function cargarDatosVenta() {
        if (!tieneRol("administrador", "gerente", "vendedor")) return;

        try {
            const [respuestaClientes, respuestaProductos] =
                await Promise.all([
                    fetchAutenticado("/api/clientes"),
                    fetchAutenticado("/api/productos")
                ]);

            if (!respuestaClientes.ok || !respuestaProductos.ok) {
                throw new Error("No se pudieron cargar los datos de venta");
            }

            const datosClientes = await respuestaClientes.json();
            const datosProductos = await respuestaProductos.json();

            const clientes = Array.isArray(datosClientes)
                ? datosClientes
                : datosClientes.clientes || [];

            const productos = Array.isArray(datosProductos)
                ? datosProductos
                : datosProductos.productos || [];

            productosDisponibles = productos.filter(
                p => p.estado !== "inactivo" &&
                     Number(p.stock) > 0
            );

            clienteVenta.replaceChildren(
                new Option("Seleccionar cliente", "")
            );

            clientes.forEach(cliente => {
                clienteVenta.add(new Option(
                    `${cliente.nombre} ${cliente.apellidos}`,
                    cliente.id_cliente
                ));
            });

            productoVenta.replaceChildren(
                new Option("Seleccionar producto", "")
            );

            productosDisponibles.forEach(producto => {
                productoVenta.add(new Option(
                    `${producto.nombre} - ${moneda(producto.precio)} (Stock: ${producto.stock})`,
                    producto.id_producto
                ));
            });

            actualizarTotalVenta();
            mostrarMensajeVenta("");

        } catch (error) {
            console.error("Error al cargar datos de venta:", error);
            mostrarMensajeVenta(error.message, true);
        }
    }

    productoVenta.addEventListener("change", actualizarTotalVenta);
    cantidadVenta.addEventListener("input", actualizarTotalVenta);

    
formVenta.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    if (!tieneRol("administrador", "gerente", "vendedor")) return;

    const producto = productosDisponibles.find(
        p => String(p.id_producto) === productoVenta.value
    );

    const cantidad = Number(cantidadVenta.value);
    const idCliente = Number(clienteVenta.value);


    if (!Number.isSafeInteger(idCliente) || idCliente <= 0 || !producto) {
        mostrarMensajeVenta(
            "Selecciona un cliente y un producto",
            true
        );
        return;
    }

    if (!Number.isSafeInteger(cantidad) || cantidad <= 0) {
        mostrarMensajeVenta(
            "Ingresa una cantidad válida",
            true
        );
        return;
    }

    if (cantidad > Number(producto.stock)) {
        mostrarMensajeVenta(
            "La cantidad supera el stock disponible",
            true
        );
        return;
    }

    const boton = document.getElementById("btn-registrar-venta");

    boton.disabled = true;
    boton.textContent = "Registrando venta...";
    mostrarMensajeVenta("Procesando venta...");

    try {
        const respuesta = await fetchAutenticado("/api/ventas", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id_cliente: idCliente,
                productos: [
                    {
                        id_producto: Number(producto.id_producto),
                        cantidad: cantidad
                    }
                ]
            })
        });

        const resultado = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                resultado.error || "No se pudo registrar la venta"
            );
        }

        formVenta.reset();

        await cargarDatosVenta();

        mostrarMensajeVenta(
            `✅ Venta #${resultado.id_venta} registrada correctamente`
        );

    } catch (error) {
        console.error("Error al registrar venta:", error);
        mostrarMensajeVenta(error.message, true);

    } finally {
        boton.disabled = false;
        boton.textContent = "🛒 Registrar venta";
    }
});


    // Recargar los datos cuando se abre la sección Ventas.
    document.querySelectorAll(
        '.sidebar nav a[data-seccion="ventas"]'
    ).forEach(enlace => {
        enlace.addEventListener("click", cargarDatosVenta);
    });

    document.addEventListener("ventaspro:sesion", () => {
        if (["administrador", "gerente", "vendedor"].includes(rolActual())) cargarDatosVenta();
    });

});


/* ==========================================
   HISTORIAL DE VENTAS - FRONTEND
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    const listaHistorial = document.getElementById("lista-historial");
    const mensajeHistorial = document.getElementById("mensaje-historial");
    const btnActualizarHistorial = document.getElementById(
        "btn-actualizar-historial"
    );

    if (!listaHistorial) return;

    // Formatear cantidades monetarias
    function formatoMoneda(valor) {
        return Number(valor || 0).toLocaleString("es-MX", {
            style: "currency",
            currency: "MXN"
        });
    }

    // Crear celdas de manera segura
    function crearCelda(fila, valor) {
        const celda = document.createElement("td");
        celda.textContent = valor ?? "—";
        fila.appendChild(celda);
    }

    // Mostrar mensajes
    function mostrarMensaje(texto, error = false) {
        if (!mensajeHistorial) return;

        mensajeHistorial.textContent = texto;
        mensajeHistorial.style.color = error
            ? "#dc2626"
            : "#16a34a";
    }

    // Mostrar una fila informativa
    function mostrarFilaMensaje(texto) {
        listaHistorial.replaceChildren();

        const fila = document.createElement("tr");
        const celda = document.createElement("td");

        celda.colSpan = 9;
        celda.textContent = texto;
        celda.style.padding = "20px";
        celda.style.textAlign = "center";

        fila.appendChild(celda);
        listaHistorial.appendChild(fila);
    }

    // CONSULTAR HISTORIAL
    async function cargarHistorial() {
        if (!tieneRol("administrador", "gerente", "vendedor")) return;

        mostrarFilaMensaje("Cargando historial...");
        mostrarMensaje("");

        if (btnActualizarHistorial) {
            btnActualizarHistorial.disabled = true;
        }

        try {
            const respuesta = await fetchAutenticado("/api/ventas");

            const resultado = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(
                    resultado.error ||
                    "No se pudo consultar el historial"
                );
            }

            const ventas = Array.isArray(resultado)
                ? resultado
                : resultado.ventas || [];

            if (ventas.length === 0) {
                mostrarFilaMensaje("No hay ventas registradas.");
                return;
            }

            listaHistorial.replaceChildren();

            ventas.forEach(venta => {

                const detalles = Array.isArray(venta.detalle_ventas)
                    ? venta.detalle_ventas
                    : [];

                // Una fila por producto de la venta
                const filas = detalles.length > 0
                    ? detalles
                    : [null];

                filas.forEach((detalle, indice) => {

                    const fila = document.createElement("tr");

                    const fecha = venta.fecha_venta
                        ? new Date(venta.fecha_venta)
                            .toLocaleString("es-MX")
                        : "—";

                    const cliente = venta.clientes
                        ? `${venta.clientes.nombre || ""} ${venta.clientes.apellidos || ""}`.trim()
                        : "—";

                    const usuario = venta.usuarios?.nombre || "—";

                    const producto = detalle?.productos?.nombre || "—";
                    const cantidad = detalle?.cantidad ?? "—";

                    const precio = detalle
                        ? formatoMoneda(detalle.precio_unitario)
                        : "—";

                    // Mostrar el total una sola vez por venta
                    const total = indice === 0
                        ? formatoMoneda(venta.total)
                        : "—";

                    crearCelda(fila, venta.id_venta);
                    crearCelda(fila, fecha);
                    crearCelda(fila, cliente);
                    crearCelda(fila, usuario);
                    crearCelda(fila, producto);
                    crearCelda(fila, cantidad);
                    crearCelda(fila, precio);
                    crearCelda(fila, total);
                    crearCelda(fila, venta.estado || "—");

                    listaHistorial.appendChild(fila);
                });
            });

            mostrarMensaje(
                `${ventas.length} venta(s) consultada(s) correctamente`
            );

        } catch (error) {
            console.error("Error al cargar historial:", error);

            mostrarFilaMensaje("No se pudo cargar el historial.");
            mostrarMensaje(error.message, true);

        } finally {
            if (btnActualizarHistorial) {
                btnActualizarHistorial.disabled = false;
            }
        }
    }

    // Botón actualizar
    if (btnActualizarHistorial) {
        btnActualizarHistorial.addEventListener(
            "click",
            cargarHistorial
        );
    }

    // Actualizar al entrar a la sección Historial
    document.querySelectorAll(
        '.sidebar nav a[data-seccion="historial"]'
    ).forEach(enlace => {
        enlace.addEventListener("click", cargarHistorial);
    });

    // Primera carga
    document.addEventListener("ventaspro:sesion", () => {
        if (["administrador", "gerente", "vendedor"].includes(rolActual())) cargarHistorial();
    });

});


/* ==========================================
   CENTRO DE NOTIFICACIONES - FIREBASE
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    const listaNotificaciones = document.getElementById(
        "lista-notificaciones"
    );

    const notifTotal = document.getElementById("notif-total");
    const notifPendientes = document.getElementById("notif-pendientes");
    const notifLeidas = document.getElementById("notif-leidas");

    const filtroNotificaciones = document.getElementById(
        "filtro-notificaciones"
    );

    const btnActualizar = document.getElementById(
        "btn-actualizar-notificaciones"
    );

    const mensajeNotificaciones = document.getElementById(
        "mensaje-notificaciones"
    );

    if (!listaNotificaciones) return;

    let notificaciones = [];

    // ======================================
    // MOSTRAR MENSAJES
    // ======================================

    function mostrarMensaje(texto, error = false) {
        mensajeNotificaciones.textContent = texto;
        mensajeNotificaciones.style.color = error
            ? "#dc2626"
            : "#16a34a";
    }

    // ======================================
    // CONVERTIR FECHAS DE FIREBASE
    // ======================================

    function obtenerFecha(valor) {
        if (!valor) return null;

        if (typeof valor === "object") {
            const segundos = valor._seconds ?? valor.seconds;

            if (typeof segundos === "number") {
                return new Date(
                    segundos * 1000 +
                    (valor._nanoseconds ?? valor.nanoseconds ?? 0) / 1000000
                );
            }
        }

        const fecha = new Date(valor);

        return Number.isNaN(fecha.getTime()) ? null : fecha;
    }

    // ======================================
    // ACTUALIZAR CONTADORES
    // ======================================

    function actualizarContadores() {

        const pendientes = notificaciones.filter(
            n => n.leida !== true
        ).length;

        const leidas = notificaciones.filter(
            n => n.leida === true
        ).length;

        notifTotal.textContent = notificaciones.length;
        notifPendientes.textContent = pendientes;
        notifLeidas.textContent = leidas;
    }

    // ======================================
    // RENDERIZAR NOTIFICACIONES
    // ======================================

    function mostrarNotificaciones() {

        listaNotificaciones.replaceChildren();

        const filtro = filtroNotificaciones.value;

        const filtradas = notificaciones.filter(n => {

            if (filtro === "pendientes") {
                return n.leida !== true;
            }

            if (filtro === "leidas") {
                return n.leida === true;
            }

            return true;
        });

        if (filtradas.length === 0) {
            const mensaje = document.createElement("p");
            mensaje.textContent =
                "No hay notificaciones para mostrar.";

            listaNotificaciones.appendChild(mensaje);
            return;
        }

        filtradas.forEach(notificacion => {

            const tarjeta = document.createElement("div");

            tarjeta.className = notificacion.leida === true
                ? "item-notificacion leida"
                : "item-notificacion no-leida";

            // ENCABEZADO
            const encabezado = document.createElement("div");
            encabezado.className = "notificacion-encabezado";

            const titulo = document.createElement("strong");
            titulo.className = "notificacion-titulo";
            titulo.textContent =
                notificacion.titulo || "Notificación del sistema";

            const fechaElemento = document.createElement("span");
            fechaElemento.className = "notificacion-fecha";

            const fecha = obtenerFecha(notificacion.fecha);

            fechaElemento.textContent = fecha
                ? fecha.toLocaleString("es-MX")
                : "Fecha no disponible";

            encabezado.appendChild(titulo);
            encabezado.appendChild(fechaElemento);

            // MENSAJE
            const mensaje = document.createElement("p");
            mensaje.className = "notificacion-mensaje";
            mensaje.textContent =
                notificacion.mensaje || "Sin descripción";

            // ESTADO
            const estado = document.createElement("span");
            estado.className = "notificacion-estado";
            estado.textContent = notificacion.leida === true
                ? "✓ Leída"
                : "● Pendiente";

            tarjeta.appendChild(encabezado);
            tarjeta.appendChild(mensaje);
            tarjeta.appendChild(estado);

            // BOTÓN MARCAR COMO LEÍDA
            if (notificacion.leida !== true) {

                const boton = document.createElement("button");

                boton.type = "button";
                boton.className = "btn-marcar-leida";
                boton.textContent = "✓ Marcar como leída";

                boton.addEventListener("click", async () => {

                    boton.disabled = true;
                    boton.textContent = "Actualizando...";

                    try {

                        const respuesta = await fetchAutenticado(
                            `/api/notificaciones/${encodeURIComponent(notificacion.id)}/leida`,
                            {
                                method: "PUT"
                            }
                        );

                        const resultado = await respuesta.json();

                        if (!respuesta.ok) {
                            throw new Error(
                                resultado.error ||
                                "No se pudo actualizar la notificación"
                            );
                        }

                        await cargarNotificaciones();

                        mostrarMensaje(
                            "Notificación marcada como leída"
                        );

                    } catch (error) {

                        console.error(
                            "Error al marcar notificación:",
                            error
                        );

                        mostrarMensaje(error.message, true);

                        boton.disabled = false;
                        boton.textContent = "✓ Marcar como leída";
                    }
                });

                tarjeta.appendChild(boton);
            }

            listaNotificaciones.appendChild(tarjeta);
        });
    }

    // ======================================
    // CONSULTAR FIREBASE
    // ======================================

    async function cargarNotificaciones() {
        if (!tieneRol("administrador", "gerente")) return;

        mostrarMensaje("Cargando notificaciones...");

        if (btnActualizar) {
            btnActualizar.disabled = true;
        }

        try {

            const respuesta = await fetchAutenticado("/api/notificaciones");

            const resultado = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(
                    resultado.error ||
                    "No se pudieron consultar las notificaciones"
                );
            }

            const datos = Array.isArray(resultado)
                ? resultado
                : resultado.notificaciones || [];

            notificaciones = datos.sort((a, b) => {

                const fechaA = obtenerFecha(a.fecha)?.getTime() || 0;
                const fechaB = obtenerFecha(b.fecha)?.getTime() || 0;

                return fechaB - fechaA;
            });

            actualizarContadores();
            mostrarNotificaciones();

            mostrarMensaje(
                `${notificaciones.length} notificación(es) cargada(s)`
            );

        } catch (error) {

            console.error(
                "Error al cargar notificaciones:",
                error
            );

            mostrarMensaje(error.message, true);

        } finally {

            if (btnActualizar) {
                btnActualizar.disabled = false;
            }
        }
    }

    // ======================================
    // EVENTOS
    // ======================================

    filtroNotificaciones.addEventListener(
        "change",
        mostrarNotificaciones
    );

    if (btnActualizar) {
        btnActualizar.addEventListener(
            "click",
            cargarNotificaciones
        );
    }

    // Recargar al entrar a Notificaciones
    document.querySelectorAll(
        '.sidebar nav a[data-seccion="notificaciones"]'
    ).forEach(enlace => {

        enlace.addEventListener(
            "click",
            cargarNotificaciones
        );
    });

    // Primera carga
    document.addEventListener("ventaspro:sesion", () => {
        if (["administrador", "gerente"].includes(rolActual())) cargarNotificaciones();
    });

});



/* ==========================================
   LOGIN Y CIERRE DE SESIÓN - VENTASPRO
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    const pantallaLogin = document.getElementById("pantalla-login");
    const formLogin = document.getElementById("form-login");
    const correoLogin = document.getElementById("login-correo");
    const passwordLogin = document.getElementById("login-password");
    const mensajeLogin = document.getElementById("mensaje-login");
    const btnLogin = document.getElementById("btn-login");

    const nombreSidebar = document.getElementById(
        "nombre-usuario-sidebar"
    );

    const rolSidebar = document.getElementById(
        "rol-usuario-sidebar"
    );

    const nombreHeader = document.getElementById(
        "nombre-usuario-header"
    );

    const btnCerrarSesion = document.getElementById(
        "btn-cerrar-sesion"
    );

    if (!pantallaLogin || !formLogin) return;

    // ======================================
    // MOSTRAR INFORMACIÓN DEL USUARIO
    // ======================================

    function mostrarUsuario(usuario) {

        const nombresRoles = {
            administrador: "Administrador",
            gerente: "Gerente",
            vendedor: "Vendedor",
            cliente: "Cliente"
        };

        if (nombreSidebar) {
            nombreSidebar.textContent = `👤 ${usuario.nombre}`;
        }

        if (rolSidebar) {
            rolSidebar.textContent =
                nombresRoles[usuario.rol] || usuario.rol;
        }

        if (nombreHeader) {
            nombreHeader.textContent = `👤 ${usuario.nombre}`;
        }

        usuarioActual = usuario;
        aplicarPermisos();
        pantallaLogin.style.display = "none";
        document.dispatchEvent(new Event("ventaspro:sesion"));
    }

    // ======================================
    // INICIAR SESIÓN
    // ======================================

    
    // ======================================
    // RECUPERAR SESIÓN AUTOMÁTICAMENTE
    // ======================================

    async function recuperarSesion() {

        const token = sessionStorage.getItem("ventaspro_token");

        pantallaLogin.style.display = "flex";

        // Si no existe token, mostrar el login
        if (!token) {
            return;
        }

        btnLogin.disabled = true;
        btnLogin.textContent = "Verificando sesión...";

        try {

            const respuesta = await fetch("/api/auth/me", {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            const resultado = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(
                    resultado.error || "Sesión inválida"
                );
            }

            // Actualizar información del usuario
            sessionStorage.setItem(
                "ventaspro_usuario",
                JSON.stringify(resultado.usuario)
            );

            // Mostrar el sistema
            mostrarUsuario(resultado.usuario);

            console.log("Sesión recuperada correctamente");

        } catch (error) {

            // Eliminar sesión inválida
            sessionStorage.removeItem("ventaspro_token");
            sessionStorage.removeItem("ventaspro_usuario");

            pantallaLogin.style.display = "flex";

            mensajeLogin.textContent =
                "Inicia sesión nuevamente.";

            mensajeLogin.style.color = "#dc2626";

        } finally {

            btnLogin.disabled = false;
            btnLogin.textContent = "Iniciar sesión";

        }

    }

    recuperarSesion();


    formLogin.addEventListener("submit", async (evento) => {

        evento.preventDefault();

        const correo = correoLogin.value.trim();
        const password = passwordLogin.value;

        mensajeLogin.textContent = "";
        btnLogin.disabled = true;
        btnLogin.textContent = "Verificando...";

        try {

            const respuesta = await fetch("/api/auth/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    correo,
                    password
                })
            });

            const resultado = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(
                    resultado.error || "No se pudo iniciar sesión"
                );
            }

            // Guardar información de la sesión
            sessionStorage.setItem(
                "ventaspro_token",
                resultado.access_token
            );

            sessionStorage.setItem(
                "ventaspro_usuario",
                JSON.stringify(resultado.usuario)
            );

            // Mostrar usuario autenticado
            mostrarUsuario(resultado.usuario);

            // Limpiar formulario
            formLogin.reset();

            console.log(
                "Sesión iniciada:",
                resultado.usuario.nombre,
                "Rol:",
                resultado.usuario.rol
            );

        } catch (error) {

            mensajeLogin.textContent = error.message;
            mensajeLogin.style.color = "#dc2626";

        } finally {

            btnLogin.disabled = false;
            btnLogin.textContent = "Iniciar sesión";

        }

    });

    // ======================================
    // CERRAR SESIÓN LOCAL
    // ======================================

    if (btnCerrarSesion) {

        btnCerrarSesion.addEventListener("click", () => {

            const confirmar = confirm(
                "¿Estás seguro de que deseas cerrar sesión?"
            );

            if (!confirmar) return;

            // Eliminar información de la sesión
            sessionStorage.removeItem("ventaspro_token");
            sessionStorage.removeItem("ventaspro_usuario");

            // Regresar al login y limpiar la interfaz
            window.location.reload();

        });

    }

});

/* ==========================================
   GESTIÓN DE USUARIOS Y ROLES - VENTASPRO
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    const formulario = document.getElementById("form-usuario");
    const listaUsuarios = document.getElementById("lista-usuarios");

    if (!formulario || !listaUsuarios) return;

    const idUsuario = document.getElementById("id-usuario");
    const nombre = document.getElementById("nombre-usuario");
    const correo = document.getElementById("correo-usuario");
    const password = document.getElementById("password-usuario");
    const rol = document.getElementById("rol-usuario");

    const titulo = document.getElementById("titulo-form-usuario");
    const btnGuardar = document.getElementById("btn-guardar-usuario");
    const btnCancelar = document.getElementById("btn-cancelar-usuario");
    const btnActualizar = document.getElementById("btn-actualizar-usuarios");
    const mensaje = document.getElementById("mensaje-usuario");

    const esAdministrador = () => rolActual() === "administrador";

    // MOSTRAR MENSAJES

    function mostrarMensaje(texto, error = false) {

        mensaje.textContent = texto;
        mensaje.style.color = error ? "#dc2626" : "#16a34a";

    }

    // LIMPIAR FORMULARIO

    function limpiarFormulario() {

        formulario.reset();

        idUsuario.value = "";

        password.required = true;
        password.placeholder = "Mínimo 8 caracteres";

        correo.disabled = false;
        rol.disabled = false;

        titulo.textContent = "Registrar nuevo usuario";
        btnGuardar.textContent = "+ Registrar usuario";
        btnCancelar.style.display = "none";

        mostrarMensaje("");

    }

    // ACTUALIZAR CONTADORES

    function actualizarContadores(usuarios) {

        document.getElementById("total-usuarios").textContent =
            usuarios.length;

        document.getElementById("total-administradores").textContent =
            usuarios.filter(u => u.rol === "administrador").length;

        document.getElementById("total-gerentes").textContent =
            usuarios.filter(u => u.rol === "gerente").length;

        document.getElementById("total-vendedores").textContent =
            usuarios.filter(u => u.rol === "vendedor").length;

        document.getElementById("total-usuarios-clientes").textContent =
            usuarios.filter(u => u.rol === "cliente").length;

    }

    // CREAR CELDAS SEGURAS

    function crearCelda(fila, valor) {

        const celda = document.createElement("td");

        celda.textContent = valor ?? "—";

        fila.appendChild(celda);

        return celda;

    }

    // EDITAR USUARIO

    function editarUsuario(usuario) {

        if (!esAdministrador()) return;

        idUsuario.value = usuario.id_usuario;
        nombre.value = usuario.nombre;
        correo.value = usuario.correo;
        rol.value = usuario.rol;

        password.value = "";
        password.required = false;
        password.placeholder = "Dejar vacío para conservar contraseña";

        const esCuentaPropia =
            String(usuario.id_usuario) ===
            String(usuarioActual.id_usuario);

        rol.disabled = esCuentaPropia;

        // El correo no se modifica desde este formulario.
        correo.disabled = true;

        titulo.textContent = "Editar usuario";
        btnGuardar.textContent = "💾 Guardar cambios";
        btnCancelar.style.display = "inline-block";

        mostrarMensaje("");

        formulario.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    }

    // ACTIVAR O DESACTIVAR USUARIO

    async function cambiarEstado(usuario) {

        if (!esAdministrador()) return;

        if (
            String(usuario.id_usuario) ===
            String(usuarioActual.id_usuario)
        ) {

            mostrarMensaje(
                "No puedes desactivar tu propia cuenta",
                true
            );

            return;

        }

        const nuevoEstado = usuario.estado === "inactivo"
            ? "activo"
            : "inactivo";

        const confirmar = confirm(
            `¿Deseas ${nuevoEstado === "activo"
                ? "activar"
                : "desactivar"} a ${usuario.nombre}?`
        );

        if (!confirmar) return;

        try {

            const respuesta = await fetchAutenticado(
                `/api/usuarios/${usuario.id_usuario}/estado`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        estado: nuevoEstado
                    })
                }
            );

            const resultado = await respuesta.json();

            if (!respuesta.ok) {

                throw new Error(
                    resultado.error ||
                    "No se pudo cambiar el estado"
                );

            }

            await cargarUsuarios();

            mostrarMensaje("Estado actualizado correctamente");

        } catch (error) {

            mostrarMensaje(error.message, true);

        }

    }

    // CONSULTAR USUARIOS

    async function cargarUsuarios() {

        if (!esAdministrador()) return;

        btnActualizar.disabled = true;

        try {

            const respuesta = await fetchAutenticado("/api/usuarios");

            const resultado = await respuesta.json();

            if (!respuesta.ok) {

                throw new Error(
                    resultado.error ||
                    "No se pudieron consultar los usuarios"
                );

            }

            const usuarios = Array.isArray(resultado)
                ? resultado
                : resultado.usuarios || [];

            actualizarContadores(usuarios);

            listaUsuarios.replaceChildren();

            if (usuarios.length === 0) {

                const fila = document.createElement("tr");
                const celda = crearCelda(
                    fila,
                    "No hay usuarios registrados"
                );

                celda.colSpan = 7;

                listaUsuarios.appendChild(fila);

                return;

            }

            usuarios.forEach(usuario => {

                const fila = document.createElement("tr");

                crearCelda(fila, usuario.id_usuario);
                crearCelda(fila, usuario.nombre);
                crearCelda(fila, usuario.correo);
                crearCelda(fila, usuario.rol);

                crearCelda(
                    fila,
                    usuario.fecha_registro
                        ? new Date(usuario.fecha_registro)
                            .toLocaleDateString("es-MX")
                        : "—"
                );

                const estado = crearCelda(
                    fila,
                    usuario.estado || "activo"
                );

                estado.style.color =
                    usuario.estado === "inactivo"
                        ? "#dc2626"
                        : "#16a34a";

                const acciones = document.createElement("td");

                // BOTÓN EDITAR

                const btnEditar = document.createElement("button");

                btnEditar.type = "button";
                btnEditar.className = "btn-editar";
                btnEditar.textContent = "✏️ Editar";

                btnEditar.addEventListener("click", () => {
                    editarUsuario(usuario);
                });

                acciones.appendChild(btnEditar);

                // BOTÓN ACTIVAR O DESACTIVAR

                const btnEstado = document.createElement("button");

                btnEstado.type = "button";

                btnEstado.className =
                    usuario.estado === "inactivo"
                        ? "btn-guardar"
                        : "btn-eliminar";

                btnEstado.textContent =
                    usuario.estado === "inactivo"
                        ? "✓ Activar"
                        : "🚫 Desactivar";

                const esCuentaPropia =
                    String(usuario.id_usuario) ===
                    String(usuarioActual.id_usuario);

                if (!esCuentaPropia) {

                    btnEstado.addEventListener("click", () => {
                        cambiarEstado(usuario);
                    });

                    acciones.appendChild(btnEstado);

                }

                fila.appendChild(acciones);
                listaUsuarios.appendChild(fila);

            });

        } catch (error) {

            listaUsuarios.replaceChildren();

            const fila = document.createElement("tr");
            const celda = crearCelda(
                fila,
                "No se pudieron cargar los usuarios"
            );

            celda.colSpan = 7;

            listaUsuarios.appendChild(fila);

            mostrarMensaje(error.message, true);

        } finally {

            btnActualizar.disabled = false;

        }

    }

    // REGISTRAR O ACTUALIZAR USUARIO

    formulario.addEventListener("submit", async evento => {

        evento.preventDefault();

        if (!esAdministrador()) return;

        const id = idUsuario.value;
        const editando = id !== "";

        const datos = {

            nombre: nombre.value.trim(),
            correo: correo.value.trim(),
            rol: rol.value

        };

        if (password.value) {

            datos.password = password.value;

        }

        if (
            (!editando && !password.value) ||
            (password.value && password.value.length < 8)
        ) {

            mostrarMensaje(
                "La contraseña debe tener al menos 8 caracteres",
                true
            );

            return;

        }

        btnGuardar.disabled = true;
        btnGuardar.textContent = "Guardando...";

        try {

            const respuesta = await fetchAutenticado(
                editando
                    ? `/api/usuarios/${id}`
                    : "/api/usuarios",
                {
                    method: editando ? "PUT" : "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(datos)
                }
            );

            const resultado = await respuesta.json();

            if (!respuesta.ok) {

                throw new Error(
                    resultado.error ||
                    "No se pudo guardar el usuario"
                );

            }

            limpiarFormulario();

            await cargarUsuarios();

            mostrarMensaje(
                editando
                    ? "Usuario actualizado correctamente"
                    : "Usuario registrado correctamente"
            );

        } catch (error) {

            mostrarMensaje(error.message, true);

        } finally {

            btnGuardar.disabled = false;

            btnGuardar.textContent = idUsuario.value
                ? "💾 Guardar cambios"
                : "+ Registrar usuario";

        }

    });

    // EVENTOS

    btnCancelar.addEventListener("click", limpiarFormulario);

    btnActualizar.addEventListener("click", cargarUsuarios);

    document.querySelectorAll(
        '.sidebar nav a[data-seccion="usuarios"]'
    ).forEach(enlace => {

        enlace.addEventListener("click", () => {

            if (esAdministrador()) cargarUsuarios();

        });

    });

});

/* ==========================================
   HISTORIAL DE ACTIVIDADES - VENTASPRO
========================================== */

document.addEventListener("DOMContentLoaded", () => {

    const lista = document.getElementById("lista-actividades");

    if (!lista) return;

    const filtroModulo = document.getElementById("filtro-modulo-actividad");
    const filtroUsuario = document.getElementById("filtro-usuario-actividad");
    const filtroResultado = document.getElementById("filtro-resultado-actividad");
    const filtroFecha = document.getElementById("filtro-fecha-actividad");

    const btnActualizar = document.getElementById("btn-actualizar-actividades");
    const btnLimpiar = document.getElementById("btn-limpiar-filtros-actividades");

    const mensaje = document.getElementById("mensaje-actividades");
    const cantidad = document.getElementById("cantidad-actividades");

    let actividades = [];

    const tienePermiso = () =>
        ["administrador", "gerente"].includes(rolActual());

    // MOSTRAR MENSAJES

    function mostrarMensaje(texto, error = false) {

        mensaje.textContent = texto;

        mensaje.style.color = error
            ? "#dc2626"
            : "#16a34a";

    }

    // CONVERTIR FECHAS DE FIREBASE

    function convertirFecha(fecha) {

        if (!fecha) return null;

        let resultado;

        if (typeof fecha === "object") {

            const segundos = fecha._seconds ?? fecha.seconds;

            if (typeof segundos !== "number") return null;

            resultado = new Date(segundos * 1000);

        } else {

            resultado = new Date(fecha);

        }

        return Number.isNaN(resultado.getTime())
            ? null
            : resultado;

    }

    // OBTENER FECHA LOCAL PARA LOS FILTROS

    function fechaLocal(fecha) {

        if (!fecha) return "";

        const anio = fecha.getFullYear();

        const mes = String(
            fecha.getMonth() + 1
        ).padStart(2, "0");

        const dia = String(
            fecha.getDate()
        ).padStart(2, "0");

        return `${anio}-${mes}-${dia}`;

    }

    // FORMATEAR FECHA Y HORA

    function formatearFecha(fecha) {

        const fechaConvertida = convertirFecha(fecha);

        if (!fechaConvertida) return "Sin fecha";

        return fechaConvertida.toLocaleString("es-MX", {

            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"

        });

    }

    // FORMATEAR TEXTO

    function formatearTexto(texto) {

        if (!texto) return "—";

        const valor = String(texto).replace(/_/g, " ");

        return valor.charAt(0).toUpperCase() +
            valor.slice(1);

    }

    // ACTUALIZAR CONTADORES

    function actualizarContadores() {

        const hoy = fechaLocal(new Date());

        document.getElementById("total-actividades").textContent =
            actividades.length;

        document.getElementById("actividades-exitosas").textContent =
            actividades.filter(a =>
                a.resultado === "exitoso"
            ).length;

        document.getElementById("actividades-fallidas").textContent =
            actividades.filter(a =>
                a.resultado === "fallido"
            ).length;

        document.getElementById("actividades-hoy").textContent =
            actividades.filter(a =>
                fechaLocal(convertirFecha(a.fecha)) === hoy
            ).length;

    }

    // CARGAR USUARIOS EN EL FILTRO

    function cargarFiltroUsuarios() {

        const seleccionAnterior = filtroUsuario.value;

        filtroUsuario.replaceChildren();

        const opcionTodos = document.createElement("option");

        opcionTodos.value = "todos";
        opcionTodos.textContent = "Todos los usuarios";

        filtroUsuario.appendChild(opcionTodos);

        const usuarios = new Map();

        actividades.forEach(actividad => {

            if (actividad.id_usuario != null) {

                usuarios.set(

                    String(actividad.id_usuario),

                    actividad.nombre_usuario ||
                    `Usuario #${actividad.id_usuario}`

                );

            }

        });

        usuarios.forEach((nombre, id) => {

            const opcion = document.createElement("option");

            opcion.value = id;
            opcion.textContent = nombre;

            filtroUsuario.appendChild(opcion);

        });

        filtroUsuario.value = usuarios.has(seleccionAnterior)
            ? seleccionAnterior
            : "todos";

    }

    // CREAR CELDAS DE FORMA SEGURA

    function crearCelda(fila, texto) {

        const celda = document.createElement("td");

        celda.textContent = texto ?? "—";

        fila.appendChild(celda);

        return celda;

    }

    // MOSTRAR TABLA DE ACTIVIDADES

    function mostrarActividades(datos) {

        lista.replaceChildren();

        cantidad.textContent =
            `Mostrando ${datos.length} de ${actividades.length} actividades`;

        if (datos.length === 0) {

            const fila = document.createElement("tr");

            const celda = crearCelda(
                fila,
                "No se encontraron actividades"
            );

            celda.colSpan = 7;

            lista.appendChild(fila);

            return;

        }

        datos.forEach(actividad => {

            const fila = document.createElement("tr");

            crearCelda(
                fila,
                formatearFecha(actividad.fecha)
            );

            crearCelda(
                fila,
                actividad.nombre_usuario ||
                (actividad.id_usuario != null
                    ? `Usuario #${actividad.id_usuario}`
                    : "Sin identificar")
            );

            crearCelda(
                fila,
                formatearTexto(actividad.rol)
            );

            crearCelda(
                fila,
                formatearTexto(actividad.modulo)
            );

            crearCelda(
                fila,
                formatearTexto(actividad.accion)
            );

            crearCelda(
                fila,
                actividad.descripcion
            );

            // ESTADO DE LA OPERACIÓN

            const celdaResultado = document.createElement("td");

            const etiqueta = document.createElement("span");

            etiqueta.textContent =
                formatearTexto(actividad.resultado);

            etiqueta.className = "resultado-actividad";

            if (actividad.resultado === "exitoso") {

                etiqueta.classList.add("resultado-exitoso");

            } else if (actividad.resultado === "fallido") {

                etiqueta.classList.add("resultado-fallido");

            }

            celdaResultado.appendChild(etiqueta);

            fila.appendChild(celdaResultado);

            lista.appendChild(fila);

        });

    }

    // APLICAR FILTROS

    function aplicarFiltros() {

        if (!tienePermiso()) return;

        const modulo = filtroModulo.value;
        const usuario = filtroUsuario.value;
        const resultado = filtroResultado.value;
        const fecha = filtroFecha.value;

        const filtradas = actividades.filter(actividad => {

            const coincideModulo =
                modulo === "todos" ||
                actividad.modulo === modulo;

            const coincideUsuario =
                usuario === "todos" ||
                String(actividad.id_usuario) === usuario;

            const coincideResultado =
                resultado === "todos" ||
                actividad.resultado === resultado;

            const coincideFecha =
                !fecha ||
                fechaLocal(convertirFecha(actividad.fecha)) === fecha;

            return coincideModulo &&
                coincideUsuario &&
                coincideResultado &&
                coincideFecha;

        });

        mostrarActividades(filtradas);

    }

    // CONSULTAR ACTIVIDADES DESDE EL BACKEND

    async function cargarActividades() {

        if (!tienePermiso()) return;

        btnActualizar.disabled = true;

        mostrarMensaje("Consultando actividades...");

        try {

            const respuesta = await fetchAutenticado(
                "/api/actividades"
            );

            if (!respuesta.ok) {

                const error = await respuesta.json().catch(() => ({}));

                throw new Error(
                    error.error ||
                    "No se pudieron consultar las actividades"
                );

            }

            const resultado = await respuesta.json();

            actividades = Array.isArray(resultado)
                ? resultado
                : resultado.actividades || [];

            // Ordenar de la más reciente a la más antigua

            actividades.sort((a, b) => {

                const fechaA = convertirFecha(a.fecha);
                const fechaB = convertirFecha(b.fecha);

                return (fechaB?.getTime() || 0) -
                    (fechaA?.getTime() || 0);

            });

            actualizarContadores();

            cargarFiltroUsuarios();

            aplicarFiltros();

            mostrarMensaje("");

        } catch (error) {

            actividades = [];

            actualizarContadores();

            cargarFiltroUsuarios();

            lista.replaceChildren();

            const fila = document.createElement("tr");

            const celda = crearCelda(
                fila,
                "No se pudieron cargar las actividades"
            );

            celda.colSpan = 7;

            lista.appendChild(fila);

            cantidad.textContent = "Mostrando 0 actividades";

            mostrarMensaje(error.message, true);

        } finally {

            btnActualizar.disabled = false;

        }

    }

    // LIMPIAR FILTROS

    btnLimpiar.addEventListener("click", () => {

        filtroModulo.value = "todos";
        filtroUsuario.value = "todos";
        filtroResultado.value = "todos";
        filtroFecha.value = "";

        aplicarFiltros();

    });

    // EVENTOS DE FILTRADO

    filtroModulo.addEventListener("change", aplicarFiltros);

    filtroUsuario.addEventListener("change", aplicarFiltros);

    filtroResultado.addEventListener("change", aplicarFiltros);

    filtroFecha.addEventListener("change", aplicarFiltros);

    // ACTUALIZAR ACTIVIDADES

    btnActualizar.addEventListener("click", cargarActividades);

    // CARGAR AL ENTRAR AL MÓDULO

    document.querySelectorAll(
        '.sidebar nav a[data-seccion="actividades"]'
    ).forEach(enlace => {

        enlace.addEventListener("click", () => {

            if (tienePermiso()) {

                cargarActividades();

            }

        });

    });

});