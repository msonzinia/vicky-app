import React, { useState, useEffect } from 'react';
import { Plus, Search, DollarSign, Calendar, Receipt, X, Filter, SortAsc, SortDesc } from 'lucide-react';
import { supabase } from '../lib/supabase';

const EntradaSView = ({
  pacientes,
  currencyMode,
  tipoCambio
}) => {
  const [entradas, setEntradas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingEntrada, setEditingEntrada] = useState(null);
  const [tipoCambioActual, setTipoCambioActual] = useState(tipoCambio);

  // Estados para filtros
  const [filtros, setFiltros] = useState({
    fechaInicio: '',
    fechaFin: '',
    pacienteId: '',
    metodo: '',
    facturado: '',
    ordenarPor: 'fecha',
    ordenDesc: true
  });
  const [showEliminados, setShowEliminados] = useState(false);
  const [showFiltros, setShowFiltros] = useState(false);

  // 🚀 NUEVO: Estado para mostrar el mes hasta el cual se calcula saldo
  const [mesHastaSaldo, setMesHastaSaldo] = useState(null);

  // Cargar entradas y tipo de cambio al montar el componente
  useEffect(() => {
    cargarEntradas();
    obtenerTipoCambio();
    calcularMesHastaSaldo();
  }, []);

  // Recargar cuando cambie el toggle eliminados
  useEffect(() => {
    cargarEntradas();
  }, [showEliminados]);

  // 🚀 NUEVA FUNCIÓN: Calcular hasta qué mes incluir (misma lógica que FacturarView)
  const calcularMesHastaSaldo = () => {
    const hoy = new Date();
    const diaDelMes = hoy.getDate();

    let mesHasta;
    if (diaDelMes <= 15) {
      // Del 1 al 15: incluir hasta mes anterior
      mesHasta = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    } else {
      // Del 16 al 31: incluir hasta mes actual
      mesHasta = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    }

    console.log('🗓️ Calculando saldo hasta (nueva lógica 16-15):', {
      fechaHoy: hoy.toISOString().split('T')[0],
      diaDelMes,
      mesHasta: mesHasta.toISOString().split('T')[0],
      logica: diaDelMes <= 15 ? 'Hasta mes anterior (del 1-15)' : 'Hasta mes actual (del 16-31)',
      razonamiento: 'Consistente con período de ganancias 16-15 del dashboard'
    });

    setMesHastaSaldo(mesHasta);
  };

  const obtenerTipoCambio = async () => {
    try {
      const response = await fetch('https://dolarapi.com/v1/dolares/blue');
      const data = await response.json();
      if (data && data.venta) {
        setTipoCambioActual(data.venta);
      }
    } catch (error) {
      console.error('Error obteniendo tipo de cambio:', error);
    }
  };

  const cargarEntradas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pagos_recibidos')
        .select(`
          *,
          pacientes!inner (
            nombre_apellido,
            nombre_apellido_tutor,
            cuil
          )
        `)
        .eq('eliminado', showEliminados)
        .order('fecha', { ascending: false });

      if (error) throw error;
      setEntradas(data || []);
    } catch (error) {
      console.error('Error cargando entradas:', error);
      alert('Error al cargar entradas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestaurarEntrada = async (entrada) => {
    try {
      const { error } = await supabase
        .from('pagos_recibidos')
        .update({ eliminado: false })
        .eq('id', entrada.id);

      if (error) throw error;

      if (window.showToast) {
        window.showToast('Pago recibido restaurado exitosamente', 'success');
      }

      cargarEntradas();
    } catch (error) {
      console.error('Error restaurando entrada:', error);
      alert('Error al restaurar entrada: ' + error.message);
    }
  };

  const formatCurrency = (amount, currency = currencyMode) => {
    if (currency === 'USD') {
      return `$${(amount / tipoCambioActual).toFixed(0)} USD`;
    }
    return `$${amount.toLocaleString()} ARS`;
  };

  const getEntradasFiltradas = () => {
    let resultado = entradas.filter(entrada => {
      const matchText = entrada.pacientes?.nombre_apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entrada.pacientes?.nombre_apellido_tutor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entrada.metodo.toLowerCase().includes(searchTerm.toLowerCase());

      const matchFechaInicio = !filtros.fechaInicio || entrada.fecha >= filtros.fechaInicio;
      const matchFechaFin = !filtros.fechaFin || entrada.fecha <= filtros.fechaFin;
      const matchPaciente = !filtros.pacienteId || entrada.paciente_id === filtros.pacienteId;
      const matchMetodo = !filtros.metodo || entrada.metodo === filtros.metodo;
      const matchFacturado = filtros.facturado === '' ||
        (filtros.facturado === 'true' && entrada.facturado) ||
        (filtros.facturado === 'false' && !entrada.facturado);

      return matchText && matchFechaInicio && matchFechaFin && matchPaciente && matchMetodo && matchFacturado;
    });

    resultado.sort((a, b) => {
      let valorA, valorB;

      switch (filtros.ordenarPor) {
        case 'fecha':
          valorA = new Date(a.fecha);
          valorB = new Date(b.fecha);
          break;
        case 'monto':
          valorA = a.monto_ars;
          valorB = b.monto_ars;
          break;
        case 'paciente':
          valorA = a.pacientes?.nombre_apellido || '';
          valorB = b.pacientes?.nombre_apellido || '';
          break;
        default:
          return 0;
      }

      if (valorA < valorB) return filtros.ordenDesc ? 1 : -1;
      if (valorA > valorB) return filtros.ordenDesc ? -1 : 1;
      return 0;
    });

    return resultado;
  };

  const filteredEntradas = getEntradasFiltradas();

  const openModal = (entrada = null) => {
    setEditingEntrada(entrada);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingEntrada(null);
  };

  const handleEliminarEntrada = async (entrada) => {
    try {
      const { error } = await supabase
        .from('pagos_recibidos')
        .update({ eliminado: true })
        .eq('id', entrada.id);

      if (error) throw error;

      if (window.showToast) {
        window.showToast(
          'Pago recibido eliminado',
          'success',
          5000,
          async () => {
            try {
              const { error: undoError } = await supabase
                .from('pagos_recibidos')
                .update({ eliminado: false })
                .eq('id', entrada.id);

              if (undoError) throw undoError;

              cargarEntradas();
              if (window.showToast) {
                window.showToast('Pago recibido restaurado', 'success', 3000);
              }
            } catch (undoError) {
              console.error('Error al deshacer:', undoError);
              if (window.showToast) {
                window.showToast('Error al restaurar el pago', 'error');
              }
            }
          }
        );
      }

      cargarEntradas();
    } catch (error) {
      console.error('Error eliminando entrada:', error);
      alert('Error al eliminar entrada: ' + error.message);
    }
  };

  // 🔧 FUNCIÓN CORREGIDA: Filtrar solo las columnas que pertenecen a pagos_recibidos
  const handleSave = async (formData) => {
    try {
      // Filtrar solo las columnas que pertenecen a la tabla pagos_recibidos
      const dataToSave = {
        fecha: formData.fecha,
        paciente_id: formData.paciente_id,
        metodo: formData.metodo,
        monto_ars: parseFloat(formData.monto_ars),
        tipo_cambio: formData.tipo_cambio || tipoCambioActual,
        comprobante_url: formData.comprobante_url || null,
        facturado: formData.facturado || false,
        factura_url: formData.factura_url || null,
        factura_a_nombre: formData.factura_a_nombre || null,
        factura_cuil: formData.factura_cuil || null,
        facturador: formData.facturador || null
      };

      if (editingEntrada) {
        const { error } = await supabase
          .from('pagos_recibidos')
          .update(dataToSave)
          .eq('id', editingEntrada.id);

        if (error) throw error;

        if (window.showToast) {
          window.showToast('Entrada actualizada exitosamente', 'success');
        }
      } else {
        const { error } = await supabase
          .from('pagos_recibidos')
          .insert([dataToSave]);

        if (error) throw error;

        if (window.showToast) {
          window.showToast('Entrada registrada exitosamente', 'success');
        }
      }

      cargarEntradas();
      closeModal();
    } catch (error) {
      console.error('Error guardando entrada:', error);
      alert('Error al guardar entrada: ' + error.message);
    }
  };

  const limpiarFiltros = () => {
    setFiltros({
      fechaInicio: '',
      fechaFin: '',
      pacienteId: '',
      metodo: '',
      facturado: '',
      ordenarPor: 'fecha',
      ordenDesc: true
    });
    setSearchTerm('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando entradas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con búsqueda, filtros y botón agregar */}
      <div className="glass-effect p-4 lg:p-6 rounded-xl">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Buscar por paciente o método..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
              />
            </div>

            <div className="flex items-center gap-2 lg:gap-4 flex-wrap">
              <div className="text-xs lg:text-sm text-gray-600">
                <span className="font-medium">TC:</span> ${tipoCambioActual.toLocaleString()}
              </div>

              <button
                onClick={() => setShowFiltros(!showFiltros)}
                className={`px-3 lg:px-4 py-2 lg:py-3 rounded-lg flex items-center gap-2 font-medium transition-all text-sm ${showFiltros ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                <Filter size={16} />
                <span className="hidden lg:inline">Filtros</span>
              </button>

              <button
                onClick={() => setShowEliminados(!showEliminados)}
                className={`px-3 lg:px-4 py-2 lg:py-3 rounded-lg flex items-center gap-2 font-medium transition-all text-sm ${showEliminados ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                🗑️ <span className="hidden lg:inline">{showEliminados ? 'Ver Activos' : 'Ver Eliminados'}</span>
              </button>

              <button
                onClick={() => openModal()}
                className="btn-primary text-white px-4 lg:px-6 py-2 lg:py-3 rounded-xl flex items-center gap-2 font-medium shadow-lg text-sm"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Nuevo Pago</span>
              </button>
            </div>
          </div>

          {/* Panel de filtros expandible */}
          {showFiltros && (
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha desde</label>
                  <input
                    type="date"
                    value={filtros.fechaInicio}
                    onChange={(e) => setFiltros(prev => ({ ...prev, fechaInicio: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha hasta</label>
                  <input
                    type="date"
                    value={filtros.fechaFin}
                    onChange={(e) => setFiltros(prev => ({ ...prev, fechaFin: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Paciente</label>
                  <select
                    value={filtros.pacienteId}
                    onChange={(e) => setFiltros(prev => ({ ...prev, pacienteId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Todos</option>
                    {pacientes.filter(p => p.activo && !p.eliminado).map(paciente => (
                      <option key={paciente.id} value={paciente.id}>
                        {paciente.nombre_apellido}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Método</label>
                  <select
                    value={filtros.metodo}
                    onChange={(e) => setFiltros(prev => ({ ...prev, metodo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Todos</option>
                    <option value="Transferencia">Transferencia</option>
                    <option value="Efectivo">Efectivo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Facturado</label>
                  <select
                    value={filtros.facturado}
                    onChange={(e) => setFiltros(prev => ({ ...prev, facturado: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Todos</option>
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ordenar por</label>
                  <div className="flex gap-1">
                    <select
                      value={filtros.ordenarPor}
                      onChange={(e) => setFiltros(prev => ({ ...prev, ordenarPor: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="fecha">Fecha</option>
                      <option value="monto">Monto</option>
                      <option value="paciente">Paciente</option>
                    </select>
                    <button
                      onClick={() => setFiltros(prev => ({ ...prev, ordenDesc: !prev.ordenDesc }))}
                      className="px-2 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                    >
                      {filtros.ordenDesc ? <SortDesc size={16} /> : <SortAsc size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <button
                  onClick={limpiarFiltros}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
                >
                  Limpiar filtros
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contador de resultados */}
      {(searchTerm || Object.values(filtros).some(v => v && v !== 'fecha' && v !== true)) && (
        <div className="text-sm text-gray-600 px-2">
          Mostrando {filteredEntradas.length} de {entradas.length} entradas
        </div>
      )}

      {/* ✨ Lista de entradas - COMPACTA */}
      <div className="grid gap-2 lg:gap-4">
        {filteredEntradas.map(entrada => (
          <div key={entrada.id} className="card p-3 lg:p-4 hover-lift transition-all duration-300">
            <div className="flex items-center gap-3 lg:gap-4">
              {/* Ícono - más pequeño en mobile */}
              <div className="w-8 h-8 lg:w-12 lg:h-12 bg-gradient-to-br from-green-500 to-green-700 rounded-lg lg:rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                <DollarSign className="text-white" size={16} />
              </div>

              {/* Información principal - layout mejorado */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm lg:text-lg font-bold text-gray-800 truncate">
                      {entrada.pacientes?.nombre_apellido || 'Paciente no encontrado'}
                    </h3>

                    {/* Info secundaria en mobile más compacta */}
                    <div className="lg:hidden text-xs text-gray-500 space-y-1 mt-1">
                      <div>{entrada.pacientes?.nombre_apellido_tutor}</div>
                      <div className="flex items-center gap-3">
                        <span>{new Date(entrada.fecha).toLocaleDateString('es-AR')}</span>
                        <span>{entrada.metodo}</span>
                      </div>
                    </div>

                    {/* Info desktop */}
                    <div className="hidden lg:block space-y-1">
                      <p className="text-gray-600 text-sm">
                        <span className="font-medium">Tutor:</span> {entrada.pacientes?.nombre_apellido_tutor}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          <span>{new Date(entrada.fecha).toLocaleDateString('es-AR')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Receipt size={14} />
                          <span>{entrada.metodo}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Monto y badges */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg lg:text-2xl font-bold text-green-600">
                      {formatCurrency(entrada.monto_ars)}
                    </div>
                    <div className="text-xs lg:text-sm text-gray-500">
                      (${(entrada.monto_ars / tipoCambioActual).toFixed(0)} USD)
                    </div>

                    {/* Badges más compactos */}
                    <div className="flex items-center gap-1 mt-1 lg:mt-2 justify-end flex-wrap">
                      {entrada.facturado && (
                        <span className="px-1.5 lg:px-2 py-0.5 lg:py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                          Fact.
                        </span>
                      )}
                      {entrada.comprobante_url && (
                        <span className="px-1.5 lg:px-2 py-0.5 lg:py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                          Comp.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Botones de acción - más compactos */}
            <div className="mt-2 lg:mt-4 pt-2 lg:pt-4 border-t border-gray-200 flex justify-end gap-1 lg:gap-2">
              {!showEliminados ? (
                <>
                  <button
                    onClick={() => openModal(entrada)}
                    className="px-2 lg:px-3 py-1 lg:py-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors text-xs lg:text-sm"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleEliminarEntrada(entrada)}
                    className="px-2 lg:px-3 py-1 lg:py-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors text-xs lg:text-sm"
                  >
                    Eliminar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleRestaurarEntrada(entrada)}
                  className="px-2 lg:px-3 py-1 lg:py-1.5 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors text-xs lg:text-sm"
                >
                  Restaurar
                </button>
              )}
              {entrada.comprobante_url && (
                <a
                  href={entrada.comprobante_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 lg:px-3 py-1 lg:py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-xs lg:text-sm"
                >
                  <span className="hidden lg:inline">Ver </span>Comp.
                </a>
              )}
              {entrada.factura_url && (
                <a
                  href={entrada.factura_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 lg:px-3 py-1 lg:py-1.5 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors text-xs lg:text-sm"
                >
                  <span className="hidden lg:inline">Ver </span>Fact.
                </a>
              )}
            </div>
          </div>
        ))}

        {filteredEntradas.length === 0 && (
          <div className="text-center py-12">
            <DollarSign className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-600 mb-2">
              {searchTerm || Object.values(filtros).some(v => v && v !== 'fecha' && v !== true)
                ? 'No se encontraron entradas que coincidan con los filtros'
                : showEliminados
                  ? 'No hay pagos recibidos eliminados'
                  : 'No hay pagos recibidos registrados'}
            </h3>
            <p className="text-gray-500">
              {searchTerm || Object.values(filtros).some(v => v && v !== 'fecha' && v !== true)
                ? 'Intenta ajustar los filtros de búsqueda'
                : showEliminados
                  ? 'Los pagos eliminados aparecerán aquí'
                  : 'Registra el primer pago recibido'
              }
            </p>
          </div>
        )}
      </div>

      {/* Resumen estadístico - más compacto */}
      {filteredEntradas.length > 0 && (
        <div className="glass-effect p-4 lg:p-6 rounded-xl">
          <h3 className="text-base lg:text-lg font-bold text-gray-800 mb-3 lg:mb-4">
            Resumen {searchTerm || Object.values(filtros).some(v => v && v !== 'fecha' && v !== true) ? 'Filtrado' : 'del Mes'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
            <div className="text-center">
              <div className="text-xl lg:text-2xl font-bold text-green-600">
                {filteredEntradas.length}
              </div>
              <div className="text-xs lg:text-sm text-gray-600">Pagos recibidos</div>
            </div>

            <div className="text-center">
              <div className="text-xl lg:text-2xl font-bold text-green-600">
                {formatCurrency(
                  filteredEntradas.reduce((sum, entrada) => sum + entrada.monto_ars, 0)
                )}
              </div>
              <div className="text-xs lg:text-sm text-gray-600">Total ingresado</div>
            </div>

            <div className="text-center">
              <div className="text-xl lg:text-2xl font-bold text-blue-600">
                {filteredEntradas.filter(e => e.facturado).length}
              </div>
              <div className="text-xs lg:text-sm text-gray-600">Pagos facturados</div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para agregar/editar entrada */}
      {showModal && (
        <EntradaModal
          isOpen={showModal}
          onClose={closeModal}
          onSave={handleSave}
          entrada={editingEntrada}
          pacientes={pacientes}
          tipoCambio={tipoCambioActual}
          mesHastaSaldo={mesHastaSaldo}
        />
      )}
    </div>
  );
};

// Modal Component - ACTUALIZADO CON NUEVA LÓGICA DE SALDO
const EntradaModal = ({ isOpen, onClose, onSave, entrada, pacientes, tipoCambio, mesHastaSaldo }) => {
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

  const [saldoPaciente, setSaldoPaciente] = useState(0);
  const [nuevoSaldo, setNuevoSaldo] = useState(0);
  const [uploading, setUploading] = useState({ comprobante: false, factura: false });
  const [perfilConfig, setPerfilConfig] = useState({ nombre_completo: 'Victoria Güemes' });
  const [loadingSaldo, setLoadingSaldo] = useState(false);

  useEffect(() => {
    cargarPerfilConfig();
  }, []);

  useEffect(() => {
    if (entrada) {
      setFormData({
        ...entrada,
        fecha: entrada.fecha?.split('T')[0] || new Date().toISOString().split('T')[0]
      });
    }
  }, [entrada]);

  useEffect(() => {
    if (formData.monto_ars && saldoPaciente !== undefined) {
      setNuevoSaldo(saldoPaciente - parseFloat(formData.monto_ars || 0));
    }
  }, [formData.monto_ars, saldoPaciente]);

  const cargarPerfilConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracion_perfil')
        .select('nombre_completo')
        .limit(1)
        .single();

      if (data) {
        setPerfilConfig(data);
        setFormData(prev => ({ ...prev, facturador: data.nombre_completo }));
      }
    } catch (error) {
      console.error('Error cargando perfil:', error);
    }
  };

  // 🚀 NUEVA FUNCIÓN: Calcular saldo usando la view (misma lógica que FacturarView)
  const calcularSaldoPaciente = async (pacienteId) => {
    if (!mesHastaSaldo) {
      console.warn('mesHastaSaldo no está configurado aún');
      return;
    }

    try {
      setLoadingSaldo(true);
      console.log('💰 Calculando saldo del paciente:', pacienteId, 'hasta:', mesHastaSaldo.toISOString().split('T')[0]);

      const año = mesHastaSaldo.getFullYear();
      const mes = mesHastaSaldo.getMonth() + 1;

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
        saldo: saldoCalculado,
        debug: data ? {
          sesiones_anteriores: data.debug_sesiones_anteriores,
          pagos_totales: data.debug_pagos_totales
        } : 'Sin datos'
      });

      setSaldoPaciente(saldoCalculado);

      // Auto-completar monto si no existe entrada y hay saldo positivo
      if (!entrada && saldoCalculado > 0) {
        setFormData(prev => ({ ...prev, monto_ars: saldoCalculado }));
      }

    } catch (error) {
      console.error('Error calculando saldo:', error);
      setSaldoPaciente(0);
    } finally {
      setLoadingSaldo(false);
    }
  };

  const handlePacienteChange = (pacienteId) => {
    const paciente = pacientes.find(p => p.id === pacienteId);
    setFormData(prev => ({
      ...prev,
      paciente_id: pacienteId,
      factura_a_nombre: paciente?.nombre_apellido_tutor || '',
      factura_cuil: paciente?.cuil || ''
    }));

    if (pacienteId) {
      calcularSaldoPaciente(pacienteId);
    } else {
      setSaldoPaciente(0);
    }
  };

  const uploadFile = async (file, tipo) => {
    try {
      setUploading(prev => ({ ...prev, [tipo]: true }));

      const fileExt = file.name.split('.').pop();
      const fileName = `${tipo}-${Date.now()}.${fileExt}`;
      const bucket = tipo === 'comprobante' ? 'comprobantes-entradas' : 'facturas-entradas';

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      const field = tipo === 'comprobante' ? 'comprobante_url' : 'factura_url';
      setFormData(prev => ({ ...prev, [field]: urlData.publicUrl }));

      if (window.showToast) {
        window.showToast(`${tipo} subido exitosamente`, 'success');
      }
    } catch (error) {
      console.error(`Error subiendo ${tipo}:`, error);
      alert(`Error al subir ${tipo}: ` + error.message);
    } finally {
      setUploading(prev => ({ ...prev, [tipo]: false }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  if (!isOpen) return null;

  const formatCurrency = (amount) => `$${amount.toLocaleString()} ARS`;

  const nombreMesHasta = mesHastaSaldo ? mesHastaSaldo.toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric'
  }) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center modal-overlay">
      <div className="modal-content max-w-3xl w-full mx-4 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">
            {entrada ? 'Editar Pago Recibido' : 'Nuevo Pago Recibido'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Fecha *</label>
              <input
                type="date"
                value={formData.fecha}
                onChange={(e) => setFormData(prev => ({ ...prev, fecha: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Paciente *</label>
              <select
                value={formData.paciente_id}
                onChange={(e) => handlePacienteChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              >
                <option value="">Seleccionar paciente...</option>
                {pacientes.filter(p => p.activo && !p.eliminado).map(paciente => (
                  <option key={paciente.id} value={paciente.id}>
                    {paciente.nombre_apellido}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 🚀 NUEVO: Saldo del paciente con lógica consistente */}
          {formData.paciente_id && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">Información del Paciente</h4>
              {loadingSaldo ? (
                <div className="text-blue-600">Calculando saldo...</div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700">Saldo actual:</span>
                    <span className={`ml-2 font-bold ${saldoPaciente >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(saldoPaciente)}
                    </span>
                    <div className="text-xs text-blue-600 mt-1">
                      {saldoPaciente > 0 ? 'El paciente debe dinero' : saldoPaciente < 0 ? 'A favor del paciente' : 'Sin deuda'}
                    </div>
                    {nombreMesHasta && (
                      <div className="text-xs text-blue-500 mt-1">
                        📅 Incluye sesiones hasta {nombreMesHasta}
                      </div>
                    )}
                  </div>
                  {formData.monto_ars && (
                    <div>
                      <span className="text-blue-700">Saldo después del pago:</span>
                      <span className={`ml-2 font-bold ${nuevoSaldo >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(nuevoSaldo)}
                      </span>
                      <div className="text-xs text-blue-600 mt-1">
                        {nuevoSaldo > 0 ? 'Seguirá debiendo' : nuevoSaldo < 0 ? 'Quedará a favor' : 'Quedará al día'}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Método y Montos */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Método *</label>
              <select
                value={formData.metodo}
                onChange={(e) => setFormData(prev => ({ ...prev, metodo: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="Transferencia">Transferencia</option>
                <option value="Efectivo">Efectivo</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Monto ARS *</label>
              <input
                type="number"
                value={formData.monto_ars}
                onChange={(e) => setFormData(prev => ({ ...prev, monto_ars: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="15000"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Equivalente USD</label>
              <input
                type="text"
                value={formData.monto_ars ? `${(formData.monto_ars / tipoCambio).toFixed(0)} USD` : ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">TC: ${tipoCambio.toLocaleString()}</p>
            </div>
          </div>

          {/* Comprobante */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">¿Tiene comprobante?</label>
              <div className="flex items-center gap-4">
                {formData.comprobante_url ? (
                  <div className="flex items-center gap-2">
                    <span className="text-green-600 text-sm">✓ Comprobante subido</span>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, comprobante_url: '' }))}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-sm transition-colors">
                    {uploading.comprobante ? 'Subiendo...' : 'Subir Comprobante'}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0], 'comprobante')}
                      className="hidden"
                      disabled={uploading.comprobante}
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
                onChange={(e) => setFormData(prev => ({ ...prev, facturado: e.target.checked }))}
                className="mr-2"
              />
              <label htmlFor="facturado" className="text-sm font-medium text-gray-700">
                ¿Está facturado?
              </label>
            </div>

            {formData.facturado && (
              <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Factura a nombre de</label>
                    <input
                      type="text"
                      value={formData.factura_a_nombre}
                      onChange={(e) => setFormData(prev => ({ ...prev, factura_a_nombre: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="Nombre del tutor"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">CUIL</label>
                    <input
                      type="text"
                      value={formData.factura_cuil}
                      onChange={(e) => setFormData(prev => ({ ...prev, factura_cuil: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="20-12345678-9"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Facturador</label>
                  <input
                    type="text"
                    value={formData.facturador}
                    onChange={(e) => setFormData(prev => ({ ...prev, facturador: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Victoria Güemes"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Factura</label>
                  <div className="flex items-center gap-4">
                    {formData.factura_url ? (
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 text-sm">✓ Factura subida</span>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, factura_url: '' }))}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer bg-purple-100 hover:bg-purple-200 px-3 py-1.5 rounded-lg text-sm transition-colors">
                        {uploading.factura ? 'Subiendo...' : 'Subir Factura'}
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0], 'factura')}
                          className="hidden"
                          disabled={uploading.factura}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Botones */}
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
              className="btn-primary text-white px-6 py-2 rounded-lg"
              disabled={uploading.comprobante || uploading.factura || loadingSaldo}
            >
              {entrada ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EntradaSView;