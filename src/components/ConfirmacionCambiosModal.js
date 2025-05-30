import React from 'react';
import { AlertTriangle, X, Info, Clock, DollarSign, User, Calendar, Edit3, Plus, Trash2 } from 'lucide-react';

const ConfirmacionCambiosModal = ({
  isOpen,
  onClose,
  onConfirm,
  cambiosDetectados,
  pacienteNombre
}) => {
  if (!isOpen) return null;

  const {
    cambiosInfo = {},
    horariosEditados = [],
    horariosNuevos = [],
    horariosEliminados = [],
    esRestauracion = false,
    esReactivacion = false,
    esDesactivacion = false,
    hayCambiosHorarios = false
  } = cambiosDetectados;

  const hayCambios = Object.keys(cambiosInfo).length > 0 ||
    horariosEditados.length > 0 ||
    horariosNuevos.length > 0 ||
    horariosEliminados.length > 0 ||
    esRestauracion ||
    esReactivacion ||
    esDesactivacion ||
    hayCambiosHorarios;

  if (!hayCambios) {
    return null;
  }

  // Función mejorada para obtener texto de cambios
  const getCambioTexto = (campo, valor) => {
    switch (campo) {
      case 'nombre_apellido':
        return `Nombre: "${valor.anterior}" → "${valor.nuevo}"`;
      case 'nombre_apellido_tutor':
        return `Tutor: "${valor.anterior}" → "${valor.nuevo}"`;
      case 'cuil':
        return `CUIL: "${valor.anterior}" → "${valor.nuevo}"`;
      case 'precio_por_hora':
        return `Precio por hora: $${valor.anterior?.toLocaleString()} → $${valor.nuevo?.toLocaleString()}`;
      case 'color':
        return `Color del paciente actualizado`;
      case 'fecha_inicio':
        return `Fecha de inicio: ${valor.anterior} → ${valor.nuevo}`;
      default:
        return `${campo} actualizado`;
    }
  };

  // Función para obtener descripción del impacto
  const getDescripcionImpacto = (campo) => {
    switch (campo) {
      case 'nombre_apellido':
        return 'Se actualizará en todas las sesiones (pasadas y futuras)';
      case 'nombre_apellido_tutor':
        return 'Se actualizará en la información del paciente';
      case 'cuil':
        return 'Se actualizará en la información del paciente';
      case 'precio_por_hora':
        return 'Se actualizará solo en las sesiones futuras pendientes';
      case 'color':
        return 'Se actualizará la visualización en el calendario';
      case 'fecha_inicio':
        return 'Se actualizará la fecha de inicio del tratamiento';
      default:
        return 'Se aplicará el cambio';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
      <div className="modal-content max-w-3xl w-full mx-4 rounded-xl shadow-2xl max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-orange-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="text-orange-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                Confirmar cambios
              </h2>
              <p className="text-sm text-orange-700">
                {pacienteNombre} - Revisa detalladamente los cambios antes de aplicar
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

          {/* Cambios de información personal */}
          {Object.keys(cambiosInfo).length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <User className="text-blue-600" size={20} />
                <h3 className="font-semibold text-gray-800 text-lg">Información personal</h3>
              </div>
              <div className="space-y-3">
                {Object.entries(cambiosInfo).map(([campo, valor]) => (
                  <div key={campo} className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                    <div className="flex items-start gap-3">
                      <Info className="text-blue-600 mt-0.5 flex-shrink-0" size={18} />
                      <div className="flex-1">
                        <div className="font-medium text-blue-900 mb-1">
                          {getCambioTexto(campo, valor)}
                        </div>
                        <div className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded">
                          💡 {getDescripcionImpacto(campo)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Horarios modificados */}
          {horariosEditados && horariosEditados.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Edit3 className="text-purple-600" size={20} />
                <h3 className="font-semibold text-gray-800 text-lg">Horarios modificados</h3>
              </div>
              <div className="space-y-3">
                {horariosEditados.map((horario, index) => (
                  <div key={index} className="border border-purple-200 rounded-lg p-4 bg-purple-50">
                    <div className="flex items-start gap-3">
                      <Edit3 className="text-purple-600 mt-0.5 flex-shrink-0" size={18} />
                      <div className="flex-1">
                        <div className="font-medium text-purple-900 mb-2">
                          📅 {horario.anterior?.texto} → {horario.nuevo?.texto}
                        </div>
                        <div className="text-xs text-purple-700 bg-purple-100 px-2 py-1 rounded">
                          ⚡ Se eliminarán las sesiones futuras del horario anterior y se crearán nuevas con el nuevo horario
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Horarios nuevos */}
          {horariosNuevos && horariosNuevos.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Plus className="text-green-600" size={20} />
                <h3 className="font-semibold text-gray-800 text-lg">Horarios nuevos</h3>
              </div>
              <div className="space-y-3">
                {horariosNuevos.map((horario, index) => (
                  <div key={index} className="border border-green-200 rounded-lg p-4 bg-green-50">
                    <div className="flex items-start gap-3">
                      <Plus className="text-green-600 mt-0.5 flex-shrink-0" size={18} />
                      <div className="flex-1">
                        <div className="font-medium text-green-900 mb-2">
                          ➕ {horario.texto}
                        </div>
                        <div className="text-xs text-green-700 bg-green-100 px-2 py-1 rounded">
                          🚀 Se crearán sesiones automáticamente desde mañana hacia adelante (1 año)
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Horarios eliminados */}
          {horariosEliminados && horariosEliminados.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Trash2 className="text-red-600" size={20} />
                <h3 className="font-semibold text-gray-800 text-lg">Horarios eliminados</h3>
              </div>
              <div className="space-y-3">
                {horariosEliminados.map((horario, index) => (
                  <div key={index} className="border border-red-200 rounded-lg p-4 bg-red-50">
                    <div className="flex items-start gap-3">
                      <Trash2 className="text-red-600 mt-0.5 flex-shrink-0" size={18} />
                      <div className="flex-1">
                        <div className="font-medium text-red-900 mb-2">
                          🗑️ {horario.texto}
                        </div>
                        <div className="text-xs text-red-700 bg-red-100 px-2 py-1 rounded">
                          ⚠️ Se eliminarán todas las sesiones futuras de este horario
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reactivación */}
          {esReactivacion && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="text-emerald-600" size={20} />
                <h3 className="font-semibold text-gray-800 text-lg">Reactivación de paciente</h3>
              </div>
              <div className="border border-emerald-200 rounded-lg p-4 bg-emerald-50">
                <div className="flex items-start gap-3">
                  <Calendar className="text-emerald-600 mt-0.5 flex-shrink-0" size={18} />
                  <div className="flex-1">
                    <div className="font-medium text-emerald-900 mb-2">
                      ✅ El paciente será marcado como activo
                    </div>
                    <div className="text-xs text-emerald-700 bg-emerald-100 px-2 py-1 rounded">
                      🎯 Se generarán sesiones automáticamente desde mañana hacia adelante (1 año) según los horarios configurados
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Desactivación */}
          {esDesactivacion && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <X className="text-red-600" size={20} />
                <h3 className="font-semibold text-gray-800 text-lg">Desactivación de paciente</h3>
              </div>
              <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                <div className="flex items-start gap-3">
                  <X className="text-red-600 mt-0.5 flex-shrink-0" size={18} />
                  <div className="flex-1">
                    <div className="font-medium text-red-900 mb-2">
                      ⏸️ El paciente será marcado como inactivo
                    </div>
                    <div className="text-xs text-red-700 bg-red-100 px-2 py-1 rounded">
                      🛑 Se eliminarán todas las sesiones futuras automáticamente generadas
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Restauración */}
          {esRestauracion && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="text-blue-600" size={20} />
                <h3 className="font-semibold text-gray-800 text-lg">Restauración de paciente</h3>
              </div>
              <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                <div className="flex items-start gap-3">
                  <Calendar className="text-blue-600 mt-0.5 flex-shrink-0" size={18} />
                  <div className="flex-1">
                    <div className="font-medium text-blue-900 mb-2">
                      🔄 El paciente será restaurado desde eliminados
                    </div>
                    <div className="text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded">
                      📅 Se regenerarán las sesiones según los horarios configurados
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Mensaje general si solo hay cambios simples de horarios */}
          {hayCambiosHorarios && horariosEditados.length === 0 && horariosNuevos.length === 0 && horariosEliminados.length === 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="text-purple-600" size={20} />
                <h3 className="font-semibold text-gray-800 text-lg">Horarios actualizados</h3>
              </div>
              <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
                <div className="flex items-start gap-3">
                  <Clock className="text-purple-600 mt-0.5 flex-shrink-0" size={18} />
                  <div className="flex-1">
                    <div className="font-medium text-purple-900 mb-2">
                      🔄 Se actualizarán todos los horarios y sesiones futuras
                    </div>
                    <div className="text-xs text-purple-700 bg-purple-100 px-2 py-1 rounded">
                      ⚡ Se aplicarán los cambios de horarios y se regenerarán las sesiones correspondientes
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Advertencia final */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-yellow-600 mt-0.5 flex-shrink-0" size={18} />
              <div className="text-sm text-yellow-800">
                <div className="font-medium mb-1">⚠️ Importante:</div>
                <div>
                  Los cambios afectarán las sesiones futuras. Las sesiones pasadas y las modificadas manualmente se mantienen intactas.
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
            ❌ Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium shadow-lg"
          >
            ✅ Aplicar cambios
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmacionCambiosModal;