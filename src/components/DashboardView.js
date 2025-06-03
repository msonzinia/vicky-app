import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Clock, DollarSign, Receipt, Settings, Save, X, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';
import { supabase } from '../lib/supabase';

const DashboardView = ({ currencyMode, tipoCambio }) => {
  const [loading, setLoading] = useState(true);
  const [datosGanancias, setDatosGanancias] = useState([]);
  const [datosFacturacion, setDatosFacturacion] = useState([]);
  const [datosCancelaciones, setDatosCancelaciones] = useState([]);
  const [metricas, setMetricas] = useState({});
  const [monotributo, setMonotributo] = useState({});
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState('');
  const [pacientesDisponibles, setPacientesDisponibles] = useState([]);

  // Estados para la tabla de monotributo
  const [showMonotributoModal, setShowMonotributoModal] = useState(false);
  const [categoriasMonotributo, setCategoriasMonotributo] = useState([
    { codigo: 'A', facturacion_minima: 0, facturacion_maxima: 7813063, cuota_servicios: 32221, cuota_bienes: 32221 },
    { codigo: 'B', facturacion_minima: 7813064, facturacion_maxima: 11447046, cuota_servicios: 36679, cuota_bienes: 36679 },
    { codigo: 'C', facturacion_minima: 11447047, facturacion_maxima: 15645430, cuota_servicios: 42951, cuota_bienes: 42951 },
    { codigo: 'D', facturacion_minima: 15645431, facturacion_maxima: 19575537, cuota_servicios: 51584, cuota_bienes: 51584 },
    { codigo: 'E', facturacion_minima: 19575538, facturacion_maxima: 23440590, cuota_servicios: 77951, cuota_bienes: 70440 },
    { codigo: 'F', facturacion_minima: 23440591, facturacion_maxima: 29376450, cuota_servicios: 98103, cuota_bienes: 84535 },
    { codigo: 'G', facturacion_minima: 29376451, facturacion_maxima: 35130600, cuota_servicios: 149845, cuota_bienes: 103328 },
    { codigo: 'H', facturacion_minima: 35130601, facturacion_maxima: 53301600, cuota_servicios: 340081, cuota_bienes: 206827 },
    { codigo: 'I', facturacion_minima: 53301601, facturacion_maxima: 59661450, cuota_servicios: 626994, cuota_bienes: 309520 },
    { codigo: 'J', facturacion_minima: 59661451, facturacion_maxima: 70603800, cuota_servicios: 759420, cuota_bienes: 377852 },
    { codigo: 'K', facturacion_minima: 70603801, facturacion_maxima: 82370281, cuota_servicios: 1050324, cuota_bienes: 456773 }
  ]);

  const [editandoCategorias, setEditandoCategorias] = useState(false);
  const [categoriasTemp, setCategoriasTemp] = useState([]);

  const formatearMes = (fechaISO) => {
    const fecha = new Date(fechaISO);
    return fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  };

  const formatearMesCorto = (fechaISO) => {
    const fecha = new Date(fechaISO);
    return fecha.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
  };

  const cargarDatosDashboard = useCallback(async () => {
    try {
      setLoading(true);

      // 1. Cargar datos de ganancias mensuales (ya filtradas desde mayo 2025)
      const { data: ganancias, error: errorGanancias } = await supabase
        .from('dashboard_ganancias_mensuales')
        .select('*')
        .order('mes');

      if (errorGanancias) {
        console.error('Error cargando ganancias:', errorGanancias);
        throw errorGanancias;
      }

      // 2. Cargar datos de facturación mensual (ya filtrados desde mayo 2025)
      const { data: facturacion, error: errorFacturacion } = await supabase
        .from('dashboard_facturacion_mensual')
        .select('*')
        .order('mes');

      if (errorFacturacion) {
        console.error('Error cargando facturación:', errorFacturacion);
        throw errorFacturacion;
      }

      // 3. Cargar datos de cancelaciones por paciente (ya filtrados desde mayo 2025)
      const { data: cancelaciones, error: errorCancelaciones } = await supabase
        .from('dashboard_cancelaciones_paciente')
        .select('*')
        .order('mes, paciente_nombre');

      if (errorCancelaciones) {
        console.error('Error cargando cancelaciones:', errorCancelaciones);
        throw errorCancelaciones;
      }

      // 4. Cargar métricas de crecimiento
      const { data: metricasData, error: errorMetricas } = await supabase
        .from('dashboard_metricas_crecimiento')
        .select('*')
        .limit(1)
        .single();

      if (errorMetricas && errorMetricas.code !== 'PGRST116') {
        console.error('Error cargando métricas:', errorMetricas);
        throw errorMetricas;
      }

      // 5. Cargar datos de monotributo
      const { data: monotributoData, error: errorMonotributo } = await supabase
        .from('dashboard_monotributo')
        .select('*')
        .limit(1)
        .single();

      if (errorMonotributo && errorMonotributo.code !== 'PGRST116') {
        console.error('Error cargando monotributo:', errorMonotributo);
        throw errorMonotributo;
      }

      // Procesar datos para gráficos (solo si hay datos)
      const gananciasFormateadas = (ganancias || [])
        .filter(item => item.mes) // Solo registros con fecha válida
        .map(item => ({
          mes: formatearMes(item.mes),
          mesCorto: formatearMesCorto(item.mes),
          ganancia_neta: item.ganancia_neta || 0,
          ingresos_sesiones: item.ingresos_sesiones || 0,
          gastos_totales: item.gastos_totales || 0,
          horas_trabajadas: item.horas_trabajadas || 0,
          fecha: item.mes
        }));

      const facturacionFormateada = (facturacion || [])
        .filter(item => item.mes) // Solo registros con fecha válida
        .map(item => ({
          mes: formatearMes(item.mes),
          mesCorto: formatearMesCorto(item.mes),
          porcentaje_facturado: item.porcentaje_facturado || 0,
          porcentaje_no_facturado: 100 - (item.porcentaje_facturado || 0),
          monto_facturado: item.monto_facturado || 0,
          monto_no_facturado: item.monto_no_facturado || 0,
          monto_total: item.monto_total || 0
        }));

      const cancelacionesFormateadas = (cancelaciones || [])
        .filter(item => item.mes) // Solo registros con fecha válida
        .map(item => ({
          mes: formatearMes(item.mes),
          mesCorto: formatearMesCorto(item.mes),
          paciente_id: item.paciente_id,
          paciente_nombre: item.paciente_nombre,
          total_sesiones: item.total_sesiones || 0,
          sesiones_canceladas: item.sesiones_canceladas || 0,
          porcentaje_cancelacion: item.porcentaje_cancelacion || 0
        }));

      // Extraer lista de pacientes únicos
      const pacientesUnicos = [...new Set(cancelacionesFormateadas.map(item => item.paciente_nombre))]
        .sort()
        .map(nombre => {
          const item = cancelacionesFormateadas.find(c => c.paciente_nombre === nombre);
          return {
            id: item.paciente_id,
            nombre: nombre
          };
        });

      console.log('✅ Datos cargados:', {
        ganancias: gananciasFormateadas.length,
        facturacion: facturacionFormateada.length,
        cancelaciones: cancelacionesFormateadas.length,
        metricas: metricasData ? 'OK' : 'Sin datos',
        monotributo: monotributoData ? 'OK' : 'Sin datos'
      });

      setDatosGanancias(gananciasFormateadas);
      setDatosFacturacion(facturacionFormateada);
      setDatosCancelaciones(cancelacionesFormateadas);
      setPacientesDisponibles(pacientesUnicos);
      setMetricas(metricasData || {});
      setMonotributo(monotributoData || {});

    } catch (error) {
      console.error('Error cargando datos del dashboard:', error);

      // En caso de error, usar datos vacíos
      setDatosGanancias([]);
      setDatosFacturacion([]);
      setDatosCancelaciones([]);
      setPacientesDisponibles([]);
      setMetricas({});
      setMonotributo({});

    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatosDashboard();
  }, [cargarDatosDashboard]);

  const formatCurrency = (amount, currency = currencyMode) => {
    if (currency === 'USD') {
      return `$${(amount / tipoCambio).toFixed(0)} USD`;
    }
    return `$${amount.toLocaleString()} ARS`;
  };

  const determinarCategoriaMonotributo = (facturacion) => {
    for (const categoria of categoriasMonotributo) {
      if (facturacion >= categoria.facturacion_minima && facturacion <= categoria.facturacion_maxima) {
        return categoria;
      }
    }
    return categoriasMonotributo[categoriasMonotributo.length - 1]; // Última categoría si excede
  };

  const calcularProximaRecategorizacion = () => {
    const hoy = new Date();
    const mes = hoy.getMonth() + 1;

    if (mes >= 2 && mes <= 7) {
      return { fecha: 'Agosto 2025', tipo: 'próxima' };
    } else {
      return { fecha: 'Febrero 2026', tipo: 'próxima' };
    }
  };

  const obtenerDatosCancelacionesFiltrados = () => {
    if (!pacienteSeleccionado) return datosCancelaciones;
    return datosCancelaciones.filter(item => item.paciente_nombre === pacienteSeleccionado);
  };

  const guardarCategoriasMonotributo = async () => {
    try {
      // Aquí podrías guardar en una tabla de configuración si lo deseas
      setCategoriasMonotributo([...categoriasTemp]);
      setEditandoCategorias(false);
      setShowMonotributoModal(false);

      if (window.showToast) {
        window.showToast('Categorías de monotributo actualizadas', 'success');
      }
    } catch (error) {
      console.error('Error guardando categorías:', error);
    }
  };

  const iniciarEdicionCategorias = () => {
    setCategoriasTemp([...categoriasMonotributo]);
    setEditandoCategorias(true);
  };

  const cancelarEdicionCategorias = () => {
    setCategoriasTemp([]);
    setEditandoCategorias(false);
  };

  const actualizarCategoriaTemp = (index, campo, valor) => {
    const nuevasCategorias = [...categoriasTemp];
    nuevasCategorias[index] = {
      ...nuevasCategorias[index],
      [campo]: parseInt(valor) || 0
    };
    setCategoriasTemp(nuevasCategorias);
  };

  // 🚀 CORREGIDO: Solo mostrar datos si hay datos reales
  const datosGraficoComprensivo = datosGanancias.filter(item =>
    item.ingresos_sesiones > 0 || item.gastos_totales > 0 || item.horas_trabajadas > 0
  );

  // Colores para gráficos
  const COLORES = {
    ganancia: '#10B981',
    ganancia_negativa: '#EF4444',
    ingresos: '#3B82F6',
    gastos: '#F59E0B',
    horas: '#8B5CF6',
    facturado: '#059669',
    no_facturado: '#6B7280',
    cancelaciones: '#DC2626'
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

  // 🚀 CORREGIDO: Mostrar mensaje si no hay datos
  if (datosGraficoComprensivo.length === 0) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center">
            <BarChart3 className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
            <p className="text-gray-600">Análisis financiero y métricas de rendimiento</p>
          </div>
        </div>

        {/* Mensaje de sin datos */}
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="text-gray-400" size={32} />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Sin datos disponibles</h3>
          <p className="text-gray-600 mb-4">
            El dashboard mostrará información cuando tengas:
          </p>
          <ul className="text-sm text-gray-500 space-y-1 max-w-md mx-auto">
            <li>• Pagos recibidos registrados</li>
            <li>• Pagos hechos (gastos) registrados</li>
            <li>• Sesiones realizadas</li>
          </ul>
          <p className="text-xs text-gray-400 mt-4">
            Los datos se calculan desde mayo 2025 en adelante
          </p>
        </div>
      </div>
    );
  }

  const categoriaActual = determinarCategoriaMonotributo(monotributo.proyeccion_total || 0);
  const proximaRecategorizacion = calcularProximaRecategorizacion();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center">
          <BarChart3 className="text-white" size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-600">Análisis financiero y métricas de rendimiento (desde mayo 2025)</p>
        </div>
      </div>

      {/* Cards de métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Promedio mensual */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center">
              <DollarSign className="text-white" size={24} />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-800">
                {formatCurrency(metricas.promedio_ganancia_mensual || 0)}
              </div>
              <div className="text-sm text-gray-500">
                Promedio mensual ({metricas.meses_calculados || 0} meses)
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-500">Desde mayo 2025</div>
        </div>

        {/* Crecimiento ganancia */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-700 rounded-xl flex items-center justify-center">
              {(metricas.crecimiento_ganancia_pct || 0) >= 0 ? (
                <TrendingUp className="text-white" size={24} />
              ) : (
                <TrendingDown className="text-white" size={24} />
              )}
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${(metricas.crecimiento_ganancia_pct || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {metricas.crecimiento_ganancia_pct ? `${metricas.crecimiento_ganancia_pct > 0 ? '+' : ''}${metricas.crecimiento_ganancia_pct}%` : 'N/A'}
              </div>
              <div className="text-sm text-gray-500">
                Crecimiento ganancia
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {metricas.ultimo_mes && metricas.mes_anterior ?
              `${formatearMesCorto(metricas.ultimo_mes)} vs ${formatearMesCorto(metricas.mes_anterior)}` :
              'Sin datos suficientes'
            }
          </div>
        </div>

        {/* Crecimiento horas */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center">
              <Clock className="text-white" size={24} />
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${(metricas.crecimiento_horas_pct || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {metricas.crecimiento_horas_pct ? `${metricas.crecimiento_horas_pct > 0 ? '+' : ''}${metricas.crecimiento_horas_pct}%` : 'N/A'}
              </div>
              <div className="text-sm text-gray-500">
                Crecimiento horas
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            {metricas.ultimo_mes && metricas.mes_anterior ?
              `${formatearMesCorto(metricas.ultimo_mes)} vs ${formatearMesCorto(metricas.mes_anterior)}` :
              'Sin datos suficientes'
            }
          </div>
        </div>

        {/* Monotributo actual */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-700 rounded-xl flex items-center justify-center">
              <Receipt className="text-white" size={24} />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-800">
                Cat. {categoriaActual.codigo}
              </div>
              <div className="text-sm text-gray-500">
                {formatCurrency(monotributo.proyeccion_total || 0)}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Proyección período
            </div>
            <button
              onClick={() => setShowMonotributoModal(true)}
              className="text-orange-600 hover:text-orange-700 p-1"
              title="Configurar categorías"
            >
              <Settings size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Gráfico principal: Ganancias y Horas */}
      {datosGraficoComprensivo.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-800">Ganancias Mensuales y Horas Trabajadas</h3>
            <div className="text-sm text-gray-500">Datos reales desde mayo 2025</div>
          </div>

          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={datosGraficoComprensivo}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="mesCorto"
                tick={{ fontSize: 12 }}
                axisLine={false}
              />
              <YAxis
                yAxisId="dinero"
                orientation="left"
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickFormatter={(value) => formatCurrency(value).split(' ')[0]}
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
                    return (
                      <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
                        <p className="font-medium text-gray-800 mb-2">{data.mes}</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-green-600">Ganancia neta:</span>
                            <span className="font-medium">{formatCurrency(data.ganancia_neta)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-blue-600">Ingresos:</span>
                            <span className="font-medium">{formatCurrency(data.ingresos_sesiones)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-orange-600">Gastos:</span>
                            <span className="font-medium">{formatCurrency(data.gastos_totales)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-purple-600">Horas trabajadas:</span>
                            <span className="font-medium">{data.horas_trabajadas}h</span>
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
                dataKey="ganancia_neta"
                name="Ganancia Neta"
                fill={COLORES.ganancia}
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="horas"
                type="monotone"
                dataKey="horas_trabajadas"
                name="Horas Trabajadas"
                stroke={COLORES.horas}
                strokeWidth={3}
                dot={{ fill: COLORES.horas, strokeWidth: 2, r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Grid de gráficos secundarios */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de facturación */}
        {datosFacturacion.length > 0 && (
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-800">Facturación Mensual</h3>
              <div className="text-sm text-gray-500">% Facturado vs No Facturado</div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={datosFacturacion}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="mesCorto"
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
                          <p className="font-medium text-gray-800 mb-2">{data.mes}</p>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-green-600">Facturado:</span>
                              <span className="font-medium">{data.porcentaje_facturado.toFixed(1)}% ({formatCurrency(data.monto_facturado)})</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-gray-600">No facturado:</span>
                              <span className="font-medium">{data.porcentaje_no_facturado.toFixed(1)}% ({formatCurrency(data.monto_no_facturado)})</span>
                            </div>
                            <div className="flex items-center justify-between gap-4 pt-1 border-t">
                              <span className="text-gray-800">Total:</span>
                              <span className="font-medium">{formatCurrency(data.monto_total)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="porcentaje_facturado"
                  stackId="facturacion"
                  name="Facturado"
                  fill={COLORES.facturado}
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="porcentaje_no_facturado"
                  stackId="facturacion"
                  name="No Facturado"
                  fill={COLORES.no_facturado}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Gráfico de cancelaciones */}
        {datosCancelaciones.length > 0 && (
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-800">Cancelaciones por Paciente</h3>
              <select
                value={pacienteSeleccionado}
                onChange={(e) => setPacienteSeleccionado(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Todos los pacientes</option>
                {pacientesDisponibles.map(paciente => (
                  <option key={paciente.id} value={paciente.nombre}>
                    {paciente.nombre}
                  </option>
                ))}
              </select>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={obtenerDatosCancelacionesFiltrados()}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="mesCorto"
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
                          <p className="font-medium text-gray-800 mb-2">{data.mes}</p>
                          <p className="text-sm text-gray-600 mb-2">{data.paciente_nombre}</p>
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-red-600">Canceladas:</span>
                              <span className="font-medium">{data.sesiones_canceladas}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-gray-600">Total sesiones:</span>
                              <span className="font-medium">{data.total_sesiones}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-gray-800">% Cancelación:</span>
                              <span className="font-medium">{data.porcentaje_cancelacion}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="porcentaje_cancelacion"
                  name="% Cancelaciones"
                  fill={COLORES.cancelaciones}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Card de monotributo detallado */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-800">Análisis de Monotributo</h3>
          <div className="text-sm text-gray-500">Facturación y proyección por período</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Situación actual */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-700">Situación Actual</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Categoría actual:</span>
                <span className="font-bold text-lg">Categoría {categoriaActual.codigo}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Facturado en período:</span>
                <span className="font-medium">{formatCurrency(monotributo.facturado_12_meses || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Límite actual:</span>
                <span className="font-medium">{formatCurrency(categoriaActual.facturacion_maxima)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Utilización:</span>
                <span className="font-medium">
                  {categoriaActual.facturacion_maxima > 0 ?
                    ((monotributo.facturado_12_meses || 0) / categoriaActual.facturacion_maxima * 100).toFixed(1) : 0
                  }%
                </span>
              </div>
            </div>
          </div>

          {/* Proyección */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-700">Proyección hasta {proximaRecategorizacion.fecha}</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Proyección total:</span>
                <span className="font-medium">{formatCurrency(monotributo.proyeccion_total || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Sesiones pendientes:</span>
                <span className="font-medium">{monotributo.total_pendientes || 0} sesiones</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Valor pendiente:</span>
                <span className="font-medium">{formatCurrency(monotributo.ingresos_pendientes || 0)}</span>
              </div>
              {monotributo.proyeccion_total > categoriaActual.facturacion_maxima && (
                <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <AlertTriangle className="text-orange-600" size={16} />
                  <span className="text-sm text-orange-700">
                    Podrías necesitar recategorizar
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de configuración de monotributo */}
      {showMonotributoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
          <div className="modal-content max-w-4xl w-full mx-4 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800">Categorías de Monotributo</h2>
              <button onClick={() => setShowMonotributoModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <p className="text-gray-600">Escalas vigentes de ARCA (actualizadas febrero 2025)</p>
                {!editandoCategorias ? (
                  <button
                    onClick={iniciarEdicionCategorias}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Settings size={16} />
                    Editar
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={guardarCategoriasMonotributo}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      <Save size={16} />
                      Guardar
                    </button>
                    <button
                      onClick={cancelarEdicionCategorias}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      <X size={16} />
                      Cancelar
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Cat.</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Facturación Mínima</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Facturación Máxima</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Cuota Servicios</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Cuota Bienes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(editandoCategorias ? categoriasTemp : categoriasMonotributo).map((categoria, index) => (
                      <tr key={categoria.codigo} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{categoria.codigo}</td>
                        <td className="px-4 py-3">
                          {editandoCategorias ? (
                            <input
                              type="number"
                              value={categoria.facturacion_minima}
                              onChange={(e) => actualizarCategoriaTemp(index, 'facturacion_minima', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            formatCurrency(categoria.facturacion_minima)
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editandoCategorias ? (
                            <input
                              type="number"
                              value={categoria.facturacion_maxima}
                              onChange={(e) => actualizarCategoriaTemp(index, 'facturacion_maxima', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            formatCurrency(categoria.facturacion_maxima)
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editandoCategorias ? (
                            <input
                              type="number"
                              value={categoria.cuota_servicios}
                              onChange={(e) => actualizarCategoriaTemp(index, 'cuota_servicios', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            formatCurrency(categoria.cuota_servicios)
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editandoCategorias ? (
                            <input
                              type="number"
                              value={categoria.cuota_bienes}
                              onChange={(e) => actualizarCategoriaTemp(index, 'cuota_bienes', e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          ) : (
                            formatCurrency(categoria.cuota_bienes)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Información importante</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Las recategorizaciones son obligatorias en febrero y agosto</li>
                  <li>• Se evalúa la facturación por período (no 12 meses móviles)</li>
                  <li>• La próxima recategorización es en {proximaRecategorizacion.fecha}</li>
                  <li>• Estas escalas están vigentes desde febrero 2025</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardView;