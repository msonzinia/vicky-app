import React, { useState, useEffect } from 'react';
import { Plus, Search, DollarSign, Calendar, Receipt, X, Filter, SortAsc, SortDesc } from 'lucide-react';
import { supabase } from '../lib/supabase';

const SalidasView = ({
  supervisoras,
  currencyMode,
  tipoCambio,
  alquilerConfig
}) => {
  const [salidas, setSalidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSalida, setEditingSalida] = useState(null);
  const [tipoCambioActual, setTipoCambioActual] = useState(tipoCambio);

  // Estados para filtros
  const [filtros, setFiltros] = useState({
    fechaInicio: '',
    fechaFin: '',
    concepto: '',
    supervisoraId: '',
    metodo: '',
    facturado: '',
    ordenarPor: 'fecha',
    ordenDesc: true
  });
  const [showEliminados, setShowEliminados] = useState(false);
  const [showFiltros, setShowFiltros] = useState(false);

  // 🚀 NUEVO: Estado para mostrar el mes hasta el cual se calcula saldo
  const [mesHastaSaldo, setMesHastaSaldo] = useState(null);

  // Cargar salidas y tipo de cambio al montar el componente
  useEffect(() => {
    cargarSalidas();
    obtenerTipoCambio();
    calcularMesHastaSaldo();
  }, []);

  // Recargar cuando cambie el toggle eliminados
  useEffect(() => {
    cargarSalidas();
  }, [showEliminados]);

  // 🚀 NUEVA FUNCIÓN: Calcular hasta qué mes incluir (misma lógica que EntradaSView)
  const calcularMesHastaSaldo = () => {
    const hoy = new Date();
    const diaDelMes = hoy.getDate();

    let mesHasta;
    if (diaDelMes <= 9) {
      // Del 1 al 9: incluir hasta mes anterior
      mesHasta = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    } else {
      // Del 10 al 31: incluir hasta mes actual
      mesHasta = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    }

    console.log('🗓️ Calculando saldo gastos hasta:', {
      fechaHoy: hoy.toISOString().split('T')[0],
      diaDelMes,
      mesHasta: mesHasta.toISOString().split('T')[0],
      logica: diaDelMes <= 9 ? 'Hasta mes anterior' : 'Hasta mes actual'
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

  const handleRestaurarSalida = async (salida) => {
    try {
      // Restaurar marcando como no eliminado
      const { error } = await supabase
        .from('pagos_hechos')
        .update({ eliminado: false })
        .eq('id', salida.id);

      if (error) throw error;

      if (window.showToast) {
        window.showToast('Pago realizado restaurado exitosamente', 'success');
      }

      // Recargar salidas
      cargarSalidas();

    } catch (error) {
      console.error('Error restaurando salida:', error);
      alert('Error al restaurar salida: ' + error.message);
    }
  };

  const cargarSalidas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('pagos_hechos')
        .select(`
          *,
          supervisoras (
            nombre_apellido
          )
        `)
        .eq('eliminado', showEliminados) // Mostrar eliminados o no eliminados
        .order('fecha', { ascending: false });

      if (error) throw error;
      setSalidas(data || []);
    } catch (error) {
      console.error('Error cargando salidas:', error);
      alert('Error al cargar salidas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount, currency = currencyMode) => {
    if (currency === 'USD') {
      return `$${(amount / tipoCambioActual).toFixed(0)} USD`;
    }
    return `$${amount.toLocaleString()} ARS`;
  };

  // Aplicar filtros y ordenamiento
  const getSalidasFiltradas = () => {
    let resultado = salidas.filter(salida => {
      // Filtro de búsqueda por texto
      const matchText = salida.destinatario.toLowerCase().includes(searchTerm.toLowerCase()) ||
        salida.concepto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        salida.metodo.toLowerCase().includes(searchTerm.toLowerCase());

      // Filtros específicos
      const matchFechaInicio = !filtros.fechaInicio || salida.fecha >= filtros.fechaInicio;
      const matchFechaFin = !filtros.fechaFin || salida.fecha <= filtros.fechaFin;
      const matchConcepto = !filtros.concepto || salida.concepto === filtros.concepto;
      const matchSupervisora = !filtros.supervisoraId || salida.supervisora_id === filtros.supervisoraId;
      const matchMetodo = !filtros.metodo || salida.metodo === filtros.metodo;
      const matchFacturado = filtros.facturado === '' ||
        (filtros.facturado === 'true' && salida.facturado) ||
        (filtros.facturado === 'false' && !salida.facturado);

      return matchText && matchFechaInicio && matchFechaFin && matchConcepto && matchSupervisora && matchMetodo && matchFacturado;
    });

    // Ordenamiento
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
        case 'concepto':
          valorA = a.concepto;
          valorB = b.concepto;
          break;
        case 'destinatario':
          valorA = a.destinatario;
          valorB = b.destinatario;
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

  const filteredSalidas = getSalidasFiltradas();

  const openModal = (salida = null) => {
    setEditingSalida(salida);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSalida(null);
  };

  const handleEliminarSalida = async (salida) => {
    try {
      // Marcar como eliminado
      const { error } = await supabase
        .from('pagos_hechos')
        .update({ eliminado: true })
        .eq('id', salida.id);

      if (error) throw error;

      // Mostrar toast con opción de deshacer
      if (window.showToast) {
        window.showToast(
          'Pago realizado eliminado',
          'success',
          5000,
          async () => {
            // Función de undo
            try {
              const { error: undoError } = await supabase
                .from('pagos_hechos')
                .update({ eliminado: false })
                .eq('id', salida.id);

              if (undoError) throw undoError;

              cargarSalidas();
              if (window.showToast) {
                window.showToast('Pago realizado restaurado', 'success', 3000);
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

      // Recargar salidas
      cargarSalidas();

    } catch (error) {
      console.error('Error eliminando salida:', error);
      alert('Error al eliminar salida: ' + error.message);
    }
  };

  const handleSave = async (formData) => {
    try {
      if (editingSalida) {
        // Actualizar
        const { error } = await supabase
          .from('pagos_hechos')
          .update(formData)
          .eq('id', editingSalida.id);

        if (error) throw error;

        if (window.showToast) {
          window.showToast('Salida actualizada exitosamente', 'success');
        }
      } else {
        // Crear nuevo
        const { error } = await supabase
          .from('pagos_hechos')
          .insert([formData]);

        if (error) throw error;

        if (window.showToast) {
          window.showToast('Salida registrada exitosamente', 'success');
        }
      }

      cargarSalidas();
      closeModal();
    } catch (error) {
      console.error('Error guardando salida:', error);
      alert('Error al guardar salida: ' + error.message);
    }
  };

  const limpiarFiltros = () => {
    setFiltros({
      fechaInicio: '',
      fechaFin: '',
      concepto: '',
      supervisoraId: '',
      metodo: '',
      facturado: '',
      ordenarPor: 'fecha',
      ordenDesc: true
    });
    setSearchTerm('');
  };

  const getConceptoIcon = (concepto) => {
    switch (concepto) {
      case 'Alquiler': return '🏠';
      case 'Supervisión': return '👥';
      default: return '💰';
    }
  };

  const getConceptoColor = (concepto) => {
    switch (concepto) {
      case 'Alquiler': return 'from-orange-500 to-orange-700';
      case 'Supervisión': return 'from-purple-500 to-purple-700';
      default: return 'from-gray-500 to-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando salidas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con búsqueda, filtros y botón agregar */}
      <div className="glass-effect p-6 rounded-xl">
        <div className="flex flex-col gap-4">
          {/* Primera fila: búsqueda y botones */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Buscar por destinatario o concepto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
              />
            </div>

            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                <span className="font-medium">TC Blue:</span> ${tipoCambioActual.toLocaleString()}
              </div>

              <button
                onClick={() => setShowFiltros(!showFiltros)}
                className={`px-4 py-3 rounded-lg flex items-center gap-2 font-medium transition-all ${showFiltros ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                <Filter size={20} />
                Filtros
              </button>

              <button
                onClick={() => setShowEliminados(!showEliminados)}
                className={`px-4 py-3 rounded-lg flex items-center gap-2 font-medium transition-all ${showEliminados ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                🗑️ {showEliminados ? 'Ver Activos' : 'Ver Eliminados'}
              </button>

              <button
                onClick={() => openModal()}
                className="btn-primary text-white px-6 py-3 rounded-xl flex items-center gap-2 font-medium shadow-lg"
              >
                <Plus size={20} />
                Nuevo Pago Realizado
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Concepto</label>
                  <select
                    value={filtros.concepto}
                    onChange={(e) => setFiltros(prev => ({ ...prev, concepto: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Todos</option>
                    <option value="Alquiler">Alquiler</option>
                    <option value="Supervisión">Supervisión</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supervisora</label>
                  <select
                    value={filtros.supervisoraId}
                    onChange={(e) => setFiltros(prev => ({ ...prev, supervisoraId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="">Todas</option>
                    {supervisoras.filter(s => !s.eliminado).map(supervisora => (
                      <option key={supervisora.id} value={supervisora.id}>
                        {supervisora.nombre_apellido}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ordenar por</label>
                  <div className="flex gap-1">
                    <select
                      value={filtros.ordenarPor}
                      onChange={(e) => setFiltros(prev => ({ ...prev, ordenarPor: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="fecha">Fecha</option>
                      <option value="monto">Monto</option>
                      <option value="concepto">Concepto</option>
                      <option value="destinatario">Destinatario</option>
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
          Mostrando {filteredSalidas.length} de {salidas.length} salidas
        </div>
      )}

      {/* Lista de salidas */}
      <div className="grid gap-4">
        {filteredSalidas.map(salida => (
          <div key={salida.id} className="card p-6 hover-lift transition-all duration-300">
            <div className="flex items-center justify-between">
              {/* Información principal */}
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 bg-gradient-to-br ${getConceptoColor(salida.concepto)} rounded-xl flex items-center justify-center shadow-lg`}>
                  <span className="text-white text-xl">{getConceptoIcon(salida.concepto)}</span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-gray-800">
                    {salida.destinatario}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    <span className="font-medium">Concepto:</span> {salida.concepto}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar size={14} />
                      <span>{new Date(salida.fecha).toLocaleDateString('es-AR')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Receipt size={14} />
                      <span>{salida.metodo}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Monto y estado */}
              <div className="text-right">
                <div className="text-2xl font-bold text-red-600">
                  -{formatCurrency(salida.monto_ars)}
                </div>
                <div className="text-sm text-gray-500">
                  (-${(salida.monto_ars / tipoCambioActual).toFixed(0)} USD)
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {salida.facturado && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                      Facturado
                    </span>
                  )}
                  {salida.comprobante_url && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">
                      Comprobante
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="mt-4 pt-4 border-t border-gray-200 flex justify-end gap-2">
              {!showEliminados ? (
                <>
                  <button
                    onClick={() => openModal(salida)}
                    className="px-3 py-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleEliminarSalida(salida)}
                    className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors text-sm"
                  >
                    Eliminar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleRestaurarSalida(salida)}
                  className="px-3 py-1.5 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors text-sm"
                >
                  Restaurar
                </button>
              )}
              {salida.comprobante_url && (
                <a
                  href={salida.comprobante_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                >
                  Ver Comprobante
                </a>
              )}
              {salida.factura_url && (
                <a
                  href={salida.factura_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-colors text-sm"
                >
                  Ver Factura
                </a>
              )}
            </div>
          </div>
        ))}

        {/* Mensaje cuando no hay resultados */}
        {filteredSalidas.length === 0 && (
          <div className="text-center py-12">
            <DollarSign className="mx-auto text-gray-400 mb-4" size={48} />
            <h3 className="text-lg font-medium text-gray-600 mb-2">
              {searchTerm || Object.values(filtros).some(v => v && v !== 'fecha' && v !== true)
                ? 'No se encontraron salidas que coincidan con los filtros'
                : showEliminados
                  ? 'No hay pagos realizados eliminados'
                  : 'No hay pagos realizados registrados'}
            </h3>
            <p className="text-gray-500">
              {searchTerm || Object.values(filtros).some(v => v && v !== 'fecha' && v !== true)
                ? 'Intenta ajustar los filtros de búsqueda'
                : showEliminados
                  ? 'Los pagos eliminados aparecerán aquí'
                  : 'Registra el primer pago realizado'
              }
            </p>
          </div>
        )}
      </div>

      {/* Resumen estadístico */}
      {filteredSalidas.length > 0 && (
        <div className="glass-effect p-6 rounded-xl">
          <h3 className="text-lg font-bold text-gray-800 mb-4">
            Resumen {searchTerm || Object.values(filtros).some(v => v && v !== 'fecha' && v !== true) ? 'Filtrado' : 'del Mes'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {filteredSalidas.length}
              </div>
              <div className="text-sm text-gray-600">Pagos realizados</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                -{formatCurrency(
                  filteredSalidas.reduce((sum, salida) => sum + salida.monto_ars, 0)
                )}
              </div>
              <div className="text-sm text-gray-600">Total gastado</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {filteredSalidas.filter(s => s.concepto === 'Alquiler').length}
              </div>
              <div className="text-sm text-gray-600">Pagos de alquiler</div>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {filteredSalidas.filter(s => s.concepto === 'Supervisión').length}
              </div>
              <div className="text-sm text-gray-600">Pagos de supervisión</div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para agregar/editar salida */}
      {showModal && (
        <SalidaModal
          isOpen={showModal}
          onClose={closeModal}
          onSave={handleSave}
          salida={editingSalida}
          supervisoras={supervisoras}
          tipoCambio={tipoCambioActual}
          alquilerConfig={alquilerConfig}
          mesHastaSaldo={mesHastaSaldo}
        />
      )}
    </div>
  );
};

// 🚀 MODAL ACTUALIZADO CON NUEVA VIEW DE SUPERVISORAS
const SalidaModal = ({ isOpen, onClose, onSave, salida, supervisoras, tipoCambio, alquilerConfig, mesHastaSaldo }) => {
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

  const [saldoInfo, setSaldoInfo] = useState({ saldoActual: 0, nuevoSaldo: 0 });
  const [uploading, setUploading] = useState({ comprobante: false, factura: false });
  const [perfilConfig, setPerfilConfig] = useState({ nombre_completo: 'Victoria Güemes' });
  const [loadingSaldo, setLoadingSaldo] = useState(false);

  // Cargar configuración de perfil
  useEffect(() => {
    cargarPerfilConfig();
  }, []);

  useEffect(() => {
    if (salida) {
      setFormData({
        ...salida,
        fecha: salida.fecha?.split('T')[0] || new Date().toISOString().split('T')[0]
      });
    }
  }, [salida]);

  // Calcular nuevo saldo cuando cambia el monto
  useEffect(() => {
    if (formData.monto_ars && saldoInfo.saldoActual !== undefined) {
      setSaldoInfo(prev => ({
        ...prev,
        nuevoSaldo: prev.saldoActual - parseFloat(formData.monto_ars || 0)
      }));
    }
  }, [formData.monto_ars, saldoInfo.saldoActual]);

  const cargarPerfilConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracion_perfil')
        .select('nombre_completo')
        .limit(1)
        .single();

      if (data) {
        setPerfilConfig(data);
      }
    } catch (error) {
      console.error('Error cargando perfil:', error);
    }
  };

  // 🚀 NUEVA FUNCIÓN: Calcular saldo supervisora usando la view (misma lógica que EntradaSView)
  const calcularSaldoSupervisora = async (supervisoraId) => {
    if (!mesHastaSaldo) {
      console.warn('mesHastaSaldo no está configurado aún');
      return;
    }

    try {
      setLoadingSaldo(true);
      console.log('💰 Calculando saldo supervisora:', supervisoraId, 'hasta:', mesHastaSaldo.toISOString().split('T')[0]);

      const año = mesHastaSaldo.getFullYear();
      const mes = mesHastaSaldo.getMonth() + 1;

      const { data, error } = await supabase
        .from('resumen_gastos_supervisoras_mensual')
        .select('total_final, debug_supervisiones_anteriores, debug_acompanamientos_anteriores, debug_pagos_realizados')
        .eq('supervisora_id', supervisoraId)
        .eq('año', año)
        .eq('mes', mes)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const saldoCalculado = data?.total_final || 0;
      console.log('💰 Saldo supervisora calculado:', {
        supervisoraId,
        hasta: `${año}-${mes}`,
        saldo: saldoCalculado,
        debug: data ? {
          supervisiones_anteriores: data.debug_supervisiones_anteriores,
          acompanamientos_anteriores: data.debug_acompanamientos_anteriores,
          pagos_realizados: data.debug_pagos_realizados
        } : 'Sin datos'
      });

      setSaldoInfo({ saldoActual: saldoCalculado, nuevoSaldo: saldoCalculado });

      // Auto-completar monto si no existe entrada y hay saldo positivo
      if (!salida && saldoCalculado > 0) {
        setFormData(prev => ({ ...prev, monto_ars: saldoCalculado }));
      }

    } catch (error) {
      console.error('Error calculando saldo supervisora:', error);
      setSaldoInfo({ saldoActual: 0, nuevoSaldo: 0 });
    } finally {
      setLoadingSaldo(false);
    }
  };

  // Calcular saldo de alquiler (manteniendo la lógica original pero con filtro eliminado)
  const calcularSaldoAlquiler = async () => {
    try {
      // Calcular meses desde mayo 2025
      const fechaInicio = new Date('2025-05-01');
      const fechaActual = new Date();

      // Calcular diferencia en meses
      const diffTime = fechaActual.getTime() - fechaInicio.getTime();
      const diffMonths = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30.44))); // 30.44 días promedio por mes

      // Total adeudado
      const totalAdeudado = diffMonths * (alquilerConfig?.precio_mensual || 0);

      // Obtener pagos de alquiler realizados (SOLO NO ELIMINADOS)
      const { data: pagos, error: pagosError } = await supabase
        .from('pagos_hechos')
        .select('monto_ars')
        .eq('concepto', 'Alquiler')
        .eq('eliminado', false); // AGREGAR FILTRO

      if (pagosError) throw pagosError;

      // Calcular total pagado
      const totalPagado = (pagos || []).reduce((sum, pago) => sum + pago.monto_ars, 0);

      // Saldo actual = lo que debemos - lo que pagamos
      const saldoActual = totalAdeudado - totalPagado;

      setSaldoInfo({ saldoActual, nuevoSaldo: saldoActual });

      // Si no estamos editando y hay saldo pendiente, ponerlo como monto por defecto
      if (!salida && saldoActual > 0) {
        setFormData(prev => ({ ...prev, monto_ars: saldoActual }));
      }

    } catch (error) {
      console.error('Error calculando saldo alquiler:', error);
      setSaldoInfo({ saldoActual: 0, nuevoSaldo: 0 });
    }
  };

  // Auto-completar datos según el concepto
  const handleConceptoChange = (concepto) => {
    let newData = { ...formData, concepto };

    if (concepto === 'Alquiler') {
      newData.destinatario = alquilerConfig?.destinatario_default || 'Propietario Consultorio';
      newData.supervisora_id = null;
      newData.monto_ars = '';
      calcularSaldoAlquiler();
    } else if (concepto === 'Supervisión') {
      newData.destinatario = '';
      newData.monto_ars = '';
      if (supervisoras.length === 1) {
        newData.supervisora_id = supervisoras[0].id;
        newData.destinatario = supervisoras[0].nombre_apellido;
        calcularSaldoSupervisora(supervisoras[0].id);
      } else {
        setSaldoInfo({ saldoActual: 0, nuevoSaldo: 0 });
      }
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
      monto_ars: '' // Limpiar monto para que se auto-complete
    }));

    if (supervisoraId) {
      calcularSaldoSupervisora(supervisoraId);
    } else {
      setSaldoInfo({ saldoActual: 0, nuevoSaldo: 0 });
    }
  };

  // Subir archivos a Supabase Storage
  const uploadFile = async (file, tipo) => {
    try {
      setUploading(prev => ({ ...prev, [tipo]: true }));

      const fileExt = file.name.split('.').pop();
      const fileName = `${tipo}-${Date.now()}.${fileExt}`;
      const bucket = tipo === 'comprobante' ? 'comprobantes-salidas' : 'facturas-salidas';

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
    const dataToSave = {
      ...formData,
      monto_ars: parseFloat(formData.monto_ars),
      tipo_cambio: tipoCambio
    };
    onSave(dataToSave);
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
            {salida ? 'Editar Pago Realizado' : 'Nuevo Pago Realizado'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Fecha y Concepto */}
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Concepto *</label>
              <select
                value={formData.concepto}
                onChange={(e) => handleConceptoChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              >
                <option value="">Seleccionar concepto...</option>
                <option value="Alquiler">Alquiler</option>
                <option value="Supervisión">Supervisión</option>
                <option value="Otro">Otro</option>
              </select>
            </div>
          </div>

          {/* Destinatario */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Destinatario *</label>
            {formData.concepto === 'Supervisión' ? (
              <select
                value={formData.supervisora_id || ''}
                onChange={(e) => handleSupervisoraChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              >
                <option value="">Seleccionar supervisora...</option>
                {supervisoras.filter(s => !s.eliminado).map(supervisora => (
                  <option key={supervisora.id} value={supervisora.id}>
                    {supervisora.nombre_apellido}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={formData.destinatario}
                onChange={(e) => setFormData(prev => ({ ...prev, destinatario: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                placeholder="Nombre del destinatario"
                required
              />
            )}
          </div>

          {/* 🚀 NUEVO: Información de saldo con lógica consistente */}
          {(formData.concepto === 'Supervisión' && formData.supervisora_id) || formData.concepto === 'Alquiler' ? (
            <div className="bg-orange-50 p-4 rounded-lg">
              <h4 className="font-medium text-orange-800 mb-2">
                Información de {formData.concepto === 'Alquiler' ? 'Alquiler' : 'Supervisión'}
              </h4>
              {loadingSaldo ? (
                <div className="text-orange-600">Calculando saldo...</div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-orange-700">Saldo pendiente:</span>
                    <span className={`ml-2 font-bold ${saldoInfo.saldoActual >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {formatCurrency(saldoInfo.saldoActual)}
                    </span>
                    <div className="text-xs text-orange-600 mt-1">
                      {formData.concepto === 'Alquiler'
                        ? 'Calculado desde mayo 2025'
                        : 'Por supervisiones y acompañamientos'}
                    </div>
                    {nombreMesHasta && formData.concepto === 'Supervisión' && (
                      <div className="text-xs text-orange-500 mt-1">
                        📅 Incluye hasta {nombreMesHasta}
                      </div>
                    )}
                  </div>
                  {formData.monto_ars && (
                    <div>
                      <span className="text-orange-700">Saldo después del pago:</span>
                      <span className={`ml-2 font-bold ${saldoInfo.nuevoSaldo >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(saldoInfo.nuevoSaldo)}
                      </span>
                      <div className="text-xs text-orange-600 mt-1">
                        {saldoInfo.nuevoSaldo > 0 ? 'Seguirá pendiente' : saldoInfo.nuevoSaldo < 0 ? 'Pago en exceso' : 'Quedará al día'}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}

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
                placeholder="50000"
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
                      value={perfilConfig.nombre_completo}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                      disabled
                    />
                    <p className="text-xs text-gray-500 mt-1">La factura se emite a nombre de la psicopedagoga</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Facturador</label>
                    <input
                      type="text"
                      value={formData.destinatario}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100"
                      disabled
                    />
                    <p className="text-xs text-gray-500 mt-1">Quien emite la factura</p>
                  </div>
                </div>

                {/* Upload de factura */}
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
              {salida ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SalidasView;