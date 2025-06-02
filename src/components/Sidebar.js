import React, { useState, useEffect } from 'react';
import { Calendar, Users, UserCheck, Home, ArrowDownToLine, ArrowUpFromLine, Receipt, Camera, Edit3, Save, X, UserCog, User, GraduationCap, Heart, CreditCard } from 'lucide-react';
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
    apodo: 'Vicky',
    alias_pago: 'victoriaguemes'
  });

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
    supervisionesDetalle: {
      supervisiones: { cantidad: 0, monto: 0 },
      acomp_evaluaciones: { cantidad: 0, monto: 0 },
      acomp_reevaluaciones: { cantidad: 0, monto: 0 },
      acomp_devoluciones: { cantidad: 0, monto: 0 },
      acomp_reuniones: { cantidad: 0, monto: 0 },
      acomp_sesiones: { cantidad: 0, monto: 0 }
    },
    estimaciones: {
      supervisionesEstimadas: 0,
      horasEstimadas: 0,
      montoEstimado: 0
    }
  });

  // Cargar configuración de perfil
  useEffect(() => {
    cargarPerfilConfig();
  }, []);

  // Cargar datos de proyección usando SOLO el mes actual
  useEffect(() => {
    if (sesiones && supervisoras) {
      const timer = setTimeout(() => {
        calcularEstimadoMesActual();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [sesiones?.length, supervisoras?.length, alquilerConfig?.precio_mensual, lastUpdateTimestamp]);

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

  // 🚀 FUNCIÓN: Calcular estimado SOLO del mes actual
  const calcularEstimadoMesActual = () => {
    try {
      const hoy = new Date();
      const mesActual = hoy.getMonth();
      const añoActual = hoy.getFullYear();

      console.log('📊 Calculando estimado SOLO del mes actual:', {
        mes: mesActual + 1,
        año: añoActual
      });

      // 1. Filtrar sesiones SOLO del mes actual
      const sesionesDelMes = sesiones.filter(sesion => {
        const fechaSesion = new Date(sesion.fecha_hora);
        return fechaSesion.getMonth() === mesActual &&
          fechaSesion.getFullYear() === añoActual;
      });

      console.log('🗓️ Sesiones del mes actual:', sesionesDelMes.length);

      // 2. Solo estados que generan ingresos/gastos
      const estadosValidos = ['Realizada', 'Cancelada sin antelación', 'Pendiente'];
      const sesionesFactivirables = sesionesDelMes.filter(sesion =>
        estadosValidos.includes(sesion.estado)
      );

      console.log('💰 Sesiones que generan ingresos/gastos:', sesionesFactivirables.length);

      // 3. INGRESOS: Separar por tipo
      const sesionesIngresos = sesionesFactivirables.filter(sesion => sesion.paciente_id);

      const sesionesNormales = sesionesIngresos.filter(s => s.tipo_sesion === 'Sesión');
      const evaluaciones = sesionesIngresos.filter(s => s.tipo_sesion === 'Evaluación');
      const reevaluaciones = sesionesIngresos.filter(s => s.tipo_sesion === 'Re-evaluación');
      const devoluciones = sesionesIngresos.filter(s => s.tipo_sesion === 'Devolución');
      const reuniones = sesionesIngresos.filter(s => s.tipo_sesion === 'Reunión con colegio');

      const ingresosSesiones = sesionesNormales.reduce((total, sesion) =>
        total + (sesion.precio_por_hora * sesion.duracion_horas), 0);
      const ingresosEvaluaciones = evaluaciones.reduce((total, sesion) =>
        total + (sesion.precio_por_hora * sesion.duracion_horas), 0);
      const ingresosReevaluaciones = reevaluaciones.reduce((total, sesion) =>
        total + (sesion.precio_por_hora * sesion.duracion_horas), 0);
      const ingresosDevoluciones = devoluciones.reduce((total, sesion) =>
        total + (sesion.precio_por_hora * sesion.duracion_horas), 0);
      const ingresosReuniones = reuniones.reduce((total, sesion) =>
        total + (sesion.precio_por_hora * sesion.duracion_horas), 0);

      const totalIngresos = ingresosSesiones + ingresosEvaluaciones + ingresosReevaluaciones +
        ingresosDevoluciones + ingresosReuniones;

      // 4. GASTOS: Supervisiones directas
      const sesionesSupervisiones = sesionesFactivirables.filter(sesion => sesion.supervisora_id);
      const gastoSupervisionesDirectas = sesionesSupervisiones.reduce((total, sesion) => {
        return total + (sesion.precio_por_hora * sesion.duracion_horas);
      }, 0);

      // 5. GASTOS: Acompañamientos (50% del precio de la sesión)
      const sesionesConAcompanamiento = sesionesFactivirables.filter(sesion =>
        sesion.acompañado_supervisora && sesion.supervisora_acompanante_id
      );
      const gastoAcompanamientos = sesionesConAcompanamiento.reduce((total, sesion) => {
        return total + ((sesion.precio_por_hora * sesion.duracion_horas) * 0.5);
      }, 0);

      // 6. ESTIMACIÓN: Supervisiones regulares (2 por mes, 2 horas cada una = 4 horas)
      let gastoSupervisionesEstimado = 0;
      let supervisionesEstimadas = 0;
      let horasEstimadas = 0;

      const supervisionesRealesDelMes = sesionesSupervisiones.length;

      if (supervisionesRealesDelMes < 2 && supervisoras.length > 0) {
        const supervisorasActivas = supervisoras.filter(s => !s.eliminado);
        if (supervisorasActivas.length > 0) {
          const precioPromedio = supervisorasActivas.reduce((sum, s) =>
            sum + s.precio_por_hora, 0) / supervisorasActivas.length;

          supervisionesEstimadas = 2 - supervisionesRealesDelMes;
          horasEstimadas = supervisionesEstimadas * 2; // 2 horas por supervisión
          gastoSupervisionesEstimado = precioPromedio * horasEstimadas;
        }
      }

      // 7. GASTO: Alquiler (calculado simple para el mes)
      const gastoAlquiler = alquilerConfig?.precio_mensual || 0;

      // 8. TOTALES
      const totalGastoSupervision = gastoSupervisionesDirectas + gastoAcompanamientos + gastoSupervisionesEstimado;
      const gananciaNeta = totalIngresos - totalGastoSupervision - gastoAlquiler;

      // 9. Detalles de acompañamientos separados por tipo
      const acompEvaluaciones = sesionesConAcompanamiento.filter(s => s.tipo_sesion === 'Evaluación');
      const acompReevaluaciones = sesionesConAcompanamiento.filter(s => s.tipo_sesion === 'Re-evaluación');
      const acompDevoluciones = sesionesConAcompanamiento.filter(s => s.tipo_sesion === 'Devolución');
      const acompReuniones = sesionesConAcompanamiento.filter(s => s.tipo_sesion === 'Reunión con colegio');
      const acompSesiones = sesionesConAcompanamiento.filter(s => s.tipo_sesion === 'Sesión');

      // 10. Actualizar estado
      setDatosProyeccion({
        gananciaNeta,
        ingresos: totalIngresos,
        gastoSupervision: totalGastoSupervision,
        gastoAlquiler,
        detalle: {
          sesiones: sesionesNormales.length,
          evaluaciones: evaluaciones.length,
          reevaluaciones: reevaluaciones.length,
          devoluciones: devoluciones.length,
          reuniones_colegio: reuniones.length,
          ingresosSesiones,
          ingresosEvaluaciones,
          ingresosReevaluaciones,
          ingresosDevoluciones,
          ingresosReuniones
        },
        supervisionesDetalle: {
          supervisiones: {
            cantidad: sesionesSupervisiones.length,
            monto: gastoSupervisionesDirectas
          },
          acomp_evaluaciones: {
            cantidad: acompEvaluaciones.length,
            monto: acompEvaluaciones.reduce((t, s) => t + ((s.precio_por_hora * s.duracion_horas) * 0.5), 0)
          },
          acomp_reevaluaciones: {
            cantidad: acompReevaluaciones.length,
            monto: acompReevaluaciones.reduce((t, s) => t + ((s.precio_por_hora * s.duracion_horas) * 0.5), 0)
          },
          acomp_devoluciones: {
            cantidad: acompDevoluciones.length,
            monto: acompDevoluciones.reduce((t, s) => t + ((s.precio_por_hora * s.duracion_horas) * 0.5), 0)
          },
          acomp_reuniones: {
            cantidad: acompReuniones.length,
            monto: acompReuniones.reduce((t, s) => t + ((s.precio_por_hora * s.duracion_horas) * 0.5), 0)
          },
          acomp_sesiones: {
            cantidad: acompSesiones.length,
            monto: acompSesiones.reduce((t, s) => t + ((s.precio_por_hora * s.duracion_horas) * 0.5), 0)
          }
        },
        estimaciones: {
          supervisionesEstimadas,
          horasEstimadas,
          montoEstimado: gastoSupervisionesEstimado
        }
      });

      console.log('📊 Estimado calculado:', {
        ingresos: totalIngresos,
        gastoSupervision: totalGastoSupervision,
        gastoAlquiler,
        gananciaNeta,
        supervisionesReales: supervisionesRealesDelMes,
        supervisionesEstimadas,
        horasEstimadas
      });

    } catch (error) {
      console.error('Error calculando estimado:', error);
      // En caso de error, usar valores vacíos
      setDatosProyeccion({
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
        supervisionesDetalle: {
          supervisiones: { cantidad: 0, monto: 0 },
          acomp_evaluaciones: { cantidad: 0, monto: 0 },
          acomp_reevaluaciones: { cantidad: 0, monto: 0 },
          acomp_devoluciones: { cantidad: 0, monto: 0 },
          acomp_reuniones: { cantidad: 0, monto: 0 },
          acomp_sesiones: { cantidad: 0, monto: 0 }
        },
        estimaciones: {
          supervisionesEstimadas: 0,
          horasEstimadas: 0,
          montoEstimado: 0
        }
      });
    }
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

  const iniciarEdicionPerfil = () => {
    setEditandoPerfil(true);
    setPerfilTemporal({
      nombre_completo: perfilConfig.nombre_completo,
      titulo: perfilConfig.titulo,
      apodo: perfilConfig.apodo,
      alias_pago: perfilConfig.alias_pago
    });
  };

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

  const { gananciaNeta, gastoAlquiler, detalle, supervisionesDetalle, estimaciones } = datosProyeccion;
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
      {/* 🚀 Header con Perfil MEJORADO */}
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

          {/* 🚀 Información Personal MEJORADA */}
          <div className="flex-1">
            {editandoPerfil ? (
              <div className="space-y-2">
                {/* Header de edición */}
                <div className="flex items-center gap-2 mb-3">
                  <UserCog size={12} className="text-yellow-300" />
                  <span className="text-xs text-yellow-300 font-medium">Editando perfil</span>
                </div>

                {/* Nombre completo */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <User size={10} className="text-purple-200" />
                    <span className="text-xs text-purple-200">Nombre completo</span>
                  </div>
                  <input
                    type="text"
                    value={perfilTemporal.nombre_completo || ''}
                    onChange={(e) => setPerfilTemporal(prev => ({ ...prev, nombre_completo: e.target.value }))}
                    className="w-full bg-white/10 text-white text-xs font-medium px-2 py-1 rounded border border-white/20 focus:outline-none focus:border-white/50 placeholder-purple-300"
                    placeholder="Ej: Victoria Güemes"
                  />
                </div>

                {/* Título profesional */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <GraduationCap size={10} className="text-purple-200" />
                    <span className="text-xs text-purple-200">Título profesional</span>
                  </div>
                  <input
                    type="text"
                    value={perfilTemporal.titulo || ''}
                    onChange={(e) => setPerfilTemporal(prev => ({ ...prev, titulo: e.target.value }))}
                    className="w-full bg-white/10 text-white text-xs px-2 py-1 rounded border border-white/20 focus:outline-none focus:border-white/50 placeholder-purple-300"
                    placeholder="Ej: Lic. Psicopedagogía"
                  />
                </div>

                {/* Apodo */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Heart size={10} className="text-purple-200" />
                    <span className="text-xs text-purple-200">Apodo (para mensajes)</span>
                  </div>
                  <input
                    type="text"
                    value={perfilTemporal.apodo || ''}
                    onChange={(e) => setPerfilTemporal(prev => ({ ...prev, apodo: e.target.value }))}
                    className="w-full bg-white/10 text-white text-xs px-2 py-1 rounded border border-white/20 focus:outline-none focus:border-white/50 placeholder-purple-300"
                    placeholder="Ej: Vicky"
                  />
                </div>

                {/* Alias de pago */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard size={10} className="text-purple-200" />
                    <span className="text-xs text-purple-200">Alias de pago</span>
                  </div>
                  <input
                    type="text"
                    value={perfilTemporal.alias_pago || ''}
                    onChange={(e) => setPerfilTemporal(prev => ({ ...prev, alias_pago: e.target.value }))}
                    className="w-full bg-white/10 text-white text-xs px-2 py-1 rounded border border-white/20 focus:outline-none focus:border-white/50 placeholder-purple-300"
                    placeholder="Ej: victoriaguemes"
                  />
                </div>

                <div className="flex gap-1 pt-1">
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
              // Vista normal con botón mejorado
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-sm font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                    {perfilConfig.nombre_completo}
                  </h1>
                  <p className="text-purple-200 text-xs">{perfilConfig.titulo}</p>
                </div>

                {/* 🚀 BOTÓN MEJORADO */}
                <button
                  onClick={iniciarEdicionPerfil}
                  className="flex items-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-purple-200 hover:text-white transition-all group"
                  title="Configurar perfil: nombre, título, apodo y alias de pago"
                >
                  <UserCog size={11} className="group-hover:rotate-12 transition-transform" />
                  <span className="text-xs font-medium">Editar</span>
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

      {/* 🚀 Estimado del mes - Solo mes actual */}
      <div className="px-4 mb-6">
        <div className="p-3 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 flex-1 flex flex-col">
          <h4 className="text-xs text-purple-100 font-medium mb-2">
            Estimado de {nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1)}
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

            {/* 🚀 Mostrar supervisiones estimadas */}
            {estimaciones.supervisionesEstimadas > 0 && (
              <div className="flex justify-between">
                <span>📈 Supervisiones ({estimaciones.supervisionesEstimadas} × 2h)</span>
                <span className="text-red-300">-{formatCurrency(estimaciones.montoEstimado)}</span>
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
              {/* Nota aclaratoria sobre estimaciones */}
              {estimaciones.supervisionesEstimadas > 0 && (
                <div className="text-center text-xs text-purple-300 mt-1">
                  💡 Incluye {estimaciones.supervisionesEstimadas} supervisión(es) estimada(s)
                </div>
              )}
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