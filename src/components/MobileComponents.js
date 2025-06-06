import React, { useState, useEffect } from 'react';
import { Menu, X, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, Edit3, Plus, Eye, EyeOff } from 'lucide-react';

// 🚀 Hook para detectar mobile
export const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return isMobile;
};

// 🚀 Header Mobile con logo jel3.png y visibilidad de montos
export const MobileHeader = ({
  onToggleSidebar,
  gananciaNeta,
  sesionsPendientes,
  formatCurrency,
  onCategorizarSesiones,
  onNuevaSesion
}) => {
  // Estados para visibilidad de montos
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  // Cargar configuración inicial del localStorage
  useEffect(() => {
    const savedVisibility = localStorage.getItem('moneyVisibility');
    if (savedVisibility !== null) {
      setIsVisible(JSON.parse(savedVisibility));
    }
  }, []);

  // Función para toggle con animación
  const toggleVisibility = () => {
    setIsAnimating(true);

    setTimeout(() => {
      const newVisibility = !isVisible;
      setIsVisible(newVisibility);
      localStorage.setItem('moneyVisibility', JSON.stringify(newVisibility));
      setIsAnimating(false);
    }, 150);
  };

  // ✅ SOLO esta función para la ganancia principal
  const formatVisibleAmount = (amount, formatCurrency) => {
    if (isVisible) {
      return formatCurrency(amount);
    }

    const formattedAmount = formatCurrency(amount);
    const length = formattedAmount.replace(/[^\d]/g, '').length;
    const hiddenAmount = '*'.repeat(Math.min(length, 6));

    if (formattedAmount.includes('USD')) {
      return `${hiddenAmount} USD`;
    } else {
      return `${hiddenAmount} ARS`;
    }
  };

  // Obtener el mes actual
  const mesActual = new Date().toLocaleDateString('es-AR', { month: 'long' });
  const mesCapitalizado = mesActual.charAt(0).toUpperCase() + mesActual.slice(1);

  return (
    <div className="lg:hidden bg-gradient-to-r from-purple-600 to-purple-800 text-white p-4 sticky top-0 z-50">
      <div className="flex items-center justify-between">
        {/* Logo solo */}
        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center overflow-hidden">
          <img
            src="/jel3.png"
            alt="JEL Logo"
            className="w-8 h-8 object-contain"
            onError={(e) => {
              // Fallback si no encuentra la imagen
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'block';
            }}
          />
          <div className="hidden font-bold text-lg">JEL</div>
        </div>

        {/* Proyección del mes - CENTRADO con visibilidad */}
        <div className="flex-1 text-center mx-4 relative">
          <div className="flex items-center justify-center gap-2 mb-1">
            <div className="text-xs text-purple-200">Ganancia {mesCapitalizado}</div>

            {/* 🚀 BOTÓN DE VISIBILIDAD con animación MÁS GRANDE */}
            <button
              onClick={toggleVisibility}
              className={`p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-300 ${isAnimating ? 'scale-110 rotate-180' : 'scale-100 rotate-0'
                }`}
              title={isVisible ? 'Ocultar montos' : 'Mostrar montos'}
            >
              {isVisible ? (
                <Eye size={14} className="text-purple-200 hover:text-white transition-colors" />
              ) : (
                <EyeOff size={14} className="text-purple-300 hover:text-white transition-colors" />
              )}
            </button>
          </div>

          {/* ✅ SOLO este monto se oculta */}
          <div
            className={`transition-all duration-300 ${isAnimating ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'
              }`}
          >
            <div className={`text-xl font-bold ${gananciaNeta >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              {formatVisibleAmount(gananciaNeta, formatCurrency)}
            </div>
          </div>
        </div>

        {/* Botón para agregar nueva sesión */}
        <button
          onClick={onNuevaSesion}
          className="p-3 rounded-lg bg-green-500 hover:bg-green-600 transition-colors shadow-lg"
          title="Agregar nueva sesión"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
};

// 🚀 Componente para botones de categorización con dropdown
const BotonesCategorización = ({ sesion, onCategorizarSesion, onEditarSesion }) => {
  const [showCancelOptions, setShowCancelOptions] = useState(false);

  const esSupervisión = sesion.tipo_sesion === 'Supervisión';

  const opciones = esSupervisión ? [
    { value: 'Cancelada', label: 'Cancelada', color: 'bg-red-500' }
  ] : [
    { value: 'Cancelada con antelación', label: 'Con antelación', color: 'bg-orange-500' },
    { value: 'Cancelada sin antelación', label: 'Sin antelación', color: 'bg-red-500' },
    { value: 'Cancelada por mí', label: 'Por mí', color: 'bg-gray-500' },
    { value: 'Cancelada por feriado', label: 'Por feriado', color: 'bg-blue-500' }
  ];

  return (
    <div className="grid grid-cols-3 gap-1">
      {/* BOTÓN REALIZADA - SOLO ÍCONO */}
      <button
        onClick={() => onCategorizarSesion(sesion, 'Realizada')}
        className="bg-green-500 text-white py-3 px-1 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center"
      >
        <CheckCircle size={16} />
      </button>

      {/* BOTÓN CANCELADA con dropdown - SOLO ÍCONO */}
      <div className="relative">
        <button
          onClick={() => setShowCancelOptions(!showCancelOptions)}
          className="w-full bg-red-500 text-white py-3 px-1 rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center"
        >
          <X size={16} />
        </button>

        {/* Dropdown de opciones de cancelación */}
        {showCancelOptions && (
          <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-lg shadow-xl z-20">
            {opciones.map((opcion) => (
              <button
                key={opcion.value}
                onClick={() => {
                  onCategorizarSesion(sesion, opcion.value);
                  setShowCancelOptions(false);
                }}
                className={`w-full ${opcion.color} text-white py-2 px-2 text-xs font-bold hover:opacity-90 transition-opacity first:rounded-t-lg last:rounded-b-lg`}
              >
                {opcion.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* BOTÓN EDITAR - SOLO ÍCONO */}
      <button
        onClick={() => onEditarSesion(sesion)}
        className="bg-blue-500 text-white py-3 px-1 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center"
      >
        <Edit3 size={16} />
      </button>
    </div>
  );
};

// 🚀 Modal simple para mostrar todas las sesiones pendientes
const SesionesPendientesModal = ({
  isOpen,
  onClose,
  sesionesPendientes,
  pacientes,
  supervisoras,
  onCategorizarSesion,
  formatCurrency
}) => {
  // Funciones helper para el modal
  const getPacienteById = (id) => pacientes.find(p => p.id === id);
  const getSupervisoraById = (id) => supervisoras.find(s => s.id === id);

  const getPersonaNombre = (sesion) => {
    if (sesion.paciente_id) {
      const paciente = getPacienteById(sesion.paciente_id);
      return paciente?.nombre_apellido || 'Paciente sin asignar';
    } else if (sesion.supervisora_id) {
      const supervisora = getSupervisoraById(sesion.supervisora_id);
      return supervisora?.nombre_apellido || 'Supervisora sin asignar';
    }
    return 'Sin asignar';
  };

  const getSessionIcon = (tipo) => {
    switch (tipo) {
      case 'Sesión': return '🧠';
      case 'Evaluación': return '📋';
      case 'Re-evaluación': return '📝';
      case 'Devolución': return '🔄';
      case 'Reunión con colegio': return '🏫';
      case 'Supervisión': return '👥';
      default: return '🧠';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-end lg:items-center justify-center">
      <div className="bg-white w-full max-w-md lg:rounded-xl lg:max-h-[80vh] max-h-[90vh] overflow-y-auto">
        {/* Header - MÁS COMPACTO */}
        <div className="sticky top-0 bg-red-50 border-b border-red-200 p-3 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-red-800">⚠️ Sin Categorizar</h3>
            {/* ✅ NO ocultamos el número de sesiones pendientes */}
            <p className="text-red-600 text-sm">{sesionesPendientes.length} sesiones</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-red-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Lista de sesiones - MÁS COMPACTA */}
        <div className="p-3 space-y-2">
          {sesionesPendientes.map(sesion => {
            const fechaSesion = new Date(sesion.fecha_hora);
            const diasPasados = Math.floor((new Date() - fechaSesion) / (1000 * 60 * 60 * 24));

            return (
              <div key={sesion.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-xl">{getSessionIcon(sesion.tipo_sesion)}</div>
                  <div className="flex-1">
                    <div className="font-bold text-gray-800 text-sm">
                      {getPersonaNombre(sesion)}
                    </div>
                    <div className="text-xs text-gray-600">
                      {fechaSesion.toLocaleDateString('es-AR')} • {sesion.tipo_sesion}
                    </div>
                    {/* ✅ NO ocultamos los días pasados */}
                    <div className="text-xs text-red-600 font-medium">
                      Hace {diasPasados} día{diasPasados !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                {/* Botones de categorización - SOLO ÍCONOS */}
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => onCategorizarSesion(sesion, 'Realizada')}
                    className="bg-green-500 text-white py-3 px-1 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center"
                  >
                    <CheckCircle size={16} />
                  </button>
                  <button
                    onClick={() => onCategorizarSesion(sesion, 'Cancelada sin antelación')}
                    className="bg-red-500 text-white py-3 px-1 rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// 🚀 Calendario específico para Mobile - Vista por día MEJORADA Y COMPACTA
export const CalendarioMobile = ({
  sesiones,
  pacientes,
  supervisoras,
  onEditarSesion,
  onCategorizarSesion,
  formatCurrency,
  onCategorizarSesiones,
  onFechaChange // Nueva prop para comunicar la fecha actual
}) => {
  const [fechaActual, setFechaActual] = useState(new Date());
  const [showPendientesModal, setShowPendientesModal] = useState(false);
  const hoy = new Date();

  // Comunicar la fecha actual al componente padre
  React.useEffect(() => {
    if (onFechaChange) {
      const fechaFormateada = new Date(
        fechaActual.getFullYear(),
        fechaActual.getMonth(),
        fechaActual.getDate(),
        new Date().getHours(),
        0
      ).toISOString().slice(0, 16);
      onFechaChange(fechaFormateada);
    }
  }, [fechaActual, onFechaChange]);

  // Funciones helper para el calendario
  const getPacienteById = (id) => pacientes.find(p => p.id === id);
  const getSupervisoraById = (id) => supervisoras.find(s => s.id === id);

  const getPersonaNombre = (sesion) => {
    if (sesion.paciente_id) {
      const paciente = getPacienteById(sesion.paciente_id);
      return paciente?.nombre_apellido || 'Paciente sin asignar';
    } else if (sesion.supervisora_id) {
      const supervisora = getSupervisoraById(sesion.supervisora_id);
      return supervisora?.nombre_apellido || 'Supervisora sin asignar';
    }
    return 'Sin asignar';
  };

  const getSessionIcon = (tipo) => {
    switch (tipo) {
      case 'Sesión': return '🧠';
      case 'Evaluación': return '📋';
      case 'Re-evaluación': return '📝';
      case 'Devolución': return '🔄';
      case 'Reunión con colegio': return '🏫';
      case 'Supervisión': return '👥';
      default: return '🧠';
    }
  };

  // Función auxiliar para comparar fechas en hora local (ignora hora/min/seg)
  const getFechaLocal = (fecha) => {
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  };

  // Obtener sesiones del día actual (comparando fechas en hora local)
  const getSesionesDelDia = (fecha) => {
    const fechaBase = getFechaLocal(fecha);
    return sesiones.filter(sesion => {
      const sesionFecha = getFechaLocal(new Date(sesion.fecha_hora));
      return sesionFecha.getTime() === fechaBase.getTime();
    }).sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
  };

  // Sesiones pendientes globales
  const sesionesPendientesGlobales = sesiones.filter(s =>
    s.estado === 'Pendiente' && new Date(s.fecha_hora) < hoy
  );

  const sesionesDelDia = getSesionesDelDia(fechaActual);
  const sesionsPendientesHoy = sesionesDelDia.filter(s =>
    s.estado === 'Pendiente' && new Date(s.fecha_hora) < hoy
  );

  const esHoy = fechaActual.toDateString() === hoy.toDateString();

  return (
    <div className="space-y-4 max-w-md mx-auto pb-20">
      {/* ADVERTENCIA PRINCIPAL - MEJORADA */}
      {sesionesPendientesGlobales.length > 0 && (
        <button
          onClick={() => setShowPendientesModal(true)}
          className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white p-4 rounded-xl shadow-lg hover:from-red-600 hover:to-red-700 transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-full p-2">
                <AlertTriangle size={24} />
              </div>
              <div className="text-left">
                {/* ✅ NO ocultamos el número de sesiones pendientes */}
                <div className="font-bold text-lg">
                  ⚠️ {sesionesPendientesGlobales.length} SIN CATEGORIZAR
                </div>
                <div className="text-red-100 text-sm">
                  Toca para categorizar rápidamente
                </div>
              </div>
            </div>
            <div className="text-3xl animate-bounce">👆</div>
          </div>
        </button>
      )}

      {/* Navegación por día - MÁS COMPACTA Y REDUCIDA */}
      <div className="bg-white rounded-xl p-2 shadow-lg border border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => {
              const ayer = new Date(fechaActual);
              ayer.setDate(fechaActual.getDate() - 1);
              setFechaActual(ayer);
            }}
            className="p-2 rounded-lg bg-purple-100 hover:bg-purple-200 transition-colors"
          >
            <ChevronLeft size={18} className="text-purple-600" />
          </button>

          <div className="text-center flex-1">
            <h3 className={`text-base font-bold ${esHoy ? 'text-purple-700' : 'text-gray-800'}`}>
              {esHoy ? '🎯 HOY' : fechaActual.toLocaleDateString('es-AR', { weekday: 'short' })}
            </h3>
            <p className="text-[10px] text-gray-600 font-medium leading-tight">
              {fechaActual.toLocaleDateString('es-AR', {
                day: 'numeric',
                month: 'short'
              })}
            </p>
          </div>

          <button
            onClick={() => {
              const mañana = new Date(fechaActual);
              mañana.setDate(fechaActual.getDate() + 1);
              setFechaActual(mañana);
            }}
            className="p-2 rounded-lg bg-purple-100 hover:bg-purple-200 transition-colors"
          >
            <ChevronRight size={18} className="text-purple-600" />
          </button>
        </div>

        {/* Botón "ir a hoy" si no estamos en hoy - MÁS PEQUEÑO */}
        {!esHoy && (
          <div className="text-center">
            <button
              onClick={() => setFechaActual(new Date())}
              className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-3 py-1 rounded-lg text-xs font-bold hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg"
            >
              🎯 IR A HOY
            </button>
          </div>
        )}
      </div>

      {/* Sesiones del día */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        {sesionesDelDia.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-6xl mb-4">📅</div>
            <h3 className="font-bold text-gray-700 mb-2 text-lg">Sin sesiones</h3>
            <p className="text-sm text-gray-500">Día libre de actividades</p>
          </div>
        ) : (
          <>
            {/* Header con resumen - MÁS COMPACTO */}
            <div className="p-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">
              <div className="flex items-center justify-between">
                {/* ✅ NO ocultamos el número de sesiones del día */}
                <h4 className="font-bold text-gray-800">
                  📋 {sesionesDelDia.length} sesión{sesionesDelDia.length > 1 ? 'es' : ''}
                </h4>
                {sesionsPendientesHoy.length > 0 && (
                  <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg animate-pulse">
                    {/* ✅ NO ocultamos el número de sesiones pendientes hoy */}
                    {sesionsPendientesHoy.length} pendiente{sesionsPendientesHoy.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Lista de sesiones - MÁS COMPACTA */}
            <div className="divide-y divide-gray-100">
              {sesionesDelDia.map(sesion => {
                const fechaSesion = new Date(sesion.fecha_hora);

                const isPending = sesion.estado === 'Pendiente';
                const hora = new Date(sesion.fecha_hora).toLocaleTimeString('es-AR', {
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div
                    key={sesion.id}
                    className={`p-3 ${isPending ? 'bg-red-50 border-l-4 border-red-400' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Ícono y hora - MÁS COMPACTO */}
                      <div className="text-center min-w-[50px]">
                        <div className="text-2xl">{getSessionIcon(sesion.tipo_sesion)}</div>
                        <div className="text-xs text-gray-600 font-bold bg-gray-100 px-2 py-1 rounded-full mt-1">
                          {hora}
                        </div>
                      </div>

                      {/* Info de la sesión - MÁS COMPACTA */}
                      <div className="flex-1">
                        <div className="font-bold text-gray-800 mb-1">
                          {getPersonaNombre(sesion)}
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-medium">
                            {sesion.tipo_sesion}
                          </span>
                          {/* ✅ Verde para ingresos (pacientes), Rojo para gastos (supervisiones) */}
                          <span className={`text-xs px-2 py-1 rounded-full font-bold ${sesion.supervisora_id
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                            }`}>
                            {sesion.supervisora_id ? '-' : ''}{formatCurrency(sesion.precio_por_hora * sesion.duracion_horas)}
                          </span>
                        </div>

                        {/* Estado - MÁS COMPACTO */}
                        <div className="mb-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-bold ${sesion.estado === 'Realizada' ? 'bg-green-100 text-green-800' :
                            sesion.estado === 'Pendiente' ? 'bg-red-100 text-red-800 animate-pulse' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                            {isPending ? '⚠️ SIN CATEGORIZAR' : sesion.estado}
                          </span>
                        </div>

                        {/* Botones de acción - SOLO ÍCONOS */}
                        {isPending ? (
                          <BotonesCategorización
                            sesion={sesion}
                            onCategorizarSesion={onCategorizarSesion}
                            onEditarSesion={onEditarSesion}
                          />
                        ) : (
                          <button
                            onClick={() => onEditarSesion(sesion)}
                            className="w-full bg-blue-500 text-white py-3 px-3 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center"
                          >
                            <Edit3 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal de sesiones pendientes */}
      <SesionesPendientesModal
        isOpen={showPendientesModal}
        onClose={() => setShowPendientesModal(false)}
        sesionesPendientes={sesionesPendientesGlobales}
        pacientes={pacientes}
        supervisoras={supervisoras}
        onCategorizarSesion={onCategorizarSesion}
        formatCurrency={formatCurrency}
      />
    </div>
  );
};

// 🚀 Overlay para cerrar sidebar en mobile
export const SidebarOverlay = ({ isOpen, onClose }) => (
  isOpen && (
    <div
      className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
      onClick={onClose}
    />
  )
);