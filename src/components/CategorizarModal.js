import React, { useState } from 'react';
import { X, Save, Calendar, User, Clock, DollarSign } from 'lucide-react';

const CategorizarModal = ({
  isOpen,
  onClose,
  sesiones,
  pacientes,
  supervisoras,
  onSave,
  currencyMode,
  tipoCambio
}) => {
  const [sessionStates, setSessionStates] = useState({});

  // Filtrar solo sesiones pendientes del pasado
  const sesionesToCategorizar = sesiones.filter(sesion => {
    const fechaSesion = new Date(sesion.fecha_hora);
    const hoy = new Date();
    return sesion.estado === 'Pendiente' && fechaSesion < hoy;
  }).sort((a, b) => new Date(a.fecha_hora) - new Date(b.fecha_hora));

  // Inicializar estados de sesiones
  React.useEffect(() => {
    if (isOpen && sesionesToCategorizar.length > 0) {
      const initialStates = {};
      sesionesToCategorizar.forEach(sesion => {
        initialStates[sesion.id] = sesion.estado;
      });
      setSessionStates(initialStates);
    }
  }, [isOpen, sesionesToCategorizar.length]);

  const formatCurrency = (amount, currency = currencyMode) => {
    if (currency === 'USD') {
      return `$${(amount / tipoCambio).toFixed(0)} USD`;
    }
    return `$${amount.toLocaleString()} ARS`;
  };

  const getPacienteById = (id) => pacientes.find(p => p.id === id);
  const getSupervisoraById = (id) => supervisoras.find(s => s.id === id);

  const getSessionIcon = (tipo) => {
    switch (tipo) {
      case 'Evaluación': return '📋';
      case 'Re-evaluación': return '📝';
      case 'Supervisión': return '👥';
      default: return '🧠';
    }
  };

  const handleEstadoChange = (sesionId, nuevoEstado) => {
    console.log('Cambiando estado:', sesionId, 'a:', nuevoEstado);
    setSessionStates(prev => {
      const newState = {
        ...prev,
        [sesionId]: nuevoEstado
      };
      console.log('Nuevo estado completo:', newState);
      return newState;
    });
  };

  const handleGuardarTodos = () => {
    console.log('Estados actuales:', sessionStates);
    const cambios = [];

    Object.entries(sessionStates).forEach(([sesionId, nuevoEstado]) => {
      const sesionOriginal = sesionesToCategorizar.find(s => s.id === sesionId);
      console.log('Revisando sesión:', sesionId, 'Original:', sesionOriginal?.estado, 'Nuevo:', nuevoEstado);
      if (sesionOriginal && sesionOriginal.estado !== nuevoEstado) {
        cambios.push({
          id: sesionId,
          estado: nuevoEstado
        });
      }
    });

    console.log('Cambios a enviar:', cambios);

    if (cambios.length > 0) {
      onSave(cambios);
    } else {
      alert('No hay cambios para guardar');
    }
    onClose();
  };

  const marcarTodasComoRealizadas = () => {
    const newStates = { ...sessionStates };
    sesionesToCategorizar.forEach(sesion => {
      newStates[sesion.id] = 'Realizada';
    });
    setSessionStates(newStates);
    console.log('Marcando todas como realizadas:', newStates);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
      <div className="modal-content max-w-5xl w-full mx-4 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-orange-50">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <Calendar className="text-orange-600" size={24} />
              Categorizar Sesiones Pendientes
            </h2>
            <p className="text-orange-700 mt-1">
              {sesionesToCategorizar.length} sesión{sesionesToCategorizar.length !== 1 ? 'es' : ''} pendiente{sesionesToCategorizar.length !== 1 ? 's' : ''} de categorizar
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {sesionesToCategorizar.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="mx-auto text-gray-400 mb-4" size={48} />
              <h3 className="text-lg font-medium text-gray-600 mb-2">
                ¡Todo al día!
              </h3>
              <p className="text-gray-500">
                No hay sesiones pendientes de categorizar
              </p>
            </div>
          ) : (
            <>
              {/* Acciones rápidas */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">Acciones Rápidas:</h3>
                <div className="flex gap-2">
                  <button
                    onClick={marcarTodasComoRealizadas}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                  >
                    Marcar todas como "Realizada"
                  </button>
                </div>
              </div>

              {/* Lista de sesiones */}
              <div className="space-y-3">
                {sesionesToCategorizar.map(sesion => {
                  const persona = getPacienteById(sesion.paciente_id) || getSupervisoraById(sesion.supervisora_id);
                  const fechaSesion = new Date(sesion.fecha_hora);
                  const diasPasados = Math.floor((new Date() - fechaSesion) / (1000 * 60 * 60 * 24));

                  return (
                    <div
                      key={sesion.id}
                      className="card p-4 hover:shadow-lg transition-all"
                      style={{ borderLeft: `4px solid ${persona?.color || '#6b7280'}` }}
                    >
                      <div className="flex items-center justify-between">
                        {/* Información de la sesión */}
                        <div className="flex items-center gap-4 flex-1">
                          <div className="text-2xl">
                            {getSessionIcon(sesion.tipo_sesion)}
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-lg">
                                {persona?.nombre_apellido || 'Sin asignar'}
                              </h4>
                              <span className="text-sm bg-gray-100 px-2 py-1 rounded">
                                {sesion.tipo_sesion}
                              </span>
                            </div>

                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-1">
                                <Calendar size={14} />
                                <span>
                                  {fechaSesion.toLocaleDateString('es-AR', {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'short'
                                  })}
                                </span>
                              </div>

                              <div className="flex items-center gap-1">
                                <Clock size={14} />
                                <span>
                                  {fechaSesion.toLocaleTimeString('es-AR', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>

                              <div className="flex items-center gap-1">
                                <DollarSign size={14} />
                                <span>
                                  {formatCurrency(sesion.precio_por_hora * sesion.duracion_horas)}
                                </span>
                              </div>

                              <span className={`px-2 py-1 rounded text-xs font-medium ${diasPasados <= 3
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                                }`}>
                                Hace {diasPasados} día{diasPasados !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Selector de estado */}
                        <div className="ml-4">
                          <select
                            value={sessionStates[sesion.id] || 'Pendiente'}
                            onChange={(e) => handleEstadoChange(sesion.id, e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm min-w-[200px]"
                          >
                            <option value="Pendiente">Pendiente</option>
                            <option value="Realizada">Realizada</option>
                            {sesion.tipo_sesion === 'Supervisión' ? (
                              <option value="Cancelada">Cancelada</option>
                            ) : (
                              <>
                                <option value="Cancelada con antelación">Cancelada con antelación</option>
                                <option value="Cancelada sin antelación">Cancelada sin antelación</option>
                                <option value="Cancelada por mí">Cancelada por mí</option>
                              </>
                            )}
                          </select>

                          {/* Indicador de facturación */}
                          <div className="text-xs mt-1">
                            {(sessionStates[sesion.id] === 'Realizada' || sessionStates[sesion.id] === 'Cancelada sin antelación') && (
                              <span className="text-green-600 font-medium">✓ Se factura</span>
                            )}
                            {(sessionStates[sesion.id] === 'Cancelada con antelación' || sessionStates[sesion.id] === 'Cancelada por mí' || sessionStates[sesion.id] === 'Cancelada') && (
                              <span className="text-gray-600">✗ No se factura</span>
                            )}
                            {sessionStates[sesion.id] === 'Pendiente' && (
                              <span className="text-orange-600">⏳ Sin categorizar</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Resumen */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-800 mb-2">Resumen de Cambios:</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {['Realizada', 'Cancelada con antelación', 'Cancelada sin antelación', 'Cancelada por mí'].map(estado => {
                    const count = Object.values(sessionStates).filter(s => s === estado).length;
                    return (
                      <div key={estado} className="text-center">
                        <div className="text-lg font-bold text-gray-800">{count}</div>
                        <div className="text-gray-600">{estado}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {sesionesToCategorizar.length > 0 && (
          <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleGuardarTodos}
              className="btn-primary text-white px-6 py-2 rounded-lg flex items-center gap-2"
            >
              <Save size={16} />
              Guardar Categorizaciones
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategorizarModal;