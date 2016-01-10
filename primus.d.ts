declare module "primus" {
    import * as http from 'http';
    import {Socket} from "net";

    class Primus {
        socket: Socket;

        library():void;
        open(): void;
        write(data:any): void;
        on(event:string, cb:(spark:Spark)=>void):void;
        end():void;
        destroy():void;
        emits(event:string, parser:(next:any, parser:any) => void); // might be better tied to a TSD for https://github.com/primus/emits
        id(cb:(id:any)=>void):void;
        createSocket(options?:PrimusOptions):Socket;
        authorize(req:http.ClientRequest,done:()=>void):void;
        forEach(cb:(spark:Spark, id:string, connections:any) => void):void;
        before(event:string, cb:() => void): void;
        before(event:string, cb:(req:http.ClientRequest, res:http.ServerResponse) => void): void;
        before(event:string, cb:(req:http.ClientRequest, res:http.ServerResponse, next:any) => void): void;
        remove(name:string):void;
        enable(name:string):void;
        disable(name:string):void;
        use(name:string, plugin:Object);
        transform(event:string,cb:(packet:any)=>void):void;
        transforms(event:string, parser:(packet:any, next:any) => void); // might be better tied to a TSD for https://github.com/primus/emits
    }

    interface PrimusOptions {
        authorization?: Function;
        pathname?: string;
        parser?: string;
        transformer?: string;
        plugin?: Object;
        timeout?: number;
        global?: string;
        compression?: boolean;
        origins?:string;
        methods?:string;
        credentials?:boolean;
        maxAge?:string;
        headers?:boolean;
        exposed?:boolean;
        strategy?: any;
    }

    interface PrimusConnectOptions {
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
        }
    }

    interface Spark {
        headers:any[];
        address:string;
        query:string;
        id:string;
        request:http.ClientRequest;

        write(data:any):void;
        end(data?:any, options?:Object):void;
        emits(event:string, parser:(next:any, parser:any) => void); // might be better tied to a TSD for https://github.com/primus/emits
        on(event:string, cb:(data:any)=>void):void;
    }

    interface PrimusStatic {
        new (): Primus;
        new (server:http.Server, options?:PrimusOptions): Primus;
        connect(url:string, options?:PrimusConnectOptions): Primus;
    }

    var primus:PrimusStatic;

    export = primus;
}

