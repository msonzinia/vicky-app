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
import ConflictoHorarioModal from './components/ConflictoHorarioModal';
import ToastSystem from './components/ToastSystem';

function App() {
  // Estados principales
  const [activeView, setActiveView] = useState('calendario');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [currencyMode, setCurrencyMode] = useState('ARS');
  const [loading, setLoading] = useState(true);
  const [fechaPrecargada, setFechaPrecargada] = useState(null);

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

  // Estados para validación de conflictos
  const [showConflictoModal, setShowConflictoModal] = useState(false);
  const [conflictoDetectado, setConflictoDetectado] = useState(null);
  const [sesionConConflicto, setSesionConConflicto] = useState(null);

  // ============================================================================
  // ✅ FUNCIONES CORREGIDAS PARA FECHAS EN ARGENTINA (UTC-3)
  // ============================================================================

  const convertirFechaParaGuardar = (fechaInput) => {
    if (!fechaInput) return null;

    try {
      const [fechaStr, horaStr] = fechaInput.split('T');
      const [año, mes, dia] = fechaStr.split('-').map(Number);
      const [hora, minuto] = horaStr.split(':').map(Number);

      // Crear fecha local
      const fechaLocal = new Date(año, mes - 1, dia, hora, minuto);

      // Construir manualmente string local sin timezone
      const pad = (n) => String(n).padStart(2, '0');
      const fechaFinal = `${año}-${pad(mes)}-${pad(dia)} ${pad(hora)}:${pad(minuto)}:00`;

      console.log('🕐 Fecha final local para guardar:', fechaFinal);

      return fechaFinal;
    } catch (error) {
      console.error('❌ Error convirtiendo fecha para guardar:', error);
      return fechaInput;
    }
  };


  const convertirFechaParaInput = (fechaISO) => {
    if (!fechaISO) return '';

    try {
      console.log('📅 Convirtiendo fecha ISO a input (Argentina):', fechaISO);

      const fecha = new Date(fechaISO);

      // Usar métodos locales para mantener zona horaria
      const año = fecha.getFullYear();
      const mes = String(fecha.getMonth() + 1).padStart(2, '0');
      const dia = String(fecha.getDate()).padStart(2, '0');
      const horas = String(fecha.getHours()).padStart(2, '0');
      const minutos = String(fecha.getMinutes()).padStart(2, '0');

      const fechaFormateada = `${año}-${mes}-${dia}T${horas}:${minutos}`;

      console.log('📅 ISO original:', fechaISO);
      console.log('📅 Fecha parseada:', fecha.toString());
      console.log('📅 Para input:', fechaFormateada);

      return fechaFormateada;
    } catch (error) {
      console.error('❌ Error formateando fecha para input:', error);
      return '';
    }
  };

  const diagnosticarFechasEnSesiones = async () => {
    try {
      console.log('🔍 Iniciando diagnóstico de fechas...');

      const { data: sesiones, error } = await supabase
        .from('sesiones')
        .select('id, fecha_hora, tipo_sesion')
        .eq('eliminado', false)
        .order('fecha_hora')
        .limit(50);

      if (error) throw error;

      console.log(`📊 Analizando ${sesiones.length} sesiones...`);

      sesiones.forEach((sesion, index) => {
        const fecha = new Date(sesion.fecha_hora);
        const fechaLocal = new Date(fecha.toLocaleString());

        console.log(`Sesión ${index + 1}:`, {
          id: sesion.id,
          tipo: sesion.tipo_sesion,
          fecha_iso: sesion.fecha_hora,
          fecha_parseada: fecha.toString(),
          fecha_local: fechaLocal.toString(),
          dia_semana: fecha.getDay(),
          hora: fecha.getHours() + ':' + fecha.getMinutes().toString().padStart(2, '0')
        });
      });

      console.log('✅ Diagnóstico completado');

    } catch (error) {
      console.error('❌ Error en diagnóstico:', error);
    }
  };

  const diagnosticarZonaHoraria = () => {
    console.log('🔍 DIAGNÓSTICO DE ZONA HORARIA ARGENTINA:');

    const ahora = new Date();
    console.log('📊 Información actual:', {
      zona: Intl.DateTimeFormat().resolvedOptions().timeZone,
      offset_UTC: ahora.getTimezoneOffset() + ' minutos',
      hora_local: ahora.toLocaleString('es-AR'),
      hora_UTC: ahora.toUTCString(),
      ISO: ahora.toISOString()
    });

    // Probar conversión de 10:00 AM
    const testInput = '2025-01-30T10:00';
    const fechaGuardada = convertirFechaParaGuardar(testInput);
    const fechaParaInput = convertirFechaParaInput(fechaGuardada);

    console.log('🧪 PRUEBA 10:00 AM:');
    console.log('  1. Input:', testInput);
    console.log('  2. Para guardar:', fechaGuardada);
    console.log('  3. Para mostrar:', fechaParaInput);
    console.log('  4. ¿Coincide?:', testInput === fechaParaInput ? '✅ CORRECTO' : '❌ ERROR');

    if (fechaGuardada) {
      const fechaDB = new Date(fechaGuardada);
      console.log('🗄️ En base de datos se ve como:', fechaDB.toLocaleString('es-AR'));
    }
  };

  // ============================================================================
  // FUNCIONES PARA VALIDACIÓN DE CONFLICTOS
  // ============================================================================

  const verificarConflictoHorario = async (fechaHora, duracionHoras = 1.0, excluirSesionId = null) => {
    try {
      console.log('🔍 Verificando conflicto de horario...');
      console.log('Fecha/hora:', fechaHora);
      console.log('Duración:', duracionHoras);
      console.log('Excluir sesión ID:', excluirSesionId);

      const { data, error } = await supabase.rpc('verificar_conflicto_horario', {
        p_fecha_hora: fechaHora,
        p_duracion_horas: duracionHoras,
        p_excluir_sesion_id: excluirSesionId
      });

      if (error) {
        console.error('Error verificando conflicto:', error);
        return null;
      }

      console.log('Resultado verificación:', data);

      if (data && data.length > 0) {
        const conflicto = data[0];

        if (conflicto.conflicto) {
          return {
            hayConflicto: true,
            sesionConflictiva: {
              id: conflicto.sesion_conflictiva_id,
              pacienteNombre: conflicto.paciente_nombre,
              supervisoraNombre: conflicto.supervisora_nombre
            }
          };
        }
      }

      return { hayConflicto: false };

    } catch (error) {
      console.error('Error en verificación de conflicto:', error);
      return null;
    }
  };

  const procederConGuardadoNormal = async (formData) => {
    if (modalType === 'add-paciente') {
      await ejecutarGuardadoPaciente(formData, false);
    } else if (modalType === 'edit-paciente') {
      const cambios = detectarCambiosPaciente(selectedItem, formData);
      if (cambios.mostrarModal) {
        setCambiosDetectados(cambios);
        setFormDataPendiente(formData);
        setSelectedItemPendiente(selectedItem);
        setShowModal(false);
        setShowConfirmacionModal(true);
        return;
      } else {
        await ejecutarGuardadoPaciente(formData, true);
      }
    } else {
      await ejecutarGuardadoOtrosTipos(formData);
    }
  };

  const confirmarCreacionConConflicto = async () => {
    try {
      console.log('✅ Usuario confirmó creación a pesar del conflicto');

      setShowConflictoModal(false);

      if (sesionConConflicto) {
        await procederConGuardadoNormal(sesionConConflicto);
        setSesionConConflicto(null);
        setConflictoDetectado(null);
      }
    } catch (error) {
      console.error('Error confirmando creación con conflicto:', error);
      handleError(error);
    }
  };

  const cancelarCreacionPorConflicto = () => {
    console.log('❌ Usuario canceló creación por conflicto');

    setShowConflictoModal(false);
    setSesionConConflicto(null);
    setConflictoDetectado(null);

    if (window.showToast) {
      window.showToast('💡 Cambia la fecha/hora para evitar la superposición', 'info', 4000);
    }
  };

  // Exponer funciones de diagnóstico
  useEffect(() => {
    window.diagnosticarFechasEnSesiones = diagnosticarFechasEnSesiones;
    window.diagnosticarZonaHoraria = diagnosticarZonaHoraria;
    return () => {
      delete window.diagnosticarFechasEnSesiones;
      delete window.diagnosticarZonaHoraria;
    };
  }, []);

  // Cargar datos iniciales
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);

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
        .order('eliminado')
        .order('activo', { ascending: false })
        .order('nombre_apellido');

      if (pacientesError) throw pacientesError;

      const pacientesConHorarios = (pacientesData || []).map(paciente => ({
        ...paciente,
        horarios: paciente.horarios_pacientes || []
      }));

      setPacientes(pacientesConHorarios);

      const { data: supervisorasData, error: supervisorasError } = await supabase
        .from('supervisoras')
        .select('*')
        .eq('eliminado', false)
        .order('nombre_apellido');

      if (supervisorasError) throw supervisorasError;
      setSupervisoras(supervisorasData || []);

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

      const pendientes = (sesionesData || []).filter(s =>
        s.estado === 'Pendiente' && new Date(s.fecha_hora) < new Date() && !s.eliminado
      ).length;
      setSesionsPendientes(pendientes);

      const { data: alquilerData, error: alquilerError } = await supabase
        .from('configuracion_alquiler')
        .select('*')
        .limit(1)
        .single();

      if (!alquilerError && alquilerData) {
        setAlquilerConfig(alquilerData);
      }

      setTipoCambio(1150);

    } catch (error) {
      console.error('Error loading data:', error);
      loadExampleData();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pacientes.length > 0) {
      const eliminados = pacientes.filter(p => p.eliminado);
      console.log('✅ Pacientes eliminados cargados:', eliminados.length);
      if (eliminados.length > 0) {
        console.log('Lista de eliminados:', eliminados.map(p => p.nombre_apellido));
      }
    }
  }, [pacientes]);

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

    const sesionesEjemplo = [];
    const hoy = new Date();
    for (let i = -7; i <= 30; i++) {
      const fecha = new Date(hoy);
      fecha.setDate(hoy.getDate() + i);
      fecha.setHours(10, 0, 0, 0);

      if (fecha.getDay() === 2) {
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
      if (fecha.getDay() === 4) {
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

    const pendientes = sesionesEjemplo.filter(s =>
      s.estado === 'Pendiente' && new Date(s.fecha_hora) < hoy && !s.eliminado
    ).length;
    setSesionsPendientes(pendientes);
  };

  const actualizarSesionLocal = (sesionActualizada) => {
    console.log('Actualizando sesión local:', sesionActualizada);

    setSesiones(prev => prev.map(s =>
      s.id === sesionActualizada.id ? { ...s, ...sesionActualizada } : s
    ));

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

  const handleCategorizarSesionRapida = async (sesionOriginal, nuevoEstado) => {
    try {
      console.log('=== CATEGORIZACIÓN RÁPIDA ===');
      console.log('Sesión original:', sesionOriginal);
      console.log('Nuevo estado:', nuevoEstado);

      const updateData = {
        estado: nuevoEstado,
      };

      const { error } = await supabase
        .from('sesiones')
        .update(updateData)
        .eq('id', sesionOriginal.id);

      if (error) throw error;

      const sesionActualizada = {
        ...sesionOriginal,
        estado: nuevoEstado
      };

      actualizarSesionLocal(sesionActualizada);

      const hoy = new Date();
      const esPasada = new Date(sesionOriginal.fecha_hora) < hoy;
      const eraPendiente = sesionOriginal.estado === 'Pendiente';
      const esAhoraPendiente = nuevoEstado === 'Pendiente';

      if (esPasada && eraPendiente && !esAhoraPendiente) {
        setSesionsPendientes(prev => Math.max(0, prev - 1));
      } else if (esPasada && !eraPendiente && esAhoraPendiente) {
        setSesionsPendientes(prev => prev + 1);
      }

      return true;
    } catch (error) {
      console.error('Error en categorización rápida:', error);
      return false;
    }
  };

  const detectarCambiosPaciente = (selectedItem, formData) => {
    const cambiosInfo = {};
    const horariosEditados = [];
    const horariosNuevos = [];
    const horariosEliminados = [];

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

    const esReactivacion = !selectedItem.activo && formData.activo;
    const esDesactivacion = selectedItem.activo && !formData.activo;

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

    const horariosIguales = (h1, h2) => {
      return h1.dia_semana === h2.dia_semana && h1.hora_inicio === h2.hora_inicio;
    };

    const getDiaTexto = (dia) => {
      const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      return dias[dia];
    };

    horariosOriginales.forEach(horarioOriginal => {
      const existeEnNuevo = horariosNuevosForm.some(horarioNuevo => {
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

    horariosNuevosForm.forEach(horarioNuevo => {
      const existeEnOriginal = horariosOriginales.some(horarioOriginal => {
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

    const hayCambiosSignificativos =
      Object.keys(cambiosInfo).length > 0 ||
      horariosEditados.length > 0 ||
      horariosNuevos.length > 0 ||
      horariosEliminados.length > 0 ||
      esReactivacion ||
      esDesactivacion;

    return {
      cambiosInfo,
      horariosEditados,
      horariosNuevos,
      horariosEliminados,
      esReactivacion,
      esDesactivacion,
      mostrarModal: hayCambiosSignificativos,
      hayCambiosHorarios: horariosEditados.length > 0 || horariosNuevos.length > 0 || horariosEliminados.length > 0
    };
  };

  const openModal = (type, item = null) => {
    setModalType(type);
    setSelectedItem(item);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType('');
    setSelectedItem(null);
    setFechaPrecargada(null);
  };

  const handleNuevaSesionConFecha = (fechaFormateada) => {
    console.log('Creando nueva sesión con fecha pre-cargada:', fechaFormateada);
    setFechaPrecargada(fechaFormateada);
    setShowModal(false);
    setTimeout(() => {
      openModal('add-sesion');
    }, 100);
  };

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

  const cancelarCambiosPaciente = () => {
    console.log('Cancelando cambios de paciente...');

    setShowConfirmacionModal(false);
    setFormDataPendiente(null);
    setSelectedItemPendiente(null);
    setCambiosDetectados({});

    if (window.showToast) {
      window.showToast('Cambios cancelados', 'info', 2000);
    }
  };

  const ejecutarGuardadoPaciente = async (formData, esEdicion, selectedItemParam = null) => {
    try {
      if (!esEdicion) {
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
        console.log('=== EDITANDO PACIENTE ===');

        const itemToEdit = selectedItemParam || selectedItem;
        if (!itemToEdit?.id) {
          throw new Error('Paciente no encontrado para editar');
        }

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

        const cambiosPrecio = formData.precio_por_hora !== itemToEdit.precio_por_hora;
        const esReactivacion = !itemToEdit.activo && formData.activo;
        const esDesactivacion = itemToEdit.activo && !formData.activo;

        const horariosAntes = JSON.stringify((itemToEdit.horarios || []).map(h =>
          ({ dia_semana: h.dia_semana, hora_inicio: h.hora_inicio })
        ).sort());
        const horariosAhora = JSON.stringify((formData.horarios || []).map(h =>
          ({ dia_semana: h.dia_semana, hora_inicio: h.hora_inicio })
        ).sort());
        const hayCambiosHorarios = horariosAntes !== horariosAhora;

        if (esDesactivacion) {
          const { data: resultado, error: inactivarError } = await supabase.rpc('inactivar_paciente_completo', {
            p_paciente_id: itemToEdit.id
          });

          if (inactivarError) {
            console.error('Error inactivando:', inactivarError);
          } else {
            console.log('✅ Resultado inactivación:', resultado);
          }
        }

        if (esReactivacion) {
          if (hayCambiosHorarios) {
            const { data: resultadoHorarios, error: horariosError } = await supabase.rpc('gestionar_horarios_paciente', {
              p_paciente_id: itemToEdit.id,
              p_horarios_json: formData.horarios || [],
              p_accion: 'actualizar_completo'
            });

            if (horariosError) {
              console.error('Error actualizando horarios:', horariosError);
            }
          }

          const { data: resultado, error: reactivarError } = await supabase.rpc('reactivar_paciente_completo', {
            p_paciente_id: itemToEdit.id
          });

          if (reactivarError) {
            console.error('Error reactivando:', reactivarError);
          }
        }

        if (hayCambiosHorarios && formData.activo && !esReactivacion) {
          const { data: resultado, error: horariosError } = await supabase.rpc('gestionar_horarios_paciente', {
            p_paciente_id: itemToEdit.id,
            p_horarios_json: formData.horarios || [],
            p_accion: 'actualizar_completo'
          });

          if (horariosError) {
            console.error('Error gestionando horarios:', horariosError);
          }
        }

        if (cambiosPrecio && !esReactivacion && !esDesactivacion && !hayCambiosHorarios) {
          const { data: resultado, error: preciosError } = await supabase.rpc('actualizar_precios_futuros_paciente', {
            p_paciente_id: itemToEdit.id,
            p_nuevo_precio: formData.precio_por_hora
          });

          if (preciosError) {
            console.error('Error actualizando precios:', preciosError);
          }
        }

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

      await loadSesiones();
      closeModal();

    } catch (error) {
      console.error('Error saving patient:', error);
      handleError(error);
    }
  };

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

    } else if (modalType === 'edit-supervisora') {
      const { error } = await supabase
        .from('supervisoras')
        .update(formData)
        .eq('id', selectedItem.id);

      if (error) throw error;

      setSupervisoras(prev => prev.map(s =>
        s.id === selectedItem.id ? { ...s, ...formData } : s
      ));

    } else if (modalType === 'add-sesion') {
      console.log('=== CREANDO NUEVA SESIÓN ===');
      console.log('FormData recibido:', formData);

      const sesionData = {
        ...formData,
        fecha_hora: convertirFechaParaGuardar(formData.fecha_hora),
        auto_generada: false,
        modificada_manualmente: false,
        eliminado: false
      };

      console.log('Datos finales para insertar:', sesionData);

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
      console.log('=== EDITANDO SESIÓN ===');

      const fechaConvertida = convertirFechaParaGuardar(formData.fecha_hora);
      const fechaOriginal = selectedItem.fecha_hora;

      const fechaOrg = new Date(fechaOriginal);
      const fechaNueva = new Date(fechaConvertida);
      const diferencia = Math.abs(fechaNueva.getTime() - fechaOrg.getTime());
      const seCambioFechaHora = diferencia > 60000;

      const updateData = {
        ...formData,
        fecha_hora: fechaConvertida,
        modificada_manualmente: seCambioFechaHora ? true : (selectedItem.modificada_manualmente || false)
      };

      const { error } = await supabase
        .from('sesiones')
        .update(updateData)
        .eq('id', selectedItem.id);

      if (error) throw error;

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

  // FUNCIÓN PRINCIPAL CON VALIDACIÓN DE CONFLICTOS
  const handleModalSave = async (formData) => {
    try {
      console.log('Guardando con verificación de conflictos:', { modalType, formData });

      // Validar conflictos solo para sesiones
      if (modalType === 'add-sesion' || modalType === 'edit-sesion') {
        const fechaHoraParaValidar = convertirFechaParaGuardar(formData.fecha_hora);
        const excluirId = modalType === 'edit-sesion' ? selectedItem?.id : null;

        console.log('Validando conflicto para sesión...');
        const resultadoConflicto = await verificarConflictoHorario(
          fechaHoraParaValidar,
          formData.duracion_horas || 1.0,
          excluirId
        );

        if (resultadoConflicto && resultadoConflicto.hayConflicto) {
          console.log('⚠️ Conflicto detectado:', resultadoConflicto);

          setConflictoDetectado(resultadoConflicto);
          setSesionConConflicto(formData);
          setShowConflictoModal(true);
          return;
        }
      }

      await procederConGuardadoNormal(formData);

    } catch (error) {
      console.error('Error en guardado con validación de conflictos:', error);
      handleError(error);
    }
  };

  const handleEliminarSesion = async (sesion) => {
    try {
      const { error } = await supabase
        .from('sesiones')
        .update({ eliminado: true })
        .eq('id', sesion.id);

      if (error) throw error;

      setSesiones(prev => prev.filter(s => s.id !== sesion.id));

      if (sesion.estado === 'Pendiente' && new Date(sesion.fecha_hora) < new Date()) {
        setSesionsPendientes(prev => Math.max(0, prev - 1));
      }

      if (window.showToast) {
        window.showToast(
          `Sesión de ${sesion.tipo_sesion} eliminada`,
          'success',
          5000,
          async () => {
            try {
              const { error: undoError } = await supabase
                .from('sesiones')
                .update({ eliminado: false })
                .eq('id', sesion.id);

              if (undoError) throw undoError;

              await loadSesiones();

              if (window.showToast) {
                window.showToast('Sesión restaurada', 'success', 3000);
              }
            } catch (undoError) {
              console.error('Error al deshacer:', undoError);
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

  const handleCategorizacionMasiva = async (cambios) => {
    try {
      for (const cambio of cambios) {
        const { error } = await supabase
          .from('sesiones')
          .update({ estado: cambio.estado })
          .eq('id', cambio.id);

        if (error) {
          console.error('Error updating session:', cambio.id, error);
          throw error;
        }
      }

      setSesiones(prev => prev.map(sesion => {
        const cambio = cambios.find(c => c.id === sesion.id);
        return cambio ? { ...sesion, estado: cambio.estado } : sesion;
      }));

      const hoy = new Date();
      const nuevasPendientes = sesiones.filter(s => {
        const cambio = cambios.find(c => c.id === s.id);
        const estadoFinal = cambio ? cambio.estado : s.estado;
        return estadoFinal === 'Pendiente' && new Date(s.fecha_hora) < hoy;
      }).length;

      setSesionsPendientes(Math.max(0, nuevasPendientes - cambios.length));

    } catch (error) {
      console.error('Error al categorizar sesiones:', error);
      alert('Error al categorizar sesiones: ' + error.message);
    }
  };

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

      const pendientes = (data || []).filter(s =>
        s.estado === 'Pendiente' && new Date(s.fecha_hora) < new Date() && !s.eliminado
      ).length;
      setSesionsPendientes(pendientes);

    } catch (error) {
      console.error('Error loading sesiones:', error);
    }
  };

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
            <div className="w-24 h-24 mx-auto mb-4 relative">
              <img
                src="/jel.png"
                alt="JEL Organizador"
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'flex';
                }}
              />
              <div className="w-full h-full bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-lg hidden">
                JEL
              </div>
            </div>
            <div className="w-16 h-16 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-6"></div>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">JEL Organizador</h1>
          <p className="text-lg text-purple-600 font-medium mb-4">Cargando sistema...</p>
          <p className="text-sm text-gray-500">Preparando sesiones, pacientes y facturación</p>
          <div className="w-64 h-2 bg-gray-200 rounded-full mx-auto mt-6 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-purple-700 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-purple-50 via-white to-purple-50">
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

      <div className="main-content-adjusted flex-1 flex flex-col min-h-screen">
        <Header
          activeView={activeView}
          pacientes={pacientes}
          openModal={openModal}
          currentDate={new Date()}
        />

        <main className="flex-1 p-6 overflow-y-auto">
          {renderCurrentView()}
        </main>
      </div>

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
        fechaPrecargada={fechaPrecargada}
      />

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

      <DayDetailModal
        isOpen={showModal && modalType === 'day-detail'}
        onClose={closeModal}
        fecha={selectedItem?.fecha}
        sesiones={selectedItem?.sesiones || []}
        pacientes={pacientes}
        supervisoras={supervisoras}
        onEditarSesion={(sesion) => openModal('edit-sesion', sesion)}
        onEliminarSesion={handleEliminarSesion}
        onCategorizarSesion={handleCategorizarSesionRapida}
        onNuevaSesion={handleNuevaSesionConFecha}
        currencyMode={currencyMode}
        tipoCambio={tipoCambio}
      />

      <ConfirmacionCambiosModal
        isOpen={showConfirmacionModal}
        onClose={cancelarCambiosPaciente}
        onConfirm={confirmarCambiosPaciente}
        cambiosDetectados={cambiosDetectados}
        pacienteNombre={selectedItemPendiente?.nombre_apellido || ''}
      />

      <ConflictoHorarioModal
        isOpen={showConflictoModal}
        onClose={cancelarCreacionPorConflicto}
        onConfirmar={confirmarCreacionConConflicto}
        conflictoDetectado={conflictoDetectado}
        sesionNueva={sesionConConflicto}
      />

      <ToastSystem />
    </div>
  );
}

export default App;