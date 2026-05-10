# Presupuesto Hogar

App web simple para registrar ingresos, gastos, metas de ahorro e inversiones en USD.

## Funciones iniciales

- Caja separada de ingresos para registrar ingresos fijos, variables y unicos.
- Caja separada de gastos para registrar gastos fijos, variables y unicos.
- Movimientos fijos semanales o mensuales con versiones historicas.
- Periodo principal mensual, con opcion quincenal o semanal.
- Metas de compra futura con calculo de ahorro mensual.
- Modulo separado para compras futuras y metas de ahorro.
- Modulo de capacidad de inversion con proyeccion mensual y safety net.
- Calendario de ahorro generado desde la fecha de inicio hasta la fecha objetivo.
- Pestana de inversiones para registrar banco, producto financiero, monto, tasa, plazo y monto final estimado.
- Productos populares: poliza, cuenta de ahorro programado y cuenta de ahorro flexible.
- Seguimiento de inversiones activas, futuras y finalizadas.
- Datos guardados en el navegador con `localStorage`.
- Sin login en esta primera version.

## Ejecutar localmente

Requisito: Node.js instalado.

```bash
node server.mjs
```

Luego abre:

```text
http://localhost:4173
```

Tambien puedes abrir `index.html` directamente en el navegador, aunque el servidor local se parece mas al uso real.

## Pruebas

```bash
node test/run-tests.mjs
```

## Modulo de inversiones

Cada inversion permite registrar:

- Banco o entidad.
- Producto financiero: poliza, ahorro programado o ahorro flexible.
- Monto invertido.
- Tasa anual.
- Abono mensual cuando el producto es cuenta de ahorro programado.
- Fecha de inicio y fecha de finalizacion.

Reglas actuales:

- Poliza: monto fijo con interes fijo durante el plazo; tiene alerta de renovacion una semana antes del vencimiento.
- Ahorro programado: monto inicial mas abono mensual; usa interes compuesto mensual.
- Ahorro flexible: saldo inicial con interes anual pequeno pagado diariamente; usa interes compuesto diario.

La app calcula el monto final estimado, el interes ganado, aportes acumulados cuando aplica y el proximo vencimiento. Estos calculos son una ayuda de seguimiento; antes de tomar decisiones financieras importantes conviene comparar con la tabla oficial entregada por el banco.

## Movimientos fijos

Los ingresos y gastos fijos permiten programar valores que se repiten cada semana o cada mes.

- Si registras un ingreso fijo semanal, aparece en cada semana del mes.
- Si editas el monto, la app cierra la version anterior y crea una nueva desde la fecha indicada.
- Si eliminas un fijo, se detiene hacia adelante y los periodos pasados siguen visibles.
- Los fijos se incluyen en el resumen, la lista del periodo y el calendario.

## Capacidad de inversion

El modulo calcula cuanto dinero se podria invertir sin comprometer liquidez futura.

- Usa dinero disponible actual.
- Proyecta ingresos y gastos fijos.
- Estima gastos variables usando historial y un buffer conservador.
- Resta ahorros mensuales requeridos por metas.
- Suma inversiones que vencen en cada mes.
- Reserva una safety net basada en meses de gastos necesarios.

## Raspberry Pi

Opcion recomendada con Node.js:

1. Copia esta carpeta a la Raspberry Pi.
2. Instala Node.js si aun no esta instalado.
3. Ejecuta:

```bash
PORT=4173 node server.mjs
```

4. En otro equipo de la misma red, abre:

```text
http://IP_DE_LA_RASPBERRY:4173
```

El servidor Node guarda los datos centrales en:

```text
data/budget-state.json
```

Opcion para uso permanente:

- Crear un servicio `systemd` para `server.mjs`.
- Usar Nginx como proxy hacia `http://127.0.0.1:4173`.
- Hacer respaldo periodico de `data/budget-state.json`.

## Proximos pasos DevOps

- Crear ramas `main`, `develop` y `feature/*`.
- Agregar integracion continua cuando exista un repositorio remoto.
- Agregar respaldo de datos si la app se usara desde varios equipos.
