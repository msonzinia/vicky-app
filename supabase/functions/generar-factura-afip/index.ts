import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Interfaces
interface FacturaRequest {
  paciente_id: string;
  año: number;
  mes: number;
  monto_total: number;
  descripcion: string;
  datos_paciente: {
    nombre: string;
    documento: string;
  };
}

interface ConfiguracionAFIP {
  id: string;
  cuit: string;
  punto_venta: number;
  certificado_path: string;
  clave_privada_path: string;
  wsaa_url: string;
  wsfe_url: string;
  ambiente: string;
}

serve(async (req) => {
  // Headers CORS
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Manejar preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Solo permitir POST
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405, 
        headers: corsHeaders 
      });
    }

    const requestData: FacturaRequest = await req.json();
    
    console.log('🧾 Procesando factura AFIP:', {
      paciente_id: requestData.paciente_id,
      año: requestData.año,
      mes: requestData.mes,
      monto: requestData.monto_total
    });

    // Crear cliente Supabase con service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Obtener configuración AFIP
    console.log('⚙️ Obteniendo configuración AFIP...');
    const { data: config, error: configError } = await supabase
      .from('configuracion_afip')
      .select('*')
      .eq('activo', true)
      .single();

    if (configError || !config) {
      throw new Error('Configuración AFIP no encontrada');
    }

    console.log('✅ Configuración obtenida:', {
      cuit: config.cuit,
      punto_venta: config.punto_venta,
      ambiente: config.ambiente
    });

    // 2. Crear registro inicial en facturas_afip
    const { data: facturaDB, error: dbError } = await supabase
      .from('facturas_afip')
      .insert([{
        paciente_id: requestData.paciente_id,
        año: requestData.año,
        mes: requestData.mes,
        monto_total: requestData.monto_total,
        descripcion: requestData.descripcion,
        punto_venta: config.punto_venta,
        estado: 'generando',
        datos_afip_request: requestData
      }])
      .select()
      .single();

    if (dbError) {
      console.error('❌ Error creando registro en DB:', dbError);
      throw new Error('Error creando registro de factura');
    }

    console.log('📝 Registro creado en DB:', facturaDB.id);

    try {
      // 3. Obtener certificados del storage
      console.log('🔐 Obteniendo certificados...');
      const certificados = await obtenerCertificados(supabase, config);
      
      // 4. Autenticación con WSAA
      console.log('🔑 Autenticando con WSAA...');
      const auth = await autenticarWSAA(config, certificados);
      
      // 5. Generar factura con WSFE
      console.log('📄 Generando factura en WSFE...');
      const resultadoFactura = await generarFacturaWSFE(
        config, 
        auth, 
        requestData
      );

      // 6. Generar PDF básico
      console.log('📋 Generando PDF...');
      const pdfUrl = await generarPDFFactura(
        supabase,
        resultadoFactura,
        requestData,
        config
      );

      // 7. Actualizar registro exitoso
      const { error: updateError } = await supabase
        .from('facturas_afip')
        .update({
          numero_comprobante: resultadoFactura.numero_comprobante,
          cae: resultadoFactura.cae,
          fecha_vencimiento_cae: resultadoFactura.fecha_vencimiento_cae,
          estado: 'exitosa',
          archivo_pdf_url: pdfUrl,
          datos_afip_response: resultadoFactura,
          updated_at: new Date().toISOString()
        })
        .eq('id', facturaDB.id);

      if (updateError) {
        console.error('❌ Error actualizando registro:', updateError);
      }

      // 8. Respuesta exitosa
      return new Response(JSON.stringify({
        success: true,
        numero_comprobante: resultadoFactura.numero_comprobante,
        cae: resultadoFactura.cae,
        fecha_vencimiento_cae: resultadoFactura.fecha_vencimiento_cae,
        pdf_url: pdfUrl
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });

    } catch (afipError) {
      console.error('❌ Error en proceso AFIP:', afipError);

      // Actualizar registro con error
      await supabase
        .from('facturas_afip')
        .update({
          estado: 'error',
          error_mensaje: afipError.message,
          updated_at: new Date().toISOString()
        })
        .eq('id', facturaDB.id);

      throw afipError;
    }

  } catch (error) {
    console.error('❌ Error general:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

async function obtenerCertificados(supabase: any, config: ConfiguracionAFIP) {
  try {
    // Obtener certificado
    const { data: certData, error: certError } = await supabase.storage
      .from('certificados-afip')
      .download(config.certificado_path.replace('certificados-afip/', ''));

    if (certError) {
      throw new Error(`Error obteniendo certificado: ${certError.message}`);
    }

    // Obtener clave privada
    const { data: keyData, error: keyError } = await supabase.storage
      .from('certificados-afip')
      .download(config.clave_privada_path.replace('certificados-afip/', ''));

    if (keyError) {
      throw new Error(`Error obteniendo clave privada: ${keyError.message}`);
    }

    const certificado = await certData.text();
    const clavePrivada = await keyData.text();

    console.log('✅ Certificados obtenidos correctamente');

    return { certificado, clavePrivada };
  } catch (error) {
    console.error('❌ Error obteniendo certificados:', error);
    throw new Error('No se pudieron obtener los certificados de AFIP');
  }
}

async function autenticarWSAA(config: ConfiguracionAFIP, certificados: any) {
  try {
    // Crear TRA (Ticket de Requerimiento de Acceso)
    const tra = crearTRA();
    console.log('📝 TRA creado');

    // TODO: Implementar firma PKCS#7 real
    // Por ahora usamos una implementación básica
    const traFirmado = await firmarTRA(tra, certificados.certificado, certificados.clavePrivada);
    console.log('🔏 TRA firmado');

    // Enviar a WSAA
    const tokenData = await enviarWSAA(config.wsaa_url, traFirmado);
    console.log('🎟️ Token obtenido de WSAA');

    return tokenData;
  } catch (error) {
    console.error('❌ Error en autenticación WSAA:', error);
    throw new Error(`Error autenticando con AFIP: ${error.message}`);
  }
}

async function generarFacturaWSFE(config: ConfiguracionAFIP, auth: any, datos: FacturaRequest) {
  try {
    // Obtener último número de comprobante
    const ultimoNumero = await obtenerUltimoNumero(config, auth);
    const numeroComprobante = ultimoNumero + 1;

    console.log(`📊 Generando factura número: ${numeroComprobante}`);

    // Crear solicitud de factura
    const solicitudFactura = crearSolicitudFactura(
      config,
      auth,
      numeroComprobante,
      datos
    );

    // Enviar a WSFE
    const respuestaAFIP = await enviarWSFE(config.wsfe_url, solicitudFactura);

    // Procesar respuesta
    const resultado = procesarRespuestaWSFE(respuestaAFIP, numeroComprobante);
    
    console.log('✅ Factura generada exitosamente:', resultado);

    return resultado;
  } catch (error) {
    console.error('❌ Error generando factura WSFE:', error);
    throw new Error(`Error generando factura en AFIP: ${error.message}`);
  }
}

function crearTRA(): string {
  const now = new Date();
  const from = new Date(now.getTime() - 2 * 60 * 1000); // 2 minutos atrás
  const to = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 horas adelante

  return `<?xml version="1.0" encoding="UTF-8"?>
<loginTicketRequest version="1.0">
  <header>
    <uniqueId>${Date.now()}</uniqueId>
    <generationTime>${from.toISOString()}</generationTime>
    <expirationTime>${to.toISOString()}</expirationTime>
  </header>
  <service>wsfe</service>
</loginTicketRequest>`;
}

async function firmarTRA(tra: string, certificado: string, clavePrivada: string): Promise<string> {
  // IMPORTANTE: Esta es una implementación simplificada
  // En producción real, necesitarías implementar firma PKCS#7 completa
  
  console.log('⚠️ Usando firma simplificada (para testing)');
  
  // Por ahora, codificamos en base64 como placeholder
  // TODO: Implementar firma PKCS#7 real con crypto
  const traEncoded = btoa(tra);
  return traEncoded;
}

async function enviarWSAA(wsaaUrl: string, traFirmado: string) {
  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:log="https://wsaa.afip.gov.ar/ws/services/LoginCms">
  <soapenv:Header/>
  <soapenv:Body>
    <log:loginCms>
      <log:in0>${traFirmado}</log:in0>
    </log:loginCms>
  </soapenv:Body>
</soapenv:Envelope>`;

  const response = await fetch(wsaaUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': ''
    },
    body: soapEnvelope
  });

  if (!response.ok) {
    throw new Error(`Error WSAA HTTP ${response.status}: ${response.statusText}`);
  }

  const responseText = await response.text();
  
  // Buscar errores primero
  if (responseText.includes('<soap:Fault>') || responseText.includes('<faultstring>')) {
    const errorMatch = responseText.match(/<faultstring>(.*?)<\/faultstring>/);
    throw new Error(`Error WSAA: ${errorMatch ? errorMatch[1] : 'Error desconocido'}`);
  }

  // Extraer token y sign
  const tokenMatch = responseText.match(/<token>(.*?)<\/token>/);
  const signMatch = responseText.match(/<sign>(.*?)<\/sign>/);

  if (!tokenMatch || !signMatch) {
    console.log('Respuesta WSAA completa:', responseText);
    throw new Error('No se pudo obtener token de WSAA. Verificar certificados.');
  }

  return {
    token: tokenMatch[1],
    sign: signMatch[1]
  };
}

async function obtenerUltimoNumero(config: ConfiguracionAFIP, auth: any): Promise<number> {
  const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ser:FECompUltimoAutorizado>
      <ser:Auth>
        <ser:Token>${auth.token}</ser:Token>
        <ser:Sign>${auth.sign}</ser:Sign>
        <ser:Cuit>${config.cuit}</ser:Cuit>
      </ser:Auth>
      <ser:PtoVta>${config.punto_venta}</ser:PtoVta>
      <ser:CbteTipo>11</ser:CbteTipo>
    </ser:FECompUltimoAutorizado>
  </soapenv:Body>
</soapenv:Envelope>`;

  const response = await fetch(config.wsfe_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': ''
    },
    body: soapEnvelope
  });

  if (!response.ok) {
    throw new Error(`Error WSFE HTTP ${response.status}`);
  }

  const responseText = await response.text();
  const numeroMatch = responseText.match(/<CbteNro>(.*?)<\/CbteNro>/);
  
  return numeroMatch ? parseInt(numeroMatch[1]) : 0;
}

function crearSolicitudFactura(config: ConfiguracionAFIP, auth: any, numeroComprobante: number, datos: FacturaRequest) {
  const fechaHoy = new Date().toISOString().split('T')[0].replace(/-/g, '');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://ar.gov.afip.dif.FEV1/">
  <soapenv:Header/>
  <soapenv:Body>
    <ser:FECAESolicitar>
      <ser:Auth>
        <ser:Token>${auth.token}</ser:Token>
        <ser:Sign>${auth.sign}</ser:Sign>
        <ser:Cuit>${config.cuit}</ser:Cuit>
      </ser:Auth>
      <ser:FeCAEReq>
        <ser:FeCabReq>
          <ser:CantReg>1</ser:CantReg>
          <ser:PtoVta>${config.punto_venta}</ser:PtoVta>
          <ser:CbteTipo>11</ser:CbteTipo>
        </ser:FeCabReq>
        <ser:FeDetReq>
          <ser:FECAEDetRequest>
            <ser:Concepto>2</ser:Concepto>
            <ser:DocTipo>80</ser:DocTipo>
            <ser:DocNro>${datos.datos_paciente.documento}</ser:DocNro>
            <ser:CbteDesde>${numeroComprobante}</ser:CbteDesde>
            <ser:CbteHasta>${numeroComprobante}</ser:CbteHasta>
            <ser:CbteFch>${fechaHoy}</ser:CbteFch>
            <ser:ImpTotal>${datos.monto_total.toFixed(2)}</ser:ImpTotal>
            <ser:ImpTotConc>0.00</ser:ImpTotConc>
            <ser:ImpNeto>${datos.monto_total.toFixed(2)}</ser:ImpNeto>
            <ser:ImpOpEx>0.00</ser:ImpOpEx>
            <ser:ImpIVA>0.00</ser:ImpIVA>
            <ser:ImpTrib>0.00</ser:ImpTrib>
            <ser:MonId>PES</ser:MonId>
            <ser:MonCotiz>1.000000</ser:MonCotiz>
            <ser:FchServDesde>${fechaHoy}</ser:FchServDesde>
            <ser:FchServHasta>${fechaHoy}</ser:FchServHasta>
            <ser:FchVtoPago>${fechaHoy}</ser:FchVtoPago>
          </ser:FECAEDetRequest>
        </ser:FeDetReq>
      </ser:FeCAEReq>
    </ser:FECAESolicitar>
  </soapenv:Body>
</soapenv:Envelope>`;
}

async function enviarWSFE(wsfeUrl: string, solicitud: string) {
  const response = await fetch(wsfeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': ''
    },
    body: solicitud
  });

  if (!response.ok) {
    throw new Error(`Error WSFE HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.text();
}

function procesarRespuestaWSFE(responseText: string, numeroComprobante: number) {
  // Buscar errores primero
  if (responseText.includes('<Err>')) {
    const errorMatch = responseText.match(/<Msg>(.*?)<\/Msg>/);
    throw new Error(`Error AFIP: ${errorMatch ? errorMatch[1] : 'Error desconocido en facturación'}`);
  }

  // Extraer CAE y fecha de vencimiento
  const caeMatch = responseText.match(/<CAE>(.*?)<\/CAE>/);
  const fechaVtoMatch = responseText.match(/<CAEFchVto>(.*?)<\/CAEFchVto>/);

  if (!caeMatch) {
    console.log('Respuesta WSFE completa:', responseText);
    throw new Error('No se pudo obtener CAE de AFIP. Verificar datos enviados.');
  }

  return {
    numero_comprobante: numeroComprobante,
    cae: caeMatch[1],
    fecha_vencimiento_cae: fechaVtoMatch ? fechaVtoMatch[1] : null
  };
}

async function generarPDFFactura(supabase: any, factura: any, datos: FacturaRequest, config: ConfiguracionAFIP): Promise<string> {
  try {
    // Generar contenido PDF básico
    const fechaHoy = new Date().toLocaleDateString('es-AR');
    const nombreMes = new Date(datos.año, datos.mes - 1).toLocaleDateString('es-AR', { 
      month: 'long', 
      year: 'numeric' 
    });

    const pdfContent = `FACTURA ELECTRÓNICA - TIPO C

Punto de Venta: ${config.punto_venta.toString().padStart(4, '0')}
Número: ${factura.numero_comprobante.toString().padStart(8, '0')}
Fecha: ${fechaHoy}

CAE: ${factura.cae}
Fecha Vto CAE: ${factura.fecha_vencimiento_cae || 'N/A'}

VENDEDOR:
${config.nombre_contribuyente || 'Victoria Güemes'}
CUIT: ${config.cuit}

COMPRADOR:
${datos.datos_paciente.nombre}
CUIT: ${datos.datos_paciente.documento}

DETALLE:
${datos.descripcion}

PERÍODO: ${nombreMes}

IMPORTE TOTAL: $${datos.monto_total.toFixed(2)}

Este comprobante fue generado electrónicamente y autorizado por AFIP.
`;

    // Subir PDF al storage
    const fileName = `factura-${config.punto_venta}-${factura.numero_comprobante}-${Date.now()}.txt`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('facturas-pdf')
      .upload(fileName, pdfContent, {
        contentType: 'text/plain'
      });

    if (uploadError) {
      console.error('❌ Error subiendo PDF:', uploadError);
      return '';
    }

    // Obtener URL pública
    const { data: urlData } = supabase.storage
      .from('facturas-pdf')
      .getPublicUrl(fileName);

    console.log('📄 PDF generado:', urlData.publicUrl);
    return urlData.publicUrl;

  } catch (error) {
    console.error('❌ Error generando PDF:', error);
    return '';
  }
}