import React, { useState, useEffect, useRef } from 'react';
import { X, Clock, User, DollarSign, Edit, Trash2, Check, XCircle, ChevronDown, Plus } from 'lucide-react';

const DayDetailModal = ({
  isOpen,
  onClose,
  fecha,
  sesiones,
  pacientes,
  supervisoras,
  onEditarSesion,
  onEliminarSesion,
  onCategorizarSesion,
  currencyMode,
  tipoCambio,
  // ✅ NUEVA PROP PARA CREAR SESIÓN
  onNuevaSesion
}) => {
  // Estado local para manejar sesiones y actualizaciones inmediatas
  const [sesionesLocales, setSesionesLocales] = useState([]);
  const [showConfirmDelete, setShowConfirmDelete] = useState(null);
  const [showCancelMenu, setShowCancelMenu] = useState(null);
  const cancelMenuRef = useRef(null);

  // Actualizar sesiones locales cuando cambien las props
  useEffect(() => {
    setSesionesLocales(sesiones || []);
  }, [sesiones]);

  // ✅ CERRAR DROPDOWN AL HACER CLIC FUERA
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (cancelMenuRef.current && !cancelMenuRef.current.contains(event.target)) {
        setShowCancelMenu(null);
      }
    };

    if (showCancelMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCancelMenu]);

  if (!isOpen) return null;

  const formatCurrency = (amount, currency = currencyMode) => {
    if (currency === 'USD') {
      return `$${(amount / tipoCambio).toFixed(0)} USD`;
    }
    return `$${amount.toLocaleString()} ARS`;
  };

  const getPacienteById = (id) => pacientes.find(p => p.id === id);
  const getSupervisoraById = (id) => supervisoras.find(s => s.id === s.id);

  const getSessionIcon = (sesion) => {
    switch (sesion.tipo_sesion) {
      case 'Evaluación': return '📋';
      case 'Re-evaluación': return '📝';
      case 'Supervisión': return '👥';
      default: return '🧠';
    }
  };

  const getSessionColor = (sesion) => {
    if (sesion.paciente_id) {
      const paciente = getPacienteById(sesion.paciente_id);
      return paciente?.color || '#6b7280';
    }
    return '#9333ea'; // Purple for supervisiones
  };

  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'Realizada': return 'bg-green-100 text-green-800';
      case 'Cancelada con antelación': return 'bg-yellow-100 text-yellow-800';
      case 'Cancelada sin antelación': return 'bg-red-100 text-red-800';
      case 'Cancelada por mí': return 'bg-gray-100 text-gray-800';
      case 'Cancelada': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  // ✅ FUNCIÓN PARA VERIFICAR SI QUEDAN SESIONES POR CATEGORIZAR
  const quedanSesionesPendientes = () => {
    const hoy = new Date();
    const pendientes = sesionesLocales.filter(s =>
      s.estado === 'Pendiente' && new Date(s.fecha_hora) < hoy
    );
    return pendientes.length;
  };

  // ✅ FUNCIÓN PARA AUTO-CERRAR SI NO QUEDAN PENDIENTES
  const verificarAutoCierre = () => {
    const pendientesRestantes = quedanSesionesPendientes();
    console.log('Sesiones pendientes restantes:', pendientesRestantes);

    if (pendientesRestantes === 0) {
      // Dar un pequeño delay para que el usuario vea el cambio
      setTimeout(() => {
        if (window.showToast) {
          window.showToast('🎉 Todas las sesiones del día categorizadas', 'success', 2000);
        }
        onClose();
      }, 800);
    }
  };

  // ✅ FUNCIÓN PARA MARCAR COMO REALIZADA - USA CALLBACK PRINCIPAL
  const handleMarcarRealizada = async (sesion) => {
    try {
      // Actualizar inmediatamente en el estado local
      setSesionesLocales(prev =>
        prev.map(s => s.id === sesion.id ? { ...s, estado: 'Realizada' } : s)
      );

      // ✅ USAR CALLBACK QUE ACTUALIZA SUPABASE Y ESTADO PRINCIPAL
      const exito = await onCategorizarSesion(sesion, 'Realizada');

      if (exito !== false) {
        // Mostrar toast de éxito
        if (window.showToast) {
          window.showToast('✅ Sesión marcada como realizada', 'success', 3000);
        }

        // ✅ VERIFICAR AUTO-CIERRE
        setTimeout(verificarAutoCierre, 100); // Pequeño delay para que se actualice el estado
      } else {
        throw new Error('Error en la actualización');
      }
    } catch (error) {
      console.error('Error al marcar como realizada:', error);
      // Revertir cambio local en caso de error
      setSesionesLocales(prev =>
        prev.map(s => s.id === sesion.id ? { ...s, estado: 'Pendiente' } : s)
      );
      if (window.showToast) {
        window.showToast('❌ Error al actualizar la sesión', 'error');
      }
    }
  };

  // ✅ FUNCIÓN PARA CANCELAR CON TIPO ESPECÍFICO - USA CALLBACK PRINCIPAL
  const handleCancelar = async (sesion, tipoCancel) => {
    try {
      // Actualizar inmediatamente en el estado local
      setSesionesLocales(prev =>
        prev.map(s => s.id === sesion.id ? { ...s, estado: tipoCancel } : s)
      );

      // ✅ USAR CALLBACK QUE ACTUALIZA SUPABASE Y ESTADO PRINCIPAL
      const exito = await onCategorizarSesion(sesion, tipoCancel);

      if (exito !== false) {
        // Cerrar menú de cancelación
        setShowCancelMenu(null);

        // Mostrar toast de éxito
        if (window.showToast) {
          window.showToast(`❌ Sesión cancelada: ${tipoCancel}`, 'info', 3000);
        }

        // ✅ VERIFICAR AUTO-CIERRE
        setTimeout(verificarAutoCierre, 100); // Pequeño delay para que se actualice el estado
      } else {
        throw new Error('Error en la actualización');
      }
    } catch (error) {
      console.error('Error al cancelar sesión:', error);
      // Revertir cambio local en caso de error
      setSesionesLocales(prev =>
        prev.map(s => s.id === sesion.id ? { ...s, estado: 'Pendiente' } : s)
      );
      if (window.showToast) {
        window.showToast('❌ Error al actualizar la sesión', 'error');
      }
    }
  };

  // ✅ FUNCIÓN PARA ELIMINAR CON CONFIRMACIÓN
  const handleEliminarConConfirmacion = async (sesion) => {
    try {
      // Eliminar inmediatamente del estado local (animación)
      setSesionesLocales(prev => prev.filter(s => s.id !== sesion.id));

      // Llamar al callback para eliminar de la base de datos
      if (onEliminarSesion) {
        await onEliminarSesion(sesion);
      }

      // Cerrar modal de confirmación
      setShowConfirmDelete(null);

      // Mostrar toast de éxito
      if (window.showToast) {
        window.showToast('🗑️ Sesión eliminada correctamente', 'success', 3000);
      }

      // Si no quedan sesiones, cerrar el modal completo
      if (sesionesLocales.length <= 1) {
        setTimeout(() => onClose(), 500);
      }
    } catch (error) {
      console.error('Error al eliminar sesión:', error);
      // Revertir la eliminación local
      setSesionesLocales(sesiones);
      if (window.showToast) {
        window.showToast('❌ Error al eliminar la sesión', 'error');
      }
    }
  };

  // ✅ FUNCIÓN PARA CREAR NUEVA SESIÓN CON FECHA PRE-CARGADA
  const handleNuevaSesion = () => {
    if (onNuevaSesion) {
      // Crear fecha y hora por defecto (fecha del modal + hora actual o 10:00)
      const fechaModal = new Date(fecha);
      const ahora = new Date();

      // Si es el día actual, usar hora actual + 1, sino usar 10:00
      const esHoy = fechaModal.toDateString() === ahora.toDateString();

      if (esHoy) {
        fechaModal.setHours(ahora.getHours() + 1, 0, 0, 0);
      } else {
        fechaModal.setHours(10, 0, 0, 0);
      }

      // Formatear para datetime-local input
      const fechaFormateada = fechaModal.toISOString().slice(0, 16);

      console.log('Creando nueva sesión para fecha:', fechaFormateada);

      // Llamar callback con fecha pre-cargada
      onNuevaSesion(fechaFormateada);
    }
  };

  const hoy = new Date();
  const esPasada = fecha < hoy;
  const sesionsPendientesCount = quedanSesionesPendientes();

  // Opciones de cancelación
  const opcionesCancelacion = [
    { valor: 'Cancelada con antelación', texto: '📅 Con antelación', color: 'text-yellow-700' },
    { valor: 'Cancelada sin antelación', texto: '⚠️ Sin antelación', color: 'text-red-700' },
    { valor: 'Cancelada por mí', texto: '🙋‍♀️ Cancelada por mí', color: 'text-gray-700' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
      <div className="modal-content max-w-2xl w-full mx-4 rounded-xl shadow-2xl max-h-[80vh] overflow-y-auto">

        {/* ✅ HEADER CON BOTÓN NUEVA SESIÓN */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              {fecha.toLocaleDateString('es-AR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </h2>
            <div className="flex items-center gap-4 mt-1">
              <p className="text-gray-600">
                {sesionesLocales.length} sesión{sesionesLocales.length !== 1 ? 'es' : ''} programada{sesionesLocales.length !== 1 ? 's' : ''}
              </p>
              {sesionsPendientesCount > 0 && (
                <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium animate-pulse">
                  ⚠️ {sesionsPendientesCount} por categorizar
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* ✅ BOTÓN NUEVA SESIÓN */}
            <button
              onClick={handleNuevaSesion}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-lg"
              title="Crear nueva sesión para este día"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Nueva Sesión</span>
            </button>

            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-6">
          {sesionesLocales.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Clock className="mx-auto mb-3" size={48} />
              <p className="mb-4">No hay sesiones programadas para este día</p>
              <button
                onClick={handleNuevaSesion}
                className="flex items-center gap-2 mx-auto px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                <Plus size={18} />
                Crear primera sesión del día
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {sesionesLocales.map(sesion => {
                const persona = getPacienteById(sesion.paciente_id) || getSupervisoraById(sesion.supervisora_id);
                const isPending = sesion.estado === 'Pendiente';
                const isPendingPast = isPending && esPasada;
                const hora = new Date(sesion.fecha_hora).toLocaleTimeString('es-AR', {
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div
                    key={sesion.id}
                    className="card p-4 hover-lift transition-all duration-300"
                    style={{ borderLeft: `4px solid ${getSessionColor(sesion)}` }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-lg"
                          style={{ backgroundColor: getSessionColor(sesion) }}
                        >
                          <span className="text-xl">{getSessionIcon(sesion)}</span>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-bold text-gray-800">
                              {persona?.nombre_apellido || 'Sin asignar'}
                            </h3>
                            {isPendingPast && (
                              <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium animate-pulse">
                                ⚠️ Categorizar
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Clock size={14} />
                              <span>{hora}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <User size={14} />
                              <span>{sesion.tipo_sesion}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <DollarSign size={14} />
                              <span>{formatCurrency(sesion.precio_por_hora * sesion.duracion_horas)}</span>
                            </div>
                          </div>

                          <div className="mt-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(sesion.estado)}`}>
                              {sesion.estado}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* ✅ BOTONES DE ACCIÓN MEJORADOS */}
                      <div className="flex items-center gap-2">

                        {/* ✅ BOTONES DE CATEGORIZACIÓN RÁPIDA - Solo si está pendiente */}
                        {isPending && (
                          <>
                            {/* Botón REALIZADA */}
                            <button
                              onClick={() => handleMarcarRealizada(sesion)}
                              className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                              title="Marcar como realizada"
                            >
                              <Check size={16} />
                            </button>

                            {/* Botón CANCELAR con dropdown */}
                            <div className="relative" ref={cancelMenuRef}>
                              <button
                                onClick={() => setShowCancelMenu(showCancelMenu === sesion.id ? null : sesion.id)}
                                className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors flex items-center gap-1"
                                title="Cancelar sesión"
                              >
                                <XCircle size={16} />
                                <ChevronDown size={12} />
                              </button>

                              {/* Dropdown de opciones de cancelación */}
                              {showCancelMenu === sesion.id && (
                                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[200px]">
                                  {opcionesCancelacion.map(opcion => (
                                    <button
                                      key={opcion.valor}
                                      onClick={() => handleCancelar(sesion, opcion.valor)}
                                      className={`w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors text-sm ${opcion.color} flex items-center gap-2`}
                                    >
                                      {opcion.texto}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </>
                        )}

                        {/* Botón editar */}
                        <button
                          onClick={() => onEditarSesion(sesion)}
                          className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                          title="Editar sesión"
                        >
                          <Edit size={16} />
                        </button>

                        {/* Botón eliminar con confirmación */}
                        <button
                          onClick={() => setShowConfirmDelete(sesion)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                          title="Eliminar sesión"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ✅ FOOTER CON INFO ADICIONAL */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {sesionsPendientesCount > 0 ? (
              <span className="text-orange-600 font-medium">
                💡 Categoriza las sesiones pendientes para cerrar automáticamente
              </span>
            ) : sesionesLocales.length > 0 ? (
              <span className="text-green-600 font-medium">
                ✅ Todas las sesiones del día están categorizadas
              </span>
            ) : (
              <span className="text-gray-500">
                📅 Día sin sesiones programadas
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* ✅ MODAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
      {showConfirmDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl p-6 max-w-md mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <Trash2 className="text-red-600" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Eliminar sesión</h3>
                <p className="text-sm text-gray-600">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-gray-700">
                ¿Estás segura de que quieres eliminar la sesión de{' '}
                <span className="font-medium">
                  {(getPacienteById(showConfirmDelete.paciente_id) || getSupervisoraById(showConfirmDelete.supervisora_id))?.nombre_apellido}
                </span>
                {' '}a las {new Date(showConfirmDelete.fecha_hora).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}?
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmDelete(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleEliminarConConfirmacion(showConfirmDelete)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DayDetailModal;