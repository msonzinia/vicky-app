import React, { useState, useMemo } from 'react';
import { Edit3, Trash2, Search, UserCheck, UserX, Calendar, DollarSign } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { supabase } from '../lib/supabase';

const PacientesView = ({
  pacientes,
  setPacientes,
  openModal,
  currencyMode,
  tipoCambio
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActivo, setFilterActivo] = useState('activos'); // 'todos', 'activos', 'inactivos', 'eliminados'
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pacienteAEliminar, setPacienteAEliminar] = useState(null);

  // Funciones de utilidad
  const formatCurrency = (amount, currency = currencyMode) => {
    if (currency === 'USD') {
      return `$${(amount / tipoCambio).toFixed(2)} USD`;
    }
    return `$${amount.toLocaleString()} ARS`;
  };

  const getDiaSemanaTexto = (dia) => {
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return dias[dia];
  };

  // Filtrar y buscar pacientes
  const pacientesFiltrados = useMemo(() => {
    let filtrados = pacientes;

    // Filtrar por estado activo/eliminado
    if (filterActivo === 'activos') {
      filtrados = filtrados.filter(p => p.activo && !p.eliminado);
    } else if (filterActivo === 'inactivos') {
      filtrados = filtrados.filter(p => !p.activo && !p.eliminado);
    } else if (filterActivo === 'eliminados') {
      filtrados = filtrados.filter(p => p.eliminado);
    } else if (filterActivo === 'todos') {
      filtrados = filtrados.filter(p => !p.eliminado); // No mostrar eliminados en "todos"
    }

    // Buscar por nombre
    if (searchTerm) {
      filtrados = filtrados.filter(p =>
        p.nombre_apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.nombre_apellido_tutor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.cuil.includes(searchTerm)
      );
    }

    // Ordenar: activos primero, luego por nombre
    return filtrados.sort((a, b) => {
      if (a.activo && !b.activo) return -1;
      if (!a.activo && b.activo) return 1;
      return a.nombre_apellido.localeCompare(b.nombre_apellido);
    });
  }, [pacientes, searchTerm, filterActivo]);

  // Función para cambiar estado activo/inactivo
  const toggleActivoPaciente = async (pacienteId, nuevoEstado) => {
    try {
      console.log('Cambiando estado activo:', pacienteId, 'a:', nuevoEstado);

      const { error } = await supabase
        .from('pacientes')
        .update({ activo: nuevoEstado })
        .eq('id', pacienteId);

      if (error) {
        console.error('Error en Supabase:', error);
        throw error;
      }

      // Si se desactiva, eliminar sesiones futuras
      if (!nuevoEstado) {
        console.log('Inactivando paciente y eliminando sesiones futuras...');
        const { data: resultado, error: inactivarError } = await supabase.rpc('inactivar_paciente_completo', {
          p_paciente_id: pacienteId
        });

        if (inactivarError) {
          console.error('Error inactivando:', inactivarError);
        } else {
          console.log('✅ Paciente inactivado:', resultado);
        }
      } else {
        console.log('Reactivando paciente y generando sesiones futuras...');
        const { data: resultado, error: reactivarError } = await supabase.rpc('reactivar_paciente_completo', {
          p_paciente_id: pacienteId
        });

        if (reactivarError) {
          console.error('Error reactivando:', reactivarError);
        } else {
          console.log('✅ Paciente reactivado:', resultado);
        }
      }

      // Actualizar estado local
      setPacientes(prev => prev.map(p =>
        p.id === pacienteId ? { ...p, activo: nuevoEstado } : p
      ));

      // Mostrar toast de éxito
      if (window.showToast) {
        window.showToast(
          `Paciente ${nuevoEstado ? 'activado' : 'desactivado'} exitosamente`,
          'success'
        );
      }

    } catch (error) {
      console.error('Error al cambiar estado del paciente:', error);
      alert('Error al cambiar estado del paciente: ' + error.message);
    }
  };

  // Función para marcar paciente como eliminado
  const eliminarPaciente = async (pacienteId) => {
    try {
      console.log('Eliminando paciente:', pacienteId);

      const { error } = await supabase
        .from('pacientes')
        .update({
          activo: false,
          eliminado: true
        })
        .eq('id', pacienteId);

      if (error) {
        console.error('Error en Supabase:', error);
        throw error;
      }

      // Eliminar sesiones futuras (paciente ya quedó inactivo)
      console.log('Eliminando sesiones futuras del paciente eliminado...');
      const { data: resultado, error: inactivarError } = await supabase.rpc('inactivar_paciente_completo', {
        p_paciente_id: pacienteId
      });

      if (inactivarError) {
        console.error('Error eliminando sesiones:', inactivarError);
      } else {
        console.log('✅ Sesiones eliminadas:', resultado);
      }

      // Actualizar estado local
      setPacientes(prev => prev.map(p =>
        p.id === pacienteId ? { ...p, activo: false, eliminado: true } : p
      ));

      // Mostrar toast de éxito
      if (window.showToast) {
        window.showToast('Paciente eliminado exitosamente', 'success');
      }

    } catch (error) {
      console.error('Error al eliminar paciente:', error);
      alert('Error al eliminar paciente: ' + error.message);
    }
  };

  // Función para restaurar paciente eliminado
  const restaurarPaciente = async (pacienteId) => {
    try {
      console.log('Restaurando paciente:', pacienteId);

      const { error } = await supabase
        .from('pacientes')
        .update({
          eliminado: false,
          activo: false // Lo restauramos como inactivo por seguridad
        })
        .eq('id', pacienteId);

      if (error) {
        console.error('Error en Supabase:', error);
        throw error;
      }

      // Actualizar estado local
      setPacientes(prev => prev.map(p =>
        p.id === pacienteId ? { ...p, eliminado: false, activo: false } : p
      ));

      // Mostrar toast de éxito
      if (window.showToast) {
        window.showToast('Paciente restaurado exitosamente (inactivo)', 'success');
      }

    } catch (error) {
      console.error('Error al restaurar paciente:', error);
      alert('Error al restaurar paciente: ' + error.message);
    }
  };

  const handleEliminarPaciente = (paciente) => {
    setPacienteAEliminar(paciente);
    setShowConfirmModal(true);
  };

  const confirmarEliminacion = () => {
    if (pacienteAEliminar) {
      eliminarPaciente(pacienteAEliminar.id);
      setPacienteAEliminar(null);
    }
  };

  const getEstadoTexto = (paciente) => {
    if (paciente.eliminado) return 'Eliminado';
    if (paciente.activo) return 'Activo';
    return 'Inactivo';
  };

  const getEstadoColor = (paciente) => {
    if (paciente.eliminado) return 'bg-gray-100 text-gray-800';
    if (paciente.activo) return 'bg-green-100 text-green-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      {/* Barra de búsqueda y filtros */}
      <div className="glass-effect p-6 rounded-xl">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Búsqueda */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nombre, tutor o CUIL..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
            />
          </div>

          {/* Filtros */}
          <div className="flex gap-2">
            {['activos', 'inactivos', 'eliminados', 'todos'].map(filter => (
              <button
                key={filter}
                onClick={() => setFilterActivo(filter)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${filterActivo === filter
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>

          {/* Estadísticas */}
          <div className="text-sm text-gray-600">
            {pacientesFiltrados.length} paciente{pacientesFiltrados.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Lista de pacientes */}
      <div className="grid gap-4">
        {pacientesFiltrados.map(paciente => (
          <div
            key={paciente.id}
            className={`card p-6 hover-lift transition-all duration-300 ${paciente.eliminado ? 'opacity-50 bg-gray-50' : !paciente.activo ? 'opacity-75 grayscale' : ''
              }`}
          >
            <div className="flex items-center justify-between">
              {/* Información principal */}
              <div className="flex items-center gap-4">
                {/* Indicador de color y estado */}
                <div className="flex flex-col items-center gap-2">
                  <div
                    className="w-12 h-12 rounded-xl shadow-md flex items-center justify-center"
                    style={{ backgroundColor: paciente.eliminado ? '#9CA3AF' : paciente.color }}
                  >
                    <span className="text-white font-bold text-lg">
                      {paciente.nombre_apellido.charAt(0)}
                    </span>
                  </div>
                  {paciente.eliminado ? (
                    <span className="text-gray-500 text-xs">✕</span>
                  ) : paciente.activo ? (
                    <UserCheck className="text-green-500" size={16} />
                  ) : (
                    <UserX className="text-red-500" size={16} />
                  )}
                </div>

                {/* Datos del paciente */}
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-gray-800">
                    {paciente.nombre_apellido}
                  </h3>
                  <p className="text-gray-600">
                    <span className="font-medium">Tutor:</span> {paciente.nombre_apellido_tutor}
                  </p>
                  <p className="text-gray-600">
                    <span className="font-medium">CUIL:</span> {paciente.cuil}
                  </p>
                </div>

                {/* Información de sesiones */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar size={16} />
                    <span>
                      {paciente.horarios && paciente.horarios.length > 0 ? (
                        paciente.horarios.map((horario, index) => (
                          <span key={index}>
                            {getDiaSemanaTexto(horario.dia_semana)} a las {horario.hora_inicio}
                            {index < paciente.horarios.length - 1 ? ', ' : ''}
                          </span>
                        ))
                      ) : (
                        'Sin horarios configurados'
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <DollarSign size={16} />
                    <span className="font-semibold text-green-600">
                      {formatCurrency(paciente.precio_por_hora)}/hora
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Desde: {new Date(paciente.fecha_inicio).toLocaleDateString('es-AR')}
                  </p>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-2">
                {/* Restaurar - Solo si está eliminado */}
                {paciente.eliminado && (
                  <button
                    onClick={() => restaurarPaciente(paciente.id)}
                    className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                    title="Restaurar paciente"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                )}

                {/* Toggle activo/inactivo - Solo si no está eliminado */}
                {!paciente.eliminado && (
                  <button
                    onClick={() => toggleActivoPaciente(paciente.id, !paciente.activo)}
                    className={`p-2 rounded-lg transition-all ${paciente.activo
                      ? 'bg-green-100 text-green-600 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    title={paciente.activo ? 'Desactivar paciente' : 'Activar paciente'}
                  >
                    {paciente.activo ? <UserCheck size={20} /> : <UserX size={20} />}
                  </button>
                )}

                {/* Editar - Solo si no está eliminado */}
                {!paciente.eliminado && (
                  <button
                    onClick={() => openModal('edit-paciente', paciente)}
                    className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                    title="Editar paciente"
                  >
                    <Edit3 size={20} />
                  </button>
                )}

                {/* Eliminar - Solo si no está eliminado */}
                {!paciente.eliminado && (
                  <button
                    onClick={() => handleEliminarPaciente(paciente)}
                    className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                    title="Eliminar paciente"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </div>
            </div>

            {/* Información adicional expandible */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Estado:</span>
                  <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getEstadoColor(paciente)}`}>
                    {getEstadoTexto(paciente)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Horarios:</span>
                  <span className="ml-2 font-medium">
                    {paciente.horarios && paciente.horarios.length > 0 ?
                      `${paciente.horarios.length} sesión${paciente.horarios.length > 1 ? 'es' : ''} por semana` :
                      'Sin configurar'
                    }
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Total mensual aprox:</span>
                  <span className="ml-2 font-medium text-green-600">
                    {formatCurrency(paciente.precio_por_hora * 4)} {/* 4 sesiones aprox por mes */}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Mensaje cuando no hay resultados */}
        {pacientesFiltrados.length === 0 && (
          <div className="text-center py-12">
            <UserX className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-600 mb-2">
              No se encontraron pacientes
            </h3>
            <p className="text-gray-500">
              {searchTerm
                ? 'Intenta con otros términos de búsqueda'
                : `No hay pacientes ${filterActivo}`
              }
            </p>
          </div>
        )}
      </div>

      {/* Modal de confirmación */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setPacienteAEliminar(null);
        }}
        onConfirm={confirmarEliminacion}
        title="Eliminar Paciente"
        message={`¿Estás segura de que quieres eliminar a ${pacienteAEliminar?.nombre_apellido}? El paciente será marcado como eliminado y se eliminarán todas sus sesiones futuras. Esta acción se puede revertir desde la sección de eliminados.`}
        confirmText="Sí, Eliminar"
        cancelText="Cancelar"
        type="danger"
      />
    </div>
  );
};

export default PacientesView;