import React, { useState, useEffect } from 'react';
import { Home, DollarSign, Save, Edit3, Calendar, TrendingUp, Building } from 'lucide-react';
import { supabase } from '../lib/supabase';

const AlquilerView = ({ currencyMode, tipoCambio }) => {
  const [config, setConfig] = useState({
    precio_mensual: 50000,
    destinatario_default: 'Propietario Consultorio'
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Cargar configuración actual
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('configuracion_alquiler')
        .select('*')
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error;
      }

      if (data) {
        setConfig(data);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Verificar si ya existe una configuración
      const { data: existingData } = await supabase
        .from('configuracion_alquiler')
        .select('id')
        .limit(1)
        .single();

      if (existingData) {
        // Actualizar existente
        const { error } = await supabase
          .from('configuracion_alquiler')
          .update({
            precio_mensual: config.precio_mensual,
            destinatario_default: config.destinatario_default
          })
          .eq('id', existingData.id);

        if (error) throw error;
      } else {
        // Crear nuevo
        const { error } = await supabase
          .from('configuracion_alquiler')
          .insert([{
            precio_mensual: config.precio_mensual,
            destinatario_default: config.destinatario_default
          }]);

        if (error) throw error;
      }

      setIsEditing(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000); // Ocultar después de 3 segundos
    } catch (error) {
      console.error('Error saving config:', error);
      alert('Error al guardar la configuración: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount, currency = currencyMode) => {
    if (currency === 'USD') {
      return `$${(amount / tipoCambio).toFixed(0)} USD`;
    }
    return `$${amount.toLocaleString()} ARS`;
  };

  const getYearlyTotal = () => config.precio_mensual * 12;
  const getQuarterlyTotal = () => config.precio_mensual * 3;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notificación de éxito */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-up">
          <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
            <span className="text-green-500 text-sm">✓</span>
          </div>
          <span className="font-medium">Configuración guardada exitosamente</span>
        </div>
      )}

      {/* Header con acciones */}
      <div className="glass-effect p-6 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-700 rounded-xl flex items-center justify-center shadow-lg">
              <Home className="text-white" size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-800">Configuración de Alquiler</h2>
              <p className="text-gray-600">Gestiona el costo mensual del consultorio</p>
            </div>
          </div>

          <div className="flex gap-2">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="btn-primary text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Edit3 size={16} />
                Editar
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    loadConfig(); // Resetear cambios
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-success text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Save size={16} />
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Configuración principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Precio mensual */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <DollarSign className="text-green-600" size={20} />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">Precio Mensual</h3>
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="number"
                  value={config.precio_mensual}
                  onChange={(e) => setConfig(prev => ({
                    ...prev,
                    precio_mensual: parseFloat(e.target.value) || 0
                  }))}
                  className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-lg font-semibold"
                  placeholder="50000"
                />
              </div>
              <p className="text-sm text-gray-500">
                Equivale a {formatCurrency(config.precio_mensual, currencyMode === 'ARS' ? 'USD' : 'ARS')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-3xl font-bold text-green-600">
                {formatCurrency(config.precio_mensual)}
              </div>
              <p className="text-gray-600">
                Equivale a {formatCurrency(config.precio_mensual, currencyMode === 'ARS' ? 'USD' : 'ARS')}
              </p>
            </div>
          )}
        </div>

        {/* Destinatario */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building className="text-blue-600" size={20} />
            </div>
            <h3 className="text-lg font-semibold text-gray-800">Destinatario</h3>
          </div>

          {isEditing ? (
            <input
              type="text"
              value={config.destinatario_default}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                destinatario_default: e.target.value
              }))}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="Nombre del propietario"
            />
          ) : (
            <div className="text-lg font-medium text-gray-800">
              {config.destinatario_default}
            </div>
          )}

          <p className="text-sm text-gray-500 mt-2">
            Nombre por defecto para los pagos de alquiler
          </p>
        </div>
      </div>

      {/* Proyecciones */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <TrendingUp className="text-purple-600" size={20} />
          </div>
          <h3 className="text-lg font-semibold text-gray-800">Proyecciones de Gasto</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {formatCurrency(getQuarterlyTotal())}
            </div>
            <div className="text-sm text-blue-700 font-medium">Trimestral</div>
            <div className="text-xs text-blue-600 mt-1">3 meses</div>
          </div>

          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600 mb-1">
              {formatCurrency(config.precio_mensual * 6)}
            </div>
            <div className="text-sm text-orange-700 font-medium">Semestral</div>
            <div className="text-xs text-orange-600 mt-1">6 meses</div>
          </div>

          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {formatCurrency(getYearlyTotal())}
            </div>
            <div className="text-sm text-purple-700 font-medium">Anual</div>
            <div className="text-xs text-purple-600 mt-1">12 meses</div>
          </div>
        </div>
      </div>

      {/* Información adicional */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <Calendar className="text-gray-600" size={20} />
          </div>
          <h3 className="text-lg font-semibold text-gray-800">Información del Alquiler</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <h4 className="font-medium text-gray-800 mb-2">Impacto Mensual</h4>
            <ul className="space-y-1 text-gray-600">
              <li>• Costo fijo mensual del consultorio</li>
              <li>• Se debe considerar en el cálculo de ganancias netas</li>
              <li>• Revisar anualmente por aumentos</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium text-gray-800 mb-2">Recordatorios</h4>
            <ul className="space-y-1 text-gray-600">
              <li>• Pago típicamente el día 1 de cada mes</li>
              <li>• Mantener comprobantes para registros</li>
              <li>• Coordinar con {config.destinatario_default}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlquilerView;