import React, { useState, useEffect } from 'react';
import { X, Save, DollarSign, Calendar, Building, Users, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';

const MobileModalSalida = ({
  isOpen,
  onClose,
  supervisoras,
  alquilerConfig,
  onSave,
  tipoCambio
}) => {
  const [formData, setFormData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    concepto: '',
    destinatario: '',
    supervisora_id: null,
    metodo: 'Transferencia',
    monto_ars: '',
    tipo_cambio: tipoCambio,
    comprobante_url: '',
    facturado: false,
    factura_url: ''
  });

  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [uploading, setUploading] = useState(false);
  const [saldoInfo, setSaldoInfo] = useState({ saldoActual: 0, nuevoSaldo: 0 });
  const [loadingSaldo, setLoadingSaldo] = useState(false);

  const initializeForm = () => {
    setFormData({
      fecha: new Date().toISOString().split('T')[0],
      concepto: '',
      destinatario: '',
      supervisora_id: null,
      metodo: 'Transferencia',
      monto_ars: '',
      tipo_cambio: tipoCambio,
      comprobante_url: '',
      facturado: false,
      factura_url: ''
    });
  };

  useEffect(() => {
    if (isOpen) {
      initializeForm();
      setCurrentStep(1);
      setErrors({});
      setSaldoInfo({ saldoActual: 0, nuevoSaldo: 0 });
    }
  }, [isOpen, supervisoras, alquilerConfig, tipoCambio]);

  // Calcular saldo según el concepto (simplificado para mobile)
  const calcularSaldo = async (concepto, supervisoraId = null) => {
    try {
      setLoadingSaldo(true);
      
      if (concepto === 'Alquiler') {
        // Simplificación: usar precio mensual como saldo pendiente
        const saldoAlquiler = alquilerConfig?.precio_mensual || 0;
        setSaldoInfo({ saldoActual: saldoAlquiler, nuevoSaldo: saldoAlquiler });
        
        if (saldoAlquiler > 0) {
          setFormData(prev => ({ ...prev, monto_ars: saldoAlquiler.toString() }));
        }
      } else if (concepto === 'Supervisión' && supervisoraId) {
        // Simplificación: asumir saldo pendiente
        setSaldoInfo({ saldoActual: 0, nuevoSaldo: 0 });
      }
    } catch (error) {
      console.error('Error calculando saldo:', error);
      setSaldoInfo({ saldoActual: 0, nuevoSaldo: 0 });
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
  };

  const handleConceptoChange = (concepto) => {
    let newData = { ...formData, concepto };

    if (concepto === 'Alquiler') {
      newData.destinatario = alquilerConfig?.destinatario_default || 'Propietario Consultorio';
      newData.supervisora_id = null;
      newData.monto_ars = '';
      calcularSaldo('Alquiler');
    } else if (concepto === 'Supervisión') {
      newData.destinatario = '';
      newData.monto_ars = '';
      if (supervisoras.length === 1) {
        newData.supervisora_id = supervisoras[0].id;
        newData.destinatario = supervisoras[0].nombre_apellido;
      }
      setSaldoInfo({ saldoActual: 0, nuevoSaldo: 0 });
    } else {
      newData.destinatario = '';
      newData.supervisora_id = null;
      newData.monto_ars = '';
      setSaldoInfo({ saldoActual: 0, nuevoSaldo: 0 });
    }

    setFormData(newData);
  };

  const handleSupervisoraChange = (supervisoraId) => {
    const supervisora = supervisoras.find(s => s.id === supervisoraId);
    setFormData(prev => ({
      ...prev,
      supervisora_id: supervisoraId,
      destinatario: supervisora?.nombre_apellido || '',
      monto_ars: ''
    }));

    if (supervisoraId) {
      calcularSaldo('Supervisión', supervisoraId);
    }
  };

  const uploadFile = async (file) => {
    try {
      setUploading(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `comprobante-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('comprobantes-salidas')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('comprobantes-salidas')
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
      if (!formData.concepto) newErrors.concepto = 'Concepto requerido';
      if (!formData.fecha) newErrors.fecha = 'Fecha requerida';
    }

    if (currentStep === 2) {
      if (formData.concepto === 'Supervisión' && !formData.supervisora_id) {
        newErrors.supervisora_id = 'Supervisora requerida';
      }
      if (!formData.destinatario) newErrors.destinatario = 'Destinatario requerido';
    }

    if (currentStep === 3) {
      if (!formData.monto_ars || formData.monto_ars <= 0) {
        newErrors.monto_ars = 'Monto válido requerido';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, 4));
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

  const totalSteps = 4;
  const supervisionrasActivas = supervisoras.filter(s => !s.eliminado);

  return (
    <div className="lg:hidden fixed inset-0 z-50 bg-black bg-opacity-50">
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[90vh] overflow-hidden animate-slide-up">
        
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-red-600 to-red-700 text-white p-4 rounded-t-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <DollarSign size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold">Nueva Salida</h2>
                <p className="text-red-200 text-sm">Paso {currentStep} de {totalSteps}</p>
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
            {[1, 2, 3, 4].map(step => (
              <div
                key={step}
                className={`flex-1 h-2 rounded-full transition-all duration-300 ${
                  step <= currentStep ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto pb-20" style={{ maxHeight: 'calc(90vh - 140px)' }}>

          {/* STEP 1: Concepto y Fecha */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-800 mb-6">¿Qué tipo de gasto vas a registrar?</h3>

              <div>
                <div className="space-y-3">
                  {[
                    { value: 'Alquiler', icon: <Building size={24} />, desc: 'Pago del consultorio', color: 'orange' },
                    { value: 'Supervisión', icon: <Users size={24} />, desc: 'Pago a supervisora', color: 'purple' },
                    { value: 'Otro', icon: <DollarSign size={24} />, desc: 'Otro tipo de gasto', color: 'gray' }
                  ].map(concepto => (
                    <button
                      key={concepto.value}
                      onClick={() => handleConceptoChange(concepto.value)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                        formData.concepto === concepto.value
                          ? `border-${concepto.color}-500 bg-${concepto.color}-50 shadow-lg`
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 bg-${concepto.color}-100 rounded-full flex items-center justify-center`}>
                          {concepto.icon}
                        </div>
                        <div>
                          <div className="font-bold text-gray-800">{concepto.value}</div>
                          <div className="text-sm text-gray-600">{concepto.desc}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                {errors.concepto && (
                  <p className="text-red-500 text-sm">{errors.concepto}</p>
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
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-red-500 text-lg ${
                    errors.fecha ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {errors.fecha && (
                  <p className="text-red-500 text-sm mt-1">{errors.fecha}</p>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Destinatario */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-800 mb-6">¿A quién le pagaste?</h3>

              {formData.concepto === 'Supervisión' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Supervisora</label>
                  <div className="space-y-3">
                    {supervisionrasActivas.map(supervisora => (
                      <button
                        key={supervisora.id}
                        onClick={() => handleSupervisoraChange(supervisora.id)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                          formData.supervisora_id === supervisora.id
                            ? 'border-purple-500 bg-purple-50 shadow-lg'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                            <Users size={20} className="text-purple-600" />
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-gray-800">{supervisora.nombre_apellido}</div>
                            <div className="text-sm text-gray-600">${supervisora.precio_por_hora.toLocaleString()}/hora</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  {errors.supervisora_id && (
                    <p className="text-red-500 text-sm">{errors.supervisora_id}</p>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Destinatario</label>
                  <input
                    type="text"
                    value={formData.destinatario}
                    onChange={(e) => handleInputChange('destinatario', e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-red-500 text-lg ${
                      errors.destinatario ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Nombre del destinatario"
                  />
                  {errors.destinatario && (
                    <p className="text-red-500 text-sm mt-1">{errors.destinatario}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Monto y Método */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-gray-800 mb-6">¿Cuánto y cómo pagaste?</h3>

              {/* Información de saldo si aplica */}
              {(formData.concepto === 'Alquiler' || formData.concepto === 'Supervisión') && saldoInfo.saldoActual > 0 && (
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h4 className="font-medium text-orange-800 mb-2">Saldo Pendiente</h4>
                  <div className="text-sm">
                    <span className="text-orange-700">Debe: </span>
                    <span className="font-bold text-red-600">
                      ${saldoInfo.saldoActual.toLocaleString()}
                    </span>
                  </div>
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
                          ? 'border-red-500 bg-red-50 text-red-700'
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
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-red-500 text-lg ${
                    errors.monto_ars ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="50000"
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
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="text-center">
                  <div className="text-sm text-red-700 mb-1">Total del pago</div>
                  <div className="text-2xl font-bold text-red-800">
                    -${(formData.monto_ars || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Comprobante */}
          {currentStep === 4 && (
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
                    ¿Tiene factura?
                  </label>
                </div>

                {formData.facturado && (
                  <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">
                      La factura se emite a nombre de <strong>Victoria Güemes</strong> por parte de <strong>{formData.destinatario}</strong>
                    </p>
                  </div>
                )}
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
                className="flex-1 py-3 px-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-medium hover:from-red-700 hover:to-red-800 transition-all shadow-lg"
              >
                Siguiente
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-medium hover:from-red-700 hover:to-red-800 transition-all shadow-lg flex items-center justify-center gap-2"
                disabled={uploading}
              >
                <Save size={18} />
                Guardar Salida
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileModalSalida;