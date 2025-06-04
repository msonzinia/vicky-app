import React, { useState, useEffect, useCallback } from 'react';
import { X, Save, Plus, Clock, DollarSign, Calendar, UserCheck } from 'lucide-react';

const MobileModal = ({
  isOpen,
  onClose,
  pacientes,
  supervisoras,
  onSave,
  fechaPrecargada
}) => {
  const [formData, setFormData] = useState({
    tipo_sesion: 'Sesión',
    paciente_id: '',
    supervisora_id: '',
    fecha_hora: '',
    precio_por_hora: '',
    duracion_horas: 1,
    estado: 'Pendiente',
    acompañado_supervisora: false,
    supervisora_acompanante_id: ''
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState({});

  // Tipos que permiten acompañamiento
  const tiposConAcompanamiento = ['Evaluación', 'Re-evaluación', 'Devolución', 'Reunión con colegio'];

  const initializeForm = useCallback(() => {
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
      acompañado_supervisora: false,
      supervisora_acompanante_id: ''
    });
  }, [pacientes, supervisoras, fechaPrecargada]);

  useEffect(() => {
    if (isOpen) {
      initializeForm();
      setCurrentStep(1);
      setErrors({});
    }
  }, [isOpen, initializeForm]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Limpiar error del campo
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }

    // Lógica especial para tipo de sesión
    if (field === 'tipo_sesion') {
      const pacientesActivos = pacientes.filter(p => p.activo);

      setFormData(prev => {
        let newData = {
          ...prev,
          [field]: value,
          paciente_id: '',
          supervisora_id: '',
          duracion_horas: ['Evaluación', 'Re-evaluación', 'Supervisión'].includes(value) ? 2 : 1,
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
          if (pacientesActivos.length === 1) {
            newData.paciente_id = pacientesActivos[0].id;
            newData.precio_por_hora = pacientesActivos[0].precio_por_hora;
          }
        }

        return newData;
      });
      return;
    }

    // Auto-completar precio al seleccionar paciente/supervisora
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

    // Lógica de acompañamiento
    if (field === 'acompañado_supervisora') {
      const supervisorasActivas = supervisoras.filter(s => !s.eliminado);
      setFormData(prev => ({
        ...prev,
        [field]: value,
        supervisora_acompanante_id: value && supervisorasActivas.length === 1
          ? supervisorasActivas[0].id
          : ''
      }));
    }
  };

  const validateCurrentStep = () => {
    const newErrors = {};

    if (currentStep === 1) {
      if (!formData.tipo_sesion) newErrors.tipo_sesion = 'Requerido';
    }

    if (currentStep === 2) {
      if (formData.tipo_sesion === 'Supervisión' && !formData.supervisora_id) {
        newErrors.supervisora_id = 'Supervisora requerida';
      }
      if (['Sesión', 'Evaluación', 'Re-evaluación', 'Devolución', 'Reunión con colegio'].includes(formData.tipo_sesion) && !formData.paciente_id) {
        newErrors.paciente_id = 'Paciente requerido';
      }
    }

    if (currentStep === 3) {
      if (!formData.fecha_hora) newErrors.fecha_hora = 'Fecha y hora requeridas';
      if (!formData.precio_por_hora || formData.precio_por_hora <= 0) newErrors.precio_por_hora = 'Precio válido requerido';

      if (tiposConAcompanamiento.includes(formData.tipo_sesion) &&
        formData.acompañado_supervisora &&
        !formData.supervisora_acompanante_id) {
        newErrors.supervisora_acompanante_id = 'Supervisora acompañante requerida';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = () => {
    if (!validateCurrentStep()) return;

    // Limpiar datos antes de enviar
    const cleanFormData = { ...formData };

    if (cleanFormData.tipo_sesion === 'Supervisión') {
      cleanFormData.paciente_id = null;
      cleanFormData.supervisora_acompanante_id = null;
      cleanFormData.acompañado_supervisora = false;
    } else {
      cleanFormData.supervisora_id = null;

      if (!tiposConAcompanamiento.includes(cleanFormData.tipo_sesion)) {
        cleanFormData.acompañado_supervisora = false;
        cleanFormData.supervisora_acompanante_id = null;
      } else if (!cleanFormData.acompañado_supervisora) {
        cleanFormData.supervisora_acompanante_id = null;
      }
    }

    // Asegurar tipos correctos
    cleanFormData.precio_por_hora = parseFloat(cleanFormData.precio_por_hora);
    cleanFormData.duracion_horas = parseFloat(cleanFormData.duracion_horas);

    onSave(cleanFormData);
    onClose();
  };

  if (!isOpen) return null;

  const totalSteps = 3;

  return (
    <div className="lg:hidden fixed inset-0 z-50 bg-black bg-opacity-50">
      {/* Modal que se desliza desde abajo */}
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[90vh] overflow-hidden animate-slide-up">

        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4 rounded-t-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Plus size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold">Nueva Sesión</h2>
                <p className="text-purple-200 text-sm">Paso {currentStep} de {totalSteps}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-4 flex gap-2">
            {[1, 2, 3].map(step => (
              <div
                key={step}
                className={`flex-1 h-2 rounded-full transition-all duration-300 ${step <= currentStep ? 'bg-white' : 'bg-white/30'
                  }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>

          {/* STEP 1: Tipo de sesión */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-800 mb-6">¿Qué tipo de sesión vas a crear?</h3>

              <div className="grid grid-cols-1 gap-3">
                {[
                  { value: 'Sesión', icon: '🧠', desc: 'Sesión regular con paciente' },
                  { value: 'Evaluación', icon: '📋', desc: 'Evaluación inicial (2 horas)' },
                  { value: 'Re-evaluación', icon: '📝', desc: 'Re-evaluación de seguimiento' },
                  { value: 'Devolución', icon: '🔄', desc: 'Devolución de resultados' },
                  { value: 'Reunión con colegio', icon: '🏫', desc: 'Reunión con institución' },
                  { value: 'Supervisión', icon: '👥', desc: 'Supervisión con coordinadora' }
                ].map(tipo => (
                  <button
                    key={tipo.value}
                    onClick={() => handleInputChange('tipo_sesion', tipo.value)}
                    className={`p-4 rounded-xl border-2 text-left transition-all duration-200 ${formData.tipo_sesion === tipo.value
                        ? 'border-purple-500 bg-purple-50 shadow-lg scale-[1.02]'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{tipo.icon}</div>
                      <div>
                        <div className="font-bold text-gray-800">{tipo.value}</div>
                        <div className="text-sm text-gray-600">{tipo.desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {errors.tipo_sesion && (
                <p className="text-red-500 text-sm">{errors.tipo_sesion}</p>
              )}
            </div>
          )}

          {/* STEP 2: Seleccionar persona */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-800 mb-6">
                {formData.tipo_sesion === 'Supervisión' ? '¿Con qué supervisora?' : '¿Con qué paciente?'}
              </h3>

              <div className="space-y-3">
                {formData.tipo_sesion === 'Supervisión' ? (
                  supervisoras.map(supervisora => (
                    <button
                      key={supervisora.id}
                      onClick={() => handleInputChange('supervisora_id', supervisora.id)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${formData.supervisora_id === supervisora.id
                          ? 'border-purple-500 bg-purple-50 shadow-lg'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                          <UserCheck size={20} className="text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-gray-800">{supervisora.nombre_apellido}</div>
                          <div className="text-sm text-gray-600">${supervisora.precio_por_hora.toLocaleString()}/hora</div>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  pacientes.filter(p => p.activo).map(paciente => (
                    <button
                      key={paciente.id}
                      onClick={() => handleInputChange('paciente_id', paciente.id)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${formData.paciente_id === paciente.id
                          ? 'border-purple-500 bg-purple-50 shadow-lg'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: paciente.color }}
                        >
                          {paciente.nombre_apellido.split(' ').map(n => n.charAt(0)).join('').slice(0, 2)}
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-gray-800">{paciente.nombre_apellido}</div>
                          <div className="text-sm text-gray-600">
                            ${paciente.precio_por_hora.toLocaleString()}/hora
                            {paciente.nombre_apellido_tutor && (
                              <span className="ml-2">• {paciente.nombre_apellido_tutor}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {(errors.supervisora_id || errors.paciente_id) && (
                <p className="text-red-500 text-sm">
                  {errors.supervisora_id || errors.paciente_id}
                </p>
              )}
            </div>
          )}

          {/* STEP 3: Detalles */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-800 mb-6">Detalles de la sesión</h3>

              {/* Fecha y hora */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Calendar size={16} />
                  Fecha y Hora
                </label>
                <input
                  type="datetime-local"
                  value={formData.fecha_hora || ''}
                  onChange={(e) => handleInputChange('fecha_hora', e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 text-lg ${errors.fecha_hora ? 'border-red-500' : 'border-gray-300'
                    }`}
                />
                {errors.fecha_hora && (
                  <p className="text-red-500 text-sm mt-1">{errors.fecha_hora}</p>
                )}
              </div>

              {/* Duración y precio */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Clock size={16} />
                    Duración
                  </label>
                  <select
                    value={formData.duracion_horas || 1}
                    onChange={(e) => handleInputChange('duracion_horas', parseFloat(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 text-lg"
                  >
                    <option value={0.5}>30 min</option>
                    <option value={1}>1 hora</option>
                    <option value={1.5}>1.5 horas</option>
                    <option value={2}>2 horas</option>
                    <option value={2.5}>2.5 horas</option>
                    <option value={3}>3 horas</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <DollarSign size={16} />
                    Precio/hora
                  </label>
                  <input
                    type="number"
                    value={formData.precio_por_hora || ''}
                    onChange={(e) => handleInputChange('precio_por_hora', parseFloat(e.target.value))}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 text-lg ${errors.precio_por_hora ? 'border-red-500' : 'border-gray-300'
                      }`}
                    placeholder="15000"
                  />
                  {errors.precio_por_hora && (
                    <p className="text-red-500 text-sm mt-1">{errors.precio_por_hora}</p>
                  )}
                </div>
              </div>

              {/* Acompañamiento */}
              {tiposConAcompanamiento.includes(formData.tipo_sesion) && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="checkbox"
                      id="acompanamiento"
                      checked={formData.acompañado_supervisora || false}
                      onChange={(e) => handleInputChange('acompañado_supervisora', e.target.checked)}
                      className="w-5 h-5 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <label htmlFor="acompanamiento" className="text-sm font-medium text-gray-700">
                      ¿Vas acompañada por supervisora?
                    </label>
                  </div>

                  {formData.acompañado_supervisora && (
                    <div className="space-y-2">
                      {supervisoras.filter(s => !s.eliminado).map(supervisora => (
                        <button
                          key={supervisora.id}
                          onClick={() => handleInputChange('supervisora_acompanante_id', supervisora.id)}
                          className={`w-full p-3 rounded-lg border text-left transition-colors ${formData.supervisora_acompanante_id === supervisora.id
                              ? 'border-purple-500 bg-purple-100'
                              : 'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                          <div className="font-medium text-gray-800">{supervisora.nombre_apellido}</div>
                          <div className="text-sm text-gray-600">Recibe 50% del total</div>
                        </button>
                      ))}
                    </div>
                  )}

                  {errors.supervisora_acompanante_id && (
                    <p className="text-red-500 text-sm mt-2">{errors.supervisora_acompanante_id}</p>
                  )}
                </div>
              )}

              {/* Total estimado */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="text-center">
                  <div className="text-sm text-green-700 mb-1">Total de la sesión</div>
                  <div className="text-2xl font-bold text-green-800">
                    ${((formData.precio_por_hora || 0) * (formData.duracion_horas || 1)).toLocaleString()}
                  </div>
                  {formData.acompañado_supervisora && tiposConAcompanamiento.includes(formData.tipo_sesion) && (
                    <div className="text-sm text-purple-600 mt-1">
                      Supervisora: ${(((formData.precio_por_hora || 0) * (formData.duracion_horas || 1)) / 2).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
          <div className="flex gap-3">
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                className="flex-1 py-3 px-4 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Atrás
              </button>
            )}

            {currentStep < totalSteps ? (
              <button
                onClick={handleNext}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-medium hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg"
              >
                Siguiente
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-medium hover:from-green-700 hover:to-green-800 transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <Save size={18} />
                Crear Sesión
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileModal;