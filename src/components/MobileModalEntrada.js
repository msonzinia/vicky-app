import React, { useState, useEffect } from 'react';
import { X, Save, DollarSign, Calendar, User, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';

const MobileModalEntrada = ({
  isOpen,
  onClose,
  pacientes,
  onSave,
  tipoCambio
}) => {
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    paciente_id: '',
    metodo: 'Transferencia',
    monto_ars: '',
    tipo_cambio: tipoCambio,
    comprobante_url: '',
    facturado: false,
    factura_url: '',
    factura_a_nombre: '',
    factura_cuil: '',
    facturador: 'Victoria Güemes'
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [uploading, setUploading] = useState(false);
  const [saldoPaciente, setSaldoPaciente] = useState(0);
  const [loadingSaldo, setLoadingSaldo] = useState(false);

  // 🚀 NUEVO: Prevenir scroll del body cuando modal está abierto
  useEffect(() => {
    if (isOpen) {
      // Prevenir scroll del body
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${window.scrollY}px`;
    } else {
      // Restaurar scroll del body
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      if (scrollY) {
        window.scrollTo(0, parseInt(scrollY || '0') * -1);
      }
    }

    return () => {
      // Cleanup al desmontar
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
    };
  }, [isOpen]);

  const initializeForm = () => {
    const pacientesActivos = pacientes.filter(p => p.activo);
    setFormData({
      fecha: new Date().toISOString().split('T')[0],
      paciente_id: pacientesActivos.length === 1 ? pacientesActivos[0].id : '',
      metodo: 'Transferencia',
      monto_ars: pacientesActivos.length === 1 ? pacientesActivos[0].precio_por_hora.toString() : '',
      tipo_cambio: tipoCambio,
      comprobante_url: '',
      facturado: false,
      factura_url: '',
      factura_a_nombre: pacientesActivos.length === 1 ? pacientesActivos[0].nombre_apellido_tutor : '',
      factura_cuil: pacientesActivos.length === 1 ? pacientesActivos[0].cuil : '',
      facturador: 'Victoria Güemes'
    });
  };

  useEffect(() => {
    if (isOpen) {
      initializeForm();
      setCurrentStep(1);
      setErrors({});
      setSaldoPaciente(0);
    }
  }, [isOpen, pacientes, tipoCambio]);

  // 🚀 FUNCIÓN EXACTA del desktop: Calcular saldo usando la view
  const calcularSaldoPaciente = async (pacienteId) => {
    if (!pacienteId) return;
    
    try {
      setLoadingSaldo(true);
      console.log('💰 Calculando saldo del paciente:', pacienteId);

      // Usar la misma lógica que EntradaSView para calcular mesHasta
      const hoy = new Date();
      const diaDelMes = hoy.getDate();
      let mesHasta;
      if (diaDelMes <= 15) {
        mesHasta = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      } else {
        mesHasta = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      }

      const año = mesHasta.getFullYear();
      const mes = mesHasta.getMonth() + 1;

      const { data, error } = await supabase
        .from('resumen_facturacion_mensual')
        .select('total_final, debug_sesiones_anteriores, debug_pagos_totales')
        .eq('paciente_id', pacienteId)
        .eq('año', año)
        .eq('mes', mes)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const saldoCalculado = data?.total_final || 0;
      console.log('💰 Saldo calculado:', {
        pacienteId,
        hasta: `${año}-${mes}`,
        saldo: saldoCalculado
      });

      setSaldoPaciente(saldoCalculado);

      // Auto-completar monto si hay saldo positivo
      if (saldoCalculado > 0) {
        setFormData(prev => ({ ...prev, monto_ars: saldoCalculado.toString() }));
      }

    } catch (error) {
      console.error('Error calculando saldo:', error);
      setSaldoPaciente(0);
    } finally {
      setLoadingSaldo(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }

    if (field === 'paciente_id' && value) {
      const paciente = pacientes.find(p => p.id === value);
      if (paciente) {
        setFormData(prev => ({
          ...prev,
          factura_a_nombre: paciente.nombre_apellido_tutor || '',
          factura_cuil: paciente.cuil || ''
        }));
        calcularSaldoPaciente(value);
      }
    }
  };

  const uploadFile = async (file) => {
    try {
      setUploading(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `comprobante-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('comprobantes-entradas')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('comprobantes-entradas')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, comprobante_url: urlData.publicUrl }));

      if (window.showToast) {
        window.showToast('Comprobante subido exitosamente', 'success');
      }
    } catch (error) {
      console.error('Error subiendo comprobante:', error);
      alert('Error al subir comprobante: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const validateCurrentStep = () => {
    const newErrors = {};

    if (currentStep === 1) {
      if (!formData.paciente_id) newErrors.paciente_id = 'Paciente requerido';
      if (!formData.fecha) newErrors.fecha = 'Fecha requerida';
    }

    if (currentStep === 2) {
      if (!formData.monto_ars || formData.monto_ars <= 0) {
        newErrors.monto_ars = 'Monto válido requerido';
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
    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  const totalSteps = 3;
  const pacientesActivos = pacientes.filter(p => p.activo && !p.eliminado);

  return (
    <div className="lg:hidden fixed inset-0 z-50 bg-black bg-opacity-50">
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[90vh] flex flex-col animate-slide-up">
        
        {/* Header fijo */}
        <div className="flex-shrink-0 bg-gradient-to-r from-green-600 to-green-700 text-white p-4 rounded-t-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <DollarSign size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold">Nueva Entrada</h2>
                <p className="text-green-200 text-sm">Paso {currentStep} de {totalSteps}</p>
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
                className={`flex-1 h-2 rounded-full transition-all duration-300 ${
                  step <= currentStep ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* 🚀 CONTENIDO CON SCROLL CORRECTO */}
        <div 
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ 
            WebkitOverflowScrolling: 'touch',
            maxHeight: 'calc(90vh - 140px - 80px)' // Altura máxima menos header y footer
          }}
        >
          <div className="p-6 space-y-6 pb-4">

            {/* STEP 1: Paciente y Fecha */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-gray-800 mb-6">¿De qué paciente es el pago?</h3>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <User size={16} />
                    Paciente
                  </label>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {pacientesActivos.map(paciente => (
                      <button
                        key={paciente.id}
                        onClick={() => handleInputChange('paciente_id', paciente.id)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                          formData.paciente_id === paciente.id
                            ? 'border-green-500 bg-green-50 shadow-lg'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm"
                            style={{ backgroundColor: paciente.color }}
                          >
                            {paciente.nombre_apellido.split(' ').map(n => n.charAt(0)).join('').slice(0, 2)}
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-gray-800">{paciente.nombre_apellido}</div>
                            <div className="text-sm text-gray-600">
                              {paciente.nombre_apellido_tutor && (
                                <span>Tutor: {paciente.nombre_apellido_tutor}</span>
                              )}
                            </div>
                            <div className="text-xs text-green-600 font-medium">
                              ${paciente.precio_por_hora.toLocaleString()}/sesión
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  {errors.paciente_id && (
                    <p className="text-red-500 text-sm">{errors.paciente_id}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Calendar size={16} />
                    Fecha del Pago
                  </label>
                  <input
                    type="date"
                    value={formData.fecha}
                    onChange={(e) => handleInputChange('fecha', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 text-lg ${
                      errors.fecha ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.fecha && (
                    <p className="text-red-500 text-sm mt-1">{errors.fecha}</p>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2: Monto y Método */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-800 mb-6">¿Cuánto y cómo pagó?</h3>

                {/* 🎯 MOSTRAR INFO DEL PACIENTE SELECCIONADO */}
                {formData.paciente_id && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    {(() => {
                      const paciente = pacientes.find(p => p.id === formData.paciente_id);
                      return (
                        <div>
                          <h4 className="font-medium text-green-800 mb-2">
                            📋 {paciente?.nombre_apellido}
                          </h4>
                          <div className="text-sm text-green-700">
                            <span>Precio por sesión: </span>
                            <span className="font-bold">
                              ${paciente?.precio_por_hora.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Método de Pago</label>
                  <div className="grid grid-cols-2 gap-3">
                    {['Transferencia', 'Efectivo'].map(metodo => (
                      <button
                        key={metodo}
                        onClick={() => handleInputChange('metodo', metodo)}
                        className={`p-4 rounded-xl border-2 font-medium transition-all ${
                          formData.metodo === metodo
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {metodo}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Monto en Pesos</label>
                  <input
                    type="number"
                    value={formData.monto_ars}
                    onChange={(e) => handleInputChange('monto_ars', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 text-lg ${
                      errors.monto_ars ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="15000"
                  />
                  {formData.monto_ars && (
                    <p className="text-sm text-gray-500 mt-1">
                      Equivale a ${(formData.monto_ars / tipoCambio).toFixed(0)} USD
                    </p>
                  )}
                  {errors.monto_ars && (
                    <p className="text-red-500 text-sm mt-1">{errors.monto_ars}</p>
                  )}
                </div>

                {/* Total visual */}
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="text-center">
                    <div className="text-sm text-green-700 mb-1">Total del pago</div>
                    <div className="text-2xl font-bold text-green-800">
                      ${(formData.monto_ars || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Comprobante y Facturación */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-800 mb-6">Documentación</h3>

                {/* Comprobante */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">¿Tiene comprobante?</label>
                    <div className="flex items-center gap-4">
                      {formData.comprobante_url ? (
                        <div className="flex items-center gap-2">
                          <span className="text-green-600 text-sm">✓ Subido</span>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, comprobante_url: '' }))}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2">
                          <Upload size={16} />
                          {uploading ? 'Subiendo...' : 'Subir'}
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0])}
                            className="hidden"
                            disabled={uploading}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                </div>

                {/* Facturación */}
                <div className="space-y-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="facturado"
                      checked={formData.facturado}
                      onChange={(e) => handleInputChange('facturado', e.target.checked)}
                      className="mr-3 w-4 h-4"
                    />
                    <label htmlFor="facturado" className="text-sm font-medium text-gray-700">
                      ¿Necesita factura?
                    </label>
                  </div>

                  {formData.facturado && (
                    <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Factura a nombre de</label>
                        <input
                          type="text"
                          value={formData.factura_a_nombre}
                          onChange={(e) => handleInputChange('factura_a_nombre', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                          placeholder="Nombre del tutor"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">CUIL</label>
                        <input
                          type="text"
                          value={formData.factura_cuil}
                          onChange={(e) => handleInputChange('factura_cuil', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                          placeholder="20-12345678-9"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer fijo */}
        <div className="flex-shrink-0 bg-white border-t border-gray-200 p-4">
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
                className="flex-1 py-3 px-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-medium hover:from-green-700 hover:to-green-800 transition-all shadow-lg"
              >
                Siguiente
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-medium hover:from-green-700 hover:to-green-800 transition-all shadow-lg flex items-center justify-center gap-2"
                disabled={uploading}
              >
                <Save size={18} />
                Guardar Entrada
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileModalEntrada;