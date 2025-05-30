import React, { useState, useEffect } from 'react';
import { Receipt, AlertTriangle, FileText, Calendar, DollarSign, User, Building, CheckCircle, AlertCircle, Mail, FileCheck, CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabase';

const FacturarView = ({
  pacientes,
  supervisoras,
  currencyMode,
  tipoCambio,
  alquilerConfig,
  openModal
}) => {
  const [loading, setLoading] = useState(true);
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date());
  const [datosFacturacion, setDatosFacturacion] = useState({
    entradas: {
      pendientes: [],
      pagados: []
    },
    salidas: {
      alquiler: 0,
      supervisiones: []
    },
    alertas: []
  });

  // Determinar mes por defecto (actual o anterior si estamos en los primeros 6 días)
  useEffect(() => {
    const hoy = new Date();
    const diaDelMes = hoy.getDate();

    if (diaDelMes <= 6) {
      const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      setMesSeleccionado(mesAnterior);
    } else {
      setMesSeleccionado(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    }
  }, []);

  // Cargar datos cuando cambia el mes
  useEffect(() => {
    if (mesSeleccionado) {
      cargarDatosFacturacion();
    }
  }, [mesSeleccionado, pacientes, supervisoras]);

  const cargarDatosFacturacion = async () => {
    try {
      setLoading(true);

      const year = mesSeleccionado.getFullYear();
      const month = mesSeleccionado.getMonth() + 1;

      const inicioMes = new Date(year, month - 1, 1);
      const finMes = new Date(year, month, 0, 23, 59, 59);
      const hoy = new Date();

      console.log('Cargando datos para:', {
        año: year,
        mes: month,
        inicioMes: inicioMes.toISOString(),
        finMes: finMes.toISOString()
      });

      // 1. Cargar sesiones del mes
      const { data: sesiones, error: sesionesError } = await supabase
        .from('sesiones')
        .select('*')
        .eq('eliminado', false)
        .gte('fecha_hora', inicioMes.toISOString())
        .lte('fecha_hora', finMes.toISOString())
        .order('fecha_hora');

      if (sesionesError) throw sesionesError;

      // 2. Verificar sesiones pendientes de categorizar
      const sesionsPendientesPasadas = (sesiones || []).filter(s =>
        s.estado === 'Pendiente' && new Date(s.fecha_hora) < hoy
      );

      // 3. Procesar entradas por paciente
      const entradasPorPaciente = await procesarEntradas(sesiones || [], year, month, hoy);

      // 4. Procesar salidas
      const salidasData = await procesarSalidas(sesiones || [], inicioMes, finMes);

      // 5. Generar alertas
      const alertas = [];

      if (sesionsPendientesPasadas.length > 0) {
        alertas.push({
          tipo: 'error',
          mensaje: `Hay ${sesionsPendientesPasadas.length} sesión(es) pasada(s) pendiente(s) de categorizar`,
          accion: 'categorizar',
          count: sesionsPendientesPasadas.length
        });
      }

      const sesionesFuturas = (sesiones || []).filter(s =>
        new Date(s.fecha_hora) > hoy && s.estado === 'Pendiente'
      );

      if (sesionesFuturas.length > 0) {
        alertas.push({
          tipo: 'info',
          mensaje: `Se incluyen ${sesionesFuturas.length} sesión(es) futura(s) asumiendo que se realizarán`,
          count: sesionesFuturas.length
        });
      }

      setDatosFacturacion({
        entradas: entradasPorPaciente,
        salidas: salidasData,
        alertas
      });

    } catch (error) {
      console.error('Error cargando datos de facturación:', error);
      alert('Error al cargar datos de facturación: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const procesarEntradas = async (sesiones, año, mes, hoy) => {
    const entradasPorPaciente = [];
    const entradasPagadas = [];

    for (const paciente of pacientes.filter(p => p.activo && !p.eliminado)) {
      // Sesiones del paciente en el mes
      const sesionesPaciente = sesiones.filter(s =>
        s.paciente_id === paciente.id &&
        !['Cancelada', 'Cancelada con antelación', 'Cancelada por mí'].includes(s.estado)
      );

      if (sesionesPaciente.length === 0) continue;

      // Agrupar por tipo de sesión
      const sesionesRegulares = sesionesPaciente.filter(s => s.tipo_sesion === 'Sesión');
      const evaluaciones = sesionesPaciente.filter(s => s.tipo_sesion === 'Evaluación');
      const reevaluaciones = sesionesPaciente.filter(s => s.tipo_sesion === 'Re-evaluación');

      // Calcular totales del mes
      const totalSesiones = sesionesRegulares.reduce((sum, s) =>
        sum + (s.precio_por_hora * s.duracion_horas), 0);
      const totalEvaluaciones = evaluaciones.reduce((sum, s) =>
        sum + (s.precio_por_hora * s.duracion_horas), 0);
      const totalReevaluaciones = reevaluaciones.reduce((sum, s) =>
        sum + (s.precio_por_hora * s.duracion_horas), 0);

      const totalMes = totalSesiones + totalEvaluaciones + totalReevaluaciones;

      // NUEVA LÓGICA: Usar saldo total hasta el mes
      let saldoTotalHastaMes = 0;
      let seguimiento = null;

      try {
        // Calcular saldo total hasta este mes (incluye pagos de cualquier fecha)
        const { data: saldoData, error: saldoError } = await supabase
          .rpc('calcular_saldo_total_hasta_mes', {
            p_paciente_id: paciente.id,
            p_año: año,
            p_mes: mes
          });

        if (!saldoError && saldoData !== null) {
          saldoTotalHastaMes = saldoData;
        }

        // Obtener o crear registro de seguimiento
        seguimiento = await obtenerSeguimiento(paciente.id, año, mes, Math.max(saldoTotalHastaMes, totalMes));

      } catch (error) {
        console.error('Error calculando saldo total:', error);
      }

      const entrada = {
        paciente,
        sesiones: {
          regulares: { cantidad: sesionesRegulares.length, total: totalSesiones, items: sesionesRegulares },
          evaluaciones: { cantidad: evaluaciones.length, total: totalEvaluaciones, items: evaluaciones },
          reevaluaciones: { cantidad: reevaluaciones.length, total: totalReevaluaciones, items: reevaluaciones }
        },
        totalMes,
        saldoTotalHastaMes,
        seguimiento
      };

      // NUEVO: Separar entre pendientes y pagados
      if (seguimiento && seguimiento.completamente_pagado) {
        entradasPagadas.push(entrada);
      } else if (saldoTotalHastaMes > 0) {
        entradasPorPaciente.push(entrada);
      }
    }

    return { pendientes: entradasPorPaciente, pagados: entradasPagadas };
  };

  // Función para detectar si hay una factura por el monto correspondiente
  const detectarFacturacion = async (pacienteId, monto, año, mes) => {
    try {
      // Buscar facturas del paciente en el rango de fechas del mes
      const inicioMesBusqueda = new Date(año, mes - 1, 1).toISOString().split('T')[0];
      const finMesBusqueda = new Date(año, mes, 0).toISOString().split('T')[0];

      const { data: facturas, error } = await supabase
        .from('pagos_recibidos')
        .select('monto_ars, facturado, fecha')
        .eq('paciente_id', pacienteId)
        .eq('facturado', true)
        .eq('eliminado', false)
        .gte('fecha', inicioMesBusqueda)
        .lte('fecha', finMesBusqueda);

      if (error) throw error;

      // Verificar si hay una factura por el monto exacto o similar (±5%)
      const facturaEncontrada = (facturas || []).find(f => {
        const diferencia = Math.abs(f.monto_ars - monto);
        const porcentajeDiferencia = (diferencia / monto) * 100;
        return porcentajeDiferencia <= 5; // Tolerancia del 5%
      });

      return !!facturaEncontrada;
    } catch (error) {
      console.error('Error detectando facturación:', error);
      return false;
    }
  };

  // Función para detectar si está completamente pagado
  const detectarPagoCompleto = async (pacienteId, monto, año, mes) => {
    try {
      // Buscar pagos del paciente hasta la fecha
      const { data: pagos, error } = await supabase
        .from('pagos_recibidos')
        .select('monto_ars')
        .eq('paciente_id', pacienteId)
        .eq('eliminado', false);

      if (error) throw error;

      const totalPagado = (pagos || []).reduce((sum, p) => sum + p.monto_ars, 0);

      // Calcular saldo actual
      const { data: saldoActual } = await supabase
        .rpc('calcular_saldo_total_hasta_mes', {
          p_paciente_id: pacienteId,
          p_año: año,
          p_mes: mes
        });

      return (saldoActual || 0) <= 0; // Está pagado si el saldo es 0 o negativo
    } catch (error) {
      console.error('Error detectando pago completo:', error);
      return false;
    }
  };

  // Función para obtener/crear seguimiento de facturación
  const obtenerSeguimiento = async (pacienteId, año, mes, montoTotal) => {
    try {
      // Buscar registro existente
      let { data: seguimiento, error } = await supabase
        .from('seguimiento_facturacion')
        .select('*')
        .eq('paciente_id', pacienteId)
        .eq('año', año)
        .eq('mes', mes)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      // Detectar estados automáticamente
      const facturadoAutomatico = await detectarFacturacion(pacienteId, montoTotal, año, mes);
      const pagadoAutomatico = await detectarPagoCompleto(pacienteId, montoTotal, año, mes);

      if (!seguimiento) {
        // Crear nuevo registro
        const { data: nuevoSeguimiento, error: createError } = await supabase
          .from('seguimiento_facturacion')
          .insert([{
            paciente_id: pacienteId,
            año: año,
            mes: mes,
            monto_total_facturado: montoTotal,
            enviado_tutor: false,
            facturado: facturadoAutomatico,
            completamente_pagado: pagadoAutomatico,
            fecha_facturado: facturadoAutomatico ? new Date().toISOString() : null,
            fecha_pago_completo: pagadoAutomatico ? new Date().toISOString() : null
          }])
          .select()
          .single();

        if (createError) throw createError;
        seguimiento = nuevoSeguimiento;
      } else {
        // Actualizar detección automática si cambió
        const needsUpdate = seguimiento.facturado !== facturadoAutomatico ||
          seguimiento.completamente_pagado !== pagadoAutomatico;

        if (needsUpdate) {
          const updateData = {
            facturado: facturadoAutomatico,
            completamente_pagado: pagadoAutomatico
          };

          if (facturadoAutomatico && !seguimiento.facturado) {
            updateData.fecha_facturado = new Date().toISOString();
          }

          if (pagadoAutomatico && !seguimiento.completamente_pagado) {
            updateData.fecha_pago_completo = new Date().toISOString();
          }

          const { data: seguimientoActualizado, error: updateError } = await supabase
            .from('seguimiento_facturacion')
            .update(updateData)
            .eq('id', seguimiento.id)
            .select()
            .single();

          if (updateError) throw updateError;
          seguimiento = seguimientoActualizado;
        }
      }

      return seguimiento;
    } catch (error) {
      console.error('Error en seguimiento:', error);
      return null;
    }
  };

  // Función para actualizar estado de seguimiento (solo para "enviado_tutor")
  const actualizarSeguimiento = async (seguimientoId, campo, valor) => {
    try {
      const updateData = { [campo]: valor };

      if (campo === 'enviado_tutor' && valor) {
        updateData.fecha_envio = new Date().toISOString();
      }

      const { error } = await supabase
        .from('seguimiento_facturacion')
        .update(updateData)
        .eq('id', seguimientoId);

      if (error) throw error;

      // Recargar datos
      cargarDatosFacturacion();

      if (window.showToast) {
        const mensaje = valor ? 'Marcado como enviado al tutor' : 'Desmarcado envío al tutor';
        window.showToast(mensaje, 'success');
      }

    } catch (error) {
      console.error('Error actualizando seguimiento:', error);
      alert('Error al actualizar seguimiento: ' + error.message);
    }
  };

  const procesarSalidas = async (sesiones, inicioMes, finMes) => {
    // Calcular alquiler pendiente
    const fechaInicioAlquiler = new Date('2025-05-01');
    const mesActual = new Date(mesSeleccionado.getFullYear(), mesSeleccionado.getMonth(), 1);

    let mesesAlquiler = 0;
    if (mesActual >= fechaInicioAlquiler) {
      const diffTime = mesActual.getTime() - fechaInicioAlquiler.getTime();
      mesesAlquiler = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44)) + 1;
    }

    const totalAlquilerAdeudado = mesesAlquiler * (alquilerConfig?.precio_mensual || 0);

    const { data: pagosAlquiler } = await supabase
      .from('pagos_hechos')
      .select('monto_ars')
      .eq('concepto', 'Alquiler')
      .eq('eliminado', false);

    const totalAlquilerPagado = (pagosAlquiler || []).reduce((sum, p) => sum + p.monto_ars, 0);
    const alquilerPendiente = totalAlquilerAdeudado - totalAlquilerPagado;

    // Calcular supervisiones pendientes
    const supervisionesPorSupervisora = [];

    for (const supervisora of supervisoras.filter(s => !s.eliminado)) {
      const { data: sesionesSupervision } = await supabase
        .from('sesiones')
        .select('precio_por_hora, duracion_horas, fecha_hora')
        .eq('supervisora_id', supervisora.id)
        .eq('tipo_sesion', 'Supervisión')
        .eq('estado', 'Realizada')
        .eq('eliminado', false);

      const totalAdeudado = (sesionesSupervision || []).reduce((sum, s) =>
        sum + (s.precio_por_hora * s.duracion_horas), 0);

      const { data: pagosSupervision } = await supabase
        .from('pagos_hechos')
        .select('monto_ars')
        .eq('supervisora_id', supervisora.id)
        .eq('eliminado', false);

      const totalPagado = (pagosSupervision || []).reduce((sum, p) => sum + p.monto_ars, 0);
      const saldoPendiente = totalAdeudado - totalPagado;

      if (saldoPendiente > 0) {
        supervisionesPorSupervisora.push({
          supervisora,
          totalAdeudado,
          totalPagado,
          saldoPendiente,
          sesionesCount: (sesionesSupervision || []).length
        });
      }
    }

    return {
      alquiler: Math.max(0, alquilerPendiente),
      supervisiones: supervisionesPorSupervisora
    };
  };

  const formatCurrency = (amount, currency = currencyMode) => {
    if (currency === 'USD') {
      return `$${(amount / tipoCambio).toFixed(0)} USD`;
    }
    return `$${amount.toLocaleString()} ARS`;
  };

  const calcularNetoTotal = () => {
    const totalIngresos = (datosFacturacion.entradas.pendientes || []).reduce((sum, e) => sum + e.saldoTotalHastaMes, 0);
    const totalGastos = datosFacturacion.salidas.alquiler +
      datosFacturacion.salidas.supervisiones.reduce((sum, s) => sum + s.saldoPendiente, 0);
    return totalIngresos - totalGastos;
  };

  const generarOpcionesMes = () => {
    const opciones = [];
    const hoy = new Date();

    for (let year = 2025; year <= hoy.getFullYear() + 1; year++) {
      const maxMonth = year === hoy.getFullYear() + 1 ? 2 : 11;
      for (let month = 0; month <= maxMonth; month++) {
        const fecha = new Date(year, month, 1);
        const esMuyFuturo = fecha > new Date(hoy.getFullYear(), hoy.getMonth() + 3, 1);
        if (!esMuyFuturo) {
          opciones.push({
            valor: fecha,
            etiqueta: fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
          });
        }
      }
    }

    return opciones.reverse();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Calculando facturación...</p>
        </div>
      </div>
    );
  }

  const netoTotal = calcularNetoTotal();

  return (
    <div className="space-y-6">
      {/* Header con selector de mes */}
      <div className="glass-effect p-6 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-700 rounded-xl flex items-center justify-center shadow-lg">
              <Receipt className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Facturación</h2>
              <p className="text-gray-600">Resumen mensual de ingresos y gastos</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar size={20} className="text-gray-500" />
              <select
                value={mesSeleccionado.toISOString().slice(0, 7)}
                onChange={(e) => {
                  const [year, month] = e.target.value.split('-');
                  setMesSeleccionado(new Date(parseInt(year), parseInt(month) - 1, 1));
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                {generarOpcionesMes().map(opcion => (
                  <option
                    key={opcion.valor.toISOString().slice(0, 7)}
                    value={opcion.valor.toISOString().slice(0, 7)}
                  >
                    {opcion.etiqueta}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Alertas */}
      {datosFacturacion.alertas.length > 0 && (
        <div className="space-y-3">
          {datosFacturacion.alertas.map((alerta, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border-l-4 ${alerta.tipo === 'error'
                ? 'bg-red-50 border-red-500 text-red-800'
                : 'bg-blue-50 border-blue-500 text-blue-800'
                }`}
            >
              <div className="flex items-center gap-3">
                {alerta.tipo === 'error' ? (
                  <AlertTriangle size={20} className="text-red-600" />
                ) : (
                  <AlertCircle size={20} className="text-blue-600" />
                )}
                <span className="font-medium">{alerta.mensaje}</span>
                {alerta.accion === 'categorizar' && (
                  <button
                    onClick={() => openModal('categorizar-sesiones')}
                    className="ml-auto px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                  >
                    Categorizar Ahora
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Resumen del neto */}
      <div className="glass-effect p-6 rounded-xl">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Neto del Mes</h3>
          <div className={`text-4xl font-bold ${netoTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(Math.abs(netoTotal))} {netoTotal < 0 ? '(Pérdida)' : ''}
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {netoTotal >= 0
              ? 'Ganancia neta después de cobrar todo y pagar gastos'
              : 'Déficit después de cobrar todo y pagar gastos'
            }
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ENTRADAS - Ingresos a cobrar */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-green-600" size={20} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Ingresos a Cobrar</h3>
              <p className="text-sm text-gray-600">Pendientes de pago</p>
            </div>
          </div>

          <div className="space-y-6">
            {(datosFacturacion.entradas.pendientes || []).map(entrada => (
              <div key={entrada.paciente.id} className="border border-gray-200 rounded-lg p-4">
                {/* Header del paciente */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-gray-800">{entrada.paciente.nombre_apellido}</h4>
                    <div className="text-sm text-gray-600">
                      <div><span className="font-medium">Tutor:</span> {entrada.paciente.nombre_apellido_tutor}</div>
                      <div><span className="font-medium">CUIL:</span> {entrada.paciente.cuil}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-green-600">
                      {formatCurrency(entrada.saldoTotalHastaMes)}
                    </div>
                    <div className="text-xs text-gray-500">A cobrar</div>
                  </div>
                </div>

                {/* Detalle de sesiones del mes */}
                <div className="space-y-2 text-sm">
                  {entrada.sesiones.regulares.cantidad > 0 && (
                    <div className="flex justify-between py-1">
                      <span>🧠 Sesiones ({entrada.sesiones.regulares.cantidad})</span>
                      <span className="font-medium">{formatCurrency(entrada.sesiones.regulares.total)}</span>
                    </div>
                  )}
                  {entrada.sesiones.evaluaciones.cantidad > 0 && (
                    <div className="flex justify-between py-1">
                      <span>📋 Evaluaciones ({entrada.sesiones.evaluaciones.cantidad})</span>
                      <span className="font-medium">{formatCurrency(entrada.sesiones.evaluaciones.total)}</span>
                    </div>
                  )}
                  {entrada.sesiones.reevaluaciones.cantidad > 0 && (
                    <div className="flex justify-between py-1">
                      <span>📝 Re-evaluaciones ({entrada.sesiones.reevaluaciones.cantidad})</span>
                      <span className="font-medium">{formatCurrency(entrada.sesiones.reevaluaciones.total)}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-1 border-t pt-2 font-medium">
                    <span>Subtotal del mes</span>
                    <span>{formatCurrency(entrada.totalMes)}</span>
                  </div>

                  {/* Mostrar si hay saldo anterior incluido */}
                  {entrada.saldoTotalHastaMes > entrada.totalMes && (
                    <div className="flex justify-between py-1">
                      <span className="text-orange-600">+ Saldo pendiente anterior</span>
                      <span className="text-orange-600 font-medium">
                        +{formatCurrency(entrada.saldoTotalHastaMes - entrada.totalMes)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Sistema de seguimiento */}
                {entrada.seguimiento && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h5 className="font-medium text-gray-700 mb-3">Estado de Facturación</h5>

                    {/* Alerta si no se envió al tutor */}
                    {!entrada.seguimiento.enviado_tutor && (
                      <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center gap-2 text-yellow-800 text-sm">
                          <AlertTriangle size={14} />
                          <span className="font-medium">¡Recordar enviar al tutor!</span>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-3">
                      {/* Enviado al tutor - MANUAL */}
                      <button
                        onClick={() => actualizarSeguimiento(
                          entrada.seguimiento.id,
                          'enviado_tutor',
                          !entrada.seguimiento.enviado_tutor
                        )}
                        className={`p-2 rounded-lg border-2 transition-all text-sm ${entrada.seguimiento.enviado_tutor
                          ? 'bg-blue-100 border-blue-500 text-blue-700'
                          : 'bg-gray-50 border-gray-300 text-gray-600 hover:border-blue-300'
                          }`}
                      >
                        <Mail size={16} className="mx-auto mb-1" />
                        <div className="font-medium">Enviado</div>
                        {entrada.seguimiento.fecha_envio && (
                          <div className="text-xs">
                            {new Date(entrada.seguimiento.fecha_envio).toLocaleDateString('es-AR')}
                          </div>
                        )}
                      </button>

                      {/* Facturado - AUTOMÁTICO */}
                      <div
                        className={`p-2 rounded-lg border-2 text-sm ${entrada.seguimiento.facturado
                          ? 'bg-purple-100 border-purple-500 text-purple-700'
                          : 'bg-gray-50 border-gray-300 text-gray-600'
                          }`}
                      >
                        <FileCheck size={16} className="mx-auto mb-1" />
                        <div className="font-medium">Facturado</div>
                        <div className="text-xs">
                          {entrada.seguimiento.facturado ? 'Detectado auto' : 'No detectado'}
                        </div>
                        {entrada.seguimiento.fecha_facturado && (
                          <div className="text-xs">
                            {new Date(entrada.seguimiento.fecha_facturado).toLocaleDateString('es-AR')}
                          </div>
                        )}
                      </div>

                      {/* Pagado - AUTOMÁTICO */}
                      <div
                        className={`p-2 rounded-lg border-2 text-sm ${entrada.seguimiento.completamente_pagado
                          ? 'bg-green-100 border-green-500 text-green-700'
                          : 'bg-gray-50 border-gray-300 text-gray-600'
                          }`}
                      >
                        <CreditCard size={16} className="mx-auto mb-1" />
                        <div className="font-medium">Pagado</div>
                        <div className="text-xs">
                          {entrada.seguimiento.completamente_pagado ? 'Detectado auto' : 'Pendiente'}
                        </div>
                        {entrada.seguimiento.fecha_pago_completo && (
                          <div className="text-xs">
                            {new Date(entrada.seguimiento.fecha_pago_completo).toLocaleDateString('es-AR')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {(datosFacturacion.entradas.pendientes || []).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <FileText className="mx-auto mb-3" size={48} />
                <p>No hay ingresos pendientes de cobro</p>
              </div>
            )}
          </div>
        </div>

        {/* NUEVA SECCIÓN - Facturados/Pagados */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="text-blue-600" size={20} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Facturados/Pagados</h3>
              <p className="text-sm text-gray-600">Ya completados del mes</p>
            </div>
          </div>

          <div className="space-y-4">
            {(datosFacturacion.entradas.pagados || []).map(entrada => (
              <div key={entrada.paciente.id} className="border border-green-200 bg-green-50 rounded-lg p-4">
                {/* Header del paciente */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-gray-800">{entrada.paciente.nombre_apellido}</h4>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Tutor:</span> {entrada.paciente.nombre_apellido_tutor}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">
                      ✓ {formatCurrency(entrada.totalMes)}
                    </div>
                    <div className="text-xs text-green-600">Completado</div>
                  </div>
                </div>

                {/* Advertencia si no se envió al tutor */}
                {entrada.seguimiento && !entrada.seguimiento.enviado_tutor && (
                  <div className="mb-3 p-2 bg-yellow-100 border border-yellow-300 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-yellow-800 text-sm">
                        <AlertTriangle size={14} />
                        <span className="font-medium">No se envió al tutor</span>
                      </div>
                      <button
                        onClick={() => actualizarSeguimiento(
                          entrada.seguimiento.id,
                          'enviado_tutor',
                          true
                        )}
                        className="px-2 py-1 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700"
                      >
                        Marcar enviado
                      </button>
                    </div>
                  </div>
                )}

                {/* Estado resumido */}
                {entrada.seguimiento && (
                  <div className="flex justify-between text-xs text-gray-600">
                    <span className={entrada.seguimiento.enviado_tutor ? 'text-blue-600' : 'text-gray-400'}>
                      📧 {entrada.seguimiento.enviado_tutor ? 'Enviado' : 'No enviado'}
                    </span>
                    <span className={entrada.seguimiento.facturado ? 'text-purple-600' : 'text-gray-400'}>
                      📄 {entrada.seguimiento.facturado ? 'Facturado' : 'No facturado'}
                    </span>
                    <span className="text-green-600">💳 Pagado</span>
                  </div>
                )}
              </div>
            ))}

            {(datosFacturacion.entradas.pagados || []).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="mx-auto mb-3" size={48} />
                <p>No hay facturas completadas este mes</p>
              </div>
            )}
          </div>
        </div>

        {/* SALIDAS - Gastos a pagar */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-red-600" size={20} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Gastos a Pagar</h3>
              <p className="text-sm text-gray-600">Alquiler y supervisiones</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Alquiler */}
            {datosFacturacion.salidas.alquiler > 0 && (
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building className="text-orange-600" size={20} />
                    <div>
                      <h4 className="font-bold text-gray-800">Alquiler del Consultorio</h4>
                      <p className="text-sm text-gray-600">{alquilerConfig?.destinatario_default}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-red-600">
                      {formatCurrency(datosFacturacion.salidas.alquiler)}
                    </div>
                    <div className="text-xs text-gray-500">Pendiente</div>
                  </div>
                </div>
              </div>
            )}

            {/* Supervisiones */}
            {datosFacturacion.salidas.supervisiones.map(supervision => (
              <div key={supervision.supervisora.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <User className="text-purple-600" size={20} />
                    <div>
                      <h4 className="font-bold text-gray-800">{supervision.supervisora.nombre_apellido}</h4>
                      <p className="text-sm text-gray-600">
                        {supervision.sesionesCount} sesión(es) de supervisión
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-red-600">
                      {formatCurrency(supervision.saldoPendiente)}
                    </div>
                    <div className="text-xs text-gray-500">Pendiente</div>
                  </div>
                </div>
              </div>
            ))}

            {datosFacturacion.salidas.alquiler === 0 && datosFacturacion.salidas.supervisiones.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="mx-auto mb-3" size={48} />
                <p>No hay gastos pendientes este mes</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacturarView;