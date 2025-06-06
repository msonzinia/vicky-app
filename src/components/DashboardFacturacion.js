import React, { useState, useEffect, useCallback } from 'react';
import { Receipt, AlertTriangle, TrendingUp, Calendar, Settings, Target, DollarSign, BarChart3, Info, X } from 'lucide-react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '../lib/supabase';

const DashboardFacturacion = ({ currencyMode, tipoCambio }) => {
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [updateKey, setUpdateKey] = useState(0); // 🔧 NUEVO: Para forzar updates

  // Estados principales
  const [datosFacturacion, setDatosFacturacion] = useState(null);
  const [datosGraficoMensual, setDatosGraficoMensual] = useState([]);
  const [configuracionUsuario, setConfiguracionUsuario] = useState(null);
  const [categorias, setCategorias] = useState([]);

  // Cargar datos principales del dashboard
  const cargarDatosFacturacion = useCallback(async () => {
    try {
      console.log('📊 Cargando datos de facturación...');

      // 🔧 CORRECCIÓN: Cargar configuración directamente aquí también
      const { data: configData } = await supabase
        .from('configuracion_usuario_monotributo')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      // Intentar cargar la view del dashboard
      const { data, error } = await supabase
        .from('dashboard_facturacion_monotributo')
        .select('*')
        .limit(1);

      let datosFacturacion = null;

      if (data && data.length > 0) {
        datosFacturacion = data[0];

        // 🔧 OVERRIDE: Siempre usar la meta de la configuración real
        if (configData && configData.meta_porcentaje_facturacion) {
          datosFacturacion.meta_porcentaje_facturacion = configData.meta_porcentaje_facturacion;
          console.log('✅ Usando meta de configuración directa:', configData.meta_porcentaje_facturacion);
        }
      } else if (configData) {
        // Si no hay datos de dashboard pero sí hay configuración, crear datos básicos
        console.log('⚠️ No hay datos de dashboard, usando solo configuración');
        datosFacturacion = {
          meta_porcentaje_facturacion: configData.meta_porcentaje_facturacion,
          categoria_actual: configData.categoria_actual,
          total_facturado_periodo: 0,
          total_entradas_periodo: 0,
          porcentaje_facturacion_periodo: 0,
          estado_alerta: 'OK'
        };
      }

      console.log('📊 Datos de facturación finales:', datosFacturacion);
      setDatosFacturacion(datosFacturacion);

    } catch (error) {
      console.error('Error cargando datos de facturación:', error);
      setDatosFacturacion(null);
    }
  }, []);

  // Cargar datos mensuales para el gráfico
  const cargarDatosGraficoMensual = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('pagos_recibidos')
        .select(`
          fecha,
          monto_ars,
          facturado
        `)
        .eq('eliminado', false)
        .gte('fecha', '2024-01-01')
        .order('fecha');

      if (error) throw error;

      // Agrupar por mes
      const datosPorMes = {};

      data.forEach(pago => {
        const fecha = new Date(pago.fecha);
        const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;

        if (!datosPorMes[mesKey]) {
          datosPorMes[mesKey] = {
            mes: fecha.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
            mesCompleto: fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
            total_entradas: 0,
            total_facturado: 0,
            cantidad_entradas: 0,
            cantidad_facturadas: 0
          };
        }

        datosPorMes[mesKey].total_entradas += pago.monto_ars;
        datosPorMes[mesKey].cantidad_entradas += 1;

        if (pago.facturado) {
          datosPorMes[mesKey].total_facturado += pago.monto_ars;
          datosPorMes[mesKey].cantidad_facturadas += 1;
        }
      });

      // Convertir a array y calcular porcentajes
      const datosFormateados = Object.keys(datosPorMes)
        .sort()
        .map(mesKey => {
          const datos = datosPorMes[mesKey];
          return {
            ...datos,
            porcentaje_facturacion: datos.total_entradas > 0
              ? Math.round((datos.total_facturado / datos.total_entradas) * 100)
              : 0,
            entradas_no_facturadas: datos.total_entradas - datos.total_facturado
          };
        });

      console.log('📈 Datos gráfico mensual:', datosFormateados);
      setDatosGraficoMensual(datosFormateados);

    } catch (error) {
      console.error('Error cargando datos del gráfico:', error);
      setDatosGraficoMensual([]);
    }
  }, []);

  // Cargar configuración del usuario
  const cargarConfiguracion = useCallback(async () => {
    try {
      // 🔧 CORRECCIÓN: Consulta simple sin JOIN
      const { data: configData, error: configError } = await supabase
        .from('configuracion_usuario_monotributo')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (configError && configError.code !== 'PGRST116') {
        console.warn('No se encontró configuración de usuario:', configError);
      }

      console.log('📊 Configuración cargada:', configData);
      setConfiguracionUsuario(configData);

      // Cargar todas las categorías para el configurador
      const { data: categoriasData, error: categoriasError } = await supabase
        .from('configuracion_monotributo')
        .select('*')
        .is('vigente_hasta', null)
        .order('categoria');

      if (categoriasError) {
        console.error('Error cargando categorías:', categoriasError);
        throw categoriasError;
      }

      console.log('📊 Categorías cargadas:', categoriasData?.length || 0);
      setCategorias(categoriasData || []);

    } catch (error) {
      console.error('Error cargando configuración:', error);
      setConfiguracionUsuario(null);
      setCategorias([]);
    }
  }, []);

  // Efecto principal para cargar todos los datos
  useEffect(() => {
    const cargarTodosLosDatos = async () => {
      setLoading(true);
      await Promise.all([
        cargarDatosFacturacion(),
        cargarDatosGraficoMensual(),
        cargarConfiguracion()
      ]);
      setLoading(false);
    };

    cargarTodosLosDatos();
  }, [cargarDatosFacturacion, cargarDatosGraficoMensual, cargarConfiguracion, updateKey]); // 🔧 NUEVO: Incluir updateKey

  // Función para formatear moneda
  const formatCurrency = (amount, currency = currencyMode) => {
    if (currency === 'USD') {
      return `${(amount / tipoCambio).toFixed(0)} USD`;
    }
    return `${Math.round(amount).toLocaleString()} ARS`;
  };

  // Función para obtener el color de la alerta
  const getAlertaColor = (estado) => {
    switch (estado) {
      case 'ALERTA_LIMITE': return 'text-red-600 bg-red-50 border-red-200';
      case 'PRECAUCION_LIMITE': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'BAJO_PORCENTAJE_FACTURACION': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  // Función para obtener el mensaje de alerta
  const getMensajeAlerta = (estado, datos) => {
    if (!datos) return '';

    switch (estado) {
      case 'ALERTA_LIMITE':
        return `⚠️ ¡Cuidado! Ya facturaste el ${datos.porcentaje_limite_utilizado}% del límite de tu categoría. Considerá postergar facturas hasta después de la recategorización.`;
      case 'PRECAUCION_LIMITE':
        return `🔶 Estás cerca del límite (${datos.porcentaje_limite_utilizado}% utilizado). Monitoreá tu facturación.`;
      case 'BAJO_PORCENTAJE_FACTURACION':
        return `📈 Tu porcentaje de facturación (${datos.porcentaje_facturacion_periodo}%) está por debajo de tu meta (${datos.meta_porcentaje_facturacion}%). ¡Podés facturar más!`;
      default:
        return `✅ ¡Todo bien! Estás facturando ${datos.porcentaje_facturacion_periodo}% de tus entradas y dentro de los límites de tu categoría.`;
    }
  };

  // Calcular próxima categoría según proyección
  const calcularProximaCategoria = (proyeccionAnual) => {
    if (!categorias.length || !proyeccionAnual) return null;

    const categoriaCorrespondiente = categorias.find(cat =>
      proyeccionAnual <= cat.limite_anual_ars
    );

    return categoriaCorrespondiente || categorias[categorias.length - 1];
  };

  // Guardar configuración del usuario
  const guardarConfiguracion = async (nuevaConfig) => {
    try {
      console.log('💾 Guardando configuración:', nuevaConfig);

      // 🔧 SOLUCIÓN DIRECTA: No usar función SQL, manejar upsert en React

      // 1. Verificar si ya existe configuración
      const { data: existingConfig, error: checkError } = await supabase
        .from('configuracion_usuario_monotributo')
        .select('id')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      let resultado;

      if (existingConfig && !checkError) {
        // 2. Actualizar configuración existente
        console.log('🔄 Actualizando configuración existente:', existingConfig.id);

        const { data: updatedData, error: updateError } = await supabase
          .from('configuracion_usuario_monotributo')
          .update({
            ...nuevaConfig,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingConfig.id)
          .select()
          .single();

        if (updateError) throw updateError;
        resultado = updatedData;
        console.log('✅ Configuración actualizada:', resultado);

      } else {
        // 3. Crear nueva configuración
        console.log('➕ Creando nueva configuración');

        const { data: newData, error: insertError } = await supabase
          .from('configuracion_usuario_monotributo')
          .insert([{
            ...nuevaConfig,
            updated_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (insertError) throw insertError;
        resultado = newData;
        console.log('✅ Nueva configuración creada:', resultado);
      }

      // 4. Recargar datos Y forzar actualización del estado
      await Promise.all([
        cargarConfiguracion(),
        cargarDatosFacturacion()
      ]);

      setShowConfig(false);

      if (window.showToast) {
        window.showToast(`✅ Meta actualizada a ${nuevaConfig.meta_porcentaje_facturacion}%`, 'success');
      }

      // 🔧 EXTRA: Forzar re-render después de un delay
      setTimeout(() => {
        setUpdateKey(prev => prev + 1);
      }, 100);

    } catch (error) {
      console.error('❌ Error guardando configuración:', error);
      if (window.showToast) {
        window.showToast('Error al guardar configuración: ' + error.message, 'error');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando dashboard de facturación...</p>
        </div>
      </div>
    );
  }

  // Si no hay configuración, mostrar mensaje para configurar
  if (!configuracionUsuario) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-700 rounded-xl flex items-center justify-center">
              <Receipt className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Dashboard de Facturación</h2>
              <p className="text-gray-600">Control de monotributo y seguimiento de ingresos facturados</p>
            </div>
          </div>

          <button
            onClick={() => setShowConfig(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Settings size={16} />
            Configurar Monotributo
          </button>
        </div>

        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Receipt className="text-green-600" size={32} />
          </div>

          <h3 className="text-xl font-bold text-gray-800 mb-2">Configurá tu información de monotributo</h3>
          <p className="text-gray-600 mb-6">
            Para ver el dashboard de facturación, necesitamos conocer tu categoría actual y objetivos
          </p>

          <button
            onClick={() => setShowConfig(true)}
            className="btn-primary text-white px-6 py-3 rounded-xl font-medium"
          >
            <Settings className="inline mr-2" size={16} />
            Configurar Ahora
          </button>
        </div>

        {showConfig && (
          <ConfiguracionModal
            isOpen={showConfig}
            onClose={() => setShowConfig(false)}
            onSave={guardarConfiguracion}
            configuracion={null}
            categorias={categorias}
          />
        )}
      </div>
    );
  }

  // Si no hay datos (por problemas con la view), mostrar mensaje
  if (!datosFacturacion) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-700 rounded-xl flex items-center justify-center">
              <Receipt className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Dashboard de Facturación</h2>
              <p className="text-gray-600">Control de monotributo y seguimiento de ingresos facturados</p>
            </div>
          </div>

          <button
            onClick={() => setShowConfig(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Settings size={16} />
            Configurar
          </button>
        </div>

        <div className="card p-8 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <BarChart3 className="text-gray-400" size={24} />
          </div>

          <h3 className="text-lg font-bold text-gray-800 mb-2">Sin datos de facturación</h3>
          <p className="text-gray-600">
            Verificá que tengas pagos recibidos registrados para ver el análisis
          </p>
        </div>

        {showConfig && (
          <ConfiguracionModal
            isOpen={showConfig}
            onClose={() => setShowConfig(false)}
            onSave={guardarConfiguracion}
            configuracion={configuracionUsuario}
            categorias={categorias}
          />
        )}
      </div>
    );
  }

  const proximaCategoria = calcularProximaCategoria(datosFacturacion.proyeccion_anual_actual);
  const diferenciaCosto = proximaCategoria && proximaCategoria.categoria !== datosFacturacion.categoria_actual
    ? (proximaCategoria.cuota_mensual_servicios - (categorias.find(c => c.categoria === datosFacturacion.categoria_actual)?.cuota_mensual_servicios || 0))
    : 0;

  return (
    <div className="space-y-6">
      {/* Header con configuración */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-700 rounded-xl flex items-center justify-center">
            <Receipt className="text-white" size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Dashboard de Facturación</h2>
            <p className="text-gray-600">Control de monotributo y seguimiento de ingresos facturados</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Categoría actual:</span> {datosFacturacion.categoria_actual}
          </div>

          <button
            onClick={() => setShowConfig(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Settings size={16} />
            Configurar
          </button>
        </div>
      </div>

      {/* Alerta principal */}
      {datosFacturacion.estado_alerta && (
        <div className={`p-4 rounded-lg border ${getAlertaColor(datosFacturacion.estado_alerta)}`}>
          <div className="flex items-start gap-3">
            <Info size={20} className="mt-0.5 flex-shrink-0" />
            <p className="text-sm font-medium">
              {getMensajeAlerta(datosFacturacion.estado_alerta, datosFacturacion)}
            </p>
          </div>
        </div>
      )}

      {/* Tarjetas KPI principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Facturado este período */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-700 rounded-xl flex items-center justify-center">
              <Receipt className="text-white" size={24} />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(datosFacturacion.total_facturado_periodo)}
              </div>
              <div className="text-sm text-gray-500">Facturado en período fiscal</div>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Del {new Date(datosFacturacion.periodo_inicio).toLocaleDateString('es-AR')} al{' '}
            {new Date(datosFacturacion.periodo_fin).toLocaleDateString('es-AR')}
          </div>
        </div>

        {/* % Facturación actual */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center">
              <Target className="text-white" size={24} />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">
                {datosFacturacion.porcentaje_facturacion_periodo}%
              </div>
              <div className="text-sm text-gray-500">
                Meta: {datosFacturacion.meta_porcentaje_facturacion}%
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-500">% de entradas facturadas</div>
        </div>

        {/* Próxima recategorización */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center">
              <Calendar className="text-white" size={24} />
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-purple-600">
                {datosFacturacion.dias_restantes} días
              </div>
              <div className="text-sm text-gray-500">
                {new Date(datosFacturacion.proxima_recategorizacion).toLocaleDateString('es-AR')}
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-500">Próxima recategorización</div>
        </div>

        {/* Margen disponible */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 bg-gradient-to-br rounded-xl flex items-center justify-center ${datosFacturacion.margen_disponible_periodo > 0 ? 'from-green-500 to-green-700' : 'from-red-500 to-red-700'
              }`}>
              <DollarSign className="text-white" size={24} />
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${datosFacturacion.margen_disponible_periodo > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                {formatCurrency(Math.abs(datosFacturacion.margen_disponible_periodo))}
              </div>
              <div className="text-sm text-gray-500">
                {datosFacturacion.margen_disponible_periodo > 0 ? 'Disponible' : 'Excedido'}
              </div>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Margen en categoría {datosFacturacion.categoria_actual}
          </div>
        </div>
      </div>

      {/* ✨ GRÁFICO MENSUAL DE FACTURACIÓN - BARRAS APILADAS */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-800">
            Evolución Mensual de Facturación
          </h3>
          <div className="text-sm text-gray-500">
            % de entradas facturadas por mes
          </div>
        </div>

        {datosGraficoMensual.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <ComposedChart data={datosGraficoMensual} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
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
                    return `${(value / tipoCambio / 1000).toFixed(0)}k`;
                  }
                  return `${(value / 1000).toFixed(0)}k`;
                }}
              />

              <YAxis
                yAxisId="porcentaje"
                orientation="right"
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
                            <span className="text-blue-600">Total entradas:</span>
                            <span className="font-medium">{formatCurrency(data.total_entradas)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-green-600">Facturado:</span>
                            <span className="font-medium">{formatCurrency(data.total_facturado)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-red-600">Sin facturar:</span>
                            <span className="font-medium">{formatCurrency(data.entradas_no_facturadas)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 pt-1 border-t">
                            <span className="text-purple-600">% Facturación:</span>
                            <span className="font-medium">{data.porcentaje_facturacion}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Legend />

              {/* ✨ BARRAS APILADAS - Facturado (abajo, verde) */}
              <Bar
                yAxisId="dinero"
                dataKey="total_facturado"
                stackId="total"
                name="Facturado"
                fill="#10B981"
                radius={[0, 0, 0, 0]}
              />

              {/* ✨ BARRAS APILADAS - Sin facturar (arriba, rojo) */}
              <Bar
                yAxisId="dinero"
                dataKey="entradas_no_facturadas"
                stackId="total"
                name="Sin facturar"
                fill="#EF4444"
                radius={[4, 4, 0, 0]}
              />

              {/* Línea de porcentaje de facturación */}
              <Line
                yAxisId="porcentaje"
                type="monotone"
                dataKey="porcentaje_facturacion"
                name="% Facturación"
                stroke="#8B5CF6"
                strokeWidth={3}
                dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No hay datos suficientes para mostrar el gráfico
          </div>
        )}
      </div>

      {/* Panel de proyección y análisis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Proyección de categoría */}
        <div className="card p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">
            Proyección de Categoría
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Categoría actual:</span>
              <span className="font-bold text-lg">{datosFacturacion.categoria_actual}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-600">Proyección anual:</span>
              <span className="font-medium">{formatCurrency(datosFacturacion.proyeccion_anual_actual)}</span>
            </div>

            {proximaCategoria && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Categoría proyectada:</span>
                  <span className={`font-bold text-lg ${proximaCategoria.categoria !== datosFacturacion.categoria_actual ? 'text-orange-600' : 'text-green-600'
                    }`}>
                    {proximaCategoria.categoria}
                  </span>
                </div>

                {diferenciaCosto !== 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Diferencia de costo:</span>
                    <span className={`font-medium ${diferenciaCosto > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {diferenciaCosto > 0 ? '+' : ''}{formatCurrency(diferenciaCosto)}/mes
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {proximaCategoria && proximaCategoria.categoria !== datosFacturacion.categoria_actual && (
            <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <p className="text-sm text-orange-700">
                <AlertTriangle className="inline mr-1" size={14} />
                Si mantenés este ritmo, cambiarías a categoría {proximaCategoria.categoria}
                en la próxima recategorización.
              </p>
            </div>
          )}
        </div>

        {/* Resumen del período */}
        <div className="card p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">
            Resumen del Período Fiscal
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total de entradas:</span>
              <span className="font-medium">{formatCurrency(datosFacturacion.total_entradas_periodo)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-600">Total facturado:</span>
              <span className="font-medium text-green-600">{formatCurrency(datosFacturacion.total_facturado_periodo)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-600">Sin facturar:</span>
              <span className="font-medium text-red-600">
                {formatCurrency(datosFacturacion.total_entradas_periodo - datosFacturacion.total_facturado_periodo)}
              </span>
            </div>

            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Límite de categoría:</span>
                <span className="font-medium">{formatCurrency(datosFacturacion.limite_anual_ars)}</span>
              </div>

              <div className="flex items-center justify-between mt-1">
                <span className="text-gray-600">% utilizado:</span>
                <span className={`font-medium ${datosFacturacion.porcentaje_limite_utilizado > 90 ? 'text-red-600' :
                  datosFacturacion.porcentaje_limite_utilizado > 80 ? 'text-orange-600' : 'text-green-600'
                  }`}>
                  {datosFacturacion.porcentaje_limite_utilizado}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de configuración */}
      {showConfig && (
        <ConfiguracionModal
          isOpen={showConfig}
          onClose={() => setShowConfig(false)}
          onSave={guardarConfiguracion}
          configuracion={configuracionUsuario}
          categorias={categorias}
        />
      )}
    </div>
  );
};

// Componente Modal de Configuración
const ConfiguracionModal = ({ isOpen, onClose, onSave, configuracion, categorias }) => {
  const [formData, setFormData] = useState({
    categoria_actual: 'A',
    tipo_actividad: 'servicios',
    meta_porcentaje_facturacion: 100,
    fecha_inscripcion_monotributo: new Date().toISOString().split('T')[0],
    observaciones: ''
  });

  useEffect(() => {
    if (configuracion) {
      setFormData({
        categoria_actual: configuracion.categoria_actual || 'A',
        tipo_actividad: configuracion.tipo_actividad || 'servicios',
        meta_porcentaje_facturacion: configuracion.meta_porcentaje_facturacion || 100,
        fecha_inscripcion_monotributo: configuracion.fecha_inscripcion_monotributo?.split('T')[0] || new Date().toISOString().split('T')[0],
        observaciones: configuracion.observaciones || ''
      });
    }
  }, [configuracion]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  if (!isOpen) return null;

  const categoriaSeleccionada = categorias.find(c => c.categoria === formData.categoria_actual);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
      <div className="modal-content max-w-2xl w-full mx-4 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">
            Configuración de Monotributo
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoría actual *
              </label>
              <select
                value={formData.categoria_actual}
                onChange={(e) => setFormData(prev => ({ ...prev, categoria_actual: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                required
              >
                {categorias.map(categoria => (
                  <option key={categoria.categoria} value={categoria.categoria}>
                    Categoría {categoria.categoria} - Hasta ${(categoria.limite_anual_ars / 1000000).toFixed(1)}M
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de actividad
              </label>
              <select
                value={formData.tipo_actividad}
                onChange={(e) => setFormData(prev => ({ ...prev, tipo_actividad: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="servicios">Servicios (Psicopedagogía)</option>
                <option value="comercio">Comercio/Venta</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Meta de facturación (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.meta_porcentaje_facturacion}
                onChange={(e) => setFormData(prev => ({ ...prev, meta_porcentaje_facturacion: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              <p className="text-xs text-gray-500 mt-1">% de entradas que querés facturar</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fecha de inscripción
              </label>
              <input
                type="date"
                value={formData.fecha_inscripcion_monotributo}
                onChange={(e) => setFormData(prev => ({ ...prev, fecha_inscripcion_monotributo: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Información de la categoría seleccionada */}
          {categoriaSeleccionada && (
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h4 className="font-medium text-green-800 mb-2">
                Información Categoría {categoriaSeleccionada.categoria}
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-green-700">Límite anual:</span>
                  <span className="ml-2 font-medium">${(categoriaSeleccionada.limite_anual_ars / 1000000).toFixed(1)}M</span>
                </div>
                <div>
                  <span className="text-green-700">Cuota mensual:</span>
                  <span className="ml-2 font-medium">
                    ${(formData.tipo_actividad === 'servicios'
                      ? categoriaSeleccionada.cuota_mensual_servicios
                      : categoriaSeleccionada.cuota_mensual_comercio
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
              {categoriaSeleccionada.descripcion && (
                <p className="text-sm text-green-600 mt-2">{categoriaSeleccionada.descripcion}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Observaciones
            </label>
            <textarea
              value={formData.observaciones}
              onChange={(e) => setFormData(prev => ({ ...prev, observaciones: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
              rows={3}
              placeholder="Notas adicionales sobre tu situación fiscal..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary text-white px-6 py-2 rounded-lg"
            >
              {configuracion ? 'Actualizar' : 'Guardar'} Configuración
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DashboardFacturacion;