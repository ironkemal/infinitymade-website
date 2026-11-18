// Typ-Hilfen für die Editor-Prüfung (checkJs). Wird NICHT ausgeliefert.

// Das Projekt hängt an Modul-URLs einen Cache-Buster: './signal.js?v=20260813'.
// Der Browser versteht das, die TypeScript-Auflösung nicht — sie sucht nach
// einer Datei, die wörtlich '?v=...' heißt. Ohne diese Deklaration meldet jeder
// interne Import "Cannot find module".
//
// Preis: solche Importe sind für den Editor `any`, verlieren also ihre Typen.
// Wer volle Typen im Editor will, importiert modul-zu-modul OHNE '?v=' und
// setzt den Cache-Buster nur dort, wo HTML das Einstiegsmodul lädt.
declare module '*?v=*';
declare module './datum.js?v=*';
declare module './kvnr.js?v=*';
declare module './podo-behandlungstag-regel.js?v=*';
declare module './standort-plan-regel.js?v=*';
declare module './verordnung-regeln.js?v=*';
declare module './api-sitzung.js?v=*';

// Sentry kommt per CDN-Loader ins Fenster, nicht als npm-Paket.
interface Window {
  Sentry?: {
    captureException: (err: unknown, ctx?: Record<string, unknown>) => void;
    captureMessage?: (msg: string, ctx?: Record<string, unknown>) => void;
  };
  Cropper?: any;
}

declare var Cropper: any;

// Backend-Abhängigkeiten ohne eigene TypeScript-Deklarationen (.d.ts) in api-backend/node_modules.
declare module 'express' {
  export interface AuthContext {
    userId?: string | null;
    tenantId?: string | null;
    role?: string | null;
    email?: string | null;
    standortIds?: string[] | null;
    [key: string]: any;
  }

  export interface Request extends import('node:http').IncomingMessage {
    body: any;
    params: Record<string, string>;
    query: Record<string, any>;
    headers: Record<string, string | string[] | undefined>;
    method?: string;
    url?: string;
    path: string;
    originalUrl: string;
    baseUrl: string;
    ip?: string;
    ips: string[];
    protocol: string;
    secure: boolean;
    hostname: string;
    auth?: AuthContext;
    get(name: string): string | undefined;
    header(name: string): string | undefined;
    is(type: string | string[]): string | false | null;
    app: Application;
  }

  export interface Response extends import('node:http').ServerResponse {
    locals: Record<string, any>;
    headersSent: boolean;
    status(code: number): this;
    sendStatus(code: number): this;
    json(body?: any): this;
    jsonp(body?: any): this;
    send(body?: any): this;
    set(field: string | Record<string, string | string[]>, value?: string | string[]): this;
    header(field: string | Record<string, string | string[]>, value?: string | string[]): this;
    type(type: string): this;
    contentType(type: string): this;
    sendFile(path: string, options?: any, fn?: (err: Error) => void): void;
    redirect(statusOrUrl: number | string, url?: string): void;
    cookie(name: string, val: any, options?: any): this;
    clearCookie(name: string, options?: any): this;
  }

  export type NextFunction = (err?: any) => void;
  export type RequestHandler = (req: Request, res: Response, next: NextFunction) => any;
  export type ErrorRequestHandler = (err: any, req: Request, res: Response, next: NextFunction) => any;
  type Handler = RequestHandler | ErrorRequestHandler;
  type LooseHandler = ((req: any, res: any, next?: any) => any) | Function;

  export interface IRouter {
    use(path: string | RegExp | string[] | Handler, ...handlers: Array<Handler | IRouter>): this;
    use(path: string | RegExp | string[] | LooseHandler | IRouter, ...handlers: Array<LooseHandler | IRouter>): this;
    get(path: string | RegExp | string[], ...handlers: Array<Handler | IRouter>): this;
    get(path: string | RegExp | string[], ...handlers: Array<LooseHandler | IRouter>): this;
    post(path: string | RegExp | string[], ...handlers: Array<Handler | IRouter>): this;
    post(path: string | RegExp | string[], ...handlers: Array<LooseHandler | IRouter>): this;
    put(path: string | RegExp | string[], ...handlers: Array<Handler | IRouter>): this;
    put(path: string | RegExp | string[], ...handlers: Array<LooseHandler | IRouter>): this;
    patch(path: string | RegExp | string[], ...handlers: Array<Handler | IRouter>): this;
    patch(path: string | RegExp | string[], ...handlers: Array<LooseHandler | IRouter>): this;
    delete(path: string | RegExp | string[], ...handlers: Array<Handler | IRouter>): this;
    delete(path: string | RegExp | string[], ...handlers: Array<LooseHandler | IRouter>): this;
    all(path: string | RegExp | string[], ...handlers: Array<Handler | IRouter>): this;
    all(path: string | RegExp | string[], ...handlers: Array<LooseHandler | IRouter>): this;
  }

  export interface Router extends IRouter {
    (req: any, res: any, next?: NextFunction): any;
  }

  export interface Application extends IRouter {
    (req: import('node:http').IncomingMessage | Request, res: import('node:http').ServerResponse | Response, next?: NextFunction): any;
    set(setting: string, val: any): this;
    get(name: string): any;
    get(path: string | RegExp | string[], ...handlers: Array<Handler | IRouter>): this;
    disable(setting: string): this;
    enable(setting: string): this;
    listen(port: number, hostname?: string, callback?: () => void): import('node:http').Server;
    listen(port: number, callback?: () => void): import('node:http').Server;
  }

  export interface Express extends Application {}

  interface ExpressFactory {
    (): Express;
    Router(options?: { caseSensitive?: boolean; mergeParams?: boolean; strict?: boolean }): Router;
    json(options?: { limit?: string | number; verify?: (req: Request, res: Response, buf: Buffer, encoding: string) => void }): RequestHandler;
    raw(options?: { limit?: string | number; type?: string | string[] | ((req: Request) => boolean) }): RequestHandler;
    text(options?: { limit?: string | number; type?: string | string[] }): RequestHandler;
    urlencoded(options?: { extended?: boolean; limit?: string | number }): RequestHandler;
    static(root: string, options?: Record<string, unknown>): RequestHandler;
  }

  export const Router: ExpressFactory['Router'];
  export const json: ExpressFactory['json'];
  export const raw: ExpressFactory['raw'];
  export const text: ExpressFactory['text'];
  export const urlencoded: ExpressFactory['urlencoded'];
  const expressFn: ExpressFactory;
  export default expressFn;
}

declare module 'node-forge' {
  namespace forge {
    namespace pki {
      interface CertificateField {
        name?: string;
        shortName?: string;
        type?: string;
        value?: string;
      }
      interface CertificateExtension {
        name?: string;
        [key: string]: any;
      }
      interface Certificate {
        publicKey: any;
        privateKey?: any;
        serialNumber: string;
        validity: { notBefore: Date; notAfter: Date };
        subject: { attributes: CertificateField[]; getField(sn: string | { name?: string; shortName?: string }): CertificateField | null };
        issuer: { attributes: CertificateField[]; getField(sn: string | { name?: string; shortName?: string }): CertificateField | null };
        setSubject(attrs: CertificateField[]): void;
        setIssuer(attrs: CertificateField[]): void;
        setExtensions(exts: CertificateExtension[]): void;
        getExtension(options: string | { name?: string; id?: string }): any;
        sign(key: any, md?: any): void;
      }
      namespace rsa {
        function generateKeyPair(options?: { bits?: number; workers?: number; e?: number }): { publicKey: any; privateKey: any };
      }
      const oids: Record<string, string>;
      function createCertificate(): Certificate;
      function certificateToAsn1(cert: Certificate): asn1.Asn1;
      function certificateFromAsn1(obj: asn1.Asn1, computeHash?: boolean): Certificate;
      function certificateToPem(cert: Certificate): string;
      function certificateFromPem(pem: string): Certificate;
      function publicKeyFromPem(pem: string): any;
      function privateKeyFromPem(pem: string): any;
    }
    namespace asn1 {
      interface Asn1 {
        tagClass: number;
        type: number;
        constructed: boolean;
        composed: boolean;
        value: any;
      }
      const Type: Record<string, number>;
      const Class: Record<string, number>;
      function toDer(obj: Asn1): util.ByteStringBuffer;
      function fromDer(bytes: string | util.ByteStringBuffer): Asn1;
    }
    namespace util {
      interface ByteStringBuffer {
        getBytes(count?: number): string;
        toHex(): string;
        length(): number;
      }
      function createBuffer(input?: string | Uint8Array, encoding?: string): ByteStringBuffer;
      function encode64(bytes: string): string;
      function decode64(encoded: string): string;
    }
    namespace md {
      interface MessageDigest {
        update(msg: string, encoding?: string): MessageDigest;
        digest(): util.ByteStringBuffer;
      }
      const sha256: { create(): MessageDigest };
      const sha512: { create(): MessageDigest };
    }
    namespace pkcs7 {
      interface PkcsSignedData {
        content?: util.ByteStringBuffer | string;
        addCertificate(cert: pki.Certificate | string): void;
        addSigner(opts: {
          key: any;
          certificate: pki.Certificate | string;
          digestAlgorithm: string;
          authenticatedAttributes?: Array<{ type: string; value?: any }>;
        }): void;
        sign(opts?: { detached?: boolean }): void;
        toAsn1(): asn1.Asn1;
      }
      function createSignedData(): PkcsSignedData;
      function messageFromPem(pem: string): any;
      function messageFromAsn1(obj: asn1.Asn1): any;
    }
  }
  export default forge;
}

declare module 'pdfkit' {
  interface PDFTextOptions {
    width?: number;
    align?: 'left' | 'center' | 'right' | 'justify';
    continued?: boolean;
    lineGap?: number;
    underline?: boolean;
    [key: string]: any;
  }
  class PDFDocument extends import('node:events').EventEmitter {
    constructor(options?: Record<string, any>);
    y: number;
    x: number;
    page: { width: number; height: number; margins: { top: number; bottom: number; left: number; right: number } };
    font(src: string, size?: number): this;
    fontSize(size: number): this;
    fillColor(color: string, opacity?: number): this;
    strokeColor(color: string, opacity?: number): this;
    lineWidth(w: number): this;
    text(text: string, x?: number | PDFTextOptions, y?: number | PDFTextOptions, options?: PDFTextOptions): this;
    moveDown(lines?: number): this;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    rect(x: number, y: number, w: number, h: number): this;
    fill(color?: string): this;
    stroke(color?: string): this;
    addPage(options?: Record<string, any>): this;
    end(): void;
  }
  export default PDFDocument;
}

declare module 'yauzl' {
  export interface Entry {
    fileName: string;
    uncompressedSize: number;
    compressedSize: number;
  }
  export interface ZipFile extends import('node:events').EventEmitter {
    readEntry(): void;
    openReadStream(entry: Entry, cb: (err: Error | null, stream: import('node:stream').Readable) => void): void;
    close(): void;
  }
  export function fromBuffer(
    buffer: Buffer,
    options: { lazyEntries?: boolean },
    cb: (err: Error | null, zipfile: ZipFile) => void
  ): void;
  const yauzlDefault: { fromBuffer: typeof fromBuffer };
  export default yauzlDefault;
}

declare module 'cors' {
  import type { RequestHandler } from 'express';
  export interface CorsOptions {
    origin?: boolean | string | RegExp | Array<string | RegExp> | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void);
    credentials?: boolean;
    methods?: string | string[];
    allowedHeaders?: string | string[];
    [key: string]: any;
  }
  export default function cors(options?: CorsOptions): RequestHandler;
}

declare module 'ws' {
  class WebSocket extends import('node:events').EventEmitter {
    constructor(address: string | URL, protocols?: string | string[], options?: Record<string, any>);
    readyState: number;
    send(data: any, cb?: (err?: Error) => void): void;
    close(code?: number, data?: string | Buffer): void;
    static readonly OPEN: number;
    static readonly CLOSED: number;
  }
  export default WebSocket;
}

declare module 'nodemailer' {
  export interface SendMailOptions {
    from?: string | { name: string; address: string };
    to?: string | string[];
    replyTo?: string | string[];
    subject?: string;
    text?: string;
    html?: string;
    attachments?: Array<{ filename?: string; content?: string | Buffer; contentType?: string }>;
    [key: string]: any;
  }
  export interface SentMessageInfo {
    messageId?: string;
    accepted?: string[];
    rejected?: string[];
    response?: string;
    envelope?: Record<string, any>;
    message?: Buffer | string;
  }
  export interface Transporter {
    sendMail(mailOptions: SendMailOptions): Promise<SentMessageInfo>;
    verify(): Promise<boolean>;
    close?(): void;
  }
  export interface TransportOptions {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: { user?: string; pass?: string };
    requireTLS?: boolean;
    tls?: Record<string, any>;
    streamTransport?: boolean;
    buffer?: boolean;
    newline?: string;
    connectionTimeout?: number;
    greetingTimeout?: number;
    socketTimeout?: number;
    [key: string]: any;
  }
  export function createTransport(options?: TransportOptions): Transporter;
  const nodemailerDefault: { createTransport: typeof createTransport };
  export default nodemailerDefault;
}

