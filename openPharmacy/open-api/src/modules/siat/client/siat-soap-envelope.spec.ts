import { SiatFaultError, SiatProtocolError } from './siat-errors';
import { SIAT_OPERATIONS } from './siat-operations';
import { buildEnvelope, escapeXml, parseResponse } from './siat-soap-envelope';

const CUIS = SIAT_OPERATIONS.FacturacionCodigos.cuis;
const VERIFICAR_NIT = SIAT_OPERATIONS.FacturacionCodigos.verificarNit;

/** A response shaped like the pinned schema: cuisResponse > RespuestaCuis. */
const CUIS_OK = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <ns2:cuisResponse xmlns:ns2="https://siat.impuestos.gob.bo/">
      <RespuestaCuis>
        <codigo>ABC123</codigo>
        <fechaVigencia>2026-11-20T23:59:59.000</fechaVigencia>
        <mensajesList><codigo>908</codigo><descripcion>VALIDADA</descripcion></mensajesList>
        <mensajesList><codigo>1</codigo><descripcion>Aviso</descripcion></mensajesList>
        <transaccion>true</transaccion>
      </RespuestaCuis>
    </ns2:cuisResponse>
  </soap:Body>
</soap:Envelope>`;

function soapWithBody(body: string): string {
  return `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${body}</soap:Body></soap:Envelope>`;
}

describe('buildEnvelope', () => {
  it('wraps the payload in the operation element in the SIAT namespace', () => {
    const xml = buildEnvelope(CUIS, { codigoAmbiente: 2, nit: 123456 });

    expect(xml).toContain(
      '<ns1:cuis xmlns:ns1="https://siat.impuestos.gob.bo/">',
    );
    expect(xml).toContain(
      '<codigoAmbiente>2</codigoAmbiente><nit>123456</nit>',
    );
    expect(xml).toContain('</ns1:cuis>');
  });

  it('keeps the payload keys in the order the caller gives them', () => {
    const xml = buildEnvelope(CUIS, { b: 'x', a: 'y' });

    expect(xml.indexOf('<b>')).toBeLessThan(xml.indexOf('<a>'));
  });

  it('escapes text content', () => {
    const xml = buildEnvelope(VERIFICAR_NIT, {
      razonSocial: 'A & B <S.R.L.> "x" \'y\'',
    });

    expect(xml).toContain(
      '<razonSocial>A &amp; B &lt;S.R.L.&gt; &quot;x&quot; &apos;y&apos;</razonSocial>',
    );
  });

  it('writes null as xsi:nil and repeats arrays', () => {
    const xml = buildEnvelope(VERIFICAR_NIT, {
      codigoPuntoVenta: null,
      items: [{ n: 1 }, { n: 2 }],
    });

    expect(xml).toContain('<codigoPuntoVenta xsi:nil="true"/>');
    expect(xml).toContain('<items><n>1</n></items><items><n>2</n></items>');
  });

  it('drops undefined values', () => {
    const xml = buildEnvelope(CUIS, { codigoAmbiente: 2, cuis: undefined });

    expect(xml).not.toContain('<cuis>');
  });
});

describe('parseResponse', () => {
  it('maps a successful response to a typed result', () => {
    const result = parseResponse(CUIS_OK, CUIS);

    expect(result.transaccion).toBe(true);
    expect(result.mensajes).toEqual([
      { codigo: 908, descripcion: 'VALIDADA' },
      { codigo: 1, descripcion: 'Aviso' },
    ]);
    expect(result.payload.codigo).toBe('ABC123');
  });

  it('reads transaccion=false without throwing', () => {
    const xml = soapWithBody(
      '<ns2:cuisResponse><RespuestaCuis><transaccion>false</transaccion></RespuestaCuis></ns2:cuisResponse>',
    );

    expect(parseResponse(xml, CUIS).transaccion).toBe(false);
    expect(parseResponse(xml, CUIS).mensajes).toEqual([]);
  });

  it('reads codigoEstado as a number when present', () => {
    const xml = soapWithBody(
      '<ns2:verificarNitResponse><RespuestaVerificarNit><codigoEstado>1</codigoEstado><transaccion>true</transaccion></RespuestaVerificarNit></ns2:verificarNitResponse>',
    );

    expect(parseResponse(xml, VERIFICAR_NIT).codigoEstado).toBe(1);
  });

  it('throws SiatFaultError for a SOAP fault', () => {
    const xml = soapWithBody(
      '<soap:Fault><faultcode>soap:Server</faultcode><faultstring>Token inválido</faultstring></soap:Fault>',
    );

    expect(() => parseResponse(xml, CUIS)).toThrow(SiatFaultError);
    expect(() => parseResponse(xml, CUIS)).toThrow('Token inválido');
  });

  it('throws SiatProtocolError when the body is not a SOAP envelope', () => {
    expect(() =>
      parseResponse('<html><body>Gateway</body></html>', CUIS),
    ).toThrow(SiatProtocolError);
  });

  it('throws SiatProtocolError for malformed XML', () => {
    expect(() => parseResponse('<soap:Envelope><soap:Body>', CUIS)).toThrow(
      SiatProtocolError,
    );
  });

  it('throws SiatProtocolError when the operation response element is missing', () => {
    const xml = soapWithBody('<ns2:otraCosa/>');

    expect(() => parseResponse(xml, CUIS)).toThrow(SiatProtocolError);
  });

  it('throws SiatProtocolError when transaccion is missing', () => {
    const xml = soapWithBody(
      '<ns2:cuisResponse><RespuestaCuis><codigo>X</codigo></RespuestaCuis></ns2:cuisResponse>',
    );

    expect(() => parseResponse(xml, CUIS)).toThrow(SiatProtocolError);
  });
});

describe('escapeXml', () => {
  it('escapes the five XML special characters', () => {
    expect(escapeXml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
  });
});
