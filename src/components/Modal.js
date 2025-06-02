import React, { useState, useEffect } from 'react';
import { X, Save, User, Calendar, DollarSign, Clock } from 'lucide-react';

const Modal = ({
  isOpen,
  onClose,
  type,
  data,
  pacientes,
  supervisoras,
  onSave,
  currencyMode,
  tipoCambio,
  fechaPrecargada
}) => {
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});

  // Colores predefinidos para pacientes
  const coloresPacientes = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'
  ];

  // ✅ TIPOS QUE PERMITEN ACOMPAÑAMIENTO
  const tiposConAcompanamiento = ['Evaluación', 'Re-evaluación', 'Devolución', 'Reunión con colegio'];

  useEffect(() => {
    if (isOpen) {
      initializeForm();
    }
  }, [isOpen, type, data, fechaPrecargada]);

  const initializeForm = () => {
    setErrors({});

    switch (type) {
      case 'add-paciente':
        setFormData({
          nombre_apellido: '',
          nombre_apellido_tutor: '',
          cuil: '',
          precio_por_hora: '',
          fecha_inicio: new Date().toISOString().split('T')[0],
          activo: true,
          color: coloresPacientes[Math.floor(Math.random() * coloresPacientes.length)],
          horarios: [{ dia_semana: 1, hora_inicio: '10:00' }]
        });
        break;

      case 'edit-paciente':
        setFormData({
          ...data,
          fecha_inicio: data.fecha_inicio?.split('T')[0] || new Date().toISOString().split('T')[0],
          horarios: data.horarios || [{ dia_semana: data.dia_semana || 1, hora_inicio: data.hora_inicio || '10:00' }]
        });
        break;

      case 'add-supervisora':
        setFormData({
          nombre_apellido: '',
          precio_por_hora: ''
        });
        break;

      case 'edit-supervisora':
        setFormData({ ...data });
        break;

      case 'add-sesion':
        const pacientesActivos = pacientes.filter(p => p.activo);
        const fechaHoraPorDefecto = fechaPrecargada || new Date().toISOString().slice(0, 16);

        setFormData({
          tipo_sesion: 'Sesión',
          paciente_id: pacientesActivos.length === 1 ? pacientesActivos[0].id : '',
          supervisora_id: supervisoras.length === 1 ? supervisoras[0].id : '',
          fecha_hora: fechaHoraPorDefecto,
          precio_por_hora: pacientesActivos.length === 1 ? pacientesActivos[0].precio_por_hora :
            supervisoras.length === 1 ? supervisoras[0].precio_por_hora : '',
          duracion_horas: 1,
          estado: 'Pendiente',
          // ✅ CAMPOS DE ACOMPAÑAMIENTO (nombres corregidos para coincidir con BD)
          acompañado_supervisora: false,
          supervisora_acompanante_id: ''
        });
        break;

      case 'edit-sesion':
        setFormData({
          ...data,
          // ✅ CORRECCIÓN DEFINITIVA: Convertir fecha sin zona horaria
          fecha_hora: data.fecha_hora.includes(' ')
            ? data.fecha_hora.split(' ')[0] + 'T' + data.fecha_hora.split(' ')[1].slice(0, 5)
            : (data.fecha_hora.includes('T') ? data.fecha_hora.slice(0, 16) : data.fecha_hora),
          // ✅ CAMPOS DE ACOMPAÑAMIENTO para edición
          acompañado_supervisora: data.acompañado_supervisora || false,
          supervisora_acompanante_id: data.supervisora_acompanante_id || ''
        });
        break;

      default:
        setFormData({});
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Limpiar error del campo si existe
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }

    // Lógica especial para sesiones
    if (field === 'tipo_sesion') {
      const pacientesActivos = pacientes.filter(p => p.activo);

      setFormData(prev => {
        let newData = {
          ...prev,
          [field]: value,
          paciente_id: '',
          supervisora_id: '',
          duracion_horas: value === 'Evaluación' || value === 'Re-evaluación' ? 2 : 1,
          // ✅ Resetear campos de acompañamiento solo si el nuevo tipo no lo permite
          acompañado_supervisora: tiposConAcompanamiento.includes(value) ? prev.acompañado_supervisora || false : false,
          supervisora_acompanante_id: tiposConAcompanamiento.includes(value) ? prev.supervisora_acompanante_id || '' : ''
        };

        // Auto-seleccionar si hay solo uno disponible
        if (value === 'Supervisión') {
          if (supervisoras.length === 1) {
            newData.supervisora_id = supervisoras[0].id;
            newData.precio_por_hora = supervisoras[0].precio_por_hora;
          }
        } else {
          // Para todos los otros tipos (con paciente)
          if (pacientesActivos.length === 1) {
            newData.paciente_id = pacientesActivos[0].id;
            newData.precio_por_hora = pacientesActivos[0].precio_por_hora;
          }
        }

        return newData;
      });
      return;
    }

    // ✅ LÓGICA para checkbox de acompañamiento
    if (field === 'acompañado_supervisora') {
      const supervisorasActivas = supervisoras.filter(s => !s.eliminado);

      setFormData(prev => ({
        ...prev,
        [field]: value,
        // Si marca acompañamiento y hay solo 1 supervisora, auto-seleccionar
        supervisora_acompanante_id: value && supervisorasActivas.length === 1
          ? supervisorasActivas[0].id
          : ''
      }));
      return;
    }

    if (field === 'paciente_id' && value) {
      const paciente = pacientes.find(p => p.id === value);
      if (paciente) {
        setFormData(prev => ({
          ...prev,
          precio_por_hora: paciente.precio_por_hora
        }));
      }
    }

    if (field === 'supervisora_id' && value) {
      const supervisora = supervisoras.find(s => s.id === value);
      if (supervisora) {
        setFormData(prev => ({
          ...prev,
          precio_por_hora: supervisora.precio_por_hora
        }));
      }
    }
  };

  // Funciones para manejar horarios múltiples
  const agregarHorario = () => {
    setFormData(prev => ({
      ...prev,
      horarios: [...(prev.horarios || []), { dia_semana: 1, hora_inicio: '10:00' }]
    }));
  };

  const eliminarHorario = (index) => {
    if (formData.horarios && formData.horarios.length > 1) {
      setFormData(prev => ({
        ...prev,
        horarios: prev.horarios.filter((_, i) => i !== index)
      }));
    }
  };

  const actualizarHorario = (index, campo, valor) => {
    setFormData(prev => ({
      ...prev,
      horarios: (prev.horarios || []).map((horario, i) =>
        i === index ? { ...horario, [campo]: campo === 'dia_semana' ? parseInt(valor) : valor } : horario
      )
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (type.includes('paciente')) {
      if (!formData.nombre_apellido?.trim()) newErrors.nombre_apellido = 'Nombre requerido';
      if (!formData.nombre_apellido_tutor?.trim()) newErrors.nombre_apellido_tutor = 'Nombre del tutor requerido';
      if (!formData.cuil?.trim()) newErrors.cuil = 'CUIL requerido';
      if (!formData.precio_por_hora || formData.precio_por_hora <= 0) newErrors.precio_por_hora = 'Precio válido requerido';
      if (!formData.fecha_inicio) newErrors.fecha_inicio = 'Fecha de inicio requerida';

      if (!formData.horarios || formData.horarios.length === 0) {
        newErrors.horarios = 'Debe agregar al menos un horario';
      } else {
        formData.horarios.forEach((horario, index) => {
          if (!horario.hora_inicio) {
            newErrors[`horario_${index}`] = 'Hora requerida';
          }
        });
      }
    }

    if (type.includes('supervisora')) {
      if (!formData.nombre_apellido?.trim()) newErrors.nombre_apellido = 'Nombre requerido';
      if (!formData.precio_por_hora || formData.precio_por_hora <= 0) newErrors.precio_por_hora = 'Precio válido requerido';
    }

    if (type.includes('sesion')) {
      if (!formData.fecha_hora) newErrors.fecha_hora = 'Fecha y hora requeridas';
      if (!formData.precio_por_hora || formData.precio_por_hora <= 0) newErrors.precio_por_hora = 'Precio válido requerido';

      if (formData.tipo_sesion === 'Supervisión' && !formData.supervisora_id) {
        newErrors.supervisora_id = 'Supervisora requerida';
      }

      if (['Sesión', 'Evaluación', 'Re-evaluación', 'Devolución', 'Reunión con colegio'].includes(formData.tipo_sesion) && !formData.paciente_id) {
        newErrors.paciente_id = 'Paciente requerido';
      }

      // ✅ VALIDACIÓN para acompañamiento
      if (tiposConAcompanamiento.includes(formData.tipo_sesion) &&
        formData.acompañado_supervisora &&
        !formData.supervisora_acompanante_id) {
        newErrors.supervisora_acompanante_id = 'Supervisora acompañante requerida';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Limpiar datos antes de enviar
    const cleanFormData = { ...formData };

    // Para sesiones, asegurar que solo uno de paciente_id o supervisora_id esté presente
    if (type.includes('sesion')) {
      // 🔧 CORRECCIÓN: Limpiar lógica de IDs según tipo de sesión
      if (cleanFormData.tipo_sesion === 'Supervisión') {
        // Supervisión: Solo supervisora, sin paciente
        cleanFormData.paciente_id = null;
        cleanFormData.supervisora_acompanante_id = null;
        cleanFormData.acompañado_supervisora = false;

        if (!cleanFormData.supervisora_id) {
          alert('Debe seleccionar una supervisora');
          return;
        }
      } else {
        // Todos los demás tipos: Tienen paciente, sin supervisora principal
        cleanFormData.supervisora_id = null;

        if (!cleanFormData.paciente_id) {
          alert('Debe seleccionar un paciente');
          return;
        }

        // 🔧 CORRECCIÓN: Manejar acompañamiento correctamente
        if (!tiposConAcompanamiento.includes(cleanFormData.tipo_sesion)) {
          // Si el tipo NO permite acompañamiento, limpiar campos
          cleanFormData.acompañado_supervisora = false;
          cleanFormData.supervisora_acompanante_id = null;
        } else if (!cleanFormData.acompañado_supervisora) {
          // Si permite acompañamiento pero no está marcado, limpiar supervisora acompañante
          cleanFormData.supervisora_acompanante_id = null;
        }
        // Si está marcado Y el tipo lo permite, mantener supervisora_acompanante_id
      }

      // Asegurar que los números son números
      cleanFormData.precio_por_hora = parseFloat(cleanFormData.precio_por_hora);
      cleanFormData.duracion_horas = parseFloat(cleanFormData.duracion_horas);
      // ✅ Limpiar campos de acompañamiento si no aplican
      if (!tiposConAcompanamiento.includes(cleanFormData.tipo_sesion)) {
        cleanFormData.acompañado_supervisora = false;
        cleanFormData.supervisora_acompanante_id = null;
      } else if (!cleanFormData.acompañado_supervisora) {
        cleanFormData.supervisora_acompanante_id = null;
      }
    }

    // Para pacientes, asegurar tipos correctos
    if (type.includes('paciente')) {
      cleanFormData.precio_por_hora = parseFloat(cleanFormData.precio_por_hora);
      cleanFormData.activo = Boolean(cleanFormData.activo);
    }

    // Para supervisoras
    if (type.includes('supervisora')) {
      cleanFormData.precio_por_hora = parseFloat(cleanFormData.precio_por_hora);
    }

    console.log('Sending clean data:', cleanFormData);
    onSave(cleanFormData);
    onClose();

    console.log('🧪 DEBUGGING - Datos limpios que se envían:', {
      tipo_sesion: cleanFormData.tipo_sesion,
      paciente_id: cleanFormData.paciente_id,
      supervisora_id: cleanFormData.supervisora_id,
      supervisora_acompanante_id: cleanFormData.supervisora_acompanante_id,
      acompañado_supervisora: cleanFormData.acompañado_supervisora,
      fecha_hora: cleanFormData.fecha_hora
    });

  };



  if (!isOpen) return null;

  const getModalTitle = () => {
    switch (type) {
      case 'add-paciente': return 'Nuevo Paciente';
      case 'edit-paciente': return 'Editar Paciente';
      case 'add-supervisora': return 'Nueva Supervisora';
      case 'edit-supervisora': return 'Editar Supervisora';
      case 'add-sesion': return fechaPrecargada ? 'Nueva Sesión para el Día' : 'Nueva Sesión';
      case 'edit-sesion': return 'Editar Sesión';
      default: return 'Modal';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
      <div className="modal-content max-w-4xl w-full mx-4 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              {type.includes('paciente') && <User className="text-purple-600" size={24} />}
              {type.includes('supervisora') && <User className="text-purple-600" size={24} />}
              {type.includes('sesion') && <Calendar className="text-purple-600" size={24} />}
              {getModalTitle()}
            </h2>
            {fechaPrecargada && type === 'add-sesion' && (
              <p className="text-sm text-purple-600 mt-1">
                📅 Fecha pre-cargada: {new Date(fechaPrecargada).toLocaleDateString('es-AR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Formulario de Paciente */}
          {type.includes('paciente') && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre y Apellido *
                  </label>
                  <input
                    type="text"
                    value={formData.nombre_apellido || ''}
                    onChange={(e) => handleInputChange('nombre_apellido', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${errors.nombre_apellido ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="Juan Pérez"
                  />
                  {errors.nombre_apellido && (
                    <p className="text-red-500 text-sm mt-1">{errors.nombre_apellido}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre y Apellido del Tutor *
                  </label>
                  <input
                    type="text"
                    value={formData.nombre_apellido_tutor || ''}
                    onChange={(e) => handleInputChange('nombre_apellido_tutor', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${errors.nombre_apellido_tutor ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="Carlos Pérez"
                  />
                  {errors.nombre_apellido_tutor && (
                    <p className="text-red-500 text-sm mt-1">{errors.nombre_apellido_tutor}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CUIL *
                  </label>
                  <input
                    type="text"
                    value={formData.cuil || ''}
                    onChange={(e) => handleInputChange('cuil', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${errors.cuil ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="20-12345678-9"
                  />
                  {errors.cuil && (
                    <p className="text-red-500 text-sm mt-1">{errors.cuil}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Precio por Hora *
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="number"
                      value={formData.precio_por_hora || ''}
                      onChange={(e) => handleInputChange('precio_por_hora', parseFloat(e.target.value))}
                      className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${errors.precio_por_hora ? 'border-red-500' : 'border-gray-300'
                        }`}
                      placeholder="15000"
                    />
                  </div>
                  {errors.precio_por_hora && (
                    <p className="text-red-500 text-sm mt-1">{errors.precio_por_hora}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha de Inicio *
                  </label>
                  <input
                    type="date"
                    value={formData.fecha_inicio || ''}
                    onChange={(e) => handleInputChange('fecha_inicio', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${errors.fecha_inicio ? 'border-red-500' : 'border-gray-300'
                      }`}
                  />
                  {errors.fecha_inicio && (
                    <p className="text-red-500 text-sm mt-1">{errors.fecha_inicio}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Color del Paciente
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {coloresPacientes.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleInputChange('color', color)}
                        className={`w-8 h-8 rounded-lg transition-all ${formData.color === color ? 'ring-2 ring-gray-600 scale-110' : 'hover:scale-105'
                          }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Horarios múltiples */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Horarios de Sesiones *
                  </label>
                  <button
                    type="button"
                    onClick={agregarHorario}
                    className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 transition-colors"
                    disabled={formData.horarios?.length >= 3}
                  >
                    + Agregar Horario
                  </button>
                </div>

                <div className="space-y-3">
                  {(formData.horarios || []).map((horario, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <select
                          value={horario.dia_semana}
                          onChange={(e) => actualizarHorario(index, 'dia_semana', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        >
                          <option value={1}>Lunes</option>
                          <option value={2}>Martes</option>
                          <option value={3}>Miércoles</option>
                          <option value={4}>Jueves</option>
                          <option value={5}>Viernes</option>
                          <option value={6}>Sábado</option>
                          <option value={0}>Domingo</option>
                        </select>
                      </div>

                      <div className="flex-1">
                        <input
                          type="time"
                          value={horario.hora_inicio}
                          onChange={(e) => actualizarHorario(index, 'hora_inicio', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${errors[`horario_${index}`] ? 'border-red-500' : 'border-gray-300'
                            }`}
                        />
                      </div>

                      {(formData.horarios || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() => eliminarHorario(index)}
                          className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {errors.horarios && (
                  <p className="text-red-500 text-sm mt-1">{errors.horarios}</p>
                )}
              </div>
            </>
          )}

          {/* Formulario de Supervisora */}
          {type.includes('supervisora') && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre y Apellido *
                </label>
                <input
                  type="text"
                  value={formData.nombre_apellido || ''}
                  onChange={(e) => handleInputChange('nombre_apellido', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${errors.nombre_apellido ? 'border-red-500' : 'border-gray-300'
                    }`}
                  placeholder="Dra. María González"
                />
                {errors.nombre_apellido && (
                  <p className="text-red-500 text-sm mt-1">{errors.nombre_apellido}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Precio por Hora *
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="number"
                    value={formData.precio_por_hora || ''}
                    onChange={(e) => handleInputChange('precio_por_hora', parseFloat(e.target.value))}
                    className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${errors.precio_por_hora ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="8000"
                  />
                </div>
                {errors.precio_por_hora && (
                  <p className="text-red-500 text-sm mt-1">{errors.precio_por_hora}</p>
                )}
              </div>
            </>
          )}

          {/* Formulario de Sesión */}
          {type.includes('sesion') && (
            <>
              {fechaPrecargada && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="text-green-600" size={16} />
                    <span className="text-green-800 font-medium text-sm">
                      Fecha y hora configuradas automáticamente para el día seleccionado
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Sesión *
                  </label>
                  <select
                    value={formData.tipo_sesion || 'Sesión'}
                    onChange={(e) => handleInputChange('tipo_sesion', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="Sesión">Sesión</option>
                    <option value="Evaluación">Evaluación</option>
                    <option value="Re-evaluación">Re-evaluación</option>
                    <option value="Devolución">Devolución</option>
                    <option value="Reunión con colegio">Reunión con colegio</option>
                    <option value="Supervisión">Supervisión</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {formData.tipo_sesion === 'Supervisión' ? 'Supervisora *' : 'Paciente *'}
                  </label>
                  {formData.tipo_sesion === 'Supervisión' ? (
                    <select
                      value={formData.supervisora_id || ''}
                      onChange={(e) => handleInputChange('supervisora_id', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${errors.supervisora_id ? 'border-red-500' : 'border-gray-300'
                        }`}
                    >
                      <option value="">Seleccionar supervisora...</option>
                      {supervisoras.map(supervisora => (
                        <option key={supervisora.id} value={supervisora.id}>
                          {supervisora.nombre_apellido}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={formData.paciente_id || ''}
                      onChange={(e) => handleInputChange('paciente_id', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${errors.paciente_id ? 'border-red-500' : 'border-gray-300'
                        }`}
                    >
                      <option value="">Seleccionar paciente...</option>
                      {pacientes.filter(p => p.activo).map(paciente => (
                        <option key={paciente.id} value={paciente.id}>
                          {paciente.nombre_apellido}
                        </option>
                      ))}
                    </select>
                  )}
                  {(errors.supervisora_id || errors.paciente_id) && (
                    <p className="text-red-500 text-sm mt-1">
                      {errors.supervisora_id || errors.paciente_id}
                    </p>
                  )}
                </div>
              </div>

              {/* ✅ SECCIÓN DE ACOMPAÑAMIENTO - Solo para tipos específicos */}
              {tiposConAcompanamiento.includes(formData.tipo_sesion) && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center gap-4">
                    {/* Checkbox de acompañamiento */}
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="acompañado_supervisora"
                        checked={formData.acompañado_supervisora || false}
                        onChange={(e) => handleInputChange('acompañado_supervisora', e.target.checked)}
                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500"
                      />
                      <label
                        htmlFor="acompañado_supervisora"
                        className="ml-2 text-sm font-medium text-gray-700"
                      >
                        ¿Vas acompañada por supervisora?
                      </label>
                    </div>

                    {/* Dropdown de supervisoras - Solo si está marcado el checkbox */}
                    {formData.acompañado_supervisora && (
                      <div className="flex-1">
                        <select
                          value={formData.supervisora_acompanante_id || ''}
                          onChange={(e) => handleInputChange('supervisora_acompanante_id', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 text-sm ${errors.supervisora_acompanante_id ? 'border-red-500' : 'border-gray-300'}`}
                        >
                          <option value="">Seleccionar supervisora...</option>
                          {supervisoras.filter(s => !s.eliminado).map(supervisora => (
                            <option key={supervisora.id} value={supervisora.id}>
                              {supervisora.nombre_apellido}
                            </option>
                          ))}
                        </select>
                        {errors.supervisora_acompanante_id && (
                          <p className="text-red-500 text-xs mt-1">{errors.supervisora_acompanante_id}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Nota explicativa */}
                  <div className="mt-2 text-xs text-purple-600">
                    💡 El precio se mantiene según el paciente. La supervisora recibe el 50% a fin de mes.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fecha y Hora *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.fecha_hora || ''}
                    onChange={(e) => handleInputChange('fecha_hora', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${errors.fecha_hora ? 'border-red-500' : 'border-gray-300'
                      }`}
                  />
                  {errors.fecha_hora && (
                    <p className="text-red-500 text-sm mt-1">{errors.fecha_hora}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Duración (horas) *
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="8"
                      value={formData.duracion_horas || 1}
                      onChange={(e) => handleInputChange('duracion_horas', parseFloat(e.target.value))}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Precio por Hora *
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="number"
                      value={formData.precio_por_hora || ''}
                      onChange={(e) => handleInputChange('precio_por_hora', parseFloat(e.target.value))}
                      className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 ${errors.precio_por_hora ? 'border-red-500' : 'border-gray-300'
                        }`}
                      placeholder="15000"
                    />
                  </div>
                  {errors.precio_por_hora && (
                    <p className="text-red-500 text-sm mt-1">{errors.precio_por_hora}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estado de la Sesión
                </label>
                <select
                  value={formData.estado || 'Pendiente'}
                  onChange={(e) => handleInputChange('estado', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="Pendiente">Pendiente</option>
                  <option value="Realizada">Realizada</option>
                  {formData.tipo_sesion === 'Supervisión' ? (
                    <option value="Cancelada">Cancelada</option>
                  ) : (
                    <>
                      <option value="Cancelada con antelación">Cancelada con antelación</option>
                      <option value="Cancelada sin antelación">Cancelada sin antelación</option>
                      <option value="Cancelada por mí">Cancelada por mí</option>
                    </>
                  )}
                </select>

                {/* Información sobre facturación según el estado */}
                <div className="mt-2 text-sm">
                  {formData.estado === 'Realizada' && (
                    <div className="text-green-600 flex items-center gap-1">
                      <DollarSign size={14} />
                      Se factura: ${((formData.precio_por_hora || 0) * (formData.duracion_horas || 1)).toLocaleString()}
                      {/* Mostrar info de supervisora si aplica */}
                      {tiposConAcompanamiento.includes(formData.tipo_sesion) && formData.acompañado_supervisora && (
                        <span className="text-purple-600 ml-2">
                          (Supervisora: ${(((formData.precio_por_hora || 0) * (formData.duracion_horas || 1)) / 2).toLocaleString()})
                        </span>
                      )}
                    </div>
                  )}
                  {formData.estado === 'Cancelada sin antelación' && (
                    <div className="text-orange-600 flex items-center gap-1">
                      <DollarSign size={14} />
                      Se factura: ${((formData.precio_por_hora || 0) * (formData.duracion_horas || 1)).toLocaleString()}
                      {tiposConAcompanamiento.includes(formData.tipo_sesion) && formData.acompañado_supervisora && (
                        <span className="text-purple-600 ml-2">
                          (Supervisora: ${(((formData.precio_por_hora || 0) * (formData.duracion_horas || 1)) / 2).toLocaleString()})
                        </span>
                      )}
                    </div>
                  )}
                  {(formData.estado === 'Cancelada con antelación' || formData.estado === 'Cancelada por mí' || formData.estado === 'Cancelada') && (
                    <div className="text-gray-600">
                      No se factura
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Botones de acción */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary text-white px-6 py-2 rounded-lg flex items-center gap-2"
            >
              <Save size={16} />
              {type.includes('add') ? 'Crear' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Modal;