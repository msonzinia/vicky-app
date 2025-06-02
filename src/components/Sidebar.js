import React, { useState, useEffect } from 'react';
import { Calendar, Users, UserCheck, Home, ArrowDownToLine, ArrowUpFromLine, Receipt, Camera, Edit3, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Sidebar = ({
  activeView,
  setActiveView,
  currencyMode,
  setCurrencyMode,
  tipoCambio,
  sesionsPendientes,
  sesiones = [],
  supervisoras = [],
  alquilerConfig = { precio_mensual: 50000 },
  lastUpdateTimestamp
}) => {
  const [perfilConfig, setPerfilConfig] = useState({
    nombre_completo: 'Victoria Güemes',
    titulo: 'Lic. Psicopedagogía',
    foto_url: null,
    apodo: 'Vicky', // 🆕 NUEVO CAMPO
    alias_pago: 'victoriaguemes' // 🆕 NUEVO CAMPO
  });

  // 🚀 MODIFICADO: Estados para edición completa del perfil
  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const [perfilTemporal, setPerfilTemporal] = useState({});

  const [datosProyeccion, setDatosProyeccion] = useState({
    gananciaNeta: 0,
    ingresos: 0,
    gastoSupervision: 0,
    gastoAlquiler: 0,
    detalle: {
      sesiones: 0,
      evaluaciones: 0,
      reevaluaciones: 0,
      devoluciones: 0,
      reuniones_colegio: 0,
      ingresosSesiones: 0,
      ingresosEvaluaciones: 0,
      ingresosReevaluaciones: 0,
      ingresosDevoluciones: 0,
      ingresosReuniones: 0
    },
    supervisiones: []
  });

  // Cargar configuración de perfil COMPLETA
  useEffect(() => {
    cargarPerfilConfig();
  }, []);

  // Cargar datos de proyección usando las views
  useEffect(() => {
    if (sesiones && supervisoras) {
      const timer = setTimeout(() => {
        calcularProyeccionConViews();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [sesiones?.length, supervisoras?.length, alquilerConfig?.precio_mensual, lastUpdateTimestamp]);

  // 🚀 MODIFICADA: Cargar configuración completa del perfil
  const cargarPerfilConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracion_perfil')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setPerfilConfig({
          ...data,
          // Valores por defecto si no existen
          nombre_completo: data.nombre_completo || 'Victoria Güemes',
          titulo: data.titulo || 'Lic. Psicopedagogía',
          apodo: data.apodo || 'Vicky',
          alias_pago: data.alias_pago || 'victoriaguemes'
        });
      }
    } catch (error) {
      console.error('Error cargando perfil:', error);
    }
  };

  // 🚀 NUEVA FUNCIÓN: Calcular proyección usando las views de Supabase
  const calcularProyeccionConViews = async () => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      console.log('📊 Calculando proyección sidebar para:', { year, month });

      // 1. Obtener ingresos usando la view de pacientes
      const { data: ingresosView, error: ingresosError } = await supabase
        .from('resumen_facturacion_mensual')
        .select('*')
        .eq('año', year)
        .eq('mes', month);

      if (ingresosError) throw ingresosError;

      // 2. Obtener gastos de supervisoras usando la view
      const { data: gastosView, error: gastosError } = await supabase
        .from('resumen_gastos_supervisoras_mensual')
        .select('*')
        .eq('año', year)
        .eq('mes', month);

      if (gastosError) throw gastosError;

      // 3. Calcular alquiler
      const fechaInicioAlquiler = new Date('2025-05-01');
      const mesActual = new Date(year, month - 1, 1);

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
      const gastoAlquiler = Math.max(0, totalAlquilerAdeudado - totalAlquilerPagado);

      // 4. Procesar datos de ingresos
      let totalIngresos = 0;
      const detalleIngresos = {
        sesiones: 0,
        evaluaciones: 0,
        reevaluaciones: 0,
        devoluciones: 0,
        reuniones_colegio: 0,
        ingresosSesiones: 0,
        ingresosEvaluaciones: 0,
        ingresosReevaluaciones: 0,
        ingresosDevoluciones: 0,
        ingresosReuniones: 0
      };

      (ingresosView || []).forEach(resumen => {
        if (resumen.total_final > 0) {
          totalIngresos += resumen.total_final;
          detalleIngresos.sesiones += resumen.cantidad_sesiones || 0;
          detalleIngresos.evaluaciones += resumen.cantidad_evaluaciones || 0;
          detalleIngresos.reevaluaciones += resumen.cantidad_reevaluaciones || 0;
          detalleIngresos.devoluciones += resumen.cantidad_devoluciones || 0;
          detalleIngresos.reuniones_colegio += resumen.cantidad_reuniones_colegio || 0;
          detalleIngresos.ingresosSesiones += resumen.monto_sesiones || 0;
          detalleIngresos.ingresosEvaluaciones += resumen.monto_evaluaciones || 0;
          detalleIngresos.ingresosReevaluaciones += resumen.monto_reevaluaciones || 0;
          detalleIngresos.ingresosDevoluciones += resumen.monto_devoluciones || 0;
          detalleIngresos.ingresosReuniones += resumen.monto_reuniones_colegio || 0;
        }
      });

      // 5. Procesar datos de gastos de supervisoras
      let totalGastoSupervision = 0;
      const supervisionesDetalle = {
        supervisiones: { cantidad: 0, monto: 0 },
        acomp_evaluaciones: { cantidad: 0, monto: 0 },
        acomp_reevaluaciones: { cantidad: 0, monto: 0 },
        acomp_devoluciones: { cantidad: 0, monto: 0 },
        acomp_reuniones: { cantidad: 0, monto: 0 },
        acomp_sesiones: { cantidad: 0, monto: 0 }
      };

      (gastosView || []).forEach(gasto => {
        if (gasto.total_final > 0) {
          totalGastoSupervision += gasto.total_final;
          supervisionesDetalle.supervisiones.cantidad += gasto.cantidad_supervisiones || 0;
          supervisionesDetalle.supervisiones.monto += gasto.monto_supervisiones || 0;
          supervisionesDetalle.acomp_evaluaciones.cantidad += gasto.cantidad_acomp_evaluaciones || 0;
          supervisionesDetalle.acomp_evaluaciones.monto += gasto.monto_acomp_evaluaciones || 0;
          supervisionesDetalle.acomp_reevaluaciones.cantidad += gasto.cantidad_acomp_reevaluaciones || 0;
          supervisionesDetalle.acomp_reevaluaciones.monto += gasto.monto_acomp_reevaluaciones || 0;
          supervisionesDetalle.acomp_devoluciones.cantidad += gasto.cantidad_acomp_devoluciones || 0;
          supervisionesDetalle.acomp_devoluciones.monto += gasto.monto_acomp_devoluciones || 0;
          supervisionesDetalle.acomp_reuniones.cantidad += gasto.cantidad_acomp_reuniones || 0;
          supervisionesDetalle.acomp_reuniones.monto += gasto.monto_acomp_reuniones || 0;
          supervisionesDetalle.acomp_sesiones.cantidad += gasto.cantidad_acomp_sesiones || 0;
          supervisionesDetalle.acomp_sesiones.monto += gasto.monto_acomp_sesiones || 0;
        }
      });

      // 6. Calcular ganancia neta
      const gananciaNeta = totalIngresos - totalGastoSupervision - gastoAlquiler;

      // 7. Actualizar estado
      setDatosProyeccion({
        gananciaNeta,
        ingresos: totalIngresos,
        gastoSupervision: totalGastoSupervision,
        gastoAlquiler,
        detalle: detalleIngresos,
        supervisionesDetalle
      });

      console.log('📊 Proyección calculada:', {
        ingresos: totalIngresos,
        gastoSupervision: totalGastoSupervision,
        gastoAlquiler,
        gananciaNeta
      });

    } catch (error) {
      console.error('Error calculando proyección:', error);
      const fallback = calculateCurrentMonthProfitFallback();
      setDatosProyeccion(fallback);
    }
  };

  // Función fallback en caso de error
  const calculateCurrentMonthProfitFallback = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const sesionesDelMes = sesiones.filter(sesion => {
      const fechaSesion = new Date(sesion.fecha_hora);
      return fechaSesion.getMonth() === currentMonth &&
        fechaSesion.getFullYear() === currentYear &&
        !['Cancelada con antelación', 'Cancelada por mí', 'Cancelada'].includes(sesion.estado);
    });

    const sesionesIngresos = sesionesDelMes.filter(sesion => sesion.paciente_id);
    const sesionesSupervisiones = sesionesDelMes.filter(sesion => sesion.supervisora_id);

    const sesionesNormales = sesionesIngresos.filter(s => s.tipo_sesion === 'Sesión');
    const evaluaciones = sesionesIngresos.filter(s => s.tipo_sesion === 'Evaluación');
    const reevaluaciones = sesionesIngresos.filter(s => s.tipo_sesion === 'Re-evaluación');

    const ingresosSesiones = sesionesNormales.reduce((total, sesion) =>
      total + (sesion.precio_por_hora * sesion.duracion_horas), 0);
    const ingresosEvaluaciones = evaluaciones.reduce((total, sesion) =>
      total + (sesion.precio_por_hora * sesion.duracion_horas), 0);
    const ingresosReevaluaciones = reevaluaciones.reduce((total, sesion) =>
      total + (sesion.precio_por_hora * sesion.duracion_horas), 0);

    const ingresos = ingresosSesiones + ingresosEvaluaciones + ingresosReevaluaciones;
    const gastoSupervision = sesionesSupervisiones.reduce((total, sesion) => {
      return total + (sesion.precio_por_hora * sesion.duracion_horas);
    }, 0);

    const gastoAlquiler = alquilerConfig.precio_mensual || 0;
    const gananciaNeta = ingresos - gastoSupervision - gastoAlquiler;

    return {
      gananciaNeta,
      ingresos,
      gastoSupervision,
      gastoAlquiler,
      detalle: {
        sesiones: sesionesNormales.length,
        evaluaciones: evaluaciones.length,
        reevaluaciones: reevaluaciones.length,
        devoluciones: 0,
        reuniones_colegio: 0,
        ingresosSesiones,
        ingresosEvaluaciones,
        ingresosReevaluaciones,
        ingresosDevoluciones: 0,
        ingresosReuniones: 0
      },
      supervisionesDetalle: {
        supervisiones: { cantidad: sesionesSupervisiones.length, monto: gastoSupervision },
        acomp_evaluaciones: { cantidad: 0, monto: 0 },
        acomp_reevaluaciones: { cantidad: 0, monto: 0 },
        acomp_devoluciones: { cantidad: 0, monto: 0 },
        acomp_reuniones: { cantidad: 0, monto: 0 },
        acomp_sesiones: { cantidad: 0, monto: 0 }
      }
    };
  };

  const subirFotoPerfil = async (file) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `profile-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('configuracion_perfil')
        .update({ foto_url: urlData.publicUrl })
        .eq('id', perfilConfig.id);

      if (updateError) throw updateError;

      setPerfilConfig(prev => ({ ...prev, foto_url: urlData.publicUrl }));

      if (window.showToast) {
        window.showToast('Foto de perfil actualizada', 'success');
      }

    } catch (error) {
      console.error('Error subiendo foto:', error);
      alert('Error al subir la foto: ' + error.message);
    }
  };

  // 🚀 MODIFICADA: Actualizar perfil completo
  const actualizarPerfil = async () => {
    try {
      const { error } = await supabase
        .from('configuracion_perfil')
        .update({
          nombre_completo: perfilTemporal.nombre_completo,
          titulo: perfilTemporal.titulo,
          apodo: perfilTemporal.apodo,
          alias_pago: perfilTemporal.alias_pago
        })
        .eq('id', perfilConfig.id);

      if (error) throw error;

      setPerfilConfig(prev => ({
        ...prev,
        nombre_completo: perfilTemporal.nombre_completo,
        titulo: perfilTemporal.titulo,
        apodo: perfilTemporal.apodo,
        alias_pago: perfilTemporal.alias_pago
      }));

      setEditandoPerfil(false);
      setPerfilTemporal({});

      if (window.showToast) {
        window.showToast('Perfil actualizado correctamente', 'success');
      }

    } catch (error) {
      console.error('Error actualizando perfil:', error);
      alert('Error al actualizar perfil: ' + error.message);
    }
  };

  // 🚀 NUEVA: Iniciar edición de perfil
  const iniciarEdicionPerfil = () => {
    setEditandoPerfil(true);
    setPerfilTemporal({
      nombre_completo: perfilConfig.nombre_completo,
      titulo: perfilConfig.titulo,
      apodo: perfilConfig.apodo,
      alias_pago: perfilConfig.alias_pago
    });
  };

  // 🚀 NUEVA: Cancelar edición
  const cancelarEdicionPerfil = () => {
    setEditandoPerfil(false);
    setPerfilTemporal({});
  };

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      subirFotoPerfil(file);
    }
  };

  const formatCurrency = (amount, currency = currencyMode) => {
    if (currency === 'USD') {
      return `${(amount / tipoCambio).toFixed(0)} USD`;
    }
    return `${amount.toLocaleString()} ARS`;
  };

  const { gananciaNeta, gastoAlquiler, detalle, supervisionesDetalle } = datosProyeccion;
  const nombreMes = new Date().toLocaleDateString('es-AR', { month: 'long' });

  const menuItems = [
    { id: 'calendario', label: 'Calendario', icon: Calendar },
    { id: 'entradas', label: 'Entradas', icon: ArrowDownToLine },
    { id: 'salidas', label: 'Salidas', icon: ArrowUpFromLine },
    { id: 'facturar', label: 'Facturar', icon: Receipt },
    { id: 'pacientes', label: 'Pacientes', icon: Users },
    { id: 'coordinadoras', label: 'Supervisoras', icon: UserCheck },
    { id: 'alquiler', label: 'Alquiler', icon: Home }
  ];

  return (
    <div className="w-72 sidebar-fixed text-white flex-shrink-0 flex flex-col h-screen">
      {/* Header con Perfil - EXPANDIDO PARA EDICIÓN */}
      <div className="p-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Foto de Perfil */}
          <div className="relative">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-white/20 border border-white/30">
              {perfilConfig.foto_url ? (
                <img src={perfilConfig.foto_url} alt="Perfil" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-lg font-bold text-white">
                  {perfilConfig.nombre_completo.split(' ').map(n => n.charAt(0)).join('').slice(0, 2)}
                </div>
              )}
            </div>
            <label htmlFor="profile-upload" className="absolute -bottom-1 -right-1 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-purple-700 transition-colors">
              <Camera size={10} className="text-white" />
            </label>
            <input
              id="profile-upload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          {/* Información Personal */}
          <div className="flex-1">
            {editandoPerfil ? (
              // 🚀 NUEVO: Formulario de edición completo
              <div className="space-y-2">
                <input
                  type="text"
                  value={perfilTemporal.nombre_completo || ''}
                  onChange={(e) => setPerfilTemporal(prev => ({ ...prev, nombre_completo: e.target.value }))}
                  className="w-full bg-white/10 text-gray-900 text-xs font-medium px-2 py-1 rounded border border-white/20 focus:outline-none focus:border-white/50 placeholder-gray-600"
                  placeholder="Nombre completo"
                />
                <input
                  type="text"
                  value={perfilTemporal.titulo || ''}
                  onChange={(e) => setPerfilTemporal(prev => ({ ...prev, titulo: e.target.value }))}
                  className="w-full bg-white/10 text-gray-900 text-xs px-2 py-1 rounded border border-white/20 focus:outline-none focus:border-white/50 placeholder-gray-600"
                  placeholder="Título profesional"
                />
                <input
                  type="text"
                  value={perfilTemporal.apodo || ''}
                  onChange={(e) => setPerfilTemporal(prev => ({ ...prev, apodo: e.target.value }))}
                  className="w-full bg-white/10 text-gray-900 text-xs px-2 py-1 rounded border border-white/20 focus:outline-none focus:border-white/50 placeholder-gray-600"
                  placeholder="Tu apodo (para mensajes)"
                />
                <input
                  type="text"
                  value={perfilTemporal.alias_pago || ''}
                  onChange={(e) => setPerfilTemporal(prev => ({ ...prev, alias_pago: e.target.value }))}
                  className="w-full bg-white/10 text-gray-900 text-xs px-2 py-1 rounded border border-white/20 focus:outline-none focus:border-white/50 placeholder-gray-600"
                  placeholder="Alias de pago"
                />
                <div className="flex gap-1">
                  <button
                    onClick={actualizarPerfil}
                    className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                  >
                    <Save size={10} />
                    Guardar
                  </button>
                  <button
                    onClick={cancelarEdicionPerfil}
                    className="flex items-center gap-1 px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                  >
                    <X size={10} />
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              // Vista normal SIN mostrar apodo y alias
              <div className="flex items-center gap-1">
                <div>
                  <h1 className="text-sm font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                    {perfilConfig.nombre_completo}
                  </h1>
                  <p className="text-purple-200 text-xs">{perfilConfig.titulo}</p>
                </div>
                <button
                  onClick={iniciarEdicionPerfil}
                  className="text-purple-200 hover:text-white opacity-70 hover:opacity-100"
                  title="Editar perfil completo"
                >
                  <Edit3 size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notificación de sesiones pendientes */}
      {sesionsPendientes > 0 && (
        <div className="mx-4 mb-2 p-2 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-lg shadow-lg flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <p className="text-xs text-white font-medium">
              {sesionsPendientes} pendiente{sesionsPendientes > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      {/* Navegación */}
      <div className="px-4 flex-shrink-0">
        <nav className="space-y-1 mb-4">
          {menuItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300 text-sm ${activeView === id
                ? 'bg-white text-purple-800 shadow-xl font-semibold'
                : 'hover:bg-white/20 hover:shadow-lg'
                }`}
            >
              <Icon size={16} />
              <span className="font-medium">{label}</span>
              {id === 'calendario' && sesionsPendientes > 0 && (
                <span className="ml-auto bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {sesionsPendientes}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Ganancia neta del mes */}
      <div className="px-4 mb-6">
        <div className="p-3 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 flex-1 flex flex-col">
          <h4 className="text-xs text-purple-100 font-medium mb-2">
            Ganancia proyectada de {nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)}
          </h4>

          <div className={`text-lg font-bold mb-3 ${gananciaNeta >= 0 ? 'text-green-300' : 'text-red-300'}`}>
            {formatCurrency(gananciaNeta)}
          </div>

          {/* Detalles compactos */}
          <div className="text-xs text-purple-200 space-y-1 flex-1">
            {/* INGRESOS */}
            {detalle.sesiones > 0 && (
              <div className="flex justify-between">
                <span>🧠 Sesiones ({detalle.sesiones})</span>
                <span className="text-green-300">{formatCurrency(detalle.ingresosSesiones)}</span>
              </div>
            )}
            {detalle.evaluaciones > 0 && (
              <div className="flex justify-between">
                <span>📋 Evaluaciones ({detalle.evaluaciones})</span>
                <span className="text-green-300">{formatCurrency(detalle.ingresosEvaluaciones)}</span>
              </div>
            )}
            {detalle.reevaluaciones > 0 && (
              <div className="flex justify-between">
                <span>📝 Re-evaluaciones ({detalle.reevaluaciones})</span>
                <span className="text-green-300">{formatCurrency(detalle.ingresosReevaluaciones)}</span>
              </div>
            )}
            {detalle.devoluciones > 0 && (
              <div className="flex justify-between">
                <span>🔄 Devoluciones ({detalle.devoluciones})</span>
                <span className="text-green-300">{formatCurrency(detalle.ingresosDevoluciones)}</span>
              </div>
            )}
            {detalle.reuniones_colegio > 0 && (
              <div className="flex justify-between">
                <span>🏫 Reuniones ({detalle.reuniones_colegio})</span>
                <span className="text-green-300">{formatCurrency(detalle.ingresosReuniones)}</span>
              </div>
            )}

            {/* Separador si hay ingresos */}
            {(detalle.sesiones > 0 || detalle.evaluaciones > 0 || detalle.reevaluaciones > 0 || detalle.devoluciones > 0 || detalle.reuniones_colegio > 0) && (
              <div className="border-t border-purple-300/30 my-1"></div>
            )}

            {/* GASTOS */}
            {supervisionesDetalle?.supervisiones?.cantidad > 0 && (
              <div className="flex justify-between">
                <span>👥 Supervisiones ({supervisionesDetalle.supervisiones.cantidad})</span>
                <span className="text-red-300">-{formatCurrency(supervisionesDetalle.supervisiones.monto)}</span>
              </div>
            )}

            {supervisionesDetalle?.acomp_evaluaciones?.cantidad > 0 && (
              <div className="flex justify-between">
                <span>📋 Acomp. Evaluaciones ({supervisionesDetalle.acomp_evaluaciones.cantidad})</span>
                <span className="text-red-300">-{formatCurrency(supervisionesDetalle.acomp_evaluaciones.monto)}</span>
              </div>
            )}

            {supervisionesDetalle?.acomp_reevaluaciones?.cantidad > 0 && (
              <div className="flex justify-between">
                <span>📝 Acomp. Re-evaluaciones ({supervisionesDetalle.acomp_reevaluaciones.cantidad})</span>
                <span className="text-red-300">-{formatCurrency(supervisionesDetalle.acomp_reevaluaciones.monto)}</span>
              </div>
            )}

            {supervisionesDetalle?.acomp_devoluciones?.cantidad > 0 && (
              <div className="flex justify-between">
                <span>🔄 Acomp. Devoluciones ({supervisionesDetalle.acomp_devoluciones.cantidad})</span>
                <span className="text-red-300">-{formatCurrency(supervisionesDetalle.acomp_devoluciones.monto)}</span>
              </div>
            )}

            {supervisionesDetalle?.acomp_reuniones?.cantidad > 0 && (
              <div className="flex justify-between">
                <span>🏫 Acomp. Reuniones ({supervisionesDetalle.acomp_reuniones.cantidad})</span>
                <span className="text-red-300">-{formatCurrency(supervisionesDetalle.acomp_reuniones.monto)}</span>
              </div>
            )}

            {supervisionesDetalle?.acomp_sesiones?.cantidad > 0 && (
              <div className="flex justify-between">
                <span>🧠 Acomp. Sesiones ({supervisionesDetalle.acomp_sesiones.cantidad})</span>
                <span className="text-red-300">-{formatCurrency(supervisionesDetalle.acomp_sesiones.monto)}</span>
              </div>
            )}

            {gastoAlquiler > 0 && (
              <div className="flex justify-between">
                <span>🏠 Alquiler</span>
                <span className="text-red-300">-{formatCurrency(gastoAlquiler)}</span>
              </div>
            )}

            {/* Resultado final */}
            <div className="border-t border-purple-300/30 pt-1 mt-2">
              <div className="text-center font-medium text-xs">
                {gananciaNeta >= 0 ? '📈 Ganancia' : '📉 Pérdida'} del mes
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toggle de moneda */}
      <div className="px-4 pb-4 flex-shrink-0">
        <div className="flex bg-white/20 rounded-md p-0.5">
          <button
            onClick={() => setCurrencyMode('ARS')}
            className={`flex-1 py-1 px-2 rounded text-xs font-medium transition-all ${currencyMode === 'ARS'
              ? 'bg-white text-purple-800 shadow-lg'
              : 'text-purple-100 hover:bg-white/10'
              }`}
          >
            ARS
          </button>
          <button
            onClick={() => setCurrencyMode('USD')}
            className={`flex-1 py-1 px-2 rounded text-xs font-medium transition-all ${currencyMode === 'USD'
              ? 'bg-white text-purple-800 shadow-lg'
              : 'text-purple-100 hover:bg-white/10'
              }`}
          >
            USD
          </button>
        </div>
        <p className="text-xs text-purple-200 mt-1 text-center">
          TC: ${tipoCambio?.toLocaleString()}
        </p>
      </div>
    </div>
  );
};

export default Sidebar;