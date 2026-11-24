# Estrategia de solución

## Backend

### Principios

- **Contrato único.** Los esquemas Zod de peticiones y respuestas se declaran una vez en un paquete compartido y los
  consumen el backend, el frontend y las pruebas. El documento OpenAPI se genera a partir de ellos, por lo que no hay
  contratos que mantener aparte.
- **Organización por funcionalidad.** El código se agrupa por módulo y no por tipo técnico.
- **Una operación, un archivo.** Cada operación define en un mismo archivo su ruta, su validación y su contrato.
- **Tipos inferidos.** Hono infiere los tipos a partir de la definición de la ruta, por lo que no se usan controladores
  separados.
- **Respuestas filtradas.** Todo cuerpo correcto se serializa con el esquema del contrato, de modo que ningún dato
  interno llega al cliente.
- **Errores públicos estables.** Cada error expone un código propio y nunca el detalle interno.

## Frontend

### Principios

- Agrupa el código por funcionalidad, no por tipo de archivo.
- Mantén juntas las rutas, layouts, páginas, componentes, hooks, peticiones y esquemas de una misma funcionalidad.
- Mueve a las carpetas comunes únicamente lo que usan varias funcionalidades.
- Antes de construir un componente de interfaz, comprueba si existe en el registro de shadcn/ui y úsalo. Las piezas
  propias se reservan para lo que el registro no cubre.
- Mantén una dirección única de dependencias: lo compartido no conoce a las funcionalidades y las funcionalidades no
  conocen a la aplicación.

### Visión general

El código se divide en tres capas. Cada capa solo puede importar de las que están a su derecha.

```text
app  ──►  features  ──►  compartido (components/, hooks/, lib/ y paquetes del monorepo)
```

- **`app/`** ensambla: router, proveedores globales y páginas globales.
- **`features/`** contiene cada funcionalidad aislada de las demás.
- **Compartido** reúne lo reutilizable: componentes comunes, hooks, utilidades y los paquetes del monorepo.
