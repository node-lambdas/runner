import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import require$$0 from 'buffer';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

var safeBuffer = {exports: {}};

/*! safe-buffer. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */

(function (module, exports) {
	/* eslint-disable node/no-deprecated-api */
	var buffer = require$$0;
	var Buffer = buffer.Buffer;

	// alternative to using Object.keys for old browsers
	function copyProps (src, dst) {
	  for (var key in src) {
	    dst[key] = src[key];
	  }
	}
	if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) {
	  module.exports = buffer;
	} else {
	  // Copy properties from require('buffer')
	  copyProps(buffer, exports);
	  exports.Buffer = SafeBuffer;
	}

	function SafeBuffer (arg, encodingOrOffset, length) {
	  return Buffer(arg, encodingOrOffset, length)
	}

	SafeBuffer.prototype = Object.create(Buffer.prototype);

	// Copy static methods from Buffer
	copyProps(Buffer, SafeBuffer);

	SafeBuffer.from = function (arg, encodingOrOffset, length) {
	  if (typeof arg === 'number') {
	    throw new TypeError('Argument must not be a number')
	  }
	  return Buffer(arg, encodingOrOffset, length)
	};

	SafeBuffer.alloc = function (size, fill, encoding) {
	  if (typeof size !== 'number') {
	    throw new TypeError('Argument must be a number')
	  }
	  var buf = Buffer(size);
	  if (fill !== undefined) {
	    if (typeof encoding === 'string') {
	      buf.fill(fill, encoding);
	    } else {
	      buf.fill(fill);
	    }
	  } else {
	    buf.fill(0);
	  }
	  return buf
	};

	SafeBuffer.allocUnsafe = function (size) {
	  if (typeof size !== 'number') {
	    throw new TypeError('Argument must be a number')
	  }
	  return Buffer(size)
	};

	SafeBuffer.allocUnsafeSlow = function (size) {
	  if (typeof size !== 'number') {
	    throw new TypeError('Argument must be a number')
	  }
	  return buffer.SlowBuffer(size)
	};
} (safeBuffer, safeBuffer.exports));

/*<replacement>*/

var Buffer$1 = safeBuffer.exports.Buffer;
/*</replacement>*/

var isEncoding = Buffer$1.isEncoding || function (encoding) {
  encoding = '' + encoding;
  switch (encoding && encoding.toLowerCase()) {
    case 'hex':case 'utf8':case 'utf-8':case 'ascii':case 'binary':case 'base64':case 'ucs2':case 'ucs-2':case 'utf16le':case 'utf-16le':case 'raw':
      return true;
    default:
      return false;
  }
};

function _normalizeEncoding(enc) {
  if (!enc) return 'utf8';
  var retried;
  while (true) {
    switch (enc) {
      case 'utf8':
      case 'utf-8':
        return 'utf8';
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return 'utf16le';
      case 'latin1':
      case 'binary':
        return 'latin1';
      case 'base64':
      case 'ascii':
      case 'hex':
        return enc;
      default:
        if (retried) return; // undefined
        enc = ('' + enc).toLowerCase();
        retried = true;
    }
  }
}
// Do not cache `Buffer.isEncoding` when checking encoding names as some
// modules monkey-patch it to support additional encodings
function normalizeEncoding(enc) {
  var nenc = _normalizeEncoding(enc);
  if (typeof nenc !== 'string' && (Buffer$1.isEncoding === isEncoding || !isEncoding(enc))) throw new Error('Unknown encoding: ' + enc);
  return nenc || enc;
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters.
var StringDecoder_1 = StringDecoder;
function StringDecoder(encoding) {
  this.encoding = normalizeEncoding(encoding);
  var nb;
  switch (this.encoding) {
    case 'utf16le':
      this.text = utf16Text;
      this.end = utf16End;
      nb = 4;
      break;
    case 'utf8':
      this.fillLast = utf8FillLast;
      nb = 4;
      break;
    case 'base64':
      this.text = base64Text;
      this.end = base64End;
      nb = 3;
      break;
    default:
      this.write = simpleWrite;
      this.end = simpleEnd;
      return;
  }
  this.lastNeed = 0;
  this.lastTotal = 0;
  this.lastChar = Buffer$1.allocUnsafe(nb);
}

StringDecoder.prototype.write = function (buf) {
  if (buf.length === 0) return '';
  var r;
  var i;
  if (this.lastNeed) {
    r = this.fillLast(buf);
    if (r === undefined) return '';
    i = this.lastNeed;
    this.lastNeed = 0;
  } else {
    i = 0;
  }
  if (i < buf.length) return r ? r + this.text(buf, i) : this.text(buf, i);
  return r || '';
};

StringDecoder.prototype.end = utf8End;

// Returns only complete characters in a Buffer
StringDecoder.prototype.text = utf8Text;

// Attempts to complete a partial non-UTF-8 character using bytes from a Buffer
StringDecoder.prototype.fillLast = function (buf) {
  if (this.lastNeed <= buf.length) {
    buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
    return this.lastChar.toString(this.encoding, 0, this.lastTotal);
  }
  buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
  this.lastNeed -= buf.length;
};

// Checks the type of a UTF-8 byte, whether it's ASCII, a leading byte, or a
// continuation byte. If an invalid byte is detected, -2 is returned.
function utf8CheckByte(byte) {
  if (byte <= 0x7F) return 0;else if (byte >> 5 === 0x06) return 2;else if (byte >> 4 === 0x0E) return 3;else if (byte >> 3 === 0x1E) return 4;
  return byte >> 6 === 0x02 ? -1 : -2;
}

// Checks at most 3 bytes at the end of a Buffer in order to detect an
// incomplete multi-byte UTF-8 character. The total number of bytes (2, 3, or 4)
// needed to complete the UTF-8 character (if applicable) are returned.
function utf8CheckIncomplete(self, buf, i) {
  var j = buf.length - 1;
  if (j < i) return 0;
  var nb = utf8CheckByte(buf[j]);
  if (nb >= 0) {
    if (nb > 0) self.lastNeed = nb - 1;
    return nb;
  }
  if (--j < i || nb === -2) return 0;
  nb = utf8CheckByte(buf[j]);
  if (nb >= 0) {
    if (nb > 0) self.lastNeed = nb - 2;
    return nb;
  }
  if (--j < i || nb === -2) return 0;
  nb = utf8CheckByte(buf[j]);
  if (nb >= 0) {
    if (nb > 0) {
      if (nb === 2) nb = 0;else self.lastNeed = nb - 3;
    }
    return nb;
  }
  return 0;
}

// Validates as many continuation bytes for a multi-byte UTF-8 character as
// needed or are available. If we see a non-continuation byte where we expect
// one, we "replace" the validated continuation bytes we've seen so far with
// a single UTF-8 replacement character ('\ufffd'), to match v8's UTF-8 decoding
// behavior. The continuation byte check is included three times in the case
// where all of the continuation bytes for a character exist in the same buffer.
// It is also done this way as a slight performance increase instead of using a
// loop.
function utf8CheckExtraBytes(self, buf, p) {
  if ((buf[0] & 0xC0) !== 0x80) {
    self.lastNeed = 0;
    return '\ufffd';
  }
  if (self.lastNeed > 1 && buf.length > 1) {
    if ((buf[1] & 0xC0) !== 0x80) {
      self.lastNeed = 1;
      return '\ufffd';
    }
    if (self.lastNeed > 2 && buf.length > 2) {
      if ((buf[2] & 0xC0) !== 0x80) {
        self.lastNeed = 2;
        return '\ufffd';
      }
    }
  }
}

// Attempts to complete a multi-byte UTF-8 character using bytes from a Buffer.
function utf8FillLast(buf) {
  var p = this.lastTotal - this.lastNeed;
  var r = utf8CheckExtraBytes(this, buf);
  if (r !== undefined) return r;
  if (this.lastNeed <= buf.length) {
    buf.copy(this.lastChar, p, 0, this.lastNeed);
    return this.lastChar.toString(this.encoding, 0, this.lastTotal);
  }
  buf.copy(this.lastChar, p, 0, buf.length);
  this.lastNeed -= buf.length;
}

// Returns all complete UTF-8 characters in a Buffer. If the Buffer ended on a
// partial character, the character's bytes are buffered until the required
// number of bytes are available.
function utf8Text(buf, i) {
  var total = utf8CheckIncomplete(this, buf, i);
  if (!this.lastNeed) return buf.toString('utf8', i);
  this.lastTotal = total;
  var end = buf.length - (total - this.lastNeed);
  buf.copy(this.lastChar, 0, end);
  return buf.toString('utf8', i, end);
}

// For UTF-8, a replacement character is added when ending on a partial
// character.
function utf8End(buf) {
  var r = buf && buf.length ? this.write(buf) : '';
  if (this.lastNeed) return r + '\ufffd';
  return r;
}

// UTF-16LE typically needs two bytes per character, but even if we have an even
// number of bytes available, we need to check if we end on a leading/high
// surrogate. In that case, we need to wait for the next two bytes in order to
// decode the last character properly.
function utf16Text(buf, i) {
  if ((buf.length - i) % 2 === 0) {
    var r = buf.toString('utf16le', i);
    if (r) {
      var c = r.charCodeAt(r.length - 1);
      if (c >= 0xD800 && c <= 0xDBFF) {
        this.lastNeed = 2;
        this.lastTotal = 4;
        this.lastChar[0] = buf[buf.length - 2];
        this.lastChar[1] = buf[buf.length - 1];
        return r.slice(0, -1);
      }
    }
    return r;
  }
  this.lastNeed = 1;
  this.lastTotal = 2;
  this.lastChar[0] = buf[buf.length - 1];
  return buf.toString('utf16le', i, buf.length - 1);
}

// For UTF-16LE we do not explicitly append special replacement characters if we
// end on a partial character, we simply let v8 handle that.
function utf16End(buf) {
  var r = buf && buf.length ? this.write(buf) : '';
  if (this.lastNeed) {
    var end = this.lastTotal - this.lastNeed;
    return r + this.lastChar.toString('utf16le', 0, end);
  }
  return r;
}

function base64Text(buf, i) {
  var n = (buf.length - i) % 3;
  if (n === 0) return buf.toString('base64', i);
  this.lastNeed = 3 - n;
  this.lastTotal = 3;
  if (n === 1) {
    this.lastChar[0] = buf[buf.length - 1];
  } else {
    this.lastChar[0] = buf[buf.length - 2];
    this.lastChar[1] = buf[buf.length - 1];
  }
  return buf.toString('base64', i, buf.length - n);
}

function base64End(buf) {
  var r = buf && buf.length ? this.write(buf) : '';
  if (this.lastNeed) return r + this.lastChar.toString('base64', 0, 3 - this.lastNeed);
  return r;
}

// Pass bytes on through for single-byte encodings (e.g. ascii, latin1, hex)
function simpleWrite(buf) {
  return buf.toString(this.encoding);
}

function simpleEnd(buf) {
  return buf && buf.length ? this.write(buf) : '';
}

class Process extends EventEmitter {
    get hasError() {
        return Boolean((this._errorBuffer.length && this.code !== 0) || this.code !== 0 || this.error);
    }
    constructor(childProcess) {
        super();
        this.childProcess = childProcess;
        this.code = 0;
        this.completed = false;
        this._outputBuffer = '';
        this._errorBuffer = '';
        this.stdoutDecoder = new StringDecoder_1();
        this.stderrDecoder = new StringDecoder_1();
        childProcess.stdout?.on('data', (data) => (this.stdout = data));
        childProcess.stderr?.on('data', (data) => (this.stderr = data));
        childProcess.on('exit', (code) => (this.code = code));
        childProcess.on('close', () => this.complete());
        childProcess.on('error', (error) => (this.error = error));
    }
    set stdout(value) {
        this._outputBuffer += this.stdoutDecoder.write(value);
    }
    set stderr(value) {
        this._errorBuffer += this.stderrDecoder.write(value);
    }
    complete() {
        this.completed = true;
        this._outputBuffer += this.stdoutDecoder.end();
        this._errorBuffer += this.stderrDecoder.end();
        this.emit('done', this.output);
    }
    get output() {
        return {
            ok: !this.hasError && this.code === 0,
            code: this.error ? -1 : this.code,
            stdout: this._outputBuffer,
            stderr: this._errorBuffer,
            error: this.hasError ? new Error(this._errorBuffer) : undefined,
        };
    }
}
async function exec(command, args = [], options) {
    /* istanbul ignore next */
    process.env.DEBUG && console.log(command, args, options);
    return execInternal(() => spawn(command, args, options));
}
function execInternal(runner) {
    return new Promise((resolve, reject) => {
        try {
            const childProcess = runner();
            const state = new Process(childProcess);
            state.on('done', () => resolve(state.output));
        }
        catch (error) {
            reject(error);
        }
    });
}

var HttpMethod;
(function (HttpMethod) {
    HttpMethod["Get"] = "GET";
    HttpMethod["Options"] = "OPTIONS";
    HttpMethod["Post"] = "POST";
    HttpMethod["Head"] = "HEAD";
})(HttpMethod || (HttpMethod = {}));
const uid = (size = 16) => randomBytes(size).toString('hex');
const toJson = (x, inOneLine = false) => JSON.stringify(x, null, inOneLine ? 0 : 2);
const timestamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const tryToParseJson = (data) => {
    try {
        return JSON.parse(data);
    }
    catch {
        return null;
    }
};

const ansiCodes = {
    error: '\u001b[33;1m',
    info: '\u001b[34;1m',
    log: '\u001b[37;1m',
    reset: '\u001b[0m',
};
const Console = {
    write(type, ...values) {
        const output = type === 'error' ? console.error : console.log;
        output(ansiCodes[type], ...values, ansiCodes.reset);
    },
    log(...args) {
        Console.write('log', ...args);
    },
    info(...args) {
        Console.write('info', ...args);
    },
    error(...args) {
        Console.write('error', ...args);
    },
    debug(...args) {
        if (process.env.DEBUG) {
            console.error(...args);
        }
    }
};

class HttpServer {
    constructor() {
        this.server = createServer((request, response) => this.dispatch(request, response));
        this.server.listen(process.env.PORT);
    }
    async dispatch(request, response) {
        try {
            const { method } = request;
            switch (true) {
                case method === HttpMethod.Get: {
                    if (request.url === "/index.mjs" || request.url === "/index.js") {
                        return this.sendEsModule(request, response);
                    }
                    return this.sendLambdaDocumentation(request, response);
                }
                case method === HttpMethod.Options: {
                    if (request.url === "/api") {
                        return this.sendApiDescription(request, response);
                    }
                    return this.sendCorsPreflight(request, response);
                }
                case method === HttpMethod.Head && request.url === "/health":
                    return this.sendHealthCheckResponse(request, response);
                case method !== HttpMethod.Post:
                    return this.sendMethodNotAllowed(request, response);
                default:
                    return this.executeLambda(request, response);
            }
        }
        catch (error) {
            this.onError(response, error);
        }
    }
    async sendApiDescription($request, $response) {
        this.setCorsHeaders($request, $response);
        const description = this.describeApi();
        Console.debug(description);
        $response.end(JSON.stringify(description, null, 2));
    }
    async sendEsModule($request, $response) {
        const description = this.describeApi();
        const fnName = String(process.env.FN_NAME || $request.headers["x-forwarded-for"] || "").replace(".jsfn.run", "");
        const outputMap = {
            json: "response.json()",
            text: "response.text()",
            dom: "__d(await response.text())",
        };
        const lines = description.map((_) => [
            _.default ? "export default " : "",
            `async function ${_.name}(i,o = {}) {`,
            `${(_.input === "json" && "i=JSON.stringify(i||{});") || ""}`,
            `const response=await fetch('https://${fnName}.jsfn.run/${_.name}?' + __s(o),{mode:'cors',method:'POST',body:i});`,
            `return ${outputMap[_.output] || ""};}`,
        ].join(""));
        lines.push(`const __s=(o={})=>new URLSearchParams(o).toString();`);
        lines.push(`const __d=(h,t,s,z,d=document)=>{
t=d.createElement('template');t.innerHTML=h;z=t.content.cloneNode(true);t=[];
z.querySelectorAll('script,style').forEach(n=>{
s=d.createElement(n.nodeName.toLowerCase());
s.innerHTML=n.innerHTML;s.type=n.type;t.push(s);n.remove();
});return [...z.childNodes,...t].map(n=>d.body.append(n)),''}`);
        lines.push("export { " + description.map((f) => f.name).join(", ") + " }");
        this.setCorsHeaders($request, $response);
        $response.setHeader("content-type", "text/javascript");
        $response.end(lines.join("\n"));
    }
    async executeLambda($request, $response) {
        this.setCorsHeaders($request, $response);
        this.onPrepare($request, $response);
        const { request, response } = await this.prepareInputAndOutput($request, $response);
        if (request.body === null && request.input === "json") {
            response.reject("Invalid JSON");
            return null;
        }
        return this.onRun(request, response);
    }
    onPipe(response, base64Header) {
        response.header("x-next", base64Header);
        response.end();
        this.logRequest(response);
    }
    onError(response, error) {
        Console.error("[error]", timestamp(), response.id, error);
        response.writeHead(500, { "X-Trace-Id": response.id });
        response.end("");
    }
    onSend(response, status, value) {
        const body = this.serialize(value, response.output);
        response.writeHead(status);
        response.end(body);
        this.logRequest(response);
    }
    sendMethodNotAllowed(_request, response) {
        response.setHeader("Connection", "close");
        response.writeHead(405);
        response.end("");
    }
    sendCorsPreflight(request, response) {
        this.setCorsHeaders(request, response);
        response.end();
    }
    sendHealthCheckResponse(_request, response) {
        response.setHeader("Connection", "close");
        response.writeHead(200);
        response.end();
    }
    sendLambdaDocumentation(_request, response) {
        response.setHeader("Location", "https://jsfn.run/?fn=" + process.env.FN_NAME);
        response.writeHead(302);
        response.end();
    }
    async prepareInputAndOutput($request, $response) {
        const request = $request;
        const response = $response;
        request.id = response.id = uid();
        response.request = request;
        await this.augmentRequest(request);
        await this.augmentResponse(response);
        return { request, response };
    }
    async augmentRequest(request) {
        request.asBuffer = () => this.readStream(request);
        request.asText = async () => (await request.asBuffer()).toString("utf-8");
        request.asJson = async () => JSON.parse(await request.asText());
        if (request.method === HttpMethod.Post && !!request.input) {
            await this.readRequest(request);
        }
    }
    async augmentResponse(response) {
        response.header = (name, value) => (response.setHeader(name, value), response);
        response.send = (status, body) => this.writeResponse(response, status, body);
        response.reject = (message) => this.writeResponse(response, 400, String(message || "Invalid input") + "\n");
        response.pipeTo = (name, params, action) => {
            const json = JSON.stringify({
                name,
                params,
                inputs: action ? [action] : undefined,
            });
            this.onPipe(response, Buffer.from(json).toString("base64"));
        };
        response.sendBuffer = (b) => {
            response.writeHead(200, { "Content-Type": "application/octet-stream" });
            response.end(b);
        };
        response.sendText = (b) => {
            response.writeHead(200, { "Content-Type": "text/plain" });
            response.end(b);
        };
        response.sendJson = (b) => {
            response.writeHead(200, { "Content-Type": "application/json" });
            response.end(JSON.stringify(b));
        };
    }
    writeResponse(response, status, body) {
        response.header("X-Trace-Id", response.id);
        if (typeof body === "undefined" && typeof status !== "number") {
            body = status;
            status = 200;
        }
        if (body instanceof Promise) {
            body.then((value) => this.onSend(response, status, value), (error) => this.onError(response, error));
            return;
        }
        if (body instanceof Error) {
            this.onError(response, body);
            return;
        }
        this.onSend(response, status, body);
    }
    async readStream(stream) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            stream.on("error", reject);
            stream.on("close", reject);
            stream.on("data", (chunk) => chunks.push(chunk));
            stream.on("end", () => resolve(Buffer.concat(chunks)));
        });
    }
    async readRequest(request) {
        return new Promise(async (resolve) => {
            if (!["json", "text", "buffer"].includes(request.input)) {
                resolve(null);
                return;
            }
            const buffer = await this.readStream(request);
            const inputFormat = request.input;
            switch (inputFormat) {
                case "json":
                    request.body = tryToParseJson(buffer.toString("utf8"));
                    break;
                case "text":
                    request.body = buffer.toString("utf8");
                    break;
                case "buffer":
                default:
                    request.body = buffer;
                    break;
            }
            resolve(null);
        });
    }
    setCorsHeaders(_request, response) {
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
    }
    serialize(value, format) {
        switch (format) {
            case "json":
                return toJson(value);
            case "text":
                return value && value.toString ? value.toString("utf8") : String(value);
            case "buffer":
            default:
                return Buffer.isBuffer(value) ? value : String(value);
        }
    }
    logRequest(response) {
        const { url, id } = response.request;
        Console.info("[info]", timestamp(), id, String(url), response.statusCode);
    }
}

const isNumberRe = /^[0-9]+$/;
const lambda$2 = (configuration) => new V2(configuration);
class V2 extends HttpServer {
    constructor(configuration) {
        super();
        this.configuration = configuration;
        if (!configuration.actions) {
            throw new Error('No actions were provided in the current configuration');
        }
        const { actions } = this.configuration;
        this.actions = { ...actions };
        this.setDefaultAction();
    }
    describeApi() {
        return Object.entries(this.configuration.actions).map(([name, value]) => {
            let { input = 'raw', output = 'raw', credentials = [], options = {}, description = '' } = value;
            return {
                name,
                input,
                output,
                credentials,
                options,
                description,
                default: !!value.default,
            };
        });
    }
    setDefaultAction() {
        Object.keys(this.actions).some((actionName) => {
            if (this.actions[actionName].default) {
                this.actions.default = this.actions[actionName];
                return true;
            }
        });
    }
    parseOption(value) {
        if (value === 'true' || value === 'false') {
            return value === 'true';
        }
        if (isNumberRe.test(String(value))) {
            return Number(value);
        }
        return value;
    }
    onPrepare($request, response) {
        const request = $request;
        request.parsedUrl = new URL(request.url, 'http://localhost');
        const actionName = request.parsedUrl.pathname.slice(1) || 'default';
        const action = this.actions[actionName] || null;
        if (!action)
            return;
        const { input, output } = action;
        const options = Array.from(request.parsedUrl.searchParams.entries()).map(([key, value]) => [
            key,
            this.parseOption(value),
        ]);
        request.options = Object.fromEntries(options);
        request.action = action;
        request.actionName = actionName;
        request.input = input;
        request.credentials = {};
        response.output = output;
        this.readCredentials(request, action);
    }
    readCredentials(request, action) {
        const requiredCredentials = action.credentials || [];
        if (requiredCredentials.length && request.headers.authorization) {
            const token = request.headers.authorization.replace(/\s*Bearer\s*/, '').trim();
            const json = Buffer.from(token, 'base64').toString('utf-8');
            const credentials = JSON.parse(json);
            requiredCredentials.forEach((key) => (request.credentials[key] = credentials[key]));
        }
    }
    onRun(request, response) {
        if (!request.action) {
            response.reject('Invalid action');
            return;
        }
        if (!request.action.handler) {
            response.reject('Not implemented');
            return;
        }
        request.action.handler(request, response);
    }
}

const lambda$1 = (configuration) => new V1(configuration);
class V1 extends HttpServer {
    constructor(configuration) {
        super();
        this.configuration = configuration;
    }
    onPrepare(request, response) {
        const { input, output } = this.configuration;
        request.input = input;
        response.output = output;
    }
    onRun(request, response) {
        return this.configuration.handler(request, response);
    }
    describeApi() {
        const { input, output } = this.configuration;
        return [{
                name: 'default',
                default: true,
                input: input || 'raw',
                output: output || 'raw',
                credentials: [],
                options: {}
            }];
    }
}

function lambda(configuration) {
    if (typeof configuration === 'function') {
        return lambda$1({ version: 1, handler: configuration });
    }
    switch (configuration.version || 1) {
        case 1:
            return lambda$1(configuration);
        case 2:
            return lambda$2(configuration);
        default:
            throw new Error('Invalid configuration');
    }
}

const workingDir = process.env.WORKING_DIR;
const repoUrl = (repo) => {
    const [owner, ref = 'main'] = repo.split(':');
    return `https://codeload.github.com/${owner}/zip/refs/heads/${ref}`;
};
async function main() {
    try {
        const source = getSource();
        if (source) {
            const filePath = await download(source);
            await extractFile(filePath);
        }
        await npmInstall();
        await startServer();
    }
    catch (error) {
        Console.error(`Failed to run`);
        Console.error(String(error));
        Console.debug(error.stack);
    }
}
function getSource() {
    const sourceRepo = process.env.REPOSITORY;
    const sourceUrl = process.env.SOURCE_URL;
    const source = !sourceUrl && sourceRepo ? repoUrl(sourceRepo) : sourceUrl;
    if (source) {
        Console.info('Using source at ' + source);
    }
    return source;
}
async function extractFile(filePath) {
    switch (true) {
        case filePath.endsWith('.tgz'):
            const tar = await exec('tar', ['xzf', workingDir, filePath]);
            if (!tar.ok) {
                throw new Error('Unable to extract file: ' + tar.stderr);
            }
            break;
        case filePath.endsWith('.zip'):
            const zip = await exec('unzip', ['-o', '-d', workingDir, filePath]);
            if (!zip.ok) {
                throw new Error('Unable to extract file: ' + zip.stderr);
            }
            break;
        default:
            throw new Error(`Unsupported file format at ${filePath}`);
    }
}
async function npmInstall() {
    let rootFolder;
    if (existsSync(join(workingDir, 'package.json'))) {
        rootFolder = workingDir;
    }
    const subFolder = (await readdir(workingDir))[0] || '';
    if (subFolder && existsSync(join(workingDir, subFolder, 'package.json'))) {
        rootFolder = join(workingDir, subFolder);
    }
    if (!rootFolder) {
        throw new Error(`Unable to find package.json at ${workingDir}`);
    }
    Console.info(`Installing dependencies at ${rootFolder}`);
    process.chdir(rootFolder);
    const npmi = await exec('npm', ['i', '--no-audit', '--no-fund'], { cwd: rootFolder });
    if (!npmi.ok) {
        Console.log(npmi.stdout);
        Console.error(npmi.stderr);
        throw new Error(`Failed to install dependencies`);
    }
    Console.log(npmi.stdout);
}
async function startServer() {
    const fn = await import(join(process.cwd(), 'index.js'));
    const configurations = fn['default'] || fn;
    const { server } = lambda(configurations);
    Console.info(`[${new Date().toISOString().slice(0, 16)}] started`);
    server.on('close', () => process.exit(1));
}
async function download(url) {
    let extension = '';
    if (url.endsWith('.tgz') || url.endsWith('.tar.gz')) {
        extension = '.tgz';
    }
    if (url.endsWith('.zip') || url.includes('zip/refs')) {
        extension = '.zip';
    }
    if (!extension) {
        throw new Error(`Unsupported format at ${url}`);
    }
    const filePath = '/tmp/fn' + extension;
    if (existsSync(filePath) && process.env.USE_CACHED) {
        return filePath;
    }
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download ${url}: ${await response.text()}`);
    }
    const file = Buffer.from(await response.arrayBuffer());
    await writeFile(filePath, file);
    return filePath;
}
main();
