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
  const [mesSeleccionado, setMesSeleccionado] = useState(null);
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

  // Determinar mes por defecto (actual o anterior si estamos en los primeros 9 días)
  useEffect(() => {
    const hoy = new Date();
    const diaDelMes = hoy.getDate();

    console.log('🗓️ Configurando mes por defecto:', {
      fechaHoy: hoy.toISOString().split('T')[0],
      diaDelMes,
      logica: diaDelMes <= 9 ? 'Mostrar mes anterior' : 'Mostrar mes actual'
    });

    if (diaDelMes <= 9) {
      const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      console.log('📅 Seleccionando mes anterior:', mesAnterior.toISOString().split('T')[0]);
      setMesSeleccionado(mesAnterior);
    } else {
      const mesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      console.log('📅 Seleccionando mes actual:', mesActual.toISOString().split('T')[0]);
      setMesSeleccionado(mesActual);
    }
  }, []);

  // Cargar datos cuando cambia el mes
  useEffect(() => {
    console.log('🔄 useEffect cargarDatos disparado:', {
      mesSeleccionado: mesSeleccionado?.toISOString().split('T')[0],
      pacientesLength: pacientes?.length,
      supervisorasLength: supervisoras?.length
    });

    if (mesSeleccionado && pacientes?.length > 0) {
      console.log('✅ Condiciones cumplidas, cargando datos...');
      cargarDatosFacturacion();
    } else {
      console.log('❌ Condiciones no cumplidas, esperando...', {
        tieneMes: !!mesSeleccionado,
        tienePacientes: pacientes?.length > 0
      });
    }
  }, [mesSeleccionado, pacientes, supervisoras]);

  const cargarDatosFacturacion = async () => {
    try {
      setLoading(true);

      const year = mesSeleccionado.getFullYear();
      const month = mesSeleccionado.getMonth() + 1;
      const hoy = new Date();

      console.log('Cargando datos para:', {
        año: year,
        mes: month
      });

      // 1. 🚀 NUEVA LÓGICA: Usar la view de Supabase para pacientes
      const { data: resumenesView, error: viewError } = await supabase
        .from('resumen_facturacion_mensual')
        .select('*')
        .eq('año', year)
        .eq('mes', month)
        .order('nombre_apellido');

      if (viewError) throw viewError;

      console.log('📊 Datos desde view pacientes:', resumenesView);

      // 2. Verificar sesiones pendientes de categorizar (para alertas)
      const inicioMes = new Date(year, month - 1, 1);
      const finMes = new Date(year, month, 0, 23, 59, 59);

      const { data: sesiones, error: sesionesError } = await supabase
        .from('sesiones')
        .select('*')
        .eq('eliminado', false)
        .gte('fecha_hora', inicioMes.toISOString())
        .lte('fecha_hora', finMes.toISOString());

      if (sesionesError) throw sesionesError;

      const sesionsPendientesPasadas = (sesiones || []).filter(s =>
        s.estado === 'Pendiente' && new Date(s.fecha_hora) < hoy
      );

      // 3. Procesar entradas usando la view
      const entradasPorPaciente = await procesarEntradasConView(resumenesView || [], year, month);

      // 4. 🚀 NUEVA LÓGICA: Procesar salidas usando la view de supervisoras
      const salidasData = await procesarSalidasConView(year, month);

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

  // Procesar entradas usando la view (sin cambios)
  const procesarEntradasConView = async (resumenesView, año, mes) => {
    const entradasPorPaciente = [];
    const entradasPagadas = [];

    for (const resumen of resumenesView) {
      // Solo procesar si hay actividad en el mes o saldo anterior
      if (resumen.total_mes_actual <= 0 && resumen.saldo_anterior <= 0) {
        continue;
      }

      // Encontrar datos del paciente
      const paciente = pacientes.find(p => p.id === resumen.paciente_id);
      if (!paciente) {
        console.warn('Paciente no encontrado:', resumen.paciente_id);
        continue;
      }

      // Construir objeto de sesiones con la estructura esperada
      const sesiones = {
        regulares: {
          cantidad: resumen.cantidad_sesiones,
          total: resumen.monto_sesiones,
          horas: resumen.horas_sesiones,
          items: []
        },
        evaluaciones: {
          cantidad: resumen.cantidad_evaluaciones,
          total: resumen.monto_evaluaciones,
          horas: resumen.horas_evaluaciones,
          items: []
        },
        reevaluaciones: {
          cantidad: resumen.cantidad_reevaluaciones,
          total: resumen.monto_reevaluaciones,
          horas: resumen.horas_reevaluaciones,
          items: []
        },
        devoluciones: {
          cantidad: resumen.cantidad_devoluciones,
          total: resumen.monto_devoluciones,
          horas: resumen.horas_devoluciones,
          items: []
        },
        reuniones_colegio: {
          cantidad: resumen.cantidad_reuniones_colegio,
          total: resumen.monto_reuniones_colegio,
          horas: resumen.horas_reuniones_colegio,
          items: []
        },
        supervisiones: {
          cantidad: resumen.cantidad_supervisiones,
          total: resumen.monto_supervisiones,
          horas: resumen.horas_supervisiones,
          items: []
        }
      };

      // Obtener seguimiento de facturación
      let seguimiento = null;
      try {
        seguimiento = await obtenerSeguimiento(resumen.paciente_id, año, mes, resumen.total_final);
      } catch (error) {
        console.error('Error obteniendo seguimiento:', error);
      }

      const entrada = {
        paciente,
        sesiones,
        totalMes: resumen.total_mes_actual,
        saldoAnterior: resumen.saldo_anterior,
        saldoTotalHastaMes: resumen.total_final,
        totalFinal: resumen.total_final,
        sesiones_futuras_incluidas: resumen.sesiones_futuras_incluidas,
        seguimiento,

        // Info de debug
        debug: {
          sesiones_anteriores: resumen.debug_sesiones_anteriores,
          pagos_totales: resumen.debug_pagos_totales
        }
      };

      // Separar entre pendientes y pagados
      if (seguimiento && seguimiento.completamente_pagado) {
        entradasPagadas.push(entrada);
      } else if (resumen.total_final > 0) {
        entradasPorPaciente.push(entrada);
      }
    }

    return { pendientes: entradasPorPaciente, pagados: entradasPagadas };
  };

  // 🚀 NUEVA FUNCIÓN: Procesar salidas usando la view de supervisoras
  const procesarSalidasConView = async (año, mes) => {
    try {
      console.log('💰 Procesando gastos con view para:', { año, mes });

      // 1. Calcular alquiler (lógica original)
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

      // 2. 🚀 NUEVO: Usar la view de supervisoras
      const { data: resumenSupervisoras, error: supervisorasError } = await supabase
        .from('resumen_gastos_supervisoras_mensual')
        .select('*')
        .eq('año', año)
        .eq('mes', mes)
        .order('nombre_apellido');

      if (supervisorasError) throw supervisorasError;

      console.log('📊 Datos desde view supervisoras:', resumenSupervisoras);

      // 3. Procesar datos de supervisoras
      const supervisionesPorSupervisora = (resumenSupervisoras || []).map(resumen => {
        // Encontrar datos de la supervisora
        const supervisora = supervisoras.find(s => s.id === resumen.supervisora_id);
        if (!supervisora) {
          console.warn('Supervisora no encontrada:', resumen.supervisora_id);
          return null;
        }

        // Crear estructura detallada
        return {
          supervisora,

          // Supervisiones del mes
          supervisiones: {
            cantidad: resumen.cantidad_supervisiones,
            horas: resumen.horas_supervisiones,
            monto: resumen.monto_supervisiones,
            futuras_incluidas: resumen.supervisiones_futuras_incluidas
          },

          // Acompañamientos del mes por tipo
          acompanamientos: {
            evaluaciones: {
              cantidad: resumen.cantidad_acomp_evaluaciones,
              horas: resumen.horas_acomp_evaluaciones,
              monto: resumen.monto_acomp_evaluaciones
            },
            reevaluaciones: {
              cantidad: resumen.cantidad_acomp_reevaluaciones,
              horas: resumen.horas_acomp_reevaluaciones,
              monto: resumen.monto_acomp_reevaluaciones
            },
            devoluciones: {
              cantidad: resumen.cantidad_acomp_devoluciones,
              horas: resumen.horas_acomp_devoluciones,
              monto: resumen.monto_acomp_devoluciones
            },
            reuniones: {
              cantidad: resumen.cantidad_acomp_reuniones,
              horas: resumen.horas_acomp_reuniones,
              monto: resumen.monto_acomp_reuniones
            },
            sesiones: {
              cantidad: resumen.cantidad_acomp_sesiones,
              horas: resumen.horas_acomp_sesiones,
              monto: resumen.monto_acomp_sesiones
            },
            total_monto: resumen.monto_total_acompanamientos,
            futuras_incluidas: resumen.acompanamientos_futuros_incluidos
          },

          // Totales
          totalMes: resumen.total_mes_actual,
          saldoAnterior: resumen.saldo_anterior,
          totalFinal: resumen.total_final,

          // Debug info
          debug: {
            supervisiones_anteriores: resumen.debug_supervisiones_anteriores,
            acompanamientos_anteriores: resumen.debug_acompanamientos_anteriores,
            pagos_realizados: resumen.debug_pagos_realizados
          }
        };
      }).filter(Boolean); // Remover nulls

      return {
        alquiler: Math.max(0, alquilerPendiente),
        supervisiones: supervisionesPorSupervisora
      };

    } catch (error) {
      console.error('Error procesando gastos con view:', error);
      return {
        alquiler: 0,
        supervisiones: []
      };
    }
  };

  // Función para detectar si hay una factura por el monto correspondiente
  const detectarFacturacion = async (pacienteId, monto, año, mes) => {
    try {
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

      const facturaEncontrada = (facturas || []).find(f => {
        const diferencia = Math.abs(f.monto_ars - monto);
        const porcentajeDiferencia = (diferencia / monto) * 100;
        return porcentajeDiferencia <= 5;
      });

      return !!facturaEncontrada;
    } catch (error) {
      console.error('Error detectando facturación:', error);
      return false;
    }
  };

  // Detectar pago completo usando saldo de la view
  const detectarPagoCompleto = async (pacienteId, totalFinal) => {
    try {
      return totalFinal <= 0;
    } catch (error) {
      console.error('Error detectando pago completo:', error);
      return false;
    }
  };

  // Función para obtener/crear seguimiento de facturación
  const obtenerSeguimiento = async (pacienteId, año, mes, montoTotal) => {
    try {
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

      const facturadoAutomatico = await detectarFacturacion(pacienteId, Math.abs(montoTotal), año, mes);
      const pagadoAutomatico = await detectarPagoCompleto(pacienteId, montoTotal);

      if (!seguimiento) {
        const { data: nuevoSeguimiento, error: createError } = await supabase
          .from('seguimiento_facturacion')
          .insert([{
            paciente_id: pacienteId,
            año: año,
            mes: mes,
            monto_total_facturado: Math.abs(montoTotal),
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

  // Función para actualizar estado de seguimiento
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

  const formatCurrency = (amount, currency = currencyMode) => {
    if (currency === 'USD') {
      return `$${(amount / tipoCambio).toFixed(0)} USD`;
    }
    return `$${amount.toLocaleString()} ARS`;
  };

  const calcularNetoTotal = () => {
    const totalIngresos = (datosFacturacion.entradas.pendientes || []).reduce((sum, e) => sum + e.totalFinal, 0);
    const totalGastos = datosFacturacion.salidas.alquiler +
      datosFacturacion.salidas.supervisiones.reduce((sum, s) => sum + s.totalFinal, 0);
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ENTRADAS - Todos los ingresos (pendientes + pagados) */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-green-600" size={20} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Ingresos del Mes</h3>
              <p className="text-sm text-gray-600">Resúmenes para tutores</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Primero los pendientes */}
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
                    <div className="text-xl font-bold text-green-600 flex items-center gap-2">
                      {formatCurrency(entrada.totalFinal)}
                      {entrada.seguimiento?.completamente_pagado && <CheckCircle size={16} className="text-green-500" />}
                      {!entrada.seguimiento?.enviado_tutor && <AlertTriangle size={16} className="text-yellow-500" />}
                    </div>
                    <div className="text-xs text-gray-500">A cobrar</div>
                  </div>
                </div>

                {/* Detalle de sesiones del mes */}
                <div className="space-y-2 text-sm">
                  {entrada.sesiones.regulares.cantidad > 0 && (
                    <div className="flex justify-between py-1">
                      <span>🧠 Sesiones ({entrada.sesiones.regulares.cantidad}) - {entrada.sesiones.regulares.horas}h</span>
                      <span className="font-medium">{formatCurrency(entrada.sesiones.regulares.total)}</span>
                    </div>
                  )}
                  {entrada.sesiones.evaluaciones.cantidad > 0 && (
                    <div className="flex justify-between py-1">
                      <span>📋 Evaluaciones ({entrada.sesiones.evaluaciones.cantidad}) - {entrada.sesiones.evaluaciones.horas}h</span>
                      <span className="font-medium">{formatCurrency(entrada.sesiones.evaluaciones.total)}</span>
                    </div>
                  )}
                  {entrada.sesiones.reevaluaciones.cantidad > 0 && (
                    <div className="flex justify-between py-1">
                      <span>📝 Re-evaluaciones ({entrada.sesiones.reevaluaciones.cantidad}) - {entrada.sesiones.reevaluaciones.horas}h</span>
                      <span className="font-medium">{formatCurrency(entrada.sesiones.reevaluaciones.total)}</span>
                    </div>
                  )}
                  {entrada.sesiones.devoluciones.cantidad > 0 && (
                    <div className="flex justify-between py-1">
                      <span>🔄 Devoluciones ({entrada.sesiones.devoluciones.cantidad}) - {entrada.sesiones.devoluciones.horas}h</span>
                      <span className="font-medium">{formatCurrency(entrada.sesiones.devoluciones.total)}</span>
                    </div>
                  )}
                  {entrada.sesiones.reuniones_colegio.cantidad > 0 && (
                    <div className="flex justify-between py-1">
                      <span>🏫 Reuniones colegio ({entrada.sesiones.reuniones_colegio.cantidad}) - {entrada.sesiones.reuniones_colegio.horas}h</span>
                      <span className="font-medium">{formatCurrency(entrada.sesiones.reuniones_colegio.total)}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-1 border-t pt-2 font-medium">
                    <span>Subtotal del mes</span>
                    <span>{formatCurrency(entrada.totalMes)}</span>
                  </div>

                  {/* Mostrar saldo anterior si existe */}
                  {entrada.saldoAnterior !== 0 && (
                    <div className="flex justify-between py-1">
                      <span className={entrada.saldoAnterior > 0 ? "text-orange-600" : "text-green-600"}>
                        {entrada.saldoAnterior > 0 ? '+ Saldo pendiente anterior' : '- Saldo a favor anterior'}
                      </span>
                      <span className={`font-medium ${entrada.saldoAnterior > 0 ? "text-orange-600" : "text-green-600"}`}>
                        {entrada.saldoAnterior > 0 ? '+' : ''}{formatCurrency(entrada.saldoAnterior)}
                      </span>
                    </div>
                  )}

                  {/* Mostrar si hay sesiones futuras incluidas */}
                  {entrada.sesiones_futuras_incluidas > 0 && (
                    <div className="text-xs text-blue-600 mt-2 p-2 bg-blue-50 rounded">
                      ℹ️ Incluye {entrada.sesiones_futuras_incluidas} sesión(es) futura(s) del mes
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

            {/* Después los pagados */}
            {(datosFacturacion.entradas.pagados || []).map(entrada => (
              <div key={entrada.paciente.id} className="border border-green-200 bg-green-50 rounded-lg p-4">
                {/* Header del paciente */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                      {entrada.paciente.nombre_apellido}
                      <CheckCircle size={16} className="text-green-600" />
                    </h4>
                    <div className="text-sm text-gray-600">
                      <div><span className="font-medium">Tutor:</span> {entrada.paciente.nombre_apellido_tutor}</div>
                      <div><span className="font-medium">CUIL:</span> {entrada.paciente.cuil}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-green-600 flex items-center gap-2">
                      {formatCurrency(entrada.totalMes)}
                      <div className="flex gap-1">
                        {!entrada.seguimiento?.enviado_tutor && <AlertTriangle size={14} className="text-yellow-500" />}
                        {entrada.seguimiento?.facturado && <FileCheck size={14} className="text-purple-500" />}
                        <CreditCard size={14} className="text-green-500" />
                      </div>
                    </div>
                    <div className="text-xs text-green-600">Completado</div>
                  </div>
                </div>

                {/* Mostrar alerta si no se envió al tutor */}
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

                {/* Sistema de seguimiento simplificado */}
                {entrada.seguimiento && (
                  <div className="mt-3 pt-3 border-t border-green-200">
                    <div className="grid grid-cols-3 gap-3">
                      {/* Enviado al tutor - MANUAL */}
                      <button
                        onClick={() => actualizarSeguimiento(
                          entrada.seguimiento.id,
                          'enviado_tutor',
                          !entrada.seguimiento.enviado_tutor
                        )}
                        className={`p-2 rounded-lg border-2 transition-all text-xs ${entrada.seguimiento.enviado_tutor
                          ? 'bg-blue-100 border-blue-500 text-blue-700'
                          : 'bg-gray-50 border-gray-300 text-gray-600 hover:border-blue-300'
                          }`}
                      >
                        <Mail size={14} className="mx-auto mb-1" />
                        <div className="font-medium">Enviado</div>
                      </button>

                      {/* Facturado - AUTOMÁTICO */}
                      <div
                        className={`p-2 rounded-lg border-2 text-xs ${entrada.seguimiento.facturado
                          ? 'bg-purple-100 border-purple-500 text-purple-700'
                          : 'bg-gray-50 border-gray-300 text-gray-600'
                          }`}
                      >
                        <FileCheck size={14} className="mx-auto mb-1" />
                        <div className="font-medium">Facturado</div>
                      </div>

                      {/* Pagado - AUTOMÁTICO */}
                      <div className="p-2 rounded-lg border-2 text-xs bg-green-100 border-green-500 text-green-700">
                        <CreditCard size={14} className="mx-auto mb-1" />
                        <div className="font-medium">Pagado</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {(datosFacturacion.entradas.pendientes || []).length === 0 && (datosFacturacion.entradas.pagados || []).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <FileText className="mx-auto mb-3" size={48} />
                <p>No hay actividad este mes</p>
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

            {/* 🚀 SUPERVISIONES CON DETALLE COMPLETO */}
            {datosFacturacion.salidas.supervisiones.map(supervision => (
              <div key={supervision.supervisora.id} className="border border-gray-200 rounded-lg p-4">
                {/* Header de la supervisora */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <User className="text-purple-600" size={20} />
                    <div>
                      <h4 className="font-bold text-gray-800">{supervision.supervisora.nombre_apellido}</h4>
                      <p className="text-sm text-gray-600">
                        {supervision.supervisiones.cantidad > 0 && `${supervision.supervisiones.cantidad} supervisión(es)`}
                        {supervision.supervisiones.cantidad > 0 && supervision.acompanamientos.total_monto > 0 && ' + '}
                        {supervision.acompanamientos.total_monto > 0 && 'acompañamientos'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-red-600">
                      {formatCurrency(supervision.totalFinal)}
                    </div>
                    <div className="text-xs text-gray-500">Total a pagar</div>
                  </div>
                </div>

                {/* Detalle del mes */}
                <div className="space-y-2 text-sm">
                  {/* Supervisiones del mes */}
                  {supervision.supervisiones.cantidad > 0 && (
                    <div className="flex justify-between py-1">
                      <span>👥 Supervisiones ({supervision.supervisiones.cantidad}) - {supervision.supervisiones.horas}h</span>
                      <span className="font-medium">{formatCurrency(supervision.supervisiones.monto)}</span>
                    </div>
                  )}

                  {/* Acompañamientos por tipo */}
                  {supervision.acompanamientos.evaluaciones.cantidad > 0 && (
                    <div className="flex justify-between py-1">
                      <span>📋 Acomp. Evaluaciones ({supervision.acompanamientos.evaluaciones.cantidad}) - {supervision.acompanamientos.evaluaciones.horas}h</span>
                      <span className="font-medium">{formatCurrency(supervision.acompanamientos.evaluaciones.monto)}</span>
                    </div>
                  )}

                  {supervision.acompanamientos.reevaluaciones.cantidad > 0 && (
                    <div className="flex justify-between py-1">
                      <span>📝 Acomp. Re-evaluaciones ({supervision.acompanamientos.reevaluaciones.cantidad}) - {supervision.acompanamientos.reevaluaciones.horas}h</span>
                      <span className="font-medium">{formatCurrency(supervision.acompanamientos.reevaluaciones.monto)}</span>
                    </div>
                  )}

                  {supervision.acompanamientos.devoluciones.cantidad > 0 && (
                    <div className="flex justify-between py-1">
                      <span>🔄 Acomp. Devoluciones ({supervision.acompanamientos.devoluciones.cantidad}) - {supervision.acompanamientos.devoluciones.horas}h</span>
                      <span className="font-medium">{formatCurrency(supervision.acompanamientos.devoluciones.monto)}</span>
                    </div>
                  )}

                  {supervision.acompanamientos.reuniones.cantidad > 0 && (
                    <div className="flex justify-between py-1">
                      <span>🏫 Acomp. Reuniones colegio ({supervision.acompanamientos.reuniones.cantidad}) - {supervision.acompanamientos.reuniones.horas}h</span>
                      <span className="font-medium">{formatCurrency(supervision.acompanamientos.reuniones.monto)}</span>
                    </div>
                  )}

                  {supervision.acompanamientos.sesiones.cantidad > 0 && (
                    <div className="flex justify-between py-1">
                      <span>🧠 Acomp. Sesiones ({supervision.acompanamientos.sesiones.cantidad}) - {supervision.acompanamientos.sesiones.horas}h</span>
                      <span className="font-medium">{formatCurrency(supervision.acompanamientos.sesiones.monto)}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-1 border-t pt-2 font-medium">
                    <span>Subtotal del mes</span>
                    <span>{formatCurrency(supervision.totalMes)}</span>
                  </div>

                  {/* Mostrar saldo anterior si existe */}
                  {supervision.saldoAnterior !== 0 && (
                    <div className="flex justify-between py-1">
                      <span className={supervision.saldoAnterior > 0 ? "text-orange-600" : "text-green-600"}>
                        {supervision.saldoAnterior > 0 ? '+ Saldo pendiente anterior' : '- Saldo a favor anterior'}
                      </span>
                      <span className={`font-medium ${supervision.saldoAnterior > 0 ? "text-orange-600" : "text-green-600"}`}>
                        {supervision.saldoAnterior > 0 ? '+' : ''}{formatCurrency(supervision.saldoAnterior)}
                      </span>
                    </div>
                  )}

                  {/* Mostrar si hay actividades futuras incluidas */}
                  {(supervision.supervisiones.futuras_incluidas > 0 || supervision.acompanamientos.futuras_incluidas > 0) && (
                    <div className="text-xs text-blue-600 mt-2 p-2 bg-blue-50 rounded">
                      ℹ️ Incluye {supervision.supervisiones.futuras_incluidas + supervision.acompanamientos.futuras_incluidas} actividad(es) futura(s) del mes
                    </div>
                  )}
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