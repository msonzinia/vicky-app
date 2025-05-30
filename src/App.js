import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

// Componentes
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CalendarioView from './components/CalendarioView';
import PacientesView from './components/PacientesView';
import SupervisorasView from './components/SupervisorasView';
import AlquilerView from './components/AlquilerView';
import EntradaSView from './components/EntradaSView';
import SalidasView from './components/SalidasView';
import FacturarView from './components/FacturarView';
import Modal from './components/Modal';
import CategorizarModal from './components/CategorizarModal';
import DayDetailModal from './components/DayDetailModal';
import ConfirmacionCambiosModal from './components/ConfirmacionCambiosModal';
import ToastSystem from './components/ToastSystem';

function App() {
  // Estados principales
  const [activeView, setActiveView] = useState('calendario');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [currencyMode, setCurrencyMode] = useState('ARS'); // ARS o USD
  const [loading, setLoading] = useState(true);
  const [fechaPrecargada, setFechaPrecargada] = useState(null); // ✅ NUEVA: Para pre-cargar fecha en nueva sesión

  // Estados para datos
  const [pacientes, setPacientes] = useState([]);
  const [supervisoras, setSupervisoras] = useState([]);
  const [sesiones, setSesiones] = useState([]);
  const [alquilerConfig, setAlquilerConfig] = useState({ precio_mensual: 50000 });
  const [tipoCambio, setTipoCambio] = useState(1150);
  const [sesionsPendientes, setSesionsPendientes] = useState(0);

  // Estados para modal de confirmación
  const [showConfirmacionModal, setShowConfirmacionModal] = useState(false);
  const [cambiosDetectados, setCambiosDetectados] = useState({});
  const [formDataPendiente, setFormDataPendiente] = useState(null);
  const [selectedItemPendiente, setSelectedItemPendiente] = useState(null);

  // Cargar datos iniciales
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);

      // ✅ CORRECCIÓN: Cargar TODOS los pacientes (incluyendo eliminados)
      const { data: pacientesData, error: pacientesError } = await supabase
        .from('pacientes')
        .select(`
          *,
          horarios_pacientes (
            id,
            dia_semana,
            hora_inicio
          )
        `)
        // CORRECCIÓN: Eliminar .eq('eliminado', false) para cargar también eliminados
        .order('eliminado')  // Primero los no eliminados
        .order('activo', { ascending: false })
        .order('nombre_apellido');

      if (pacientesError) throw pacientesError;

      // Transformar los datos para que horarios_pacientes se llame horarios
      const pacientesConHorarios = (pacientesData || []).map(paciente => ({
        ...paciente,
        horarios: paciente.horarios_pacientes || []
      }));

      setPacientes(pacientesConHorarios);

      // Cargar supervisoras
      const { data: supervisorasData, error: supervisorasError } = await supabase
        .from('supervisoras')
        .select('*')
        .eq('eliminado', false)
        .order('nombre_apellido');

      if (supervisorasError) throw supervisorasError;
      setSupervisoras(supervisorasData || []);

      // Cargar sesiones (últimos 3 meses hacia adelante)
      const fechaInicio = new Date();
      fechaInicio.setMonth(fechaInicio.getMonth() - 3);

      const { data: sesionesData, error: sesionesError } = await supabase
        .from('sesiones')
        .select('*')
        .eq('eliminado', false)
        .gte('fecha_hora', fechaInicio.toISOString())
        .order('fecha_hora');

      if (sesionesError) throw sesionesError;
      setSesiones(sesionesData || []);

      // Contar sesiones pendientes (solo no eliminadas)
      const pendientes = (sesionesData || []).filter(s =>
        s.estado === 'Pendiente' && new Date(s.fecha_hora) < new Date() && !s.eliminado
      ).length;
      setSesionsPendientes(pendientes);

      // Cargar configuración de alquiler
      const { data: alquilerData, error: alquilerError } = await supabase
        .from('configuracion_alquiler')
        .select('*')
        .limit(1)
        .single();

      if (!alquilerError && alquilerData) {
        setAlquilerConfig(alquilerData);
      }

      // Obtener tipo de cambio actual (simulado)
      setTipoCambio(1150);

    } catch (error) {
      console.error('Error loading data:', error);
      // Cargar datos de ejemplo en caso de error
      loadExampleData();
    } finally {
      setLoading(false);
    }
  };

  // Debug: Verificar pacientes eliminados cargados
  useEffect(() => {
    if (pacientes.length > 0) {
      const eliminados = pacientes.filter(p => p.eliminado);
      console.log('✅ Pacientes eliminados cargados:', eliminados.length);
      if (eliminados.length > 0) {
        console.log('Lista de eliminados:', eliminados.map(p => p.nombre_apellido));
      }
    }
  }, [pacientes]);

  // Datos de ejemplo para desarrollo
  const loadExampleData = () => {
    setPacientes([
      {
        id: '1',
        nombre_apellido: 'Juan Pérez',
        nombre_apellido_tutor: 'Carlos Pérez',
        cuil: '20-12345678-9',
        precio_por_hora: 15000,
        fecha_inicio: '2025-01-15',
        activo: true,
        eliminado: false,
        color: '#3B82F6',
        horarios: [{ id: 'h1', dia_semana: 2, hora_inicio: '10:00' }]
      },
      {
        id: '2',
        nombre_apellido: 'María García',
        nombre_apellido_tutor: 'Laura García',
        cuil: '27-87654321-3',
        precio_por_hora: 18000,
        fecha_inicio: '2025-01-20',
        activo: true,
        eliminado: false,
        color: '#EF4444',
        horarios: [{ id: 'h2', dia_semana: 4, hora_inicio: '14:00' }]
      }
    ]);

    setSupervisoras([
      { id: '1', nombre_apellido: 'Dra. María González', precio_por_hora: 8000 },
      { id: '2', nombre_apellido: 'Lic. Ana Rodríguez', precio_por_hora: 7500 }
    ]);

    // Generar sesiones de ejemplo
    const sesionesEjemplo = [];
    const hoy = new Date();
    for (let i = -7; i <= 30; i++) {
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() + i);
      fecha.setHours(10, 0, 0, 0);

      if (fecha.getDay() === 2) { // Martes para Juan
        sesionesEjemplo.push({
          id: `s1-${i}`,
          tipo_sesion: 'Sesión',
          paciente_id: '1',
          supervisora_id: null,
          fecha_hora: fecha.toISOString(),
          precio_por_hora: 15000,
          duracion_horas: 1,
          estado: i < 0 ? 'Pendiente' : 'Pendiente',
          auto_generada: true,
          modificada_manualmente: false,
          eliminado: false,
          horario_origen_id: 'h1'
        });
      }
      if (fecha.getDay() === 4) { // Jueves para María
        fecha.setHours(14, 0, 0, 0);
        sesionesEjemplo.push({
          id: `s2-${i}`,
          tipo_sesion: 'Sesión',
          paciente_id: '2',
          supervisora_id: null,
          fecha_hora: fecha.toISOString(),
          precio_por_hora: 18000,
          duracion_horas: 1,
          estado: i < 0 ? 'Pendiente' : 'Pendiente',
          auto_generada: true,
          modificada_manualmente: false,
          eliminado: false,
          horario_origen_id: 'h2'
        });
      }
    }
    setSesiones(sesionesEjemplo);

    // Contar sesiones pendientes (solo no eliminadas)
    const pendientes = sesionesEjemplo.filter(s =>
      s.estado === 'Pendiente' && new Date(s.fecha_hora) < hoy && !s.eliminado
    ).length;
    setSesionsPendientes(pendientes);
  };

  // ============================================================================
  // ✅ FUNCIÓN NUEVA: ACTUALIZAR SESIÓN LOCAL AUTOMÁTICAMENTE
  // ============================================================================
  const actualizarSesionLocal = (sesionActualizada) => {
    console.log('Actualizando sesión local:', sesionActualizada);

    setSesiones(prev => prev.map(s =>
      s.id === sesionActualizada.id ? { ...s, ...sesionActualizada } : s
    ));

    // Actualizar contador de pendientes si cambió el estado
    if (sesionActualizada.estado) {
      const hoy = new Date();
      const esPasada = new Date(sesionActualizada.fecha_hora) < hoy;

      if (esPasada) {
        if (sesionActualizada.estado === 'Pendiente') {
          setSesionsPendientes(prev => prev + 1);
        } else {
          setSesionsPendientes(prev => Math.max(0, prev - 1));
        }
      }
    }
  };

  // ============================================================================
  // ✅ FUNCIÓN CORREGIDA PARA CATEGORIZAR SESIÓN (desde DayDetailModal)
  // ============================================================================
  const handleCategorizarSesionRapida = async (sesionOriginal, nuevoEstado) => {
    try {
      console.log('=== CATEGORIZACIÓN RÁPIDA ===');
      console.log('Sesión original:', sesionOriginal);
      console.log('Nuevo estado:', nuevoEstado);

      // ✅ PRESERVAR LA FECHA ORIGINAL EXACTAMENTE
      const updateData = {
        estado: nuevoEstado,
        // NO tocar la fecha_hora para evitar problemas de zona horaria
      };

      const { error } = await supabase
        .from('sesiones')
        .update(updateData)
        .eq('id', sesionOriginal.id);

      if (error) throw error;

      // Actualizar estado local inmediatamente
      const sesionActualizada = {
        ...sesionOriginal,
        estado: nuevoEstado
      };

      actualizarSesionLocal(sesionActualizada);

      // Actualizar contador de pendientes
      const hoy = new Date();
      const esPasada = new Date(sesionOriginal.fecha_hora) < hoy;
      const eraPendiente = sesionOriginal.estado === 'Pendiente';
      const esAhoraPendiente = nuevoEstado === 'Pendiente';

      if (esPasada && eraPendiente && !esAhoraPendiente) {
        setSesionsPendientes(prev => Math.max(0, prev - 1));
      } else if (esPasada && !eraPendiente && esAhoraPendiente) {
        setSesionsPendientes(prev => prev + 1);
      }

      return true; // Éxito
    } catch (error) {
      console.error('Error en categorización rápida:', error);
      return false; // Error
    }
  };

  // ============================================================================
  // ✅ FUNCIÓN MEJORADA - DETECCIÓN DE CAMBIOS DETALLADA
  // ============================================================================
  const detectarCambiosPaciente = (selectedItem, formData) => {
    const cambiosInfo = {};
    const horariosEditados = [];
    const horariosNuevos = [];
    const horariosEliminados = [];

    // ==================== DETECTAR CAMBIOS DE INFORMACIÓN ====================
    if (formData.nombre_apellido !== selectedItem.nombre_apellido) {
      cambiosInfo.nombre_apellido = {
        anterior: selectedItem.nombre_apellido,
        nuevo: formData.nombre_apellido
      };
    }

    if (formData.nombre_apellido_tutor !== selectedItem.nombre_apellido_tutor) {
      cambiosInfo.nombre_apellido_tutor = {
        anterior: selectedItem.nombre_apellido_tutor,
        nuevo: formData.nombre_apellido_tutor
      };
    }

    if (formData.cuil !== selectedItem.cuil) {
      cambiosInfo.cuil = {
        anterior: selectedItem.cuil,
        nuevo: formData.cuil
      };
    }

    if (formData.precio_por_hora !== selectedItem.precio_por_hora) {
      cambiosInfo.precio_por_hora = {
        anterior: selectedItem.precio_por_hora,
        nuevo: formData.precio_por_hora
      };
    }

    if (formData.color !== selectedItem.color) {
      cambiosInfo.color = {
        anterior: selectedItem.color,
        nuevo: formData.color
      };
    }

    if (formData.fecha_inicio !== selectedItem.fecha_inicio?.split('T')[0]) {
      cambiosInfo.fecha_inicio = {
        anterior: selectedItem.fecha_inicio?.split('T')[0],
        nuevo: formData.fecha_inicio
      };
    }

    // ==================== DETECTAR CAMBIOS DE ESTADO ====================
    const esReactivacion = !selectedItem.activo && formData.activo;
    const esDesactivacion = selectedItem.activo && !formData.activo;

    // ==================== DETECTAR CAMBIOS DETALLADOS DE HORARIOS ====================
    const horariosOriginales = (selectedItem.horarios || []).map(h => ({
      id: h.id || null,
      dia_semana: h.dia_semana,
      hora_inicio: h.hora_inicio
    }));

    const horariosNuevosForm = (formData.horarios || []).map(h => ({
      id: h.id || null,
      dia_semana: h.dia_semana,
      hora_inicio: h.hora_inicio
    }));

    // Función auxiliar para comparar horarios
    const horariosIguales = (h1, h2) => {
      return h1.dia_semana === h2.dia_semana && h1.hora_inicio === h2.hora_inicio;
    };

    // Función auxiliar para obtener texto del día
    const getDiaTexto = (dia) => {
      const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      return dias[dia];
    };

    // 1. DETECTAR HORARIOS ELIMINADOS (existen en original pero no en nuevo)
    horariosOriginales.forEach(horarioOriginal => {
      const existeEnNuevo = horariosNuevosForm.some(horarioNuevo => {
        // Si tiene ID, comparar por ID; si no, comparar por contenido
        if (horarioOriginal.id && horarioNuevo.id) {
          return horarioOriginal.id === horarioNuevo.id;
        }
        return horariosIguales(horarioOriginal, horarioNuevo);
      });

      if (!existeEnNuevo) {
        horariosEliminados.push({
          dia_semana: horarioOriginal.dia_semana,
          hora_inicio: horarioOriginal.hora_inicio,
          texto: `${getDiaTexto(horarioOriginal.dia_semana)} a las ${horarioOriginal.hora_inicio}`
        });
      }
    });

    // 2. DETECTAR HORARIOS NUEVOS (existen en nuevo pero no en original)
    horariosNuevosForm.forEach(horarioNuevo => {
      const existeEnOriginal = horariosOriginales.some(horarioOriginal => {
        // Si tiene ID, comparar por ID; si no, comparar por contenido
        if (horarioNuevo.id && horarioOriginal.id) {
          return horarioNuevo.id === horarioOriginal.id;
        }
        return horariosIguales(horarioNuevo, horarioOriginal);
      });

      if (!existeEnOriginal) {
        horariosNuevos.push({
          dia_semana: horarioNuevo.dia_semana,
          hora_inicio: horarioNuevo.hora_inicio,
          texto: `${getDiaTexto(horarioNuevo.dia_semana)} a las ${horarioNuevo.hora_inicio}`
        });
      }
    });

    // 3. DETECTAR HORARIOS MODIFICADOS (mismo ID pero diferente contenido)
    horariosOriginales.forEach(horarioOriginal => {
      if (horarioOriginal.id) {
        const horarioNuevoCorrespondiente = horariosNuevosForm.find(h => h.id === horarioOriginal.id);

        if (horarioNuevoCorrespondiente && !horariosIguales(horarioOriginal, horarioNuevoCorrespondiente)) {
          horariosEditados.push({
            anterior: {
              dia_semana: horarioOriginal.dia_semana,
              hora_inicio: horarioOriginal.hora_inicio,
              texto: `${getDiaTexto(horarioOriginal.dia_semana)} a las ${horarioOriginal.hora_inicio}`
            },
            nuevo: {
              dia_semana: horarioNuevoCorrespondiente.dia_semana,
              hora_inicio: horarioNuevoCorrespondiente.hora_inicio,
              texto: `${getDiaTexto(horarioNuevoCorrespondiente.dia_semana)} a las ${horarioNuevoCorrespondiente.hora_inicio}`
            }
          });
        }
      }
    });

    // ==================== DETERMINAR SI MOSTRAR MODAL ====================
    const hayCambiosSignificativos =
      Object.keys(cambiosInfo).length > 0 ||
      horariosEditados.length > 0 ||
      horariosNuevos.length > 0 ||
      horariosEliminados.length > 0 ||
      esReactivacion ||
      esDesactivacion;

    console.log('Cambios detectados:', {
      cambiosInfo,
      horariosEditados,
      horariosNuevos,
      horariosEliminados,
      esReactivacion,
      esDesactivacion
    });

    return {
      cambiosInfo,
      horariosEditados,
      horariosNuevos,
      horariosEliminados,
      esReactivacion,
      esDesactivacion,
      mostrarModal: hayCambiosSignificativos,
      // Campos adicionales para compatibilidad
      hayCambiosHorarios: horariosEditados.length > 0 || horariosNuevos.length > 0 || horariosEliminados.length > 0
    };
  };

  // Funciones para manejar modales
  const openModal = (type, item = null) => {
    setModalType(type);
    setSelectedItem(item);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType('');
    setSelectedItem(null);
    setFechaPrecargada(null); // ✅ Limpiar fecha pre-cargada
  };

  // ✅ FUNCIÓN NUEVA: Crear sesión con fecha pre-cargada desde DayDetailModal
  const handleNuevaSesionConFecha = (fechaFormateada) => {
    console.log('Creando nueva sesión con fecha pre-cargada:', fechaFormateada);
    setFechaPrecargada(fechaFormateada);
    setShowModal(false); // Cerrar modal del día
    setTimeout(() => {
      openModal('add-sesion');
    }, 100); // Pequeño delay para que se cierre el modal del día primero
  };

  // Nueva función para confirmar cambios de paciente
  const confirmarCambiosPaciente = async () => {
    try {
      setShowConfirmacionModal(false);

      if (formDataPendiente && selectedItemPendiente) {
        await ejecutarGuardadoPaciente(formDataPendiente, true, selectedItemPendiente);
        setFormDataPendiente(null);
        setSelectedItemPendiente(null);
        setCambiosDetectados({});
      }
    } catch (error) {
      console.error('Error al confirmar cambios:', error);
      handleError(error);
    }
  };

  // ============================================================================
  // ✅ FUNCIÓN CORREGIDA PARA CANCELAR CAMBIOS
  // ============================================================================
  const cancelarCambiosPaciente = () => {
    console.log('Cancelando cambios de paciente...');

    // Limpiar estados del modal de confirmación
    setShowConfirmacionModal(false);
    setFormDataPendiente(null);
    setSelectedItemPendiente(null);
    setCambiosDetectados({});

    // NO reabrir el modal de edición automáticamente
    // El usuario puede volver a hacer clic en "Editar" si quiere

    // Mostrar mensaje de cancelación (opcional)
    if (window.showToast) {
      window.showToast('Cambios cancelados', 'info', 2000);
    }
  };

  // FUNCIÓN COMPLETAMENTE ACTUALIZADA - Usa las funciones SQL probadas
  const ejecutarGuardadoPaciente = async (formData, esEdicion, selectedItemParam = null) => {
    try {
      if (!esEdicion) {
        // ============ PACIENTE NUEVO ============
        console.log('=== CREANDO PACIENTE NUEVO ===');

        const { data, error } = await supabase
          .from('pacientes')
          .insert([{
            nombre_apellido: formData.nombre_apellido,
            nombre_apellido_tutor: formData.nombre_apellido_tutor,
            cuil: formData.cuil,
            precio_por_hora: formData.precio_por_hora,
            fecha_inicio: formData.fecha_inicio,
            activo: formData.activo,
            color: formData.color
          }])
          .select()
          .single();

        if (error) throw error;

        // Insertar horarios
        const horariosInsertados = [];
        for (const horario of formData.horarios || []) {
          const { data: horarioInsertado, error: horarioError } = await supabase
            .from('horarios_pacientes')
            .insert({
              paciente_id: data.id,
              dia_semana: horario.dia_semana,
              hora_inicio: horario.hora_inicio
            })
            .select()
            .single();

          if (horarioError) throw horarioError;
          horariosInsertados.push(horarioInsertado);
        }

        // ✅ USAR FUNCIÓN SQL PROBADA - Generar sesiones para 5 años
        if (formData.activo && horariosInsertados.length > 0) {
          console.log('Generando sesiones con función SQL...');
          const { data: resultado, error: sesionesError } = await supabase.rpc('generar_sesiones_paciente_nuevo', {
            p_paciente_id: data.id
          });

          if (sesionesError) {
            console.error('Error generando sesiones:', sesionesError);
          } else {
            console.log(`✅ ${resultado} sesiones generadas exitosamente`);
          }
        }

        // Actualizar estado local
        setPacientes(prev => [...prev, {
          ...data,
          horarios: horariosInsertados.map(h => ({
            id: h.id,
            dia_semana: h.dia_semana,
            hora_inicio: h.hora_inicio
          }))
        }]);

        if (window.showToast) {
          window.showToast(`Paciente ${formData.nombre_apellido} agregado exitosamente`, 'success');
        }

      } else {
        // ============ EDITAR PACIENTE ============
        console.log('=== EDITANDO PACIENTE ===');

        const itemToEdit = selectedItemParam || selectedItem;
        if (!itemToEdit?.id) {
          throw new Error('Paciente no encontrado para editar');
        }

        // 1. ACTUALIZAR INFORMACIÓN BÁSICA EN TABLA
        const { error: updateError } = await supabase
          .from('pacientes')
          .update({
            nombre_apellido: formData.nombre_apellido,
            nombre_apellido_tutor: formData.nombre_apellido_tutor,
            cuil: formData.cuil,
            precio_por_hora: formData.precio_por_hora,
            fecha_inicio: formData.fecha_inicio,
            activo: formData.activo,
            color: formData.color
          })
          .eq('id', itemToEdit.id);

        if (updateError) throw updateError;

        // 2. DETECTAR CAMBIOS
        const cambiosPrecio = formData.precio_por_hora !== itemToEdit.precio_por_hora;
        const esReactivacion = !itemToEdit.activo && formData.activo;
        const esDesactivacion = itemToEdit.activo && !formData.activo;

        // Detectar cambios en horarios
        const horariosAntes = JSON.stringify((itemToEdit.horarios || []).map(h =>
          ({ dia_semana: h.dia_semana, hora_inicio: h.hora_inicio })
        ).sort());
        const horariosAhora = JSON.stringify((formData.horarios || []).map(h =>
          ({ dia_semana: h.dia_semana, hora_inicio: h.hora_inicio })
        ).sort());
        const hayCambiosHorarios = horariosAntes !== horariosAhora;

        console.log('Cambios detectados:', {
          precio: cambiosPrecio,
          reactivacion: esReactivacion,
          desactivacion: esDesactivacion,
          horarios: hayCambiosHorarios
        });

        // 3. ✅ MANEJAR DESACTIVACIÓN CON FUNCIÓN SQL PROBADA
        if (esDesactivacion) {
          console.log('Desactivando paciente...');
          const { data: resultado, error: inactivarError } = await supabase.rpc('inactivar_paciente_completo', {
            p_paciente_id: itemToEdit.id
          });

          if (inactivarError) {
            console.error('Error inactivando:', inactivarError);
          } else {
            console.log('✅ Resultado inactivación:', resultado);
          }
        }

        // 4. ✅ MANEJAR REACTIVACIÓN CON FUNCIÓN SQL PROBADA
        if (esReactivacion) {
          console.log('Reactivando paciente...');

          // Primero actualizar horarios si es necesario
          if (hayCambiosHorarios) {
            console.log('Actualizando horarios en reactivación...');
            console.log('formData.horarios:', formData.horarios);

            const { data: resultadoHorarios, error: horariosError } = await supabase.rpc('gestionar_horarios_paciente', {
              p_paciente_id: itemToEdit.id,
              p_horarios_json: formData.horarios || [],
              p_accion: 'actualizar_completo'
            });

            if (horariosError) {
              console.error('Error actualizando horarios:', horariosError);
            } else {
              console.log('✅ Horarios actualizados:', resultadoHorarios);
            }
          }

          // Reactivar y generar sesiones futuras
          const { data: resultado, error: reactivarError } = await supabase.rpc('reactivar_paciente_completo', {
            p_paciente_id: itemToEdit.id
          });

          if (reactivarError) {
            console.error('Error reactivando:', reactivarError);
          } else {
            console.log('✅ Resultado reactivación:', resultado);
          }
        }

        // 5. ✅ MANEJAR CAMBIOS DE HORARIOS (paciente activo) CON FUNCIÓN SQL PROBADA
        if (hayCambiosHorarios && formData.activo && !esReactivacion) {
          console.log('Actualizando horarios...');
          console.log('formData.horarios:', formData.horarios);
          console.log('tipo:', typeof formData.horarios);

          // Pasar array directamente, Supabase lo convierte a JSON automáticamente
          const { data: resultado, error: horariosError } = await supabase.rpc('gestionar_horarios_paciente', {
            p_paciente_id: itemToEdit.id,
            p_horarios_json: formData.horarios || [],
            p_accion: 'actualizar_completo'
          });

          if (horariosError) {
            console.error('Error gestionando horarios:', horariosError);
          } else {
            console.log('✅ Resultado gestión horarios:', resultado);
          }
        }

        // 6. MANEJAR CAMBIOS DE PRECIO (solo si no hay otros cambios mayores)
        if (cambiosPrecio && !esReactivacion && !esDesactivacion && !hayCambiosHorarios) {
          console.log('Actualizando solo precios...');
          const { data: resultado, error: preciosError } = await supabase.rpc('actualizar_precios_futuros_paciente', {
            p_paciente_id: itemToEdit.id,
            p_nuevo_precio: formData.precio_por_hora
          });

          if (preciosError) {
            console.error('Error actualizando precios:', preciosError);
          } else {
            console.log(`✅ ${resultado} sesiones con precios actualizados`);
          }
        }

        // 7. ACTUALIZAR ESTADO LOCAL
        const pacienteActualizado = {
          ...itemToEdit,
          ...formData,
          horarios: formData.horarios || []
        };

        setPacientes(prev => prev.map(p =>
          p.id === itemToEdit.id ? pacienteActualizado : p
        ));

        if (window.showToast) {
          window.showToast(`Paciente ${formData.nombre_apellido} actualizado exitosamente`, 'success');
        }
      }

      // Recargar sesiones para ver los cambios
      await loadSesiones();
      closeModal();

    } catch (error) {
      console.error('Error saving patient:', error);
      handleError(error);
    }
  };

  // ============================================================================
  // ✅ FUNCIÓN CORREGIDA PARA MANEJO DE FECHAS EN EDICIÓN DE SESIONES
  // ============================================================================
  const corregirFechaHora = (fechaHoraInput, fechaHoraOriginal) => {
    // Si no hay input, usar la original
    if (!fechaHoraInput) return fechaHoraOriginal;

    try {
      // Si el input viene en formato datetime-local (sin Z)
      if (typeof fechaHoraInput === 'string' && !fechaHoraInput.includes('Z') && !fechaHoraInput.includes('+')) {
        // Agregar zona horaria local para evitar conversión UTC
        const fechaLocal = new Date(fechaHoraInput);

        // Obtener el offset de zona horaria en minutos
        const offsetMinutes = fechaLocal.getTimezoneOffset();

        // Ajustar por la diferencia de zona horaria
        const fechaCorregida = new Date(fechaLocal.getTime() - (offsetMinutes * 60000));

        console.log('=== CORRECCIÓN DE FECHA ===');
        console.log('Input original:', fechaHoraInput);
        console.log('Fecha original:', fechaHoraOriginal);
        console.log('Fecha local:', fechaLocal);
        console.log('Offset minutos:', offsetMinutes);
        console.log('Fecha corregida:', fechaCorregida.toISOString());

        return fechaCorregida.toISOString();
      }

      // Si ya tiene zona horaria, usar tal como viene
      return new Date(fechaHoraInput).toISOString();
    } catch (error) {
      console.error('Error corrigiendo fecha:', error);
      return fechaHoraOriginal; // En caso de error, usar la original
    }
  };

  // Función para manejar otros tipos de guardado (supervisoras, sesiones, etc.)
  const ejecutarGuardadoOtrosTipos = async (formData) => {
    if (modalType === 'add-supervisora') {
      const { data, error } = await supabase
        .from('supervisoras')
        .insert([formData])
        .select()
        .single();

      if (error) throw error;
      setSupervisoras(prev => [...prev, data]);

      if (window.showToast) {
        window.showToast(`Supervisora ${data.nombre_apellido} agregada exitosamente`, 'success');
      }

      try {
        await supabase.rpc('actualizar_precios_futuros_supervisora', {
          p_supervisora_id: data.id,
          p_nuevo_precio: formData.precio_por_hora
        });
        loadSesiones();
      } catch (rpcError) {
        console.warn('Error estableciendo precios para nueva supervisora:', rpcError);
      }

    } else if (modalType === 'edit-supervisora') {
      const { error } = await supabase
        .from('supervisoras')
        .update(formData)
        .eq('id', selectedItem.id);

      if (error) throw error;

      setSupervisoras(prev => prev.map(s =>
        s.id === selectedItem.id ? { ...s, ...formData } : s
      ));

      try {
        await supabase.rpc('actualizar_precios_futuros_supervisora', {
          p_supervisora_id: selectedItem.id,
          p_nuevo_precio: formData.precio_por_hora
        });
        await loadSesiones();
      } catch (rpcError) {
        console.error('Error actualizando precios futuros de supervisión:', rpcError);
      }

    } else if (modalType === 'add-sesion') {
      const sesionData = {
        ...formData,
        auto_generada: false,
        modificada_manualmente: false
      };

      const { data, error } = await supabase
        .from('sesiones')
        .insert([sesionData])
        .select()
        .single();

      if (error) throw error;
      setSesiones(prev => [...prev, data]);

      if (window.showToast) {
        window.showToast(`${formData.tipo_sesion} agregada exitosamente`, 'success');
      }

    } else if (modalType === 'edit-sesion') {
      const fechaOriginal = new Date(selectedItem.fecha_hora);

      // ✅ CORRECCIÓN CRÍTICA: Usar función para corregir fecha
      const fechaHoraCorregida = corregirFechaHora(formData.fecha_hora, selectedItem.fecha_hora);
      const fechaNueva = new Date(fechaHoraCorregida);

      const seCambioFechaHora = Math.abs(fechaOriginal.getTime() - fechaNueva.getTime()) > 60000; // Tolerancia de 1 minuto

      const updateData = {
        ...formData,
        fecha_hora: fechaHoraCorregida, // ✅ Usar fecha corregida
        // CRÍTICO: Marcar como modificada manualmente si se cambió fecha/hora
        modificada_manualmente: seCambioFechaHora ? true : (selectedItem.modificada_manualmente || false)
      };

      console.log('=== DEBUG EDICIÓN SESIÓN ===');
      console.log('Fecha original:', fechaOriginal);
      console.log('FormData fecha_hora:', formData.fecha_hora);
      console.log('Fecha corregida:', fechaHoraCorregida);
      console.log('Fecha nueva:', fechaNueva);
      console.log('Se cambió fecha/hora:', seCambioFechaHora);
      console.log('UpdateData final:', updateData);

      const { error } = await supabase
        .from('sesiones')
        .update(updateData)
        .eq('id', selectedItem.id);

      if (error) throw error;

      // ✅ ACTUALIZAR ESTADO LOCAL INMEDIATAMENTE
      setSesiones(prev => prev.map(s =>
        s.id === selectedItem.id ? { ...s, ...updateData } : s
      ));

      if (formData.estado !== selectedItem.estado) {
        const hoy = new Date();
        const esPasada = new Date(selectedItem.fecha_hora) < hoy;
        const eraPendiente = selectedItem.estado === 'Pendiente';
        const esAhoraPendiente = formData.estado === 'Pendiente';

        if (esPasada && eraPendiente && !esAhoraPendiente) {
          setSesionsPendientes(prev => Math.max(0, prev - 1));
        } else if (esPasada && !eraPendiente && esAhoraPendiente) {
          setSesionsPendientes(prev => prev + 1);
        }
      }

      if (window.showToast) {
        window.showToast('Sesión actualizada exitosamente', 'success');
      }
    }

    closeModal();
  };

  // Función para manejar errores
  const handleError = (error) => {
    let errorMessage = 'Error al guardar los datos';
    if (error.message) {
      errorMessage += ': ' + error.message;
    }
    if (error.details) {
      errorMessage += ' - ' + error.details;
    }
    alert(errorMessage);
  };

  // FUNCIÓN ACTUALIZADA - Simplificada
  const handleModalSave = async (formData) => {
    try {
      console.log('Guardando:', { modalType, formData });

      if (modalType === 'add-paciente') {
        // Nuevo paciente - directo
        await ejecutarGuardadoPaciente(formData, false);

      } else if (modalType === 'edit-paciente') {
        // Editar paciente
        const cambios = detectarCambiosPaciente(selectedItem, formData);

        if (cambios.mostrarModal) {
          // Mostrar modal de confirmación
          setCambiosDetectados(cambios);
          setFormDataPendiente(formData);
          setSelectedItemPendiente(selectedItem);
          setShowModal(false);
          setShowConfirmacionModal(true);
          return;
        } else {
          // Sin cambios significativos - guardar directamente
          await ejecutarGuardadoPaciente(formData, true);
        }

      } else {
        // Otros tipos (supervisoras, sesiones)
        await ejecutarGuardadoOtrosTipos(formData);
      }

    } catch (error) {
      console.error('Error saving data:', error);
      handleError(error);
    }
  };

  // Función para eliminar sesión con undo (soft delete)
  const handleEliminarSesion = async (sesion) => {
    try {
      // Marcar como eliminado en la base de datos
      const { error } = await supabase
        .from('sesiones')
        .update({ eliminado: true })
        .eq('id', sesion.id);

      if (error) throw error;

      // Eliminar del estado local
      setSesiones(prev => prev.filter(s => s.id !== sesion.id));

      // Actualizar contador de pendientes si era pendiente
      if (sesion.estado === 'Pendiente' && new Date(sesion.fecha_hora) < new Date()) {
        setSesionsPendientes(prev => Math.max(0, prev - 1));
      }

      // Mostrar toast con opción de deshacer
      if (window.showToast) {
        window.showToast(
          `Sesión de ${sesion.tipo_sesion} eliminada`,
          'success',
          5000,
          async () => {
            // Función de undo
            try {
              const { error: undoError } = await supabase
                .from('sesiones')
                .update({ eliminado: false })
                .eq('id', sesion.id);

              if (undoError) throw undoError;

              // Recargar sesiones para mostrar la restaurada
              await loadSesiones();

              if (window.showToast) {
                window.showToast('Sesión restaurada', 'success', 3000);
              }
            } catch (undoError) {
              console.error('Error al deshacer:', undoError);
              if (window.showToast) {
                window.showToast('Error al restaurar la sesión', 'error');
              }
            }
          }
        );
      }

    } catch (error) {
      console.error('Error al eliminar sesión:', error);
      if (window.showToast) {
        window.showToast('Error al eliminar la sesión: ' + error.message, 'error');
      }
    }
  };

  // Función para manejar categorización masiva
  const handleCategorizacionMasiva = async (cambios) => {
    try {
      console.log('Recibiendo cambios:', cambios);

      for (const cambio of cambios) {
        const { error } = await supabase
          .from('sesiones')
          .update({ estado: cambio.estado })
          .eq('id', cambio.id);

        if (error) {
          console.error('Error updating session:', cambio.id, error);
          throw error;
        }
        console.log('Sesión actualizada:', cambio.id, 'a estado:', cambio.estado);
      }

      // Actualizar estado local
      setSesiones(prev => prev.map(sesion => {
        const cambio = cambios.find(c => c.id === sesion.id);
        return cambio ? { ...sesion, estado: cambio.estado } : sesion;
      }));

      // Recalcular sesiones pendientes
      const hoy = new Date();
      const nuevasPendientes = sesiones.filter(s => {
        const cambio = cambios.find(c => c.id === s.id);
        const estadoFinal = cambio ? cambio.estado : s.estado;
        return estadoFinal === 'Pendiente' && new Date(s.fecha_hora) < hoy;
      }).length;

      setSesionsPendientes(Math.max(0, nuevasPendientes - cambios.length));

      console.log('Categorización completada exitosamente');

    } catch (error) {
      console.error('Error al categorizar sesiones:', error);
      alert('Error al categorizar sesiones: ' + error.message);
    }
  };

  // Función para recargar sesiones
  const loadSesiones = async () => {
    try {
      const fechaInicio = new Date();
      fechaInicio.setMonth(fechaInicio.getMonth() - 3);

      const { data, error } = await supabase
        .from('sesiones')
        .select('*')
        .eq('eliminado', false)
        .gte('fecha_hora', fechaInicio.toISOString())
        .order('fecha_hora');

      if (error) throw error;
      setSesiones(data || []);

      // Recalcular pendientes (solo no eliminadas)
      const pendientes = (data || []).filter(s =>
        s.estado === 'Pendiente' && new Date(s.fecha_hora) < new Date() && !s.eliminado
      ).length;
      setSesionsPendientes(pendientes);

    } catch (error) {
      console.error('Error loading sesiones:', error);
    }
  };

  // Renderizar vista actual
  const renderCurrentView = () => {
    switch (activeView) {
      case 'calendario':
        return (
          <CalendarioView
            sesiones={sesiones}
            pacientes={pacientes}
            supervisoras={supervisoras}
            openModal={openModal}
            currencyMode={currencyMode}
            tipoCambio={tipoCambio}
            onEliminarSesion={handleEliminarSesion}
          />
        );
      case 'pacientes':
        return (
          <PacientesView
            pacientes={pacientes}
            setPacientes={setPacientes}
            openModal={openModal}
            currencyMode={currencyMode}
            tipoCambio={tipoCambio}
          />
        );
      case 'coordinadoras':
        return (
          <SupervisorasView
            supervisoras={supervisoras}
            setSupervisoras={setSupervisoras}
            openModal={openModal}
            currencyMode={currencyMode}
            tipoCambio={tipoCambio}
          />
        );
      case 'facturar':
        return (
          <FacturarView
            pacientes={pacientes}
            supervisoras={supervisoras}
            currencyMode={currencyMode}
            tipoCambio={tipoCambio}
            alquilerConfig={alquilerConfig}
            openModal={openModal}
          />
        );
      case 'alquiler':
        return (
          <AlquilerView
            currencyMode={currencyMode}
            tipoCambio={tipoCambio}
          />
        );
      case 'entradas':
        return (
          <EntradaSView
            pacientes={pacientes}
            currencyMode={currencyMode}
            tipoCambio={tipoCambio}
          />
        );
      case 'salidas':
        return (
          <SalidasView
            supervisoras={supervisoras}
            currencyMode={currencyMode}
            tipoCambio={tipoCambio}
            alquilerConfig={alquilerConfig}
          />
        );
      default:
        return (
          <div className="glass-effect p-6 rounded-xl">
            <h3 className="text-xl font-bold mb-4">Vista no encontrada</h3>
            <p className="text-gray-600">La vista solicitada no existe.</p>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-purple-50">
        <div className="text-center p-8">
          <div className="relative mb-8">
            {/* Logo o icono principal */}
            <div className="w-24 h-24 mx-auto mb-4 relative">
              <img
                src="/jel.png"
                alt="JEL Organizador"
                className="w-full h-full object-contain"
                onError={(e) => {
                  // Fallback si no encuentra el logo
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'flex';
                }}
              />
              <div className="w-full h-full bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg hidden">
                JEL
              </div>
            </div>

            {/* Spinner animado */}
            <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-6"></div>
          </div>

          {/* Texto de carga */}
          <h1 className="text-3xl font-bold text-gray-800 mb-2">JEL Organizador</h1>
          <p className="text-lg text-purple-600 font-medium mb-4">Cargando sistema...</p>
          <p className="text-sm text-gray-500">Preparando sesiones, pacientes y facturación</p>

          {/* Barra de progreso animada */}
          <div className="w-64 h-2 bg-gray-200 rounded-full mx-auto mt-6 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-purple-700 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-purple-50 via-white to-purple-50">
      {/* Sidebar Fija */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        currencyMode={currencyMode}
        setCurrencyMode={setCurrencyMode}
        tipoCambio={tipoCambio}
        sesionsPendientes={sesionsPendientes}
        sesiones={sesiones}
        supervisoras={supervisoras}
        alquilerConfig={alquilerConfig}
      />

      {/* Contenido principal con margen para sidebar fija */}
      <div className="main-content-adjusted flex-1 flex flex-col min-h-screen">
        {/* Header simplificado - SIN botones del calendario */}
        <Header
          activeView={activeView}
          pacientes={pacientes}
          openModal={openModal}
          currentDate={new Date()}
        />

        {/* Vista principal */}
        <main className="flex-1 p-6 overflow-y-auto">
          {renderCurrentView()}
        </main>
      </div>

      {/* Modal principal */}
      <Modal
        isOpen={showModal && modalType !== 'categorizar-sesiones' && modalType !== 'day-detail'}
        onClose={closeModal}
        type={modalType}
        data={selectedItem}
        pacientes={pacientes}
        supervisoras={supervisoras}
        onSave={handleModalSave}
        currencyMode={currencyMode}
        tipoCambio={tipoCambio}
        fechaPrecargada={fechaPrecargada}  // ✅ NUEVA PROP para pre-cargar fecha
      />

      {/* Modal de categorización */}
      <CategorizarModal
        isOpen={showModal && modalType === 'categorizar-sesiones'}
        onClose={closeModal}
        sesiones={sesiones}
        pacientes={pacientes}
        supervisoras={supervisoras}
        onSave={handleCategorizacionMasiva}
        currencyMode={currencyMode}
        tipoCambio={tipoCambio}
      />

      {/* ✅ Modal de detalle del día CON FUNCIÓN DE CATEGORIZACIÓN RÁPIDA Y NUEVA SESIÓN */}
      <DayDetailModal
        isOpen={showModal && modalType === 'day-detail'}
        onClose={closeModal}
        fecha={selectedItem?.fecha}
        sesiones={selectedItem?.sesiones || []}
        pacientes={pacientes}
        supervisoras={supervisoras}
        onEditarSesion={(sesion) => openModal('edit-sesion', sesion)}
        onEliminarSesion={handleEliminarSesion}
        onCategorizarSesion={handleCategorizarSesionRapida}  // ✅ FUNCIÓN CORREGIDA
        onNuevaSesion={handleNuevaSesionConFecha}  // ✅ NUEVA PROP
        currencyMode={currencyMode}
        tipoCambio={tipoCambio}
      />

      {/* Modal de confirmación de cambios */}
      <ConfirmacionCambiosModal
        isOpen={showConfirmacionModal}
        onClose={cancelarCambiosPaciente}
        onConfirm={confirmarCambiosPaciente}
        cambiosDetectados={cambiosDetectados}
        pacienteNombre={selectedItemPendiente?.nombre_apellido || ''}
      />

      {/* Sistema de Notificaciones */}
      <ToastSystem />
    </div>
  );
}

export default App;