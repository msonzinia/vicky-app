import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, CheckCircle, XCircle, Clock, Calendar, Flag, Smartphone } from 'lucide-react';

// ============================================================================
// 🎌 SERVICIO DE FERIADOS SIMPLE - SOLO ARGENTINADATOS
// ============================================================================
class FeriadosService {
  constructor() {
    this.feriadosCache = new Map();
    this.ultimaActualizacion = null;
    this.CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas
  }

  async obtenerFeriadosDelAño(año = new Date().getFullYear()) {
    const cacheKey = `feriados_${año}`;

    if (this.feriadosCache.has(cacheKey) && this.esCacheValido()) {
      return this.feriadosCache.get(cacheKey);
    }

    try {
      const response = await fetch(`https://api.argentinadatos.com/v1/feriados/${año}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      console.log(`✅ API ArgentinaDatos: ${data.length} días especiales para ${año}`);

      // Mapear todos los tipos como días especiales
      const feriados = data.map(item => ({
        fecha: item.fecha,
        nombre: item.nombre,
        tipo: item.tipo || 'feriado',
        fuente: 'ArgentinaDatos'
      }));

      this.feriadosCache.set(cacheKey, feriados);
      this.ultimaActualizacion = Date.now();
      return feriados;
    } catch (error) {
      console.error('❌ Error API ArgentinaDatos:', error);
      return [];
    }
  }

  async getFeriadosDelMes(fecha) {
    const año = fecha.getFullYear();
    const mes = fecha.getMonth();
    const todosFeriados = await this.obtenerFeriadosDelAño(año);

    return todosFeriados.filter(feriado => {
      // Parsear fecha correctamente
      const fechaParts = feriado.fecha.split('-');
      const fechaFeriado = new Date(parseInt(fechaParts[0]), parseInt(fechaParts[1]) - 1, parseInt(fechaParts[2]));

      return fechaFeriado.getFullYear() === año && fechaFeriado.getMonth() === mes;
    });
  }

  esCacheValido() {
    if (!this.ultimaActualizacion) return false;
    return (Date.now() - this.ultimaActualizacion) < this.CACHE_DURATION;
  }
}

// ============================================================================
// 📱 SERVICIO DE SINCRONIZACIÓN iOS INTEGRADO
// ============================================================================
class iOSCalendarSync {
  constructor() {
    this.timeZone = 'America/Argentina/Buenos_Aires';
  }

  generateICSFile(sesiones, pacientes, supervisoras) {
    const now = new Date();
    const filteredSesiones = sesiones.filter(s => !s.eliminado && new Date(s.fecha_hora) >= now);

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//JEL Organizador//Psicopedagogía Calendar//ES',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:JEL - Sesiones de Psicopedagogía',
      'X-WR-CALDESC:Calendario de sesiones, evaluaciones y supervisiones',
      'X-WR-TIMEZONE:America/Argentina/Buenos_Aires',
      ''
    ];

    filteredSesiones.forEach(sesion => {
      const evento = this.generateICSEvent(sesion, pacientes, supervisoras);
      icsContent.push(...evento);
    });

    icsContent.push('END:VCALENDAR');
    return icsContent.join('\r\n');
  }

  generateICSEvent(sesion, pacientes, supervisoras) {
    const startDate = new Date(sesion.fecha_hora);
    const endDate = new Date(startDate.getTime() + (sesion.duracion_horas * 60 * 60 * 1000));

    const paciente = pacientes.find(p => p.id === sesion.paciente_id);
    const supervisora = supervisoras.find(s => s.id === sesion.supervisora_id);

    let titulo = sesion.tipo_sesion;
    if (paciente) titulo += ` - ${paciente.nombre_apellido}`;
    else if (supervisora) titulo += ` - ${supervisora.nombre_apellido}`;

    let descripcion = `Tipo: ${sesion.tipo_sesion}\\n`;
    descripcion += `Estado: ${sesion.estado}\\n`;
    descripcion += `Duración: ${sesion.duracion_horas}h\\n`;
    descripcion += `Precio: $${sesion.precio_por_hora.toLocaleString()}\\n`;

    if (paciente) {
      descripcion += `\\nPaciente: ${paciente.nombre_apellido}\\n`;
      if (paciente.nombre_apellido_tutor) {
        descripcion += `Tutor: ${paciente.nombre_apellido_tutor}\\n`;
      }
    }

    if (supervisora) {
      descripcion += `\\nSupervisora: ${supervisora.nombre_apellido}\\n`;
    }

    const uid = `sesion-${sesion.id}@jel-organizador.local`;
    const formatLocalDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}${month}${day}T${hours}${minutes}${seconds}`;
    };

    const escapeText = (text) => {
      if (!text) return '';
      return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    };

    let status = 'CONFIRMED';
    if (sesion.estado.includes('Cancelada')) status = 'CANCELLED';
    else if (sesion.estado === 'Pendiente') status = 'TENTATIVE';

    const evento = [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART;TZID=America/Argentina/Buenos_Aires:${formatLocalDate(startDate)}`,
      `DTEND;TZID=America/Argentina/Buenos_Aires:${formatLocalDate(endDate)}`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `SUMMARY:${escapeText(titulo)}`,
      `DESCRIPTION:${escapeText(descripcion)}`,
      `STATUS:${status}`,
      'TRANSP:OPAQUE'
    ];

    if (sesion.estado === 'Pendiente' && startDate > new Date()) {
      evento.push(
        'BEGIN:VALARM',
        'TRIGGER:-PT30M',
        'ACTION:DISPLAY',
        `DESCRIPTION:Recordatorio: ${escapeText(titulo)} en 30 minutos`,
        'END:VALARM'
      );
    }

    evento.push('END:VEVENT', '');
    return evento;
  }

  downloadICSFile(icsContent, filename = 'jel-sesiones.ics') {
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async uploadToCloudStorage(icsContent) {
    try {
      localStorage.setItem('jel_calendar_ics', icsContent);
      localStorage.setItem('jel_calendar_timestamp', Date.now().toString());

      const baseUrl = window.location.origin;
      return `${baseUrl}/calendar/jel-sesiones.ics`;
    } catch (error) {
      console.error('Error subiendo calendario:', error);
      throw error;
    }
  }
}

// ============================================================================
// 🚀 COMPONENTE PRINCIPAL - CALENDARIO INTEGRADO
// ============================================================================
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

  // 🎌 Estados para feriados
  const [feriadosDelMes, setFeriadosDelMes] = useState([]);
  const [feriadosService] = useState(() => new FeriadosService());

  // 📱 Estados para sincronización
  const [syncService] = useState(() => new iOSCalendarSync());
  const [syncStatus, setSyncStatus] = useState('ready'); // ready, syncing, success, error
  const [subscriptionURL, setSubscriptionURL] = useState('');

  // Cargar feriados cuando cambia el mes
  const cargarFeriadosDelMes = useCallback(async () => {
    try {
      const feriados = await feriadosService.getFeriadosDelMes(currentDate);
      setFeriadosDelMes(feriados);

      if (feriados.length > 0) {
        console.log(`📅 ${feriados.length} días especiales en ${currentDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}`);
      }
    } catch (error) {
      console.error('Error cargando feriados:', error);
      setFeriadosDelMes([]);
    }
  }, [feriadosService, currentDate]);

  // Auto-sincronización cada vez que cambian las sesiones
  const autoSync = useCallback(async () => {
    try {
      const icsContent = syncService.generateICSFile(sesiones, pacientes, supervisoras);
      const url = await syncService.uploadToCloudStorage(icsContent);
      setSubscriptionURL(url);
      console.log('📱 Calendario auto-sincronizado:', url);
    } catch (error) {
      console.error('Error en auto-sincronización:', error);
    }
  }, [syncService, sesiones, pacientes, supervisoras]);

  useEffect(() => {
    cargarFeriadosDelMes();
  }, [cargarFeriadosDelMes]);

  useEffect(() => {
    if (sesiones.length > 0) {
      autoSync();
    }
  }, [autoSync, sesiones.length]);

  // Función manual de sincronización con feedback
  const handleSyncNow = async () => {
    setSyncStatus('syncing');

    try {
      const icsContent = syncService.generateICSFile(sesiones, pacientes, supervisoras);

      // Subir a almacenamiento
      const url = await syncService.uploadToCloudStorage(icsContent);
      setSubscriptionURL(url);

      // También descargar archivo
      const filename = `jel-sesiones-${new Date().toISOString().split('T')[0]}.ics`;
      syncService.downloadICSFile(icsContent, filename);

      setSyncStatus('success');

      if (window.showToast) {
        window.showToast(
          '📱 Calendario sincronizado! Archivo descargado para importar en iPhone',
          'success',
          6000
        );
      }

      setTimeout(() => setSyncStatus('ready'), 3000);

    } catch (error) {
      console.error('Error sincronizando:', error);
      setSyncStatus('error');

      if (window.showToast) {
        window.showToast('Error al sincronizar calendario: ' + error.message, 'error');
      }

      setTimeout(() => setSyncStatus('ready'), 3000);
    }
  };

  // Verificar si una fecha es feriado - SIMPLE
  const getFeriadoDelDia = (fecha) => {
    // Crear fecha local sin problemas de timezone
    const fechaLocal = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    const fechaStr = fechaLocal.toISOString().split('T')[0];

    return feriadosDelMes.find(f => f.fecha === fechaStr);
  };

  // Cancelar sesiones por feriado - SIMPLIFICADO
  const handleCancelarPorFeriado = async (fecha, feriadoInfo) => {
    const sesionesDelDia = getSesionesDelDia(fecha);

    if (sesionesDelDia.length === 0) {
      if (window.showToast) {
        window.showToast('No hay sesiones para cancelar en este día', 'info', 3000);
      }
      return;
    }

    // Modal de confirmación simple
    const modalContent = `
      <div class="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
        <div class="modal-content max-w-lg w-full mx-4 rounded-xl shadow-2xl">
          <div class="flex items-center justify-between p-6 border-b border-gray-200 bg-blue-50">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                🎌
              </div>
              <div>
                <h2 class="text-xl font-semibold text-gray-800">Cancelar por feriado</h2>
                <p class="text-sm text-blue-700">${feriadoInfo.nombre}</p>
              </div>
            </div>
          </div>
          
          <div class="p-6">
            <div class="mb-4">
              <p class="text-gray-700 mb-3">
                <strong>${fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
              </p>
              <p class="text-gray-600 mb-4">
                ¿Cancelar todas las <strong>${sesionesDelDia.length} sesiones</strong> de este día?
              </p>
              <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p class="text-sm text-yellow-800">
                  ⚠️ Las sesiones se marcarán como "Cancelada por feriado".
                </p>
              </div>
            </div>
          </div>
          
          <div class="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button 
              onclick="this.closest('.modal-overlay').remove()" 
              class="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium text-gray-700">
              ❌ Cancelar
            </button>
            <button 
              onclick="window.confirmarCancelacionFeriado()" 
              class="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium shadow-lg">
              🎌 Cancelar sesiones
            </button>
          </div>
        </div>
      </div>
    `;

    // Función para confirmar - SOLO ACTUALIZAR ESTADO
    window.confirmarCancelacionFeriado = async () => {
      document.querySelector('.modal-overlay').remove();

      try {
        const supabase = window.supabase;
        if (!supabase) throw new Error('Supabase no disponible');

        const fechaStr = fecha.toISOString().split('T')[0];

        const { data: sesionesActualizadas, error } = await supabase
          .from('sesiones')
          .update({
            estado: 'Cancelada por feriado'
          })
          .gte('fecha_hora', `${fechaStr} 00:00:00`)
          .lt('fecha_hora', `${fechaStr} 23:59:59`)
          .eq('eliminado', false)
          .select('id');

        if (error) throw error;

        if (window.showToast) {
          window.showToast(
            `🎌 ${sesionesActualizadas.length} sesiones canceladas por ${feriadoInfo.nombre}`,
            'success',
            4000
          );
        }

        // Recargar página para ver cambios
        setTimeout(() => window.location.reload(), 1500);

      } catch (error) {
        console.error('Error cancelando por feriado:', error);
        if (window.showToast) {
          window.showToast('Error al cancelar sesiones: ' + error.message, 'error', 5000);
        }
      }
    };

    // Mostrar modal
    document.body.insertAdjacentHTML('beforeend', modalContent);
  };

  // Funciones existentes del calendario
  const getPacienteById = (id) => pacientes.find(p => p.id === id);
  const getSupervisoraById = (id) => supervisoras.find(s => s.id === id);

  const handleReloadPage = () => {
    setIsReloading(true);
    if (window.showToast) {
      window.showToast('🔄 Recargando calendario...', 'info', 2000);
    }
    setTimeout(() => window.location.reload(), 500);
  };

  const sesionsPendientes = sesiones.filter(s =>
    s.estado === 'Pendiente' && new Date(s.fecha_hora) < new Date()
  ).length;

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

  const getMonthDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    const currentDay = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      days.push(new Date(currentDay));
      currentDay.setDate(currentDay.getDate() + 1);
    }

    return days;
  };

  const getSesionesDelDia = (fecha) => {
    const fechaStr = fecha.toISOString().split('T')[0];
    return sesiones.filter(sesion => {
      const sesionFecha = new Date(sesion.fecha_hora).toISOString().split('T')[0];
      return sesionFecha === fechaStr;
    }).sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));
  };

  const getSessionIcon = (sesion) => {
    switch (sesion.tipo_sesion) {
      case 'Sesión': return '🧠';
      case 'Evaluación': return '📋';
      case 'Re-evaluación': return '📝';
      case 'Devolución': return '🔄';
      case 'Reunión con colegio': return '🏫';
      case 'Supervisión': return '👥';
      default: return '🧠';
    }
  };

  const getStatusIcon = (sesion) => {
    const hoy = new Date();
    const fechaSesion = new Date(sesion.fecha_hora);
    const esPasada = fechaSesion < hoy;

    if (sesion.estado === 'Realizada') {
      return <CheckCircle size={12} className="text-white" />;
    }

    if (sesion.estado.includes('Cancelada')) {
      if (sesion.estado === 'Cancelada por feriado') {
        return <Calendar size={12} className="text-white" />;
      }
      return <XCircle size={12} className="text-white" />;
    }

    if (sesion.estado === 'Pendiente' && esPasada) {
      return <Clock size={12} className="text-yellow-600" />;
    }

    return null;
  };

  const getSessionStyle = (sesion) => {
    const hoy = new Date();
    const fechaSesion = new Date(sesion.fecha_hora);
    const esPasada = fechaSesion < hoy;
    const isPending = sesion.estado === 'Pendiente' && esPasada;

    const paciente = getPacienteById(sesion.paciente_id);
    const backgroundColor = paciente?.color || '#6b7280';

    if (isPending) {
      return { backgroundColor, border: '1px solid #f59e0b' };
    }

    if (sesion.estado === 'Realizada') {
      return { backgroundColor, border: '2px solid #10b981' };
    }

    if (sesion.estado.includes('Cancelada')) {
      if (sesion.estado === 'Cancelada por feriado') {
        return { backgroundColor, border: '2px solid #3b82f6' };
      }
      return { backgroundColor, border: '2px solid #ef4444' };
    }

    return { backgroundColor };
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

    // Verificar si es feriado
    const feriadoInfo = getFeriadoDelDia(fecha);
    const esFeriado = !!feriadoInfo;

    return (
      <div
        className={`calendar-day-improved ${isToday ? 'today' : !isCurrentMonth ? 'other-month' : ''} ${hasSessions ? 'has-sessions' : ''} ${hasPending ? 'has-pending' : ''} ${esFeriado ? 'feriado-day' : ''}`}
        onClick={() => openModal('day-detail', { fecha, sesiones: sesionesDelDia })}
      >
        <div className="day-number">
          {fecha.getDate()}
          {hasPending && (
            <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
              {pendingSessions.length}
            </span>
          )}
          {esFeriado && (
            <span className="ml-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold" title={feriadoInfo.nombre}>
              🎌
            </span>
          )}
        </div>

        {/* Botón de cancelar por feriado */}
        {esFeriado && hasSessions && (
          <div className="mb-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCancelarPorFeriado(fecha, feriadoInfo);
              }}
              className="w-full text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-md flex items-center justify-center gap-1 transition-colors"
              title={`Cancelar todas las sesiones por ${feriadoInfo.nombre}`}
            >
              <Flag size={10} />
              Cancelar por feriado
            </button>
          </div>
        )}

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
                style={getSessionStyle(sesion)}
                onClick={(e) => {
                  e.stopPropagation();
                  openModal('edit-sesion', sesion);
                }}
                title={`${getSessionIcon(sesion)} ${hora} - ${persona?.nombre_apellido || 'Sin asignar'} (${sesion.tipo_sesion}) - ${sesion.estado}`}
              >
                <div className="session-content">
                  <span className="session-icon">{getSessionIcon(sesion)}</span>
                  <span className="session-time">{hora}</span>
                  <span className="session-name">
                    {persona?.nombre_apellido || 'Sin asignar'}
                  </span>
                  <span className="session-status-icon ml-auto">
                    {getStatusIcon(sesion)}
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
      {/* Controles del calendario */}
      <div className="glass-effect p-4 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={goToPrevious} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
              <ChevronLeft size={18} />
            </button>

            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-800">
                {currentDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
              </h3>
              <p className="text-sm text-gray-600">
                {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
              {feriadosDelMes.length > 0 && (
                <p className="text-xs text-blue-600 mt-1">
                  🎌 {feriadosDelMes.length} día{feriadosDelMes.length !== 1 ? 's especiales' : ' especial'} este mes
                </p>
              )}
            </div>

            <button onClick={goToNext} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="flex gap-3">
            {/* 📱 BOTÓN DE SINCRONIZACIÓN INTEGRADO */}
            <button
              onClick={handleSyncNow}
              disabled={syncStatus === 'syncing'}
              className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all ${syncStatus === 'syncing' ? 'bg-gray-400 cursor-not-allowed'
                : syncStatus === 'success' ? 'bg-green-600 hover:bg-green-700'
                  : syncStatus === 'error' ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                } text-white`}
              title="Sincronizar con iPhone automáticamente"
            >
              {syncStatus === 'syncing' && <RefreshCw size={16} className="animate-spin" />}
              {syncStatus === 'success' && <CheckCircle size={16} />}
              {syncStatus === 'error' && <XCircle size={16} />}
              {syncStatus === 'ready' && <Smartphone size={16} />}

              {syncStatus === 'syncing' && 'Sincronizando...'}
              {syncStatus === 'success' && 'Sincronizado ✓'}
              {syncStatus === 'error' && 'Error'}
              {syncStatus === 'ready' && 'Sync iPhone'}
            </button>

            <button
              onClick={handleReloadPage}
              disabled={isReloading}
              className={`px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium text-sm flex items-center gap-2 ${isReloading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <RefreshCw size={16} className={isReloading ? 'animate-spin' : ''} />
              {isReloading ? 'Recargando...' : 'Recargar'}
            </button>

            <button onClick={goToToday} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium text-sm">
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2v12a2 2 0 002 2z" />
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
          {diasSemana.map(dia => (
            <div key={dia} className="calendar-header-improved">
              {dia}
            </div>
          ))}

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

      {/* MENSAJES MOVIDOS ABAJO DEL CALENDARIO */}

      {/* Información de feriados del mes - SIMPLIFICADA */}
      {feriadosDelMes.length > 0 && (
        <div className="glass-effect p-3 rounded-xl bg-blue-50 border border-blue-200">
          <h4 className="font-semibold text-blue-800 mb-2 text-sm flex items-center gap-2">
            <Flag size={16} className="text-blue-600" />
            Feriados y días especiales de {currentDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
          </h4>
          <div className="flex flex-wrap gap-2">
            {feriadosDelMes.map((feriado, index) => {
              // Parsear fecha correctamente
              const fechaParts = feriado.fecha.split('-');
              const fechaFeriado = new Date(parseInt(fechaParts[0]), parseInt(fechaParts[1]) - 1, parseInt(fechaParts[2]));

              // Todos se muestran como días especiales cancelables
              const tipoIcon = '🎌';
              const tipoTexto = 'Día especial';

              return (
                <div key={index} className="inline-flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-blue-100 text-xs">
                  <span>{tipoIcon}</span>
                  <span className="font-medium text-blue-800">
                    {fechaFeriado.getDate()}/{fechaFeriado.getMonth() + 1}
                  </span>
                  <span className="text-blue-700">
                    {feriado.nombre.length > 25 ? feriado.nombre.substring(0, 25) + '...' : feriado.nombre}
                  </span>
                  <span className="text-blue-600 text-xs bg-blue-100 px-1.5 py-0.5 rounded">
                    {tipoTexto}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 text-xs text-blue-600">
            🎌 Todos los días especiales son cancelables (feriados, puentes, días no laborables)
          </div>
        </div>
      )}

      {/* 📱 Instrucciones de sincronización (se muestra cuando hay URL) */}
      {subscriptionURL && (
        <div className="glass-effect p-4 rounded-xl bg-green-50 border border-green-200">
          <h4 className="font-semibold text-green-800 mb-2 text-sm flex items-center gap-2">
            <Smartphone size={16} className="text-green-600" />
            📱 Calendario sincronizado automáticamente
          </h4>
          <p className="text-green-700 text-sm mb-2">
            Tu calendario se actualiza automáticamente cada vez que hagas cambios.
            También se descargó un archivo para importar manualmente en tu iPhone.
          </p>
          <div className="text-xs text-green-600">
            ✅ Última sincronización: {new Date().toLocaleString('es-AR')}
          </div>
        </div>
      )}

      {/* Leyenda actualizada */}
      <div className="glass-effect p-3 rounded-xl">
        <h4 className="font-semibold text-gray-800 mb-2 text-xs">Leyenda</h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <h5 className="font-medium text-gray-700 mb-1 text-xs">Pacientes:</h5>
            <div className="space-y-1">
              {pacientes.filter(p => p.activo && !p.eliminado).map(paciente => (
                <div key={paciente.id} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: paciente.color }}></div>
                  <span>{paciente.nombre_apellido}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h5 className="font-medium text-gray-700 mb-1 text-xs">Estados:</h5>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle size={12} className="text-white bg-green-600 rounded-full" />
                <span>Realizada</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle size={12} className="text-white bg-red-600 rounded-full" />
                <span>Cancelada</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={12} className="text-white bg-blue-600 rounded-full" />
                <span>Feriado</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={12} className="text-yellow-600" />
                <span>Pendiente</span>
              </div>
            </div>
          </div>

          <div>
            <h5 className="font-medium text-gray-700 mb-1 text-xs">Tipos:</h5>
            <div className="text-xs text-gray-600">
              🧠 Sesión • 📋 Evaluación • 📝 Re-evaluación • 🔄 Devolución • 🏫 Colegio • 👥 Supervisión
            </div>
          </div>

          <div>
            <h5 className="font-medium text-gray-700 mb-1 text-xs">Sincronización:</h5>
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-2">
                <Smartphone size={12} className="text-blue-600" />
                <span>📱 Auto-sync iPhone</span>
              </div>
              <div className="text-gray-600">
                🎌 Cancelar por feriado disponible
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarioView;