import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Clock, DollarSign, UserX, Users, AlertTriangle, Calendar } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie, BarChart } from 'recharts';
import { supabase } from '../lib/supabase';

const DashboardView = ({ currencyMode, tipoCambio }) => {
  const [loading, setLoading] = useState(true);
  const [datosGrafico, setDatosGrafico] = useState([]);
  const [metricas, setMetricas] = useState({
    totalMeses: 0,
    promedioGanancia: 0,
    promedioHoras: 0,
    promedioHorasPorDiaLaboral: 0,
    mejorMes: null,
    peorMes: null
  });

  // Estados para cancelaciones
  const [datosCancelaciones, setDatosCancelaciones] = useState([]);
  const [metricasCancelaciones, setMetricasCancelaciones] = useState({
    totalPacientes: 0,
    promedioInasistencia: 0,
    pacienteMayorInasistencia: null,
    pacienteMenorInasistencia: null
  });
  const [vistaHistoricaCancelaciones, setVistaHistoricaCancelaciones] = useState(false);
  const [datosHistoricoCancelaciones, setDatosHistoricoCancelaciones] = useState([]);

  // Cargar datos del dashboard financiero
  const cargarDatosDashboard = useCallback(async () => {
    try {
      setLoading(true);

      const { data: datosRaw, error } = await supabase
        .from('dashboard_ganancia_horas_combinado')
        .select('*')
        .order('mes');

      if (error) {
        console.error('Error cargando datos del dashboard:', error);
        throw error;
      }

      if (!datosRaw || datosRaw.length === 0) {
        console.log('📊 No hay datos disponibles en el dashboard');
        setDatosGrafico([]);
        setMetricas({
          totalMeses: 0,
          promedioGanancia: 0,
          promedioHoras: 0,
          promedioHorasPorDiaLaboral: 0,
          mejorMes: null,
          peorMes: null
        });
        return;
      }

      // Formatear datos para el gráfico
      const datosFormateados = datosRaw.map(item => {
        const fecha = new Date(item.mes);

        return {
          mes: fecha.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
          mesCompleto: fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
          fechaOriginal: item.mes,

          // Ganancias en ambas monedas
          ganancia_ars: item.ganancia_neta_ars || 0,
          ganancia_usd: item.ganancia_neta_usd || 0,

          // Entradas y salidas para tooltips
          entradas_ars: item.entradas_ars || 0,
          entradas_usd: item.entradas_usd || 0,
          salidas_ars: item.salidas_ars || 0,
          salidas_usd: item.salidas_usd || 0,

          // Horas trabajadas
          horas: item.total_horas || 0,
          dias_laborales: item.dias_laborales_mes || 22,
          horas_por_dia_laboral: item.horas_promedio_por_dia_laboral || 0,

          // Ganancia por hora
          ganancia_por_hora_ars: item.ganancia_por_hora_ars || 0,
          ganancia_por_hora_usd: item.ganancia_por_hora_usd || 0,

          // Para el color de las barras
          gananciaNegativa: (item.ganancia_neta_ars || 0) < 0
        };
      });

      // Calcular métricas
      const totalMeses = datosFormateados.length;
      const promedioGananciaARS = datosFormateados.reduce((sum, item) => sum + item.ganancia_ars, 0) / totalMeses;
      const promedioHoras = datosFormateados.reduce((sum, item) => sum + item.horas, 0) / totalMeses;

      const totalHorasPorDiaLaboral = datosFormateados.reduce((sum, item) => sum + item.horas_por_dia_laboral, 0);
      const promedioHorasPorDiaLaboral = totalHorasPorDiaLaboral / totalMeses;

      // Encontrar mejor y peor mes
      const mejorMes = datosFormateados.reduce((mejor, actual) =>
        actual.ganancia_ars > mejor.ganancia_ars ? actual : mejor
      );
      const peorMes = datosFormateados.reduce((peor, actual) =>
        actual.ganancia_ars < peor.ganancia_ars ? actual : peor
      );

      setDatosGrafico(datosFormateados);
      setMetricas({
        totalMeses,
        promedioGanancia: promedioGananciaARS,
        promedioHoras,
        promedioHorasPorDiaLaboral,
        mejorMes,
        peorMes
      });

    } catch (error) {
      console.error('Error cargando dashboard:', error);
      setDatosGrafico([]);
      setMetricas({
        totalMeses: 0,
        promedioGanancia: 0,
        promedioHoras: 0,
        promedioHorasPorDiaLaboral: 0,
        mejorMes: null,
        peorMes: null
      });
    }
  }, []);

  // Cargar datos de cancelaciones
  const cargarDatosCancelaciones = useCallback(async () => {
    try {
      // Cargar datos actuales
      const { data: cancelacionesData, error: cancelacionesError } = await supabase
        .from('dashboard_cancelaciones_paciente')
        .select('*')
        .order('porcentaje_inasistencia_paciente', { ascending: false });

      if (cancelacionesError) throw cancelacionesError;

      // Cargar datos históricos
      const { data: historicoData, error: historicoError } = await supabase
        .from('dashboard_cancelaciones_historico')
        .select('*')
        .eq('paciente_id', '00000000-0000-0000-0000-000000000000')  // UUID especial para TOTAL
        .order('mes', { ascending: true });

      if (historicoError) throw historicoError;

      console.log('📊 Datos cancelaciones cargados:', {
        actuales: cancelacionesData?.length || 0,
        historico: historicoData?.length || 0
      });

      setDatosCancelaciones(cancelacionesData || []);
      setDatosHistoricoCancelaciones(historicoData || []);

      // Calcular métricas de cancelaciones
      if (cancelacionesData && cancelacionesData.length > 0) {
        const totalPacientes = cancelacionesData.length;
        const promedioInasistencia = cancelacionesData.reduce((sum, item) => sum + item.porcentaje_inasistencia_paciente, 0) / totalPacientes;
        const pacienteMayorInasistencia = cancelacionesData[0]; // Ya está ordenado desc
        const pacienteMenorInasistencia = cancelacionesData[cancelacionesData.length - 1];

        setMetricasCancelaciones({
          totalPacientes,
          promedioInasistencia: Math.round(promedioInasistencia * 10) / 10,
          pacienteMayorInasistencia,
          pacienteMenorInasistencia
        });
      }

    } catch (error) {
      console.error('Error cargando cancelaciones:', error);
      setDatosCancelaciones([]);
      setDatosHistoricoCancelaciones([]);
    }
  }, []);

  useEffect(() => {
    const cargarTodosLosDatos = async () => {
      await Promise.all([
        cargarDatosDashboard(),
        cargarDatosCancelaciones()
      ]);
      setLoading(false);
    };

    cargarTodosLosDatos();
  }, [cargarDatosDashboard, cargarDatosCancelaciones]);

  const formatCurrency = (amount, currency = currencyMode) => {
    if (currency === 'USD') {
      return `${amount.toFixed(2)} USD`;
    }
    return `${Math.round(amount).toLocaleString()} ARS`;
  };

  const formatHours = (hours) => {
    return `${hours.toFixed(1)}h`;
  };

  // 🚀 ACTUALIZADO: Formatear datos de cancelaciones para gráficos (CON FERIADOS)
  const datosCancelacionesParaGrafico = datosCancelaciones.slice(0, 10).map((item, index) => ({
    nombre: item.paciente_nombre.split(' ')[0], // Solo primer nombre
    nombreCompleto: item.paciente_nombre,
    inasistencia: item.porcentaje_inasistencia_paciente,
    asistencia: item.porcentaje_asistencia_paciente,
    realizadas: item.realizadas,
    canceladas_con_ant: item.canceladas_con_antelacion,
    canceladas_sin_ant: item.canceladas_sin_antelacion,
    canceladas_profesional: item.canceladas_por_profesional,
    canceladas_feriado: item.canceladas_por_feriado || 0, // 🚀 NUEVO
    total_canceladas_paciente: item.total_canceladas_paciente,
    total_validas: item.total_sesiones_validas,
    total_programadas: item.total_sesiones_programadas,
    color: item.porcentaje_inasistencia_paciente > 30 ? '#EF4444' :
      item.porcentaje_inasistencia_paciente > 15 ? '#F59E0B' : '#10B981'
  }));

  // 🚀 ACTUALIZADO: Datos históricos con feriados
  const datosHistoricoCancelacionesParaGrafico = datosHistoricoCancelaciones.map(item => {
    const fecha = new Date(item.mes);
    return {
      mes: fecha.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
      mesCompleto: fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
      inasistencia: item.porcentaje_inasistencia_paciente,
      asistencia: item.porcentaje_asistencia_paciente,
      realizadas: item.realizadas,
      canceladas_con_ant: item.canceladas_con_antelacion,
      canceladas_sin_ant: item.canceladas_sin_antelacion,
      canceladas_profesional: item.canceladas_por_profesional,
      canceladas_feriado: item.canceladas_por_feriado || 0, // 🚀 NUEVO
      proyectadas: item.proyectadas || 0,
      total_canceladas_paciente: item.total_canceladas_paciente,
      total_validas: item.total_sesiones_validas,
      total_programadas: item.total_sesiones_programadas,
      tieneProyecciones: item.tiene_proyecciones
    };
  });

  // Colores para gráficos
  const COLORES = {
    ganancia_positiva: '#10B981',
    ganancia_negativa: '#EF4444',
    horas: '#8B5CF6',
    entradas: '#3B82F6',
    salidas: '#F59E0B',
    inasistencia: '#EF4444',
    asistencia: '#10B981',
    cancelada_profesional: '#6B7280'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  // Si no hay datos financieros
  if (datosGrafico.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center">
            <BarChart3 className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Dashboard Financiero</h1>
            <p className="text-gray-600">Ganancias netas y horas trabajadas (período 16-15)</p>
          </div>
        </div>

        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="text-gray-400" size={32} />
          </div>

          <h3 className="text-xl font-bold text-gray-800 mb-2">Sin datos financieros</h3>
          <p className="text-gray-600 mb-4">
            El dashboard mostrará información cuando tengas entradas y salidas registradas
          </p>

          <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 max-w-md mx-auto">
            <p className="font-medium mb-2">💡 Para ver el dashboard necesitas:</p>
            <ul className="text-left space-y-1">
              <li>• Pagos recibidos (entradas)</li>
              <li>• Pagos hechos (salidas)</li>
              <li>• Sesiones realizadas o canceladas sin antelación</li>
            </ul>
            <p className="text-xs text-gray-400 mt-3">
              Los datos se agrupan por período del 16 al 15 del mes siguiente
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center">
            <BarChart3 className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Dashboard Financiero</h1>
            <p className="text-gray-600">Ganancias netas y horas trabajadas (período 16-15)</p>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 rounded-lg border border-purple-200">
          <DollarSign className="text-purple-600" size={16} />
          <span className="text-sm font-medium text-purple-700">
            Mostrando en {currencyMode}
          </span>
        </div>
      </div>

      {/* Cards de métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Promedio horas por día laboral */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center">
              <Clock className="text-white" size={24} />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-800">
                {formatHours(metricas.promedioHorasPorDiaLaboral)}
              </div>
              <div className="text-sm text-gray-500">Por día laboral</div>
            </div>
          </div>
          <div className="text-xs text-gray-500">Promedio de intensidad diaria</div>
        </div>

        {/* Promedio de ganancia */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-700 rounded-xl flex items-center justify-center">
              <DollarSign className="text-white" size={24} />
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${metricas.promedioGanancia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {currencyMode === 'USD'
                  ? formatCurrency(metricas.promedioGanancia / (tipoCambio || 1150), 'USD')
                  : formatCurrency(metricas.promedioGanancia, 'ARS')
                }
              </div>
              <div className="text-sm text-gray-500">Promedio mensual</div>
            </div>
          </div>
          <div className="text-xs text-gray-500">Ganancia neta promedio</div>
        </div>

        {/* Promedio de horas */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center">
              <Clock className="text-white" size={24} />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-800">
                {formatHours(metricas.promedioHoras)}
              </div>
              <div className="text-sm text-gray-500">Promedio mensual</div>
            </div>
          </div>
          <div className="text-xs text-gray-500">Horas trabajadas promedio</div>
        </div>

        {/* Mejor mes */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-700 rounded-xl flex items-center justify-center">
              <TrendingUp className="text-white" size={24} />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">
                {metricas.mejorMes && (currencyMode === 'USD'
                  ? formatCurrency(metricas.mejorMes.ganancia_usd, 'USD')
                  : formatCurrency(metricas.mejorMes.ganancia_ars, 'ARS')
                )}
              </div>
              <div className="text-sm text-gray-500">
                {metricas.mejorMes?.mes || 'N/A'}
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-500">Mejor mes histórico</div>
        </div>
      </div>

      {/* Gráfico principal */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-800">
            Evolución de Ganancias vs Horas Trabajadas
          </h3>
          <div className="text-sm text-gray-500">Período normalizado 16-15</div>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={datosGrafico} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />

            <XAxis
              dataKey="mes"
              tick={{ fontSize: 12 }}
              axisLine={false}
            />

            <YAxis
              yAxisId="dinero"
              orientation="left"
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickFormatter={(value) => {
                if (currencyMode === 'USD') {
                  return `${(value / tipoCambio).toFixed(0)}`;
                }
                return `${(value / 1000).toFixed(0)}k`;
              }}
            />

            <YAxis
              yAxisId="horas"
              orientation="right"
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickFormatter={(value) => `${value}h`}
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  const gananciaKey = currencyMode === 'USD' ? 'ganancia_usd' : 'ganancia_ars';
                  const entradasKey = currencyMode === 'USD' ? 'entradas_usd' : 'entradas_ars';
                  const salidasKey = currencyMode === 'USD' ? 'salidas_usd' : 'salidas_ars';
                  const gananciaXHoraKey = currencyMode === 'USD' ? 'ganancia_por_hora_usd' : 'ganancia_por_hora_ars';

                  return (
                    <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
                      <p className="font-medium text-gray-800 mb-2">{data.mesCompleto}</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <span className={`${data.gananciaNegativa ? 'text-red-600' : 'text-green-600'}`}>
                            Ganancia neta:
                          </span>
                          <span className="font-medium">
                            {formatCurrency(data[gananciaKey], currencyMode)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-blue-600">Entradas:</span>
                          <span className="font-medium">
                            {formatCurrency(data[entradasKey], currencyMode)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-orange-600">Salidas:</span>
                          <span className="font-medium">
                            {formatCurrency(data[salidasKey], currencyMode)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-purple-600">Horas trabajadas:</span>
                          <span className="font-medium">{formatHours(data.horas)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 pt-1 border-t">
                          <span className="text-gray-700">Ganancia/hora:</span>
                          <span className="font-medium">
                            {formatCurrency(data[gananciaXHoraKey], currencyMode)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            <Legend />

            <Bar
              yAxisId="dinero"
              dataKey={currencyMode === 'USD' ? 'ganancia_usd' : 'ganancia_ars'}
              name={`Ganancia Neta (${currencyMode})`}
              radius={[4, 4, 0, 0]}
            >
              {datosGrafico.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.gananciaNegativa ? COLORES.ganancia_negativa : COLORES.ganancia_positiva}
                />
              ))}
            </Bar>

            <Line
              yAxisId="horas"
              type="monotone"
              dataKey="horas"
              name="Horas Trabajadas"
              stroke={COLORES.horas}
              strokeWidth={3}
              dot={{ fill: COLORES.horas, strokeWidth: 2, r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Indicadores de ganancia por hora */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-3 text-center">
            💰 Ganancia por Hora Trabajada
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {datosGrafico.map((item, index) => {
              const gananciaXHora = currencyMode === 'USD'
                ? item.ganancia_por_hora_usd
                : item.ganancia_por_hora_ars;

              return (
                <div key={index} className="text-center p-2 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-600 mb-1">{item.mes}</div>
                  <div className={`text-sm font-bold ${gananciaXHora >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {item.horas > 0
                      ? formatCurrency(gananciaXHora, currencyMode)
                      : 'Sin datos'
                    }
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatHours(item.horas)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ANÁLISIS DE CANCELACIONES */}
      {datosCancelaciones.length > 0 && (
        <>
          {/* Header cancelaciones */}
          <div className="flex items-center justify-between mt-12">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center">
                <UserX className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Análisis de Inasistencias</h2>
                <p className="text-gray-600">Seguimiento de asistencia e inasistencias por paciente</p>
              </div>
            </div>

            <button
              onClick={() => setVistaHistoricaCancelaciones(!vistaHistoricaCancelaciones)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${vistaHistoricaCancelaciones
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                }`}
            >
              <Calendar size={16} />
              {vistaHistoricaCancelaciones ? 'Vista Actual' : 'Histórico'}
            </button>
          </div>

          {/* Cards de métricas de cancelaciones */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center">
                  <Users className="text-white" size={24} />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-800">
                    {metricasCancelaciones.totalPacientes}
                  </div>
                  <div className="text-sm text-gray-500">Pacientes</div>
                </div>
              </div>
              <div className="text-xs text-gray-500">Con sesiones registradas</div>
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-700 rounded-xl flex items-center justify-center">
                  <TrendingDown className="text-white" size={24} />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-orange-600">
                    {metricasCancelaciones.promedioInasistencia}%
                  </div>
                  <div className="text-sm text-gray-500">Promedio</div>
                </div>
              </div>
              <div className="text-xs text-gray-500">Inasistencia pacientes</div>
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="text-white" size={24} />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-red-600">
                    {metricasCancelaciones.pacienteMayorInasistencia?.porcentaje_inasistencia_paciente || 0}%
                  </div>
                  <div className="text-sm text-gray-500 truncate max-w-24">
                    {metricasCancelaciones.pacienteMayorInasistencia?.paciente_nombre?.split(' ')[0] || 'N/A'}
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-500">Mayor inasistencia</div>
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-700 rounded-xl flex items-center justify-center">
                  <UserX className="text-white" size={24} />
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-green-600">
                    {metricasCancelaciones.pacienteMenorInasistencia?.porcentaje_inasistencia_paciente || 0}%
                  </div>
                  <div className="text-sm text-gray-500 truncate max-w-24">
                    {metricasCancelaciones.pacienteMenorInasistencia?.paciente_nombre?.split(' ')[0] || 'N/A'}
                  </div>
                </div>
              </div>
              <div className="text-xs text-gray-500">Mejor asistencia</div>
            </div>
          </div>

          {/* Gráfico de cancelaciones */}
          <div className="card p-6">
            {!vistaHistoricaCancelaciones ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-800">
                    Inasistencias por Paciente (Top 10)
                  </h3>
                  <div className="text-sm text-gray-500">% de inasistencias del paciente</div>
                </div>

                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={datosCancelacionesParaGrafico} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis
                      dataKey="nombre"
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
                              <p className="font-medium text-gray-800 mb-2">{data.nombreCompleto}</p>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-red-600">% Inasistencia paciente:</span>
                                  <span className="font-medium">{data.inasistencia}%</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-green-600">% Asistencia paciente:</span>
                                  <span className="font-medium">{data.asistencia}%</span>
                                </div>
                                <div className="flex items-center justify-between gap-4 pt-1 border-t">
                                  <span className="text-gray-600">Realizadas:</span>
                                  <span className="font-medium">{data.realizadas}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-red-600">Cancel. con antelación:</span>
                                  <span className="font-medium">{data.canceladas_con_ant}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-red-600">Cancel. sin antelación:</span>
                                  <span className="font-medium">{data.canceladas_sin_ant}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-gray-500">Cancel. por profesional:</span>
                                  <span className="font-medium">{data.canceladas_profesional}</span>
                                </div>
                                {/* 🚀 NUEVO: Mostrar feriados separados */}
                                {data.canceladas_feriado > 0 && (
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-blue-600">Cancel. por feriado:</span>
                                    <span className="font-medium">{data.canceladas_feriado}</span>
                                  </div>
                                )}
                                <div className="flex items-center justify-between gap-4 pt-1 border-t">
                                  <span className="text-gray-600">Total válidas:</span>
                                  <span className="font-medium">{data.total_validas}</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="inasistencia"
                      name="% Inasistencia Paciente"
                      radius={[4, 4, 0, 0]}
                    >
                      {datosCancelacionesParaGrafico.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-800">
                    Evolución Mensual de Inasistencias (Total)
                  </h3>
                  <div className="text-sm text-gray-500">
                    {datosHistoricoCancelacionesParaGrafico.length} mes{datosHistoricoCancelacionesParaGrafico.length !== 1 ? 'es' : ''}
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={datosHistoricoCancelacionesParaGrafico} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis
                      dataKey="mes"
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
                              <p className="font-medium text-gray-800 mb-2">{data.mesCompleto}</p>
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-red-600">% Inasistencia pacientes:</span>
                                  <span className="font-medium">{data.inasistencia}%</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-green-600">% Asistencia pacientes:</span>
                                  <span className="font-medium">{data.asistencia}%</span>
                                </div>
                                <div className="flex items-center justify-between gap-4 pt-1 border-t">
                                  <span className="text-gray-600">Realizadas:</span>
                                  <span className="font-medium">{data.realizadas}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-red-600">Cancel. con antelación:</span>
                                  <span className="font-medium">{data.canceladas_con_ant}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-red-600">Cancel. sin antelación:</span>
                                  <span className="font-medium">{data.canceladas_sin_ant}</span>
                                </div>
                                <div className="flex items-center justify-between gap-4">
                                  <span className="text-gray-500">Cancel. por profesional:</span>
                                  <span className="font-medium">{data.canceladas_profesional}</span>
                                </div>
                                {/* 🚀 NUEVO: Mostrar feriados separados */}
                                {data.canceladas_feriado > 0 && (
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-blue-600">Cancel. por feriado:</span>
                                    <span className="font-medium">{data.canceladas_feriado}</span>
                                  </div>
                                )}
                                {data.proyectadas > 0 && (
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-purple-600">Proyectadas:</span>
                                    <span className="font-medium">{data.proyectadas}</span>
                                  </div>
                                )}
                                <div className="flex items-center justify-between gap-4 pt-1 border-t">
                                  <span className="text-gray-600">Total válidas:</span>
                                  <span className="font-medium">{data.total_validas}</span>
                                </div>
                                {data.tieneProyecciones && (
                                  <div className="text-xs text-purple-600 mt-2">
                                    * Incluye proyección del mes actual
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="inasistencia"
                      name="% Inasistencia Pacientes"
                      fill={COLORES.inasistencia}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </div>

          {/* 🚀 ACTUALIZADA: Tabla resumen con feriados separados */}
          {!vistaHistoricaCancelaciones && datosCancelaciones.length > 5 && (
            <div className="card p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Resumen de Asistencia</h3>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-700">Paciente</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-700">Realizadas</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-700">Inasist. Pac.</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-700">Cancel. Prof.</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-700">Cancel. Feriado</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-700">Total Válidas</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-700">% Inasist.</th>
                      <th className="px-4 py-3 text-center font-medium text-gray-700">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {datosCancelaciones.slice(0, 8).map((item, index) => (
                      <tr key={item.paciente_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {item.paciente_nombre}
                        </td>
                        <td className="px-4 py-3 text-center text-green-600">
                          {item.realizadas}
                        </td>
                        <td className="px-4 py-3 text-center text-red-600">
                          {item.total_canceladas_paciente}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">
                          {item.canceladas_por_profesional}
                        </td>
                        <td className="px-4 py-3 text-center text-blue-600">
                          {item.canceladas_por_feriado || 0}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600">
                          {item.total_sesiones_validas}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-medium ${item.porcentaje_inasistencia_paciente > 30 ? 'text-red-600' :
                            item.porcentaje_inasistencia_paciente > 15 ? 'text-orange-600' :
                              'text-green-600'
                            }`}>
                            {item.porcentaje_inasistencia_paciente}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.porcentaje_inasistencia_paciente > 30 ? 'bg-red-100 text-red-700' :
                            item.porcentaje_inasistencia_paciente > 15 ? 'bg-orange-100 text-orange-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                            {item.porcentaje_inasistencia_paciente > 30 ? 'Alto' :
                              item.porcentaje_inasistencia_paciente > 15 ? 'Medio' : 'Bien'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DashboardView;