import React, { useState } from 'react';
import { Edit3, Trash2, Search, UserCheck, DollarSign, Users } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { supabase } from '../lib/supabase';

const SupervisorasView = ({
  supervisoras,
  setSupervisoras,
  openModal,
  currencyMode,
  tipoCambio
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('activas'); // 'activas', 'eliminadas', 'todas'
  const [sesionesSupervisionPorMes, setSesionesSupervisionPorMes] = useState(2);
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [supervisoraAEliminar, setSupervisoraAEliminar] = useState(null);

  // Funciones de utilidad
  const formatCurrency = (amount, currency = currencyMode) => {
    if (currency === 'USD') {
      return `$${(amount / tipoCambio).toFixed(2)} USD`;
    }
    return `$${amount.toLocaleString()} ARS`;
  };

  // Filtrar supervisoras por búsqueda y estado
  const supervisorasFiltradas = supervisoras.filter(supervisora => {
    const matchesSearch = supervisora.nombre_apellido.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterEstado === 'activas') {
      return matchesSearch && !supervisora.eliminado;
    } else if (filterEstado === 'eliminadas') {
      return matchesSearch && supervisora.eliminado;
    } else { // 'todas'
      return matchesSearch;
    }
  });

  // Función para marcar supervisora como eliminada
  const eliminarSupervisora = async (supervisoraId) => {
    try {
      console.log('Eliminando supervisora:', supervisoraId);

      const { error } = await supabase
        .from('supervisoras')
        .update({ eliminado: true })
        .eq('id', supervisoraId);

      if (error) {
        console.error('Error en Supabase:', error);
        throw error;
      }

      // Actualizar estado local
      setSupervisoras(prev => prev.map(s =>
        s.id === supervisoraId ? { ...s, eliminado: true } : s
      ));

      // Mostrar toast de éxito
      if (window.showToast) {
        window.showToast('Supervisora eliminada exitosamente', 'success');
      }

    } catch (error) {
      console.error('Error al eliminar supervisora:', error);
      alert('Error al eliminar supervisora: ' + error.message);
    }
  };

  // Función para restaurar supervisora eliminada
  const restaurarSupervisora = async (supervisoraId) => {
    try {
      console.log('Restaurando supervisora:', supervisoraId);

      const { error } = await supabase
        .from('supervisoras')
        .update({ eliminado: false })
        .eq('id', supervisoraId);

      if (error) {
        console.error('Error en Supabase:', error);
        throw error;
      }

      // Actualizar estado local
      setSupervisoras(prev => prev.map(s =>
        s.id === supervisoraId ? { ...s, eliminado: false } : s
      ));

      // Mostrar toast de éxito
      if (window.showToast) {
        window.showToast('Supervisora restaurada exitosamente', 'success');
      }

    } catch (error) {
      console.error('Error al restaurar supervisora:', error);
      alert('Error al restaurar supervisora: ' + error.message);
    }
  };

  const handleEliminarSupervisora = (supervisora) => {
    setSupervisoraAEliminar(supervisora);
    setShowConfirmModal(true);
  };

  const confirmarEliminacion = () => {
    if (supervisoraAEliminar) {
      eliminarSupervisora(supervisoraAEliminar.id);
      setSupervisoraAEliminar(null);
    }
  };

  const getEstadoTexto = (supervisora) => {
    return supervisora.eliminado ? 'Eliminada' : 'Activa';
  };

  const getEstadoColor = (supervisora) => {
    return supervisora.eliminado ? 'bg-gray-100 text-gray-800' : 'bg-green-100 text-green-800';
  };

  return (
    <div className="space-y-6">
      {/* Barra de búsqueda */}
      <div className="glass-effect p-6 rounded-xl">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Búsqueda */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar supervisora por nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
            />
          </div>

          {/* Filtros */}
          <div className="flex gap-2">
            {['activas', 'eliminadas', 'todas'].map(filter => (
              <button
                key={filter}
                onClick={() => setFilterEstado(filter)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${filterEstado === filter
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>

          {/* Estadísticas */}
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Users size={16} />
              <span>{supervisorasFiltradas.length} supervisora{supervisorasFiltradas.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de supervisoras */}
      <div className="grid gap-4">
        {supervisorasFiltradas.map(supervisora => (
          <div
            key={supervisora.id}
            className={`card p-6 hover-lift transition-all duration-300 ${supervisora.eliminado ? 'opacity-50 bg-gray-50' : ''}`}
          >
            <div className="flex items-center justify-between">
              {/* Información principal */}
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className={`w-16 h-16 rounded-xl shadow-md flex items-center justify-center ${supervisora.eliminado ? 'bg-gray-400' : 'bg-gradient-to-br from-purple-500 to-purple-700'}`}>
                  <span className="text-white font-bold text-xl">
                    {supervisora.nombre_apellido.split(' ').map(n => n.charAt(0)).join('')}
                  </span>
                </div>

                {/* Datos de la supervisora */}
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-gray-800">
                    {supervisora.nombre_apellido}
                  </h3>

                  <div className="flex items-center gap-2 text-gray-600">
                    <DollarSign size={16} />
                    <span className="font-semibold text-green-600">
                      {formatCurrency(supervisora.precio_por_hora)}/hora
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <UserCheck size={16} />
                    <span>Supervisora {supervisora.eliminado ? 'eliminada' : 'activa'}</span>
                  </div>
                </div>

                {/* Información adicional */}
                <div className="ml-8 space-y-1">
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Tarifa mensual aprox:</span>
                    <div className="text-lg font-bold text-green-600">
                      {formatCurrency(supervisora.precio_por_hora * sesionesSupervisionPorMes)}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    Basado en {sesionesSupervisionPorMes} sesiones mensuales
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-2">
                {/* Restaurar - Solo si está eliminada */}
                {supervisora.eliminado && (
                  <button
                    onClick={() => restaurarSupervisora(supervisora.id)}
                    className="p-3 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                    title="Restaurar supervisora"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}

                {/* Editar - Solo si no está eliminada */}
                {!supervisora.eliminado && (
                  <button
                    onClick={() => openModal('edit-supervisora', supervisora)}
                    className="p-3 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                    title="Editar supervisora"
                  >
                    <Edit3 size={20} />
                  </button>
                )}

                {/* Eliminar - Solo si no está eliminada */}
                {!supervisora.eliminado && (
                  <button
                    onClick={() => handleEliminarSupervisora(supervisora)}
                    className="p-3 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                    title="Eliminar supervisora"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            </div>

            {/* Información expandida */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Estado:</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(supervisora)}`}>
                    {getEstadoTexto(supervisora)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Tipo:</span>
                  <span className="ml-2 font-medium">Supervisión profesional</span>
                </div>
                <div>
                  <span className="text-gray-500">Modalidad:</span>
                  <span className="ml-2 font-medium">Por sesión</span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Mensaje cuando no hay resultados */}
        {supervisorasFiltradas.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-600 mb-2">
              {searchTerm ? 'No se encontraron supervisoras' : `No hay supervisoras ${filterEstado}`}
            </h3>
            <p className="text-gray-500">
              {searchTerm
                ? 'Intenta con otros términos de búsqueda'
                : filterEstado === 'activas' ? 'Agrega tu primera supervisora para comenzar' : 'No hay supervisoras eliminadas'
              }
            </p>
          </div>
        )}
      </div>

      {/* Resumen estadístico - Solo para supervisoras activas */}
      {supervisoras.filter(s => !s.eliminado).length > 0 && (
        <div className="glass-effect p-6 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">Resumen de Supervisión</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Sesiones por mes:</span>
              {isEditingConfig ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={sesionesSupervisionPorMes}
                    onChange={(e) => setSesionesSupervisionPorMes(parseInt(e.target.value) || 2)}
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                  />
                  <button
                    onClick={() => setIsEditingConfig(false)}
                    className="text-green-600 hover:text-green-700"
                  >
                    ✓
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-medium">{sesionesSupervisionPorMes}</span>
                  <button
                    onClick={() => setIsEditingConfig(true)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✏️
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {supervisoras.filter(s => !s.eliminado).length}
              </div>
              <div className="text-sm text-gray-600">Supervisoras activas</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(
                  supervisoras.filter(s => !s.eliminado).reduce((sum, s) => sum + s.precio_por_hora, 0)
                )}
              </div>
              <div className="text-sm text-gray-600">Costo total por hora</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(
                  supervisoras.filter(s => !s.eliminado).reduce((sum, s) => sum + (s.precio_por_hora * sesionesSupervisionPorMes), 0)
                )}
              </div>
              <div className="text-sm text-gray-600">Costo mensual estimado</div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setSupervisoraAEliminar(null);
        }}
        onConfirm={confirmarEliminacion}
        title="Eliminar Supervisora"
        message={`¿Estás segura de que quieres eliminar a ${supervisoraAEliminar?.nombre_apellido}? La supervisora será marcada como eliminada. Esta acción se puede revertir desde la sección de eliminadas.`}
        confirmText="Sí, Eliminar"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  );
};

export default SupervisorasView;