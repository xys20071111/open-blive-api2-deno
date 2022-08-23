import { events } from './deps.ts'
import { IAnchorInfo } from './IAnchorInfo.ts'
import { BLiveApi } from './blive_requester.ts'
import { DanmakuReceiver } from "./danmaku_receiver.ts"

interface IGameInfo {
    // 场次
    game_id: string
}

interface IWebSocketInfo {
    // 认证信息
    auth_body: string
    // 弹幕服务器数组
    wss_link: Array<string>
}

interface IInteractiveInfo {
    game_info: IGameInfo
    websocket_info: IWebSocketInfo
    anchor_info: IAnchorInfo
}

export class InteractiveInstence extends events.default {
    private readonly appId: number
    private readonly liverId: string
    private danmakuReceiverInstence: DanmakuReceiver | null = null
    private gameId: string | null = null
    private anchorInfo: IAnchorInfo | null = null
    private requester: BLiveApi
    constructor(appId: number, liverId: string, requester: BLiveApi) {
        super()
        this.appId = appId
        this.liverId = liverId
        this.requester = requester
    }
    public connect() {
        this.requester.request('/v2/app/start', {
            code: this.liverId,
            app_id: this.appId
        }).then((data: IInteractiveInfo) => {
            this.gameId = data.game_info.game_id
            this.anchorInfo = data.anchor_info
            this.danmakuReceiverInstence = new DanmakuReceiver(data.websocket_info.wss_link[0], data.websocket_info.auth_body)
            this.danmakuReceiverInstence.on('connected', () => this.emit('connected'))
            this.danmakuReceiverInstence.on('error', () => {
                this.emit('error', 122);
            })
            this.danmakuReceiverInstence.connect()
        }).catch((code: number) => {
            this.emit('error', code)
        })
    }
    public getDanmakuReceiver(): DanmakuReceiver | null {
        return this.danmakuReceiverInstence
    }

    public getGameId(): string | null {
        return this.gameId
    }
    public getAnchorInfo(): IAnchorInfo | null {
        return this.anchorInfo
    }
}
