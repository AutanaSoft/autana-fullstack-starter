# Riesgos y deuda técnica

Esta sección lista únicamente lo que está pendiente. Al resolver una entrada, se elimina de aquí: la historia queda en
`git`.

## Deuda técnica

Cada entrada indica por qué se difiere y la condición que obliga a resolverla.

- **Los errores de la referencia `/v1/auth/reference`** se describen con la forma original de Better Auth, no con la
  normalizada.
  - Por qué se difiere: es documentación solo de desarrollo y el plugin no permite cambiarla.
  - Condición: si se necesita una referencia fiel al contrato público.
- **El límite de peticiones guarda los contadores en la memoria del proceso.**
  - Por qué se difiere: con una sola instancia basta y no añade infraestructura.
  - Condición: si la API se despliega con varias instancias, hay que usar un almacén compartido.
- **`hono/csrf` no cubre peticiones JSON,** porque solo inspecciona tipos de contenido de formulario.
  - Por qué se difiere: la API rechaza otros tipos de contenido con `415`, y CORS y `SameSite=Lax` cubren el resto.
  - Condición: si la API acepta formularios o cambia la política de cookies.
- **Hay una sola migración (`0000_db_init`),** que se regenera al cambiar el esquema.
  - Por qué se difiere: la plantilla no tiene datos que preservar.
  - Condición: antes del primer despliegue con datos reales, hay que pasar a migraciones incrementales.

## Riesgos

- **El despliegue no está definido.** Se soportan el frontend y la API bajo el mismo origen (proxy inverso) o en
  dominios distintos del mismo sitio con `VITE_API_URL`, como describe
  [Autenticación en el frontend](./08-conceptos-transversales.md#autenticación-en-el-frontend). Los dominios distintos
  no tienen prueba de extremo a extremo.
  - Mitigación: la prueba del cliente cubre el `baseURL`. Al elegir el despliegue debe crearse la sección 07 y
    comprobarse el inicio de sesión contra los dominios reales.
- **No hay verificación de correo ni recuperación de contraseña.** Una cuenta se crea con cualquier correo bien formado,
  sin comprobar que sea del usuario.
  - Mitigación: ninguna. No se han pedido.
- **Se permiten contraseñas formadas solo por espacios,** porque la contraseña no se recorta ni se normaliza.
  - Mitigación: es una decisión consciente, porque recortarla la modificaría sin avisar al usuario.
- **Las reglas de dependencia del frontend** se comprueban solo en revisión, sin una regla de lint, como indica la nota
  de [Reglas de dependencia](./05-vista-de-bloques.md#reglas-de-dependencia-1).
- **No hay integración continua.** Los hooks de Husky y las pruebas locales son la única barrera, y se pueden omitir.
  - Mitigación: ninguna. Una integración continua debería ejecutar `typecheck`, `lint` y `test`.
- **No hay [pruebas de extremo a extremo](./08-conceptos-transversales.md#pruebas-de-extremo-a-extremo).** Ninguna
  prueba recorre el frontend y la API juntas en un navegador real, así que no se comprueban la cookie de sesión entre
  recargas, las guardas de ruta ni el proxy de Vite.
  - Mitigación: las pruebas de componentes (MSW) y las de la API cubren cada lado por separado. Deben reintroducirse al
    definir el despliegue o la integración continua.
- **Bajo Vitest, Better Auth desactiva la comprobación de origen,** por lo que `403 INVALID_ORIGIN` no tiene prueba
  automática.
  - Mitigación: se comprueba a mano contra la API en ejecución.
