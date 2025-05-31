import React from 'react';
import { AlertTriangle, X, Clock, User } from 'lucide-react';

const ConflictoHorarioModal = ({
  isOpen,
  onClose,
  onConfirmar,
  conflictoDetectado,
  sesionNueva
}) => {
  if (!isOpen) return null;

  const formatearFechaHora = (fechaHora) => {
    if (!fechaHora) return '';
    const fecha = new Date(fechaHora);
    return fecha.toLocaleString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPersonaConflictiva = () => {
    if (conflictoDetectado?.sesionConflictiva?.pacienteNombre) {
      return conflictoDetectado.sesionConflictiva.pacienteNombre;
    }
    if (conflictoDetectado?.sesionConflictiva?.supervisoraNombre) {
      return conflictoDetectado.sesionConflictiva.supervisoraNombre;
    }
    return 'Sesión existente';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
      <div className="modal-content max-w-lg w-full mx-4 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-orange-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="text-orange-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                Conflicto de Horario Detectado
              </h2>
              <p className="text-sm text-orange-700">
                Ya existe una sesión en este horario
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-orange-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Información del conflicto */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-red-600 mt-0.5 flex-shrink-0" size={18} />
              <div className="flex-1">
                <h3 className="font-medium text-red-900 mb-2">
                  Sesión existente encontrada
                </h3>
                <div className="space-y-2 text-sm text-red-800">
                  <div className="flex items-center gap-2">
                    <User size={14} />
                    <span className="font-medium">{getPersonaConflictiva()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={14} />
                    <span>
                      {sesionNueva?.fecha_hora ? formatearFechaHora(sesionNueva.fecha_hora) : 'Horario no especificado'}
                    </span>
                  </div>
                  {conflictoDetectado?.sesionConflictiva?.tipo_sesion_conflictiva && (
                    <div className="text-xs bg-red-100 px-2 py-1 rounded">
                      Tipo: {conflictoDetectado.sesionConflictiva.tipo_sesion_conflictiva}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Información de la nueva sesión */}
          {sesionNueva && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">
                Sesión que intentas crear
              </h3>
              <div className="space-y-2 text-sm text-blue-800">
                <div>
                  <span className="font-medium">Tipo:</span> {sesionNueva.tipo_sesion}
                </div>
                <div>
                  <span className="font-medium">Duración:</span> {sesionNueva.duracion_horas || 1} hora(s)
                </div>
              </div>
            </div>
          )}

          {/* Advertencia */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-yellow-600 mt-0.5 flex-shrink-0" size={18} />
              <div className="text-sm text-yellow-800">
                <div className="font-medium mb-1">⚠️ Atención:</div>
                <div>
                  Crear esta sesión resultará en una superposición de horarios.
                  ¿Estás segura de que quieres continuar?
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium text-gray-700"
          >
            ❌ Cancelar y Cambiar Horario
          </button>
          <button
            onClick={onConfirmar}
            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium shadow-lg"
          >
            ✅ Crear de Todas Formas
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictoHorarioModal;