declare module 'primus' {
    import * as http from 'http';
    import {Socket} from 'net';

    module e {
      interface Primus {
        socket: Socket;
        library(): void;
        open(): void;
        write(data: any): void;
        on(event: string, cb: (spark: ISpark) => void): void;
        end(): void;
        destroy(): void;
        emits(event: string, parser: (next: any, parser: any) => void): void; // might be better tied to a TSD for https://github.com/primus/emits
        id(cb: (id: any) => void): void;
        createSocket(options?: IPrimusOptions): Socket;
        authorize(req: http.ClientRequest, done: () => void): void;
        forEach(cb: (spark: ISpark, id: string, connections: any) => void): void;
        before(event: string, cb: () => void): void;
        before(event: string, cb: (req: http.ClientRequest, res: http.ServerResponse) => void): void;
        before(event: string, cb: (req: http.ClientRequest, res: http.ServerResponse, next: any) => void): void;
        remove(name: string): void;
        enable(name: string): void;
        disable(name: string): void;
        use(name: string, plugin: Object): void;
        transform(event: string, cb: (packet: any) => void): void;
        transforms(event: string, parser: (packet: any, next: any) => void): void; // might be better tied to a TSD for https://github.com/primus/emits
      }

      interface IPrimusOptions {
        authorization?: Function;
        pathname?: string;
        parser?: string;
        transformer?: string;
        plugin?: Object;
        timeout?: number;
        global?: string;
        compression?: boolean;
        origins?: string;
        methods?: string;
        credentials?: boolean;
        maxAge?: string;
        headers?: boolean;
        exposed?: boolean;
        strategy?: any;
      }

      interface IPrimusConnectOptions {
        timeout?: number;
        ping?: number;
        pong?: number;
        strategy?: string;
        manual?: boolean;
        websockets?: boolean;
        network?: boolean;
        transport?: any;
        queueSize?: any;
        reconnect?: {
          max?: any;
          min?: number;
          retries?: number;
          factor?: number;
        };
      }

      interface ISpark {
        headers: any[];
        address: string;
        query: string;
        id: string;
        request: http.ClientRequest;

        write(data: any): void;
        end(data?: any, options?: Object): void;
        emits(event: string, parser: (next: any, parser: any) => void): void; // might be better tied to a TSD for https://github.com/primus/emits
        on(event: string, cb: (data: any) => void): void;
      }

      interface IPrimusStatic {
        new(): Primus;
        new(server: http.Server, options?: IPrimusOptions): Primus;
        connect(url: string, options?: IPrimusConnectOptions): Primus;
      }
    }

    var e: e.IPrimusStatic;

    export = e;
}
