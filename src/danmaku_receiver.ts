import { events, brotli } from './deps.ts';

enum DANMAKU_PROTOCOL {
  JSON = 0,
  HEARTBEAT,
  ZIP,
  BROTLI,
}

enum DANMAKU_TYPE {
  HEARTBEAT = 2,
  HEARTBEAT_REPLY = 3,
  DATA = 5,
  AUTH = 7,
  AUTH_REPLY = 8,
}

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8");

export class DanmakuReceiver extends events.default {
  private readonly url: string
  private readonly authBody: string
  private ws: WebSocket | null = null;
  constructor(url: string, authBody: string) {
    super();
    this.url = url
    this.authBody = authBody
  }
  public connect() {
    this.ws = new WebSocket(this.url)
    this.ws.onopen = () => {
      this.ws!.send(this.generatePacket(
        1,
        7,
        this.authBody,
      ));
      this.ws!.onmessage = this.danmakuProcesser.bind(this);
    };
    this.ws.onclose = () => {
      this.emit("closed");
    };
  }
  private generatePacket(
    protocol: number,
    type: number,
    payload: string,
  ): ArrayBuffer {
    const payloadEncoded = encoder.encode(payload);
    const packetLength = 16 + payloadEncoded.length;
    const packet = new ArrayBuffer(packetLength);
    const packetArray = new Uint8Array(packet);
    const packetView = new DataView(packet);
    packetView.setInt32(0, packetLength); // 总长度
    packetView.setInt16(4, 16); // 头长度
    packetView.setUint16(6, protocol); // 协议类型
    packetView.setUint32(8, type); // 包类型
    packetView.setUint32(12, 1); // 一个常数
    packetArray.set(payloadEncoded, 16); //写入负载
    return packet;
  }
  private async danmakuProcesser(ev: MessageEvent<Blob>) {
    // 弹幕事件处理
    const msgPacket = await ev.data.arrayBuffer()
    const msgArray = new Uint8Array(msgPacket);
    const msg = new DataView(msgPacket);
    const packetProtocol = msg.getInt16(6);
    const packetType = msg.getInt32(8);
    const packetPayload: Uint8Array = msgArray.slice(16);
    let jsonData;
    switch (packetType) {
      case DANMAKU_TYPE.HEARTBEAT_REPLY:
        // 心跳包，不做处理
        break;
      case DANMAKU_TYPE.AUTH_REPLY:
        // 认证通过，每30秒发一次心跳包
        setInterval(() => {
          const heartbeatPayload = "陈睿你妈死了";
          if (this.ws) {
            this.ws.send(this.generatePacket(1, 2, heartbeatPayload));
          }
        }, 30000);
        this.emit("connected");
        break;
      case DANMAKU_TYPE.DATA:
        switch (packetProtocol) {
          case DANMAKU_PROTOCOL.JSON:
            // 这些数据大都没用，但还是留着吧
            jsonData = JSON.parse(decoder.decode(packetPayload));
            this.emit(jsonData.cmd, jsonData.data);
            break;
          case DANMAKU_PROTOCOL.BROTLI: {
            const resultRaw = brotli.decompress(packetPayload);
            const result = new DataView(resultRaw.buffer);
            let offset = 0;
            while (offset < resultRaw.length) {
              const length = result.getUint32(offset);
              const packetData = resultRaw.slice(offset + 16, offset + length);
              const data = JSON.parse(decoder.decode(packetData));
              const cmd = data.cmd.split(":")[0];
              this.emit(cmd, data.info || data.data);
              offset += length;
            }
          }
        }
        break;
      default:
    }
  }
}
