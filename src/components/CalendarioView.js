import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

const CalendarioView = ({
  sesiones,
  pacientes,
  supervisoras,
  openModal,
  currencyMode,
  tipoCambio,
  onEliminarSesion
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isReloading, setIsReloading] = useState(false);

  // Funciones de utilidad
  const formatCurrency = (amount, currency = currencyMode) => {
    if (currency === 'USD') {
      return `${(amount / tipoCambio).toFixed(0)} USD`;
    }
    return `${amount.toLocaleString()} ARS`;
  };

  const getPacienteById = (id) => pacientes.find(p => p.id === id);
  const getSupervisoraById = (id) => supervisoras.find(s => s.id === id);

  // ✅ FUNCIÓN NUEVA: Reload de la página
  const handleReloadPage = () => {
    setIsReloading(true);

    // Mostrar feedback visual
    if (window.showToast) {
      window.showToast('🔄 Recargando calendario...', 'info', 2000);
    }

    // Reload después de un pequeño delay para mostrar el feedback
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  // Contar sesiones pendientes
  const sesionsPendientes = sesiones.filter(s =>
    s.estado === 'Pendiente' && new Date(s.fecha_hora) < new Date()
  ).length;

  // Navegación del calendario
  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Generar días del calendario
  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);

    // Ajustar para empezar en domingo
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    const currentDay = new Date(startDate);

    // Generar 6 semanas (42 días)
    for (let i = 0; i < 42; i++) {
      days.push(new Date(currentDay));
      currentDay.setDate(currentDay.getDate() + 1);
    }

    return days;
  };

  // Obtener sesiones de un día específico - ORDENADAS POR HORA
  const getSesionesDelDia = (fecha) => {
    const fechaStr = fecha.toISOString().split('T')[0];
    return sesiones.filter(sesion => {
      const sesionFecha = new Date(sesion.fecha_hora).toISOString().split('T')[0];
      return sesionFecha === fechaStr;
    }).sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora)); // ORDENAR POR HORA
  };

  // 🚀 ÍCONOS CORREGIDOS - Consistentes con FacturarView
  const getSessionIcon = (sesion) => {
    switch (sesion.tipo_sesion) {
      case 'Sesión': return '🧠';
      case 'Evaluación': return '📋';
      case 'Re-evaluación': return '📝';
      case 'Devolución': return '🔄';
      case 'Reunión con colegio': return '🏫';
      case 'Supervisión': return '👥';
      default: return '🧠'; // Fallback para sesiones regulares
    }
  };

  // Componente del día
  const DayCell = ({ fecha, sesionesDelDia }) => {
    const isToday = fecha.toDateString() === new Date().toDateString();
    const isCurrentMonth = fecha.getMonth() === currentDate.getMonth();
    const hasSessions = sesionesDelDia.length > 0;
    const hoy = new Date();
    const pendingSessions = sesionesDelDia.filter(s =>
      s.estado === 'Pendiente' && new Date(s.fecha_hora) < hoy
    );
    const hasPending = pendingSessions.length > 0;

    const getSessionColor = (sesion) => {
      const paciente = getPacienteById(sesion.paciente_id);
      return paciente?.color || '#6b7280';
    };

    return (
      <div
        className={`calendar-day-improved ${isToday ? 'today' :
          !isCurrentMonth ? 'other-month' : ''
          } ${hasSessions ? 'has-sessions' : ''} ${hasPending ? 'has-pending' : ''}`}
        onClick={() => openModal('day-detail', { fecha, sesiones: sesionesDelDia })}
      >
        <div className="day-number">
          {fecha.getDate()}
          {hasPending && (
            <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
              {pendingSessions.length}
            </span>
          )}
        </div>

        <div className="day-sessions-list">
          {sesionesDelDia.slice(0, 4).map((sesion, index) => {
            const persona = getPacienteById(sesion.paciente_id) || getSupervisoraById(sesion.supervisora_id);
            const isPast = new Date(sesion.fecha_hora) < hoy;
            const isPending = sesion.estado === 'Pendiente' && isPast;
            const hora = new Date(sesion.fecha_hora).toLocaleTimeString('es-AR', {
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div
                key={sesion.id}
                className={`session-item ${isPending ? 'pending' : ''}`}
                style={{
                  backgroundColor: getSessionColor(sesion),
                  border: isPending ? '1px solid #f59e0b' : 'none'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  openModal('edit-sesion', sesion);
                }}
                title={`${getSessionIcon(sesion)} ${hora} - ${persona?.nombre_apellido || 'Sin asignar'} (${sesion.tipo_sesion}) - ${sesion.estado}${isPending ? ' ⚠️ CATEGORIZAR' : ''}`}
              >
                <div className="session-content">
                  <span className="session-icon">{getSessionIcon(sesion)}</span>
                  <span className="session-time">{hora}</span>
                  <span className="session-name">
                    {persona?.nombre_apellido || 'Sin asignar'}
                  </span>
                  {isPending && <span className="session-warning">!</span>}
                </div>
              </div>
            );
          })}

          {sesionesDelDia.length > 4 && (
            <div className="session-more-compact">
              +{sesionesDelDia.length - 4} más
            </div>
          )}
        </div>
      </div>
    );
  };

  const monthDays = getMonthDays();
  const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <div className="space-y-3">
      {/* Controles del calendario con botones de acción */}
      <div className="glass-effect p-4 rounded-xl">
        <div className="flex items-center justify-between">
          {/* Navegación del mes */}
          <div className="flex items-center gap-4">
            <button
              onClick={goToPrevious}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-800">
                {currentDate.toLocaleDateString('es-AR', {
                  month: 'long',
                  year: 'numeric'
                })}
              </h3>
              <p className="text-sm text-gray-600">
                {new Date().toLocaleDateString('es-AR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long'
                })}
              </p>
            </div>

            <button
              onClick={goToNext}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-3">
            {/* ✅ BOTÓN DE RELOAD */}
            <button
              onClick={handleReloadPage}
              disabled={isReloading}
              className={`px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium text-sm flex items-center gap-2 ${isReloading ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Recargar calendario"
            >
              <RefreshCw size={16} className={isReloading ? 'animate-spin' : ''} />
              {isReloading ? 'Recargando...' : 'Recargar'}
            </button>

            <button
              onClick={goToToday}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium text-sm"
            >
              Hoy
            </button>

            <button
              onClick={() => openModal('add-sesion')}
              className="btn-success text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-lg text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nueva Sesión
            </button>

            {sesionsPendientes > 0 && (
              <button
                onClick={() => openModal('categorizar-sesiones')}
                className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-lg hover:from-orange-600 hover:to-yellow-600 transition-all text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Categorizar ({sesionsPendientes})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Calendario */}
      <div className="calendar-container-improved">
        <div className="calendar-grid-improved">
          {/* Encabezados de días */}
          {diasSemana.map(dia => (
            <div key={dia} className="calendar-header-improved">
              {dia}
            </div>
          ))}

          {/* Días del mes */}
          {monthDays.map((fecha, index) => {
            const sesionesDelDia = getSesionesDelDia(fecha);
            return (
              <DayCell
                key={index}
                fecha={fecha}
                sesionesDelDia={sesionesDelDia}
              />
            );
          })}
        </div>
      </div>

      {/* Leyenda - MÁS COMPACTA con íconos corregidos */}
      <div className="glass-effect p-3 rounded-xl">
        <h4 className="font-semibold text-gray-800 mb-2 text-xs">Leyenda</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Colores por paciente */}
          <div>
            <h5 className="font-medium text-gray-700 mb-1 text-xs">Pacientes:</h5>
            <div className="space-y-1">
              {pacientes.filter(p => p.activo && !p.eliminado).map(paciente => (
                <div key={paciente.id} className="flex items-center gap-2 text-xs">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: paciente.color }}
                  ></div>
                  <span>{paciente.nombre_apellido}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Estados e íconos actualizados */}
          <div>
            <h5 className="font-medium text-gray-700 mb-1 text-xs">Estados:</h5>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-yellow-500 rounded bg-white"></div>
                <span>Pendiente de categorizar</span>
              </div>
              <div className="text-xs text-gray-600 mt-1">
                <span className="font-medium">Íconos:</span> 🧠 Sesión • 📋 Evaluación • 📝 Re-evaluación • 🔄 Devolución • 🏫 Reunión colegio • 👥 Supervisión
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarioView;